import React, { useMemo, useState } from "react";

// --- layout constants for the SVG wire diagram ---
const CELL_W = 64;
const ROW_H = 56;
const LEFT_MARGIN = 56;
const TOP_MARGIN = 24;
const GATE_SIZE = 34;

const SINGLE_GATES = ["h", "x", "y", "z", "s", "t", "rx", "ry", "rz"];
const MULTI_GATES = ["cx", "cz", "swap"];
const ROTATION = new Set(["rx", "ry", "rz"]);

const GATE_LABEL = { h: "H", x: "X", y: "Y", z: "Z", s: "S", t: "T", rx: "RX", ry: "RY", rz: "RZ" };

const PRESETS = {
  bell: { numQubits: 2, ops: [{ q: 0, col: 0, name: "h" }, { pair: [0, 1], col: 1, name: "cx" }] },
  ghz: {
    numQubits: 3,
    ops: [
      { q: 0, col: 0, name: "h" },
      { pair: [0, 1], col: 1, name: "cx" },
      { pair: [1, 2], col: 2, name: "cx" },
    ],
  },
};

function emptyGrid(numQubits, numColumns) {
  return Array.from({ length: numQubits }, () => Array.from({ length: numColumns }, () => null));
}

function buildFromPreset(preset) {
  const numColumns = Math.max(6, ...preset.ops.map((o) => o.col + 1));
  const grid = emptyGrid(preset.numQubits, numColumns);
  for (const op of preset.ops) {
    if (op.pair) {
      const [a, b] = op.pair;
      grid[a][op.col] = { kind: "multi", name: op.name, role: op.name === "cx" ? "control" : "a", pairQubit: b };
      grid[b][op.col] = { kind: "multi", name: op.name, role: op.name === "cx" ? "target" : "b", pairQubit: a };
    } else {
      grid[op.q][op.col] = { kind: "single", name: op.name, theta: op.theta };
    }
  }
  return grid;
}

/** Convert the grid into the flat gate list the backend expects, preserving column order. */
function gridToGates(grid, numQubits, numColumns) {
  const gates = [];
  for (let col = 0; col < numColumns; col++) {
    for (let q = 0; q < numQubits; q++) {
      const cell = grid[q][col];
      if (!cell) continue;
      if (cell.kind === "single") {
        const g = { name: cell.name, qubits: [q] };
        if (cell.theta !== undefined) g.theta = cell.theta;
        gates.push(g);
      } else if (cell.kind === "multi") {
        if (cell.role === "control" || cell.role === "a") {
          gates.push({ name: cell.name, qubits: [q, cell.pairQubit] });
        }
      }
    }
  }
  return gates;
}

function GatePopup({ popup, onChoose, onThetaConfirm, onCancel }) {
  const left = LEFT_MARGIN + popup.column * CELL_W + CELL_W / 2;
  const top = TOP_MARGIN + popup.qubit * ROW_H + ROW_H / 2;
  const [theta, setTheta] = useState(Math.PI / 2);

  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        transform: "translate(-50%, -110%)",
        background: "var(--bg-panel-raised)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "10px",
        zIndex: 10,
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        width: "220px",
      }}
    >
      {popup.step === "choose" && (
        <>
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)", marginBottom: "6px" }}>Add gate on q{popup.qubit}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {SINGLE_GATES.map((g) => (
              <button key={g} className="btn" style={{ padding: "4px 8px", fontSize: "var(--fs-xs)" }} onClick={() => onChoose(g)}>
                {GATE_LABEL[g]}
              </button>
            ))}
            {MULTI_GATES.map((g) => (
              <button key={g} className="btn" style={{ padding: "4px 8px", fontSize: "var(--fs-xs)", borderColor: "var(--qubit-1)" }} onClick={() => onChoose(g)}>
                {g.toUpperCase()}
              </button>
            ))}
          </div>
          <button onClick={onCancel} style={{ background: "none", border: "none", color: "var(--text-faint)", fontSize: "var(--fs-xs)", marginTop: "6px" }}>
            cancel
          </button>
        </>
      )}
      {popup.step === "theta" && (
        <>
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)", marginBottom: "6px" }}>
            Angle θ for {GATE_LABEL[popup.gateName]} (radians)
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            <input
              type="number" step="0.1" value={theta} autoFocus
              onChange={(e) => setTheta(Number(e.target.value))}
              style={{ width: "80px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--text-primary)", padding: "4px 8px" }}
            />
            <button className="btn btn-primary" style={{ padding: "4px 10px", fontSize: "var(--fs-xs)" }} onClick={() => onThetaConfirm(theta)}>
              Place
            </button>
          </div>
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-faint)", marginTop: "4px" }}>π ≈ 3.1416, π/2 ≈ 1.5708</div>
        </>
      )}
    </div>
  );
}

export default function CircuitBuilder({ running, error, onRun, noisy, setNoisy }) {
  const [numQubits, setNumQubits] = useState(2);
  const [numColumns, setNumColumns] = useState(8);
  const [grid, setGrid] = useState(() => emptyGrid(2, 8));
  const [popup, setPopup] = useState(null); // { qubit, column, step, gateName? }
  const [awaitingTarget, setAwaitingTarget] = useState(null); // { qubit, column, gateName }

  function resizeGrid(nextQubits, nextColumns) {
    setGrid((old) => {
      const next = emptyGrid(nextQubits, nextColumns);
      for (let q = 0; q < Math.min(nextQubits, old.length); q++) {
        for (let c = 0; c < Math.min(nextColumns, old[q].length); c++) {
          next[q][c] = old[q][c];
        }
      }
      return next;
    });
  }

  function changeQubits(n) {
    const clamped = Math.max(1, Math.min(5, n));
    setNumQubits(clamped);
    resizeGrid(clamped, numColumns);
  }

  function changeColumns(n) {
    const clamped = Math.max(4, Math.min(14, n));
    setNumColumns(clamped);
    resizeGrid(numQubits, clamped);
  }

  function loadPreset(key) {
    const preset = PRESETS[key];
    setNumQubits(preset.numQubits);
    const cols = Math.max(8, ...preset.ops.map((o) => o.col + 1));
    setNumColumns(cols);
    setGrid(buildFromPreset(preset));
    setPopup(null);
    setAwaitingTarget(null);
  }

  function clearCircuit() {
    setGrid(emptyGrid(numQubits, numColumns));
    setPopup(null);
    setAwaitingTarget(null);
  }

  function placeSingle(qubit, column, name, theta) {
    setGrid((old) => {
      const next = old.map((row) => row.slice());
      next[qubit][column] = theta !== undefined ? { kind: "single", name, theta } : { kind: "single", name };
      return next;
    });
  }

  function placeMulti(colQubitA, colQubitB, column, name) {
    setGrid((old) => {
      const next = old.map((row) => row.slice());
      const roleA = name === "cx" ? "control" : "a";
      const roleB = name === "cx" ? "target" : "b";
      next[colQubitA][column] = { kind: "multi", name, role: roleA, pairQubit: colQubitB };
      next[colQubitB][column] = { kind: "multi", name, role: roleB, pairQubit: colQubitA };
      return next;
    });
  }

  function removeGate(qubit, column) {
    setGrid((old) => {
      const next = old.map((row) => row.slice());
      const cell = next[qubit][column];
      if (cell && cell.kind === "multi") {
        next[cell.pairQubit][column] = null;
      }
      next[qubit][column] = null;
      return next;
    });
  }

  function handleCellClick(qubit, column) {
    if (awaitingTarget) {
      if (awaitingTarget.column === column && awaitingTarget.qubit !== qubit && !grid[qubit][column]) {
        placeMulti(awaitingTarget.qubit, qubit, column, awaitingTarget.gateName);
      }
      setAwaitingTarget(null);
      setPopup(null);
      return;
    }
    const cell = grid[qubit][column];
    if (cell) {
      removeGate(qubit, column);
      return;
    }
    setPopup({ qubit, column, step: "choose" });
  }

  function handleChoose(name) {
    if (!popup) return;
    if (ROTATION.has(name)) {
      setPopup({ ...popup, step: "theta", gateName: name });
      return;
    }
    if (MULTI_GATES.includes(name)) {
      setAwaitingTarget({ qubit: popup.qubit, column: popup.column, gateName: name });
      setPopup(null);
      return;
    }
    placeSingle(popup.qubit, popup.column, name);
    setPopup(null);
  }

  function handleThetaConfirm(theta) {
    if (!popup) return;
    placeSingle(popup.qubit, popup.column, popup.gateName, theta);
    setPopup(null);
  }

  const gates = useMemo(() => gridToGates(grid, numQubits, numColumns), [grid, numQubits, numColumns]);

  const svgWidth = LEFT_MARGIN + numColumns * CELL_W + 20;
  const svgHeight = TOP_MARGIN + numQubits * ROW_H + 20;

  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
        <h3 style={{ fontSize: "var(--fs-lg)" }}>Build a circuit</h3>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <button className="btn" onClick={() => loadPreset("bell")}>Load Bell pair</button>
          <button className="btn" onClick={() => loadPreset("ghz")}>Load GHZ</button>
          <button className="btn" onClick={clearCircuit}>Clear</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "16px", marginBottom: "12px", fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>
        <label>
          Qubits{" "}
          <button className="btn" style={{ padding: "2px 8px" }} onClick={() => changeQubits(numQubits - 1)}>−</button>{" "}
          <span className="mono">{numQubits}</span>{" "}
          <button className="btn" style={{ padding: "2px 8px" }} onClick={() => changeQubits(numQubits + 1)}>+</button>
        </label>
        <label>
          Steps{" "}
          <button className="btn" style={{ padding: "2px 8px" }} onClick={() => changeColumns(numColumns - 1)}>−</button>{" "}
          <span className="mono">{numColumns}</span>{" "}
          <button className="btn" style={{ padding: "2px 8px" }} onClick={() => changeColumns(numColumns + 1)}>+</button>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <input type="checkbox" checked={noisy} onChange={(e) => setNoisy(e.target.checked)} />
          Simulate with noise
        </label>
      </div>

      {awaitingTarget && (
        <div style={{ background: "var(--bg-panel-raised)", border: "1px solid var(--amber)", color: "var(--amber)", borderRadius: "6px", padding: "6px 10px", fontSize: "var(--fs-xs)", marginBottom: "10px" }}>
          Click another qubit in the same column to place the {awaitingTarget.gateName.toUpperCase()} gate, or click elsewhere to cancel.
        </div>
      )}

      <div style={{ position: "relative", overflowX: "auto", paddingBottom: "8px" }}>
        <div style={{ position: "relative", width: svgWidth, height: svgHeight }}>
          <svg width={svgWidth} height={svgHeight} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            {Array.from({ length: numQubits }).map((_, q) => (
              <g key={q}>
                <text x={8} y={TOP_MARGIN + q * ROW_H + 5} fill="var(--text-muted)" fontSize="12" fontFamily="var(--font-mono)">
                  q{q}
                </text>
                <line
                  x1={LEFT_MARGIN} y1={TOP_MARGIN + q * ROW_H}
                  x2={LEFT_MARGIN + numColumns * CELL_W} y2={TOP_MARGIN + q * ROW_H}
                  stroke="var(--border)" strokeWidth="1.5"
                />
              </g>
            ))}

            {Array.from({ length: numColumns }).map((_, col) =>
              Array.from({ length: numQubits }).map((_, q) => {
                const cell = grid[q][col];
                if (!cell) return null;
                const cx = LEFT_MARGIN + col * CELL_W + CELL_W / 2;
                const cy = TOP_MARGIN + q * ROW_H;

                if (cell.kind === "single") {
                  return (
                    <g key={`${q}-${col}`}>
                      <rect
                        x={cx - GATE_SIZE / 2} y={cy - GATE_SIZE / 2} width={GATE_SIZE} height={GATE_SIZE} rx="6"
                        fill="var(--bg-panel-raised)" stroke="var(--qubit-0)" strokeWidth="1.5"
                      />
                      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--text-primary)" fontFamily="var(--font-mono)">
                        {GATE_LABEL[cell.name]}
                      </text>
                      {cell.theta !== undefined && (
                        <text x={cx} y={cy + GATE_SIZE / 2 + 12} textAnchor="middle" fontSize="9" fill="var(--text-faint)">
                          θ={cell.theta.toFixed(2)}
                        </text>
                      )}
                    </g>
                  );
                }

                // Only draw the connector once, from the lower qubit index looking down/up
                if (cell.pairQubit > q) {
                  const pcy = TOP_MARGIN + cell.pairQubit * ROW_H;
                  return (
                    <g key={`${q}-${col}`}>
                      <line x1={cx} y1={cy} x2={cx} y2={pcy} stroke="var(--qubit-1)" strokeWidth="2" />
                      <MultiEndpoint x={cx} y={cy} cell={cell} isControlEnd />
                      <MultiEndpoint x={cx} y={pcy} cell={cell} isControlEnd={false} />
                    </g>
                  );
                }
                return null;
              })
            )}
          </svg>

          {/* Transparent clickable grid overlay */}
          <div style={{ position: "relative" }}>
            {Array.from({ length: numQubits }).map((_, q) => (
              <div key={q} style={{ position: "absolute", top: TOP_MARGIN + q * ROW_H - ROW_H / 2, left: LEFT_MARGIN, display: "flex" }}>
                {Array.from({ length: numColumns }).map((_, col) => (
                  <button
                    key={col}
                    onClick={() => handleCellClick(q, col)}
                    aria-label={`q${q} step ${col}`}
                    style={{ width: CELL_W, height: ROW_H, background: "transparent", border: "none", cursor: "pointer" }}
                  />
                ))}
              </div>
            ))}
          </div>

          {popup && <GatePopup popup={popup} onChoose={handleChoose} onThetaConfirm={handleThetaConfirm} onCancel={() => setPopup(null)} />}
        </div>
      </div>

      <div className="mono" style={{ fontSize: "var(--fs-xs)", color: "var(--text-faint)", marginBottom: "12px" }}>
        {gates.length === 0 ? "Empty circuit — click a wire to add a gate." : `${gates.length} gate${gates.length === 1 ? "" : "s"} queued`}
      </div>

      <button className="btn btn-primary" onClick={() => onRun(numQubits, gates)} disabled={running}>
        {running ? "Running…" : "Run circuit"}
      </button>
      {error && <p style={{ color: "var(--red)", fontSize: "var(--fs-sm)", marginTop: "8px" }}>{error}</p>}
    </div>
  );
}

function MultiEndpoint({ x, y, cell, isControlEnd }) {
  const role = isControlEnd ? cell.role : cell.role === "control" ? "target" : cell.role === "target" ? "control" : cell.role;
  if (cell.name === "cx") {
    if (role === "control") {
      return <circle cx={x} cy={y} r="6" fill="var(--qubit-1)" />;
    }
    return (
      <g>
        <circle cx={x} cy={y} r="11" fill="var(--bg-panel-raised)" stroke="var(--qubit-1)" strokeWidth="2" />
        <line x1={x - 7} y1={y} x2={x + 7} y2={y} stroke="var(--qubit-1)" strokeWidth="2" />
        <line x1={x} y1={y - 7} x2={x} y2={y + 7} stroke="var(--qubit-1)" strokeWidth="2" />
      </g>
    );
  }
  if (cell.name === "cz") {
    return <circle cx={x} cy={y} r="6" fill="var(--qubit-1)" />;
  }
  // swap: an X mark on both ends
  return (
    <g>
      <line x1={x - 7} y1={y - 7} x2={x + 7} y2={y + 7} stroke="var(--qubit-1)" strokeWidth="2.5" />
      <line x1={x - 7} y1={y + 7} x2={x + 7} y2={y - 7} stroke="var(--qubit-1)" strokeWidth="2.5" />
    </g>
  );
}
