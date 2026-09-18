"""
Adaptive learning engine, now backed by SQLite so progress survives a
server restart. Tracks per-user, per-topic mastery and recommends the next
topic/difficulty based on simple heuristics.
"""
from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from typing import Dict

TOPIC_ORDER = ["qubit", "superposition", "measurement", "entanglement", "gate", "qaoa", "vqe"]

_DEFAULT_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "quantum_learn.db")
DB_PATH = os.environ.get("QUANTUM_LEARN_DB", _DEFAULT_DB_PATH)
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)


@contextmanager
def _connect():
    conn = sqlite3.connect(DB_PATH)
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def _init_db():
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS mastery (
                user_id TEXT NOT NULL,
                topic TEXT NOT NULL,
                score REAL NOT NULL DEFAULT 0.0,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, topic)
            )
            """
        )


_init_db()


def _upsert(user_id: str, topic: str, score: float) -> None:
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO mastery (user_id, topic, score, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, topic)
            DO UPDATE SET score = excluded.score, updated_at = CURRENT_TIMESTAMP
            """,
            (user_id, topic, score),
        )


def get_state(user_id: str = "default") -> Dict[str, float]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT topic, score FROM mastery WHERE user_id = ?", (user_id,)
        ).fetchall()
    state = {t: 0.0 for t in TOPIC_ORDER}
    state.update({topic: score for topic, score in rows})
    return state


def record_result(user_id: str, topic: str, correct: bool) -> Dict[str, float]:
    """Big update for an explicit right/wrong answer (e.g. a quiz question)."""
    state = get_state(user_id)
    delta = 0.2 if correct else -0.1
    new_score = max(0.0, min(1.0, state.get(topic, 0.0) + delta))
    _upsert(user_id, topic, new_score)
    state[topic] = new_score
    return state


def record_engagement(user_id: str, topic: str, delta: float = 0.08) -> Dict[str, float]:
    """Small update just for asking about / interacting with a topic."""
    if topic not in TOPIC_ORDER:
        return get_state(user_id)
    state = get_state(user_id)
    new_score = max(0.0, min(1.0, state.get(topic, 0.0) + delta))
    _upsert(user_id, topic, new_score)
    state[topic] = new_score
    return state


def recommend_next(user_id: str = "default") -> Dict:
    state = get_state(user_id)
    for topic in TOPIC_ORDER:
        if state.get(topic, 0.0) < 0.6:
            level = "beginner" if state.get(topic, 0.0) < 0.3 else "intermediate"
            return {"topic": topic, "level": level, "mastery": state}
    return {"topic": "qaoa", "level": "intermediate", "mastery": state, "note": "All core topics mastered!"}
