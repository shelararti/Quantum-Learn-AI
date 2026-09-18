import React, { useEffect, useRef, useState } from "react";

const SINGLE_GATES = ["h", "x", "y", "z", "s", "t"];
const ROTATION_GATES = ["rx", "ry", "rz"];
const TWO_QUBIT_GATES = ["cx", "cz", "swap"];
const ALL_GATES = [...SINGLE_GATES, ...ROTATION_GATES, ...TWO_QUBIT_GATES];

const GATE_COLORS = {
  h: "var(--qubit-0)", x: "var(--qubit-0)", y: "var(--qubit-0)", z: "var(--qubit-0)",
  s: "var(--qubit-0)", t: "var(--qubit-0)",
  rx: "var(--amber)", ry: "var(--amber)", rz: "var(--amber)",
  cx: "var(--qubit-1)", cz: "var(--qubit-1)", swap: "var(--qubit-1)",
};

const MIN_QUBITS = 1;
const MAX_QUBITS = 4;
const MIN_COLS = 6;

const LABEL_W = 48;
const COL_W = 68;
const ROW_H = 60;
const TOP_PAD = 24;
const BOX = 36;

let idCounter = 0;
const nextId = () => `g${idCounter++}`;

function emptyGrid(numQubits, cols) {
  return Array.from({ length: cols }, () => Array.from({ length: numQubits }, () => null));
}

function cloneGrid(grid) {
  return grid.map((col) => col.map((cell) => (cell ? { ...cell } : null)));
}

function ensureTrailingEmptyColumn(grid, numQubits) {
  let lastUsed = -1;
  grid.forEach((col, i) => {
    if (col.some((c) => c !== null)) lastUsed = i;
  });
  const needed = Math.max(MIN_COLS, lastUsed + 2);
  const g = cloneGrid(grid);
  while (g.length < needed) g.push(Array.from({ length: numQubits }, () => null));
  return g;
}

function gridToGates(grid) {
  const gates = [];
  for (let col = 0; col < grid.length; col++) {
    for (let q = 0; q < grid[col].length; q++) {
      const cell = grid[col][q];
      if (!cell) continue;
      if (cell.role === "secondary") continue;
      if (cell.role === "primary") {
        gates.push({ name: cell.gate, qubits: [q, cell.partner] });
      } else {
        const g = { name: cell.gate, qubits: [q] };
        if (cell.theta !== undefined) g.theta = cell.theta;
        gates.push(g);
      }
    }
  }
  return gates;
}

function GateMark({ gate, role, x, y }) {
  const color = GATE_COLORS[gate] || "var(--qubit-0)";
  if (TWO_QUBIT_GATES.includes(gate)) {
    if (gate === "swap") {
      const s = 7;
      return (
        <g stroke={color} strokeWidth="2.5">
          <line x1={x - s} y1={y - s} x2={x + s} y2={y + s} />
          <line x1={x - s} y1={y + s} x2={x + s} y2={y - s} />
        </g>
      );
    }
    if (gate === "cz") {
      return <circle cx={x} cy={y} r="5" fill={color} />;
    }
    // cx: control is a dot, target is a ⊕
    if (role === "primary") {
      return <circle cx={x} cy={y} r="5" fill={color} />;
    }
    return (
      <g stroke={color} strokeWidth="2" fill="none">
        <circle cx={x} cy={y} r="11" />
        <line x1={x - 11} y1={y} x2={x + 11} y2={y} />
        <line x1={x} y1={y - 11} x2={x} y2={y + 11} />
      </g>
    );
  }
  return (
    <g>
      <rect x={x - BOX / 2} y={y - BOX / 2} width={BOX} height={BOX} rx="6" fill="var(--bg-panel)" stroke={color} strokeWidth="2" />
      <text x={x} y={y + 4} textAnchor="middle" fontSize="13" fontFamily="var(--font-mono)" fill={color} fontWeight="600">
        {gate.toUpperCase()}
      </text>
    </g>
  );
}

export default function CircuitCanvas({ onChange }) {
  const [numQubits, setNumQubits] = useState(2);
  const [grid, setGrid] = useState(() => emptyGrid(2, MIN_COLS));
  const [selectedGate, setSelectedGate] = useState("h");
  const [pending, setPending] = useState(null); // {col, qubit} awaiting 2nd click for a 2-qubit gate
  const [editingCell, setEditingCell] = useState(null); // {col, qubit} for theta editing
  const [hoverCell, setHoverCell] = useState(null);

  useEffect(() => {
    onChange({ numQubits, gates: gridToGates(grid) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, numQubits]);

  function changeQubits(delta) {
    const next = Math.max(MIN_QUBITS, Math.min(MAX_QUBITS, numQubits + delta));
    if (next === numQubits) return;
    setNumQubits(next);
    setGrid(emptyGrid(next, MIN_COLS));
    setPending(null);
    setEditingCell(null);
  }

  function clearCircuit() {
    setGrid(emptyGrid(numQubits, MIN_COLS));
    setPending(null);
    setEditingCell(null);
  }

  function removeCell(col, qubit) {
    setGrid((g) => {
      const next = cloneGrid(g);
      const cell = next[col][qubit];
      if (!cell) return g;
      if (cell.partner !== undefined) {
        next[col][cell.partner] = null;
      }
      next[col][qubit] = null;
      return next;
    });
    setEditingCell(null);
  }

  function placeSingle(col, qubit) {
    setGrid((g) => {
      const next = cloneGrid(g);
      const cell = { id: nextId(), gate: selectedGate, role: "single" };
      if (ROTATION_GATES.includes(selectedGate)) cell.theta = 1.57;
      next[col][qubit] = cell;
      return ensureTrailingEmptyColumn(next, numQubits);
    });
    if (ROTATION_GATES.includes(selectedGate)) setEditingCell({ col, qubit });
  }

  function completeTwoQubit(col, qubitA, qubitB) {
    const id = nextId();
    setGrid((g) => {
      const next = cloneGrid(g);
      next[col][qubitA] = { id, gate: selectedGate, role: "primary", partner: qubitB };
      next[col][qubitB] = { id, gate: selectedGate, role: "secondary", partner: qubitA };
      return ensureTrailingEmptyColumn(next, numQubits);
    });
    setPending(null);
  }

  function handleCellClick(col, qubit) {
    const cell = grid[col][qubit];

    if (selectedGate === "erase") {
      if (cell) removeCell(col, qubit);
      return;
    }

    if (TWO_QUBIT_GATES.includes(selectedGate)) {
      if (cell) return; // occupied — pick empty cells only
      if (pending && pending.col === col && pending.qubit !== qubit) {
        completeTwoQubit(col, pending.qubit, qubit);
      } else if (pending && pending.col === col && pending.qubit === qubit) {
        setPending(null); // cancel
      } else {
        setPending({ col, qubit });
      }
      return;
    }

    // single/rotation gate
    if (cell) {
      if (ROTATION_GATES.includes(cell.gate)) setEditingCell({ col, qubit });
      return;
    }
    placeSingle(col, qubit);
    setPending(null);
  }

  function updateTheta(col, qubit, theta) {
    setGrid((g) => {
      const next = cloneGrid(g);
      next[col][qubit] = { ...next[col][qubit], theta };
      return next;
    });
  }

  const numCols = grid.length;
  const width = LABEL_W + COL_W * numCols;
  const height = TOP_PAD * 2 + ROW_H * numQubits;
  const editingGate = editingCell ? grid[editingCell.col]?.[editingCell.qubit] : null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>Qubits</span>
          <button className="btn" onClick={() => changeQubits(-1)} disabled={numQubits <= MIN_QUBITS}>−</button>
          <span className="mono" style={{ minWidth: "16px", textAlign: "center" }}>{numQubits}</span>
          <button className="btn" onClick={() => changeQubits(1)} disabled={numQubits >= MAX_QUBITS}>+</button>
        </div>
        <button className="btn" onClick={clearCircuit}>Clear circuit</button>
      </div>

      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
        {ALL_GATES.map((g) => (
          <button
            key={g}
            className="btn"
            onClick={() => { setSelectedGate(g); setPending(null); }}
            style={{
              fontFamily: "var(--font-mono)",
              borderColor: selectedGate === g ? (GATE_COLORS[g] || "var(--qubit-0)") : "var(--border)",
              color: selectedGate === g ? (GATE_COLORS[g] || "var(--qubit-0)") : "var(--text-primary)",
            }}
          >
            {g.toUpperCase()}
          </button>
        ))}
        <button
          className="btn"
          onClick={() => { setSelectedGate("erase"); setPending(null); }}
          style={{ borderColor: selectedGate === "erase" ? "var(--red)" : "var(--border)", color: selectedGate === "erase" ? "var(--red)" : "var(--text-primary)" }}
        >
          ✕ Erase
        </button>
      </div>

      <p style={{ fontSize: "var(--fs-xs)", color: "var(--text-faint)", marginTop: 0, marginBottom: "10px" }}>
        {TWO_QUBIT_GATES.includes(selectedGate)
          ? pending
            ? "Click a different qubit in the same column to connect it."
            : "Click a qubit wire to start the connection, then click another qubit in the same column."
          : selectedGate === "erase"
          ? "Click any placed gate to remove it."
          : "Click an empty spot on a wire to place the gate."}
      </p>

      <div style={{ overflowX: "auto", background: "var(--bg-panel-raised)", borderRadius: "8px", border: "1px solid var(--border-soft)" }}>
        <svg width={width} height={height} style={{ display: "block" }}>
          {Array.from({ length: numQubits }).map((_, q) => {
            const y = TOP_PAD + ROW_H * q + ROW_H / 2;
            return (
              <g key={q}>
                <text x={10} y={y + 4} fontSize="12" fontFamily="var(--font-mono)" fill="var(--text-muted)">q{q}</text>
                <line x1={LABEL_W} y1={y} x2={width - 6} y2={y} stroke="var(--border)" strokeWidth="1.5" />
              </g>
            );
          })}

          {grid.map((col, c) =>
            Array.from({ length: numQubits }).map((_, q) => {
              const x = LABEL_W + COL_W * c + COL_W / 2;
              const y = TOP_PAD + ROW_H * q + ROW_H / 2;
              const cell = col[q];
              const isHover = hoverCell && hoverCell.col === c && hoverCell.qubit === q;
              const isPendingHere = pending && pending.col === c && pending.qubit === q;
              return (
                <g key={`${c}-${q}`}>
                  <rect
                    x={LABEL_W + COL_W * c}
                    y={TOP_PAD + ROW_H * q}
                    width={COL_W}
                    height={ROW_H}
                    fill={isPendingHere ? "rgba(76,201,240,0.15)" : isHover ? "rgba(255,255,255,0.04)" : "transparent"}
                    style={{ cursor: "pointer" }}
                    onClick={() => handleCellClick(c, q)}
                    onMouseEnter={() => setHoverCell({ col: c, qubit: q })}
                    onMouseLeave={() => setHoverCell(null)}
                  />
                  {isPendingHere && <circle cx={x} cy={y} r="6" fill="none" stroke="var(--qubit-0)" strokeWidth="2" strokeDasharray="3,2" />}
                  {cell && cell.role === "primary" && (
                    <line
                      x1={x} y1={TOP_PAD + ROW_H * Math.min(q, cell.partner) + ROW_H / 2}
                      x2={x} y2={TOP_PAD + ROW_H * Math.max(q, cell.partner) + ROW_H / 2}
                      stroke={GATE_COLORS[cell.gate]} strokeWidth="2"
                    />
                  )}
                  {cell && <GateMark gate={cell.gate} role={cell.role} x={x} y={y} />}
                </g>
              );
            })
          )}
        </svg>
      </div>

      {editingGate && ROTATION_GATES.includes(editingGate.gate) && (
        <div className="panel" style={{ marginTop: "12px", padding: "12px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "var(--fs-sm)" }}>
            <span className="mono">{editingGate.gate.toUpperCase()} on q{editingCell.qubit} — θ = {editingGate.theta.toFixed(2)} rad</span>
            <button className="btn" onClick={() => removeCell(editingCell.col, editingCell.qubit)} style={{ color: "var(--red)" }}>Remove</button>
          </div>
          <input
            type="range" min="0" max={(2 * Math.PI).toFixed(2)} step="0.01"
            value={editingGate.theta}
            onChange={(e) => updateTheta(editingCell.col, editingCell.qubit, Number(e.target.value))}
            style={{ width: "100%", marginTop: "8px" }}
          />
        </div>
      )}
    </div>
  );
}
