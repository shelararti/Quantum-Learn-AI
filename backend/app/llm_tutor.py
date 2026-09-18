"""
Talks to a locally running Ollama server to get free-form tutoring answers
from Qwen3:1.7b, instead of the canned lookup table in tutor_content.py.

Requires Ollama running locally with the model pulled:
    ollama pull qwen3:1.7b
    ollama serve   # usually already running as a background service

Configurable via env vars:
    OLLAMA_HOST  - default http://localhost:11434
    OLLAMA_MODEL - default qwen3:1.7b
"""
from __future__ import annotations

import os
import re
from typing import List, Optional, Dict

import httpx

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen3:1.7b")

SYSTEM_PROMPT = (
    "You are a friendly, precise quantum computing tutor inside an app called "
    "Quantum Learn AI. The learner's level is '{level}'. Explain concepts "
    "clearly and concisely (2 short paragraphs max, plain text, no heavy "
    "markdown). When relevant, point out that the learner can try the idea "
    "themselves in the app's Playground (circuit builder, Bloch sphere, "
    "measurement histograms). If the question isn't about quantum computing, "
    "gently steer back to the subject."
)

_THINK_TAG_RE = re.compile(r"<think>.*?</think>", flags=re.DOTALL)


class OllamaUnavailable(Exception):
    """Raised when the local LLM can't be reached or returns something unusable."""


def strip_think_tags(text: str) -> str:
    """Qwen3 emits <think>...</think> reasoning blocks; strip them for display."""
    return _THINK_TAG_RE.sub("", text).strip()


def check_health(timeout: float = 3.0) -> Dict:
    """Returns connection + model-availability status for the frontend to show."""
    try:
        resp = httpx.get(f"{OLLAMA_HOST}/api/tags", timeout=timeout)
        resp.raise_for_status()
        models = [m.get("name", "") for m in resp.json().get("models", [])]
        model_ready = any(OLLAMA_MODEL in m for m in models)
        return {
            "connected": True,
            "model": OLLAMA_MODEL,
            "model_ready": model_ready,
            "available_models": models,
        }
    except Exception as e:
        return {"connected": False, "model": OLLAMA_MODEL, "model_ready": False, "error": str(e)}


def ask_llm(
    message: str,
    level: str = "beginner",
    history: Optional[List[Dict[str, str]]] = None,
    timeout: float = 60.0,
) -> str:
    messages = [{"role": "system", "content": SYSTEM_PROMPT.format(level=level)}]
    if history:
        # Only forward well-formed {role, content} turns, capped to recent context
        for turn in history[-8:]:
            role = turn.get("role")
            content = turn.get("content")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": message})

    payload = {
        "model": OLLAMA_MODEL,
        "messages": messages,
        "stream": False,
        "options": {"temperature": 0.4},
    }

    try:
        resp = httpx.post(f"{OLLAMA_HOST}/api/chat", json=payload, timeout=timeout)
        resp.raise_for_status()
    except httpx.ConnectError as e:
        raise OllamaUnavailable(f"Could not reach Ollama at {OLLAMA_HOST}. Is `ollama serve` running?") from e
    except httpx.TimeoutException as e:
        raise OllamaUnavailable("Ollama took too long to respond.") from e
    except httpx.HTTPStatusError as e:
        detail = e.response.text[:200] if e.response is not None else str(e)
        raise OllamaUnavailable(f"Ollama returned an error: {detail}") from e

    try:
        data = resp.json()
        content = data["message"]["content"].strip()
    except (ValueError, KeyError) as e:
        raise OllamaUnavailable("Ollama returned an unexpected response shape.") from e

    if not content:
        raise OllamaUnavailable("Ollama returned an empty response.")

    return strip_think_tags(content)
