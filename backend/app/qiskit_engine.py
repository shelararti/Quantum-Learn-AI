"""
Core Qiskit engine: builds circuits from a simple gate-list spec, runs them
on ideal or noisy simulators, and extracts data the frontend can visualize
(statevector, Bloch vector per qubit, measurement histogram).
"""
from __future__ import annotations

from typing import List, Dict, Any, Optional
import numpy as np

from qiskit import QuantumCircuit, transpile
from qiskit.quantum_info import Statevector, DensityMatrix, partial_trace
from qiskit_aer import AerSimulator
from qiskit_aer.noise import NoiseModel, depolarizing_error


GATE_MAP = {
    "h": lambda qc, q: qc.h(q[0]),
    "x": lambda qc, q: qc.x(q[0]),
    "y": lambda qc, q: qc.y(q[0]),
    "z": lambda qc, q: qc.z(q[0]),
    "s": lambda qc, q: qc.s(q[0]),
    "t": lambda qc, q: qc.t(q[0]),
    "cx": lambda qc, q: qc.cx(q[0], q[1]),
    "cz": lambda qc, q: qc.cz(q[0], q[1]),
    "swap": lambda qc, q: qc.swap(q[0], q[1]),
    "rx": lambda qc, q, theta=0.0: qc.rx(theta, q[0]),
    "ry": lambda qc, q, theta=0.0: qc.ry(theta, q[0]),
    "rz": lambda qc, q, theta=0.0: qc.rz(theta, q[0]),
}


class GateOp:
    def __init__(self, name: str, qubits: List[int], theta: Optional[float] = None):
        self.name = name.lower()
        self.qubits = qubits
        self.theta = theta


def build_circuit(num_qubits: int, gates: List[Dict[str, Any]]) -> QuantumCircuit:
    qc = QuantumCircuit(num_qubits)
    for g in gates:
        name = g["name"].lower()
        qubits = g["qubits"]
        if name not in GATE_MAP:
            raise ValueError(f"Unsupported gate: {name}")
        if name in ("rx", "ry", "rz"):
            GATE_MAP[name](qc, qubits, theta=g.get("theta", 0.0))
        else:
            GATE_MAP[name](qc, qubits)
    return qc


def bloch_vector_for_qubit(statevector: Statevector, qubit: int, num_qubits: int) -> Dict[str, float]:
    """Reduced single-qubit density matrix -> Bloch vector (x, y, z)."""
    trace_out = [i for i in range(num_qubits) if i != qubit]
    rho = partial_trace(DensityMatrix(statevector), trace_out)
    mat = rho.data
    x = 2 * np.real(mat[0, 1])
    y = 2 * np.imag(mat[1, 0])
    z = np.real(mat[0, 0] - mat[1, 1])
    return {"x": float(x), "y": float(y), "z": float(z)}


def run_circuit(
    num_qubits: int,
    gates: List[Dict[str, Any]],
    shots: int = 1024,
    noisy: bool = False,
) -> Dict[str, Any]:
    qc = build_circuit(num_qubits, gates)

    # Statevector (ideal, pre-measurement) for visualization
    sv = Statevector.from_instruction(qc)
    amplitudes = [
        {"basis": format(i, f"0{num_qubits}b"), "re": float(np.real(a)), "im": float(np.imag(a)),
         "prob": float(np.abs(a) ** 2)}
        for i, a in enumerate(sv.data)
    ]
    bloch_vectors = [bloch_vector_for_qubit(sv, q, num_qubits) for q in range(num_qubits)]

    # Measurement circuit
    meas_qc = qc.copy()
    meas_qc.measure_all()

    if noisy:
        noise_model = NoiseModel()
        error_1q = depolarizing_error(0.02, 1)
        error_2q = depolarizing_error(0.05, 2)
        noise_model.add_all_qubit_quantum_error(error_1q, ["h", "x", "y", "z", "s", "t", "rx", "ry", "rz"])
        noise_model.add_all_qubit_quantum_error(error_2q, ["cx", "cz", "swap"])
        backend = AerSimulator(noise_model=noise_model)
    else:
        backend = AerSimulator()

    transpiled = transpile(meas_qc, backend)
    result = backend.run(transpiled, shots=shots).result()
    counts = result.get_counts()

    return {
        "counts": counts,
        "amplitudes": amplitudes,
        "bloch_vectors": bloch_vectors,
        "num_qubits": num_qubits,
        "noisy": noisy,
    }


def run_qaoa_maxcut(edges: List[List[int]], num_nodes: int, reps: int = 1) -> Dict[str, Any]:
    """Minimal QAOA Max-Cut demo. Returns the optimization trace + best bitstring."""
    from qiskit_algorithms import QAOA
    from qiskit_algorithms.optimizers import COBYLA
    from qiskit.primitives import Sampler
    from qiskit.quantum_info import SparsePauliOp

    # Build the Max-Cut cost Hamiltonian: sum over edges of 0.5*(I - Z_i Z_j)
    pauli_list = []
    for (i, j) in edges:
        z = ["I"] * num_nodes
        z[i], z[j] = "Z", "Z"
        pauli_list.append(("".join(z), -0.5))
        pauli_list.append(("I" * num_nodes, 0.5))
    hamiltonian = SparsePauliOp.from_list(pauli_list)

    history = []

    def callback(eval_count, params, mean, std):
        history.append({"iteration": eval_count, "energy": float(np.real(mean))})

    qaoa = QAOA(sampler=Sampler(), optimizer=COBYLA(maxiter=50), reps=reps, callback=callback)
    result = qaoa.compute_minimum_eigenvalue(hamiltonian)

    best_bitstring = None
    eigenstate = result.eigenstate
    if hasattr(eigenstate, "items"):
        best_key = max(eigenstate.items(), key=lambda kv: kv[1])[0]
        best_bitstring = format(best_key, f"0{num_nodes}b") if isinstance(best_key, int) else str(best_key)

    return {
        "optimal_value": float(result.eigenvalue.real),
        "history": history,
        "best_bitstring": best_bitstring,
    }


def run_vqe_h2(reps: int = 1) -> Dict[str, Any]:
    """Minimal VQE demo on a toy 2-qubit H2-like Hamiltonian (illustrative, not chemically exact)."""
    from qiskit_algorithms import VQE
    from qiskit_algorithms.optimizers import COBYLA
    from qiskit.primitives import Estimator
    from qiskit.circuit.library import TwoLocal
    from qiskit.quantum_info import SparsePauliOp

    # Illustrative 2-qubit Hamiltonian in the spirit of a minimal H2 mapping
    hamiltonian = SparsePauliOp.from_list([
        ("II", -1.05),
        ("IZ", 0.39),
        ("ZI", -0.39),
        ("ZZ", -0.01),
        ("XX", 0.18),
    ])

    ansatz = TwoLocal(2, "ry", "cz", reps=reps)
    history = []

    def callback(eval_count, params, mean, std):
        history.append({"iteration": eval_count, "energy": float(mean)})

    vqe = VQE(Estimator(), ansatz, COBYLA(maxiter=100), callback=callback)
    result = vqe.compute_minimum_eigenvalue(hamiltonian)

    return {
        "ground_state_energy": float(result.eigenvalue.real),
        "history": history,
    }
