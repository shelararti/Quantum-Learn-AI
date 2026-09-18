import React, { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line,
} from "recharts";
import { api } from "../api.js";
import CircuitBuilder from "./CircuitBuilder.jsx";
import Bloch3D from "./Bloch3D.jsx";
import AmplitudeView from "./AmplitudeView.jsx";

function BuilderAndResults() {
  const [noisy, setNoisy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function run(numQubits, gates) {
    if (gates.length === 0) {
      setError("Add at least one gate before running.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.runCircuit({ num_qubits: numQubits, gates, shots: 1024, noisy });
      setResult(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const chartData = result
    ? Object.entries(result.counts).map(([basis, count]) => ({ basis, count }))
    : [];

  return (
    <div className="grid-2">
      <CircuitBuilder running={loading} error={error} onRun={run} noisy={noisy} setNoisy={setNoisy} />

      <div className="panel">
        <h3 style={{ fontSize: "var(--fs-lg)", marginBottom: "12px" }}>Results</h3>
        {!result && <p style={{ color: "var(--text-faint)", fontSize: "var(--fs-sm)" }}>Run a circuit to see the measurement histogram and Bloch vectors.</p>}
        {result && (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid stroke="var(--border-soft)" />
                <XAxis dataKey="basis" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--bg-panel-raised)", border: "1px solid var(--border)" }} />
                <Bar dataKey="count" fill="var(--qubit-0)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginTop: "12px" }}>
              {result.bloch_vectors.map((v, i) => <Bloch3D key={i} vector={v} label={i} />)}
            </div>
          </>
        )}
      </div>

      {result && (
        <div className="panel" style={{ gridColumn: "1 / -1" }}>
          <h3 style={{ fontSize: "var(--fs-lg)", marginBottom: "8px" }}>Amplitudes &amp; phase</h3>
          <AmplitudeView amplitudes={result.amplitudes} />
        </div>
      )}
    </div>
  );
}

function QaoaDemo() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  async function run() {
    setLoading(true);
    try {
      const res = await api.runQaoa({ edges: [[0, 1], [1, 2], [2, 0], [2, 3]], num_nodes: 4, reps: 1 });
      setResult(res);
    } finally { setLoading(false); }
  }
  return (
    <div className="panel">
      <h3 style={{ fontSize: "var(--fs-lg)" }}>QAOA — Max-Cut demo</h3>
      <p style={{ color: "var(--text-muted)", fontSize: "var(--fs-sm)" }}>
        Finds a near-optimal split of a small 4-node graph into two groups, maximizing cut edges.
      </p>
      <button className="btn btn-primary" style={{ marginTop: "12px" }} onClick={run} disabled={loading}>
        {loading ? "Optimizing…" : "Run QAOA"}
      </button>
      {result && (
        <div style={{ marginTop: "16px" }}>
          <p className="mono" style={{ fontSize: "var(--fs-sm)" }}>Optimal value: {result.optimal_value.toFixed(3)}</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={result.history}>
              <CartesianGrid stroke="var(--border-soft)" />
              <XAxis dataKey="iteration" stroke="var(--text-muted)" fontSize={11} />
              <YAxis stroke="var(--text-muted)" fontSize={11} />
              <Tooltip contentStyle={{ background: "var(--bg-panel-raised)", border: "1px solid var(--border)" }} />
              <Line type="monotone" dataKey="energy" stroke="var(--qubit-1)" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function VqeDemo() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  async function run() {
    setLoading(true);
    try {
      const res = await api.runVqe({ reps: 1 });
      setResult(res);
    } finally { setLoading(false); }
  }
  return (
    <div className="panel">
      <h3 style={{ fontSize: "var(--fs-lg)" }}>VQE — ground-state energy demo</h3>
      <p style={{ color: "var(--text-muted)", fontSize: "var(--fs-sm)" }}>
        Estimates the lowest energy of an illustrative 2-qubit Hamiltonian, inspired by H₂.
      </p>
      <button className="btn btn-primary" style={{ marginTop: "12px" }} onClick={run} disabled={loading}>
        {loading ? "Optimizing…" : "Run VQE"}
      </button>
      {result && (
        <div style={{ marginTop: "16px" }}>
          <p className="mono" style={{ fontSize: "var(--fs-sm)" }}>Ground state energy: {result.ground_state_energy.toFixed(4)}</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={result.history}>
              <CartesianGrid stroke="var(--border-soft)" />
              <XAxis dataKey="iteration" stroke="var(--text-muted)" fontSize={11} />
              <YAxis stroke="var(--text-muted)" fontSize={11} />
              <Tooltip contentStyle={{ background: "var(--bg-panel-raised)", border: "1px solid var(--border)" }} />
              <Line type="monotone" dataKey="energy" stroke="var(--green)" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default function Playground() {
  const [tab, setTab] = useState("builder");
  return (
    <div>
      <div className="page-header">
        <h1>Quantum Playground</h1>
        <p>Build circuits and run them on Qiskit's simulator, or try algorithm demos.</p>
      </div>
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        <button className={`btn ${tab === "builder" ? "btn-primary" : ""}`} onClick={() => setTab("builder")}>Circuit Builder</button>
        <button className={`btn ${tab === "qaoa" ? "btn-primary" : ""}`} onClick={() => setTab("qaoa")}>QAOA</button>
        <button className={`btn ${tab === "vqe" ? "btn-primary" : ""}`} onClick={() => setTab("vqe")}>VQE</button>
      </div>
      {tab === "builder" && <BuilderAndResults />}
      {tab === "qaoa" && <QaoaDemo />}
      {tab === "vqe" && <VqeDemo />}
    </div>
  );
}
