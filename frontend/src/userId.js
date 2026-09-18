const KEY = "quantum-learn-ai:user-id";

function randomId() {
  return "u_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function getUserId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // localStorage unavailable (private browsing, etc.) — fall back to a
    // session-only id so the app still works, just without persistence.
    return "default";
  }
}
