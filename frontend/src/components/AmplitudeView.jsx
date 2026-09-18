import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

function phaseToColor(re, im) {
  const phase = Math.atan2(im, re); // -PI..PI
  const hue = ((phase + Math.PI) / (2 * Math.PI)) * 360;
  return `hsl(${hue.toFixed(0)}, 70%, 62%)`;
}

function PhaseDial({ re, im }) {
  const phase = Math.atan2(im, re);
  const size = 22;
  const c = size / 2;
  const r = size / 2 - 2;
  const x = c + r * Math.sin(phase);
  const y = c - r * Math.cos(phase);
  return (
    <svg width={size} height={size}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="var(--border)" strokeWidth="1" />
      <line x1={c} y1={c} x2={x} y2={y} stroke={phaseToColor(re, im)} strokeWidth="2" />
    </svg>
  );
}

export default function AmplitudeView({ amplitudes }) {
  const data = amplitudes.map((a) => ({
    basis: a.basis,
    prob: a.prob,
    re: a.re,
    im: a.im,
    phaseDeg: ((Math.atan2(a.im, a.re) * 180) / Math.PI).toFixed(0),
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data}>
          <CartesianGrid stroke="var(--border-soft)" />
          <XAxis dataKey="basis" stroke="var(--text-muted)" fontSize={11} />
          <YAxis stroke="var(--text-muted)" fontSize={11} domain={[0, 1]} />
          <Tooltip
            contentStyle={{ background: "var(--bg-panel-raised)", border: "1px solid var(--border)" }}
            formatter={(value, _name, props) => [`${(value * 100).toFixed(1)}%`, `prob (phase ${props.payload.phaseDeg}°)`]}
          />
          <Bar dataKey="prob" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={phaseToColor(d.re, d.im)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", marginTop: "8px" }}>
        {data
          .filter((d) => d.prob > 1e-6)
          .map((d) => (
            <div key={d.basis} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "var(--fs-xs)", color: "var(--text-muted)" }}>
              <PhaseDial re={d.re} im={d.im} />
              <span className="mono">|{d.basis}⟩ {d.phaseDeg}°</span>
            </div>
          ))}
      </div>
      <p style={{ fontSize: "var(--fs-xs)", color: "var(--text-faint)", marginTop: "6px" }}>
        Bar height = probability |amplitude|². Color and dial = phase angle — information the measurement histogram alone throws away.
      </p>
    </div>
  );
}
