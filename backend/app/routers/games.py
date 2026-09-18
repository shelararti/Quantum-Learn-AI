import math
import random

from fastapi import APIRouter
from qiskit import QuantumCircuit, transpile
from qiskit_aer import AerSimulator

from ..schemas import GuessGameRequest, DiceRequest

router = APIRouter(prefix="/api/games", tags=["games"])
_sim = AerSimulator()


def _measure_once(qc: QuantumCircuit) -> str:
    qc = qc.copy()
    qc.measure_all()
    transpiled = transpile(qc, _sim)
    result = _sim.run(transpiled, shots=1).result()
    counts = result.get_counts()
    return list(counts.keys())[0]


@router.post("/guess")
def guess_outcome(req: GuessGameRequest):
    """Player guesses 0 or 1 before a biased qubit is measured."""
    bias = max(0.0, min(1.0, req.bias if req.bias is not None else 0.5))
    theta = 2 * math.asin(math.sqrt(bias))  # P(|1>) = sin^2(theta/2)
    qc = QuantumCircuit(1)
    qc.ry(theta, 0)
    outcome = _measure_once(qc)[-1]  # rightmost bit = qubit 0
    correct = str(req.guess) == outcome
    return {"outcome": outcome, "correct": correct, "bias_used": bias}


@router.get("/coinflip")
def coin_flip():
    qc = QuantumCircuit(1)
    qc.h(0)
    outcome = _measure_once(qc)[-1]
    return {"result": "heads" if outcome == "0" else "tails"}


@router.post("/dice")
def quantum_dice(req: DiceRequest):
    """Roll an N-sided die using qubits in superposition + rejection sampling."""
    sides = max(2, min(20, req.sides))
    n_qubits = math.ceil(math.log2(sides))
    qc = QuantumCircuit(n_qubits)
    for q in range(n_qubits):
        qc.h(q)

    for _ in range(50):  # safety cap on rejection sampling
        bitstring = _measure_once(qc)
        value = int(bitstring, 2)
        if value < sides:
            return {"roll": value + 1, "sides": sides}

    return {"roll": random.randint(1, sides), "sides": sides, "note": "fallback used"}
