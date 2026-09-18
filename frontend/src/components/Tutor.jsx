import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { getUserId } from "../userId.js";

const userId = getUserId();


function LlmBadge({ status }) {
  if (!status) return null;
  const ok = status.connected && status.model_ready;
  const label = ok
    ? `Qwen3 connected`
    : status.connected
    ? `Ollama connected, model not pulled`
    : `Local LLM offline — using fallback`;
  const color = ok ? "var(--green)" : status.connected ? "var(--amber)" : "var(--text-faint)";
  return (
    <span className="pill" style={{ borderColor: color, color }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block" }} />
      {label}
    </span>
  );
}

export default function Tutor() {
  const [messages, setMessages] = useState([
    {
      role: "tutor",
      text: "Hi! Ask me about qubits, superposition, entanglement, measurement, or algorithms like QAOA and VQE.",
    },
  ]);
  const [input, setInput] = useState("");
  const [level, setLevel] = useState("beginner");
  const [recommendation, setRecommendation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [llmStatus, setLlmStatus] = useState(null);

  useEffect(() => {
    api.recommend(userId).then(setRecommendation).catch(() => {});
    refreshLlmStatus();
  }, []);

  function refreshLlmStatus() {
    api.llmStatus().then(setLlmStatus).catch(() => setLlmStatus({ connected: false }));
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const nextMessages = [...messages, { role: "user", text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      // Forward recent turns as {role, content} for multi-turn context
      const history = nextMessages
        .slice(0, -1)
        .filter((m) => m.role === "user" || m.role === "tutor")
        .slice(-8)
        .map((m) => ({ role: m.role === "tutor" ? "assistant" : "user", content: m.text }));

      const res = await api.askTutor({ message: text, level, history, user_id: userId });
      setMessages((m) => [...m, { role: "tutor", text: res.answer, topic: res.topic, source: res.source }]);
      if (res.source) refreshLlmStatus();
      api.recommend(userId).then(setRecommendation).catch(() => {});
    } catch (e) {
      setMessages((m) => [...m, { role: "tutor", text: "Something went wrong reaching the tutor API." }]);
    } finally {
      setLoading(false);
    }
  }

  function askAbout(topic) {
    setInput(topic);
    setTimeout(send, 0);
  }

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1>AI Tutor</h1>
          <p>Ask questions in plain language. The tutor adapts explanations to your level.</p>
        </div>
        <LlmBadge status={llmStatus} />
      </div>

      <div className="grid-2">
        <div className="panel" style={{ display: "flex", flexDirection: "column", height: "60vh" }}>
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px" }}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "80%",
                  background: m.role === "user" ? "var(--bg-panel-raised)" : "transparent",
                  border: m.role === "user" ? "1px solid var(--border)" : "none",
                  borderLeft: m.role === "tutor" ? "2px solid var(--qubit-0)" : undefined,
                  padding: "10px 14px",
                  borderRadius: "10px",
                  fontSize: "var(--fs-sm)",
                  lineHeight: 1.5,
                }}
              >
                {m.text}
                {m.role === "tutor" && m.source && (
                  <div style={{ marginTop: "6px", fontSize: "var(--fs-xs)", color: "var(--text-faint)" }}>
                    {m.source === "llm" ? "— Qwen3 (local LLM)" : "— rule-based fallback"}
                  </div>
                )}
              </div>
            ))}
            {loading && <div style={{ color: "var(--text-faint)", fontSize: "var(--fs-sm)" }}>thinking…</div>}
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
            <select value={level} onChange={(e) => setLevel(e.target.value)} className="btn" style={{ flexShrink: 0 }}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
            </select>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask about superposition, entanglement…"
              style={{
                flex: 1,
                background: "var(--bg-panel-raised)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                padding: "10px 12px",
                color: "var(--text-primary)",
                fontSize: "var(--fs-sm)",
              }}
            />
            <button className="btn btn-primary" onClick={send} disabled={loading}>
              Send
            </button>
          </div>
        </div>

        <div className="panel">
          <h3 style={{ fontSize: "var(--fs-lg)", marginBottom: "12px" }}>Your path</h3>
          {recommendation ? (
            <>
              <p style={{ color: "var(--text-muted)", fontSize: "var(--fs-sm)" }}>
                {recommendation.note || "Suggested next topic based on your progress:"}
              </p>
              <button
                className="btn"
                style={{ marginTop: "8px" }}
                onClick={() => askAbout(recommendation.topic)}
              >
                Learn: {recommendation.topic}
              </button>
              <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {Object.entries(recommendation.mastery || {}).map(([topic, score]) => (
                  <div key={topic}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>
                      <span>{topic}</span>
                      <span>{Math.round(score * 100)}%</span>
                    </div>
                    <div style={{ height: "4px", background: "var(--bg-panel-raised)", borderRadius: "2px" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${score * 100}%`,
                          background: "linear-gradient(90deg, var(--qubit-0), var(--qubit-1))",
                          borderRadius: "2px",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p style={{ color: "var(--text-faint)", fontSize: "var(--fs-sm)" }}>Loading your progress…</p>
          )}
          {llmStatus && !llmStatus.connected && (
            <p style={{ marginTop: "20px", fontSize: "var(--fs-xs)", color: "var(--text-faint)" }}>
              Local LLM offline. Run <code className="mono">ollama serve</code> and{" "}
              <code className="mono">ollama pull qwen3:1.7b</code> to enable free-form answers.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
