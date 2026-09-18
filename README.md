# Quantum Learn AI — Skeleton App

A working skeleton of the platform: an AI Tutor, a Qiskit-powered Playground
(circuit builder, Bloch sphere, histograms, QAOA/VQE demos), and gamified
quantum-randomness games — all wired together with an adaptive engine that
tracks topic mastery.

```
quantum-learn-ai/
├── backend/          FastAPI + Qiskit
│   └── app/
│       ├── main.py            FastAPI app, CORS, routers
│       ├── qiskit_engine.py   circuit building, statevector, Bloch vectors,
│       │                      noise model, QAOA/VQE demos
│       ├── tutor_content.py   rule-based topic explanations (swap for an
│       │                      LLM call — see "Wiring up a real AI tutor")
│       ├── adaptive.py        in-memory per-topic mastery tracker
│       ├── schemas.py         Pydantic request/response models
│       └── routers/
│           ├── circuits.py    /api/circuit/run, /qaoa, /vqe
│           ├── tutor.py       /api/tutor/ask, /recommend, /record
│           └── games.py       /api/games/guess, /coinflip, /dice
└── frontend/         React + Vite
    └── src/
        ├── App.jsx             sidebar nav (Tutor / Playground / Games)
        ├── api.js               fetch wrapper for the backend
        └── components/
            ├── Tutor.jsx        chat UI + adaptive "your path" panel
            ├── Playground.jsx   circuit builder, Bloch sphere, QAOA/VQE tabs
            └── Games.jsx        Guess-the-Qubit, Coin Flip, Quantum Dice
```

## Run it

**Backend**
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend** (in a second terminal)
```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). The dev server
proxies `/api/*` to the backend on port 8000 (see `vite.config.js`).

## What's actually implemented vs. stubbed

**Real (backed by Qiskit + Aer):**
- Circuit builder: any combination of H, X, Y, Z, S, T, CX, CZ, SWAP, RX/RY/RZ
  on up to 5 qubits, drawn as a real wire diagram (click a wire to add a gate,
  click a placed gate to remove it, two-qubit gates draw a connecting line
  with proper control/target/swap symbols), run on `AerSimulator`.
- Two one-click presets (Bell pair, GHZ state) that build a real entangled
  circuit — verified end-to-end that both only ever measure the expected
  correlated outcomes (`00`/`11` for Bell, `000`/`111` for GHZ).
- Ideal vs. noisy simulation (depolarizing noise model).
- Statevector, per-qubit Bloch vectors (via partial trace), and measurement
  histograms.
- A real interactive **3D Bloch sphere** per qubit (rotatable via mouse/touch,
  built with three.js/react-three-fiber) — verified the coordinate mapping is
  consistent, so e.g. |+⟩ actually renders pointing at the "+" label, not just
  visually plausible.
- An **amplitude/phase view**: a bar chart of |amplitude|² per basis state,
  colored by phase angle, with a small phase-dial per bar. This surfaces
  information the measurement histogram alone destroys — verified against a
  real H+S circuit that the |1⟩ component's phase reads exactly 90°.
- QAOA Max-Cut and a toy VQE demo (`qiskit-algorithms`), with convergence
  history for charting.
- The three games: Guess-the-Qubit (biased `RY` rotation + measurement),
  quantum coin flip (`H` + measurement), and quantum dice (superposition +
  rejection sampling).

**AI Tutor now backed by a local LLM (Qwen3:1.7b via Ollama):**
- `app/llm_tutor.py` calls a locally running [Ollama](https://ollama.com)
  server at `/api/chat` with the `qwen3:1.7b` model, forwarding the last few
  turns of conversation for context, and stripping Qwen3's `<think>...</think>`
  reasoning blocks before returning the answer.
- `routers/tutor.py`'s `/api/tutor/ask` tries the LLM first and transparently
  falls back to the old rule-based topic lookup (`tutor_content.py`) if Ollama
  isn't running or errors out — so the app still works with zero setup, it's
  just less flexible without the LLM.
- `/api/tutor/llm-status` reports whether Ollama is reachable and whether the
  model has been pulled; the frontend shows this as a badge in the Tutor tab.

**To enable the local LLM:**
```bash
# 1. Install Ollama: https://ollama.com/download
# 2. Pull the model
ollama pull qwen3:1.7b
# 3. Make sure the server is running (usually automatic after install)
ollama serve
```
By default the backend looks for Ollama at `http://localhost:11434`. Override
with env vars if needed:
```bash
export OLLAMA_HOST=http://localhost:11434
export OLLAMA_MODEL=qwen3:1.7b
```
No code changes needed — just start Ollama before (or after) the backend;
the tutor will pick it up on the next question and the badge will update.

**Still stubbed on purpose:**
- No real auth — each browser gets a random `user_id` generated once and
  stored in `localStorage` (`frontend/src/userId.js`). That's enough for
  "your own progress persists on your own device," but there's no login,
  no cross-device sync, and anyone can wipe it by clearing site storage.
- If you'd rather use the Anthropic API instead of a local model, replace
  the body of `llm_tutor.ask_llm` with a call to `anthropic.Anthropic()` —
  the router code (try LLM, fall back to rule-based) doesn't need to change.

## Persistence (SQLite)

`app/adaptive.py` now stores per-user, per-topic mastery in a SQLite file at
`backend/data/quantum_learn.db` (auto-created on first run; override the path
with `QUANTUM_LEARN_DB`). Two things write to it:
- **Engagement**: every time you ask the tutor about a topic it recognizes
  (`/api/tutor/ask`), that topic's mastery ticks up slightly (+0.08) — this
  is what was missing before; the "your path" progress bars now actually
  move instead of sitting at 0% forever.
- **Explicit results**: `/api/tutor/record` applies a bigger update (+0.2 /
  -0.1) for a real right/wrong answer, e.g. from a future quiz feature.

Restart the backend and the mastery bars will still reflect prior sessions —
confirmed by writing state in one Python process and reading it back in a
separate one.

## Natural next steps

- Persist adaptive-engine state (SQLite/Postgres) and add real user accounts. ✅ SQLite is done — real accounts/login still remain.
- Expand the circuit builder to arbitrary qubit counts with a proper wire
  diagram (drag-and-drop gate placement). ✅ Wire diagram is done (click-based, not drag-and-drop yet).
- Add more games (quantum battleship, superposition matching) and a
  leaderboard.
- Swap the toy VQE Hamiltonian for a real molecule via Qiskit Nature.
- Add a proper 3D Bloch sphere (the current one is a 2D x-z projection). ✅ Done — interactive 3D via react-three-fiber.
- Circuit builder: drag-and-drop instead of click-to-place, and a way to
  drag a placed gate to a different column instead of delete + re-add.
- The production bundle is now ~1.5MB (mostly three.js) — worth code-splitting
  the Playground route with `React.lazy` if load time matters.
- A full Q-sphere (3D, showing all basis states at once with amplitude-weighted
  size) would be a richer multi-qubit complement to the current 2D amplitude
  bar chart, which only shows magnitude+phase per basis state, not their
  relationship in a single combined picture.
