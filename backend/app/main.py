from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import circuits, tutor, games

app = FastAPI(title="Quantum Learn AI API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(circuits.router)
app.include_router(tutor.router)
app.include_router(games.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
