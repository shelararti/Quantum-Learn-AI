import React, { useState } from "react";
import { api } from "../api.js";

function useScore() {
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  function add(points) {
    setScore((s) => {
      const next = s + points;
      setLevel(1 + Math.floor(next / 100));
      return next;
    });
  }
  return { score, level, add };
}

function GuessGame({ onScore }) {
  const [bias, setBias] = useState(0.5);
  const [lastResult, setLastResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function play(guess) {
    setLoading(true);
    try {
      const res = await api.guess({ guess, bias: Number(bias) });
      setLastResult(res);
      onScore(res.correct ? 20 : -5);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <h3 style={{ fontSize: "var(--fs-lg)" }}>Guess the Qubit</h3>
      <p style={{ color: "var(--text-muted)", fontSize: "var(--fs-sm)" }}>
        A qubit is prepared and measured. Guess whether it collapses to 0 or 1 before it happens.
      </p>
      <label style={{ display: "block", fontSize: "var(--fs-xs)", color: "var(--text-muted)", marginTop: "12px" }}>
        P(measuring 1) = {bias}
      </label>
      <input type="range" min="0" max="1" step="0.05" value={bias} onChange={(e) => setBias(e.target.value)} style={{ width: "100%" }} />
      <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
        <button className="btn btn-primary" disabled={loading} onClick={() => play("0")}>Guess 0</button>
        <button className="btn btn-primary" disabled={loading} onClick={() => play("1")}>Guess 1</button>
      </div>
      {lastResult && (
        <p style={{ marginTop: "12px", fontSize: "var(--fs-sm)", color: lastResult.correct ? "var(--green)" : "var(--red)" }}>
          Qubit collapsed to {lastResult.outcome}. {lastResult.correct ? "You guessed right! +20" : "Wrong guess. -5"}
        </p>
      )}
    </div>
  );
}

function CoinFlip({ onScore }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function flip() {
    setLoading(true);
    try {
      const res = await api.coinFlip();
      setResult(res.result);
      onScore(5);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <h3 style={{ fontSize: "var(--fs-lg)" }}>Quantum Coin Flip</h3>
      <p style={{ color: "var(--text-muted)", fontSize: "var(--fs-sm)" }}>
        A Hadamard gate puts a qubit into equal superposition, then measures it — a truly random coin flip.
      </p>
      <button className="btn btn-primary" style={{ marginTop: "12px" }} disabled={loading} onClick={flip}>
        {loading ? "Flipping…" : "Flip"}
      </button>
      {result && <p style={{ marginTop: "12px", fontSize: "var(--fs-xl)", fontFamily: "var(--font-display)" }}>{result}</p>}
    </div>
  );
}

function QuantumDice({ onScore }) {
  const [sides, setSides] = useState(6);
  const [roll, setRoll] = useState(null);
  const [loading, setLoading] = useState(false);

  async function rollDice() {
    setLoading(true);
    try {
      const res = await api.dice({ sides: Number(sides) });
      setRoll(res.roll);
      onScore(3);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <h3 style={{ fontSize: "var(--fs-lg)" }}>Quantum Dice</h3>
      <p style={{ color: "var(--text-muted)", fontSize: "var(--fs-sm)" }}>
        Qubits in superposition generate a genuinely random roll, using rejection sampling for non-power-of-2 sides.
      </p>
      <select value={sides} onChange={(e) => setSides(e.target.value)} className="btn" style={{ marginTop: "12px" }}>
        {[4, 6, 8, 10, 12, 20].map((s) => <option key={s} value={s}>{s}-sided</option>)}
      </select>
      <button className="btn btn-primary" style={{ marginLeft: "8px" }} disabled={loading} onClick={rollDice}>
        {loading ? "Rolling…" : "Roll"}
      </button>
      {roll && <p style={{ marginTop: "12px", fontSize: "var(--fs-xl)", fontFamily: "var(--font-display)" }}>{roll}</p>}
    </div>
  );
}

export default function Games() {
  const { score, level, add } = useScore();
  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1>Games</h1>
          <p>Quantum randomness, gamified. Every outcome here comes from a real quantum measurement.</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="pill">Level {level}</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-xl)", color: "var(--amber)" }}>{score} pts</div>
        </div>
      </div>
      <div className="grid-2">
        <GuessGame onScore={add} />
        <CoinFlip onScore={add} />
      </div>
      <div style={{ marginTop: "24px" }}>
        <QuantumDice onScore={add} />
      </div>
    </div>
  );
}
