"""
Lightweight rule-based tutor content. This is a stub so the app runs with
zero external dependencies out of the box. Swap `answer_question` for a
call to the Anthropic API (see README) to get free-form natural language
tutoring.
"""
from __future__ import annotations
import re
from typing import Dict, List

TOPICS: Dict[str, Dict[str, str]] = {
    "qubit": {
        "beginner": "A qubit is the quantum version of a bit. A classical bit is 0 or 1. "
                    "A qubit can be 0, 1, or a mix of both at once — this mix is called "
                    "superposition. We only find out which one when we measure it.",
        "intermediate": "A qubit's state is a vector |ψ⟩ = α|0⟩ + β|1⟩ with |α|² + |β|² = 1. "
                        "|α|² and |β|² are the probabilities of measuring 0 or 1. The state "
                        "can be visualized as a point on the Bloch sphere.",
    },
    "superposition": {
        "beginner": "Superposition means a qubit can be in a blend of 0 and 1 at the same time, "
                    "like a spinning coin that's neither heads nor tails until it lands. "
                    "The Hadamard gate (H) is the standard way to create superposition.",
        "intermediate": "Applying H to |0⟩ gives (|0⟩ + |1⟩)/√2 — an equal superposition. "
                        "Measuring collapses it randomly to 0 or 1 with 50/50 probability.",
    },
    "entanglement": {
        "beginner": "Entanglement links two qubits so that measuring one instantly tells you "
                    "something about the other, no matter how far apart they are. It's created "
                    "with gates like CNOT after putting one qubit in superposition.",
        "intermediate": "The Bell state (|00⟩ + |11⟩)/√2 is entangled: measuring qubit 0 as 0 "
                        "guarantees qubit 1 measures 0 too, and likewise for 1. Neither qubit "
                        "has a well-defined state on its own — only the pair does.",
    },
    "measurement": {
        "beginner": "Measuring a qubit forces it to 'choose' 0 or 1, with probabilities set by "
                    "its state before measurement. After measuring, the superposition is gone.",
        "intermediate": "Measurement projects the statevector onto the measured basis state. "
                        "Repeating the same circuit many times (shots) and counting outcomes "
                        "estimates the underlying probabilities.",
    },
    "gate": {
        "beginner": "Quantum gates are operations that change a qubit's state, like turning a "
                    "dial. H creates superposition, X flips 0 and 1, CNOT entangles two qubits.",
        "intermediate": "Gates are unitary matrices acting on the statevector. Circuits are "
                        "sequences of gates; the final statevector before measurement encodes "
                        "all outcome probabilities.",
    },
    "qaoa": {
        "beginner": "QAOA is a quantum algorithm for optimization problems, like finding the best "
                    "way to split a graph into two groups (Max-Cut). It alternates between two "
                    "types of operations and a classical computer tunes the parameters.",
        "intermediate": "QAOA prepares a parameterized state via alternating cost and mixer "
                        "unitaries e^{-iγH_C} and e^{-iβH_B}, then a classical optimizer adjusts "
                        "γ, β to minimize the expected cost.",
    },
    "vqe": {
        "beginner": "VQE (Variational Quantum Eigensolver) estimates the lowest energy of a "
                    "molecule using a quantum computer and a classical optimizer working "
                    "together — a leading approach for near-term quantum chemistry.",
        "intermediate": "VQE minimizes ⟨ψ(θ)|H|ψ(θ)⟩ over a parameterized ansatz |ψ(θ)⟩ using a "
                        "classical optimizer, converging toward H's ground-state energy.",
    },
}

DEFAULT_ANSWER = (
    "I don't have a canned answer for that yet, but here's a starting point: try asking about "
    "'qubit', 'superposition', 'entanglement', 'measurement', 'gate', 'qaoa', or 'vqe', "
    "or build a circuit in the Playground and I can help you interpret the results."
)


def detect_topic(message: str) -> str | None:
    msg = message.lower()
    for topic in TOPICS:
        if re.search(rf"\b{topic}\b", msg):
            return topic
    aliases = {
        "bloch": "qubit",
        "hadamard": "superposition",
        "entangled": "entanglement",
        "bell state": "entanglement",
        "collapse": "measurement",
        "max-cut": "qaoa",
        "maxcut": "qaoa",
        "hydrogen": "vqe",
        "h2": "vqe",
    }
    for alias, topic in aliases.items():
        if alias in msg:
            return topic
    return None


def answer_question(message: str, level: str = "beginner", explicit_topic: str | None = None) -> Dict:
    topic = explicit_topic or detect_topic(message)
    if topic and topic in TOPICS:
        level_key = level if level in TOPICS[topic] else "beginner"
        return {
            "topic": topic,
            "answer": TOPICS[topic][level_key],
            "suggested_next": suggest_next_topics(topic),
        }
    return {"topic": None, "answer": DEFAULT_ANSWER, "suggested_next": list(TOPICS.keys())[:3]}


def suggest_next_topics(current_topic: str) -> List[str]:
    order = ["qubit", "superposition", "measurement", "entanglement", "gate", "qaoa", "vqe"]
    if current_topic not in order:
        return order[:2]
    idx = order.index(current_topic)
    return order[idx + 1: idx + 3] or ["qaoa", "vqe"]
