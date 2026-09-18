from fastapi import APIRouter, HTTPException

from ..schemas import CircuitRequest, QaoaRequest, VqeRequest
from .. import qiskit_engine as qe

router = APIRouter(prefix="/api/circuit", tags=["circuit"])


@router.post("/run")
def run_circuit(req: CircuitRequest):
    try:
        gates = [g.model_dump() for g in req.gates]
        result = qe.run_circuit(req.num_qubits, gates, shots=req.shots, noisy=req.noisy)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/qaoa")
def run_qaoa(req: QaoaRequest):
    try:
        return qe.run_qaoa_maxcut(req.edges, req.num_nodes, reps=req.reps)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/vqe")
def run_vqe(req: VqeRequest):
    try:
        return qe.run_vqe_h2(reps=req.reps)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
