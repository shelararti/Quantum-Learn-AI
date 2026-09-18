import React, { useState } from "react";
import Tutor from "./components/Tutor.jsx";
import Playground from "./components/Playground.jsx";
import Games from "./components/Games.jsx";

const SECTIONS = [
  { id: "tutor", label: "AI Tutor", icon: "◐" },
  { id: "playground", label: "Playground", icon: "◈" },
  { id: "games", label: "Games", icon: "◆" },
];

export default function App() {
  const [section, setSection] = useState("tutor");

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="mark">Quantum Learn AI</span>
          <span className="sub">learn quantum computing by doing</span>
        </div>
        <nav className="nav">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              className={`nav-item ${section === s.id ? "active" : ""}`}
              onClick={() => setSection(s.id)}
            >
              <span aria-hidden="true">{s.icon}</span>
              {s.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="main">
        {section === "tutor" && <Tutor />}
        {section === "playground" && <Playground />}
        {section === "games" && <Games />}
      </main>
    </div>
  );
}
