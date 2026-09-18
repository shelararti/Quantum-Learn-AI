from typing import List, Optional
from pydantic import BaseModel


class Gate(BaseModel):
    name: str
    qubits: List[int]
    theta: Optional[float] = None


class CircuitRequest(BaseModel):
    num_qubits: int
    gates: List[Gate]
    shots: int = 1024
    noisy: bool = False


class ChatTurn(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class TutorRequest(BaseModel):
    message: str
    topic: Optional[str] = None
    level: Optional[str] = "beginner"
    history: Optional[List[ChatTurn]] = None
    user_id: Optional[str] = "default"


class GuessGameRequest(BaseModel):
    guess: str  # "0" or "1"
    bias: Optional[float] = 0.5  # probability of measuring |1>, via Ry rotation


class DiceRequest(BaseModel):
    sides: int = 6


class QaoaRequest(BaseModel):
    edges: List[List[int]]
    num_nodes: int
    reps: int = 1


class VqeRequest(BaseModel):
    reps: int = 1
