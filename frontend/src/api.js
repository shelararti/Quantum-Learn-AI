const BASE = "/api";

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json()).detail || res.statusText);
  return res.json();
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

export const api = {
  runCircuit: (payload) => post("/circuit/run", payload),
  runQaoa: (payload) => post("/circuit/qaoa", payload),
  runVqe: (payload) => post("/circuit/vqe", payload),
  askTutor: (payload) => post("/tutor/ask", payload),
  llmStatus: () => get("/tutor/llm-status"),
  recommend: (userId = "default") => get(`/tutor/recommend?user_id=${userId}`),
  guess: (payload) => post("/games/guess", payload),
  coinFlip: () => get("/games/coinflip"),
  dice: (payload) => post("/games/dice", payload),
};
