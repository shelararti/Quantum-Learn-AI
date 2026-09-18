import React, { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Line, Text } from "@react-three/drei";
import * as THREE from "three";

// Bloch-space (x, y, z) -> three.js scene space, keeping z (|0>/|1> axis) as
// the visual "up" direction so the sphere reads the way textbooks draw it.
function toScene([bx, by, bz]) {
  return [bx, bz, -by];
}

function greatCircle(plane, segments = 64) {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    if (plane === "xy") pts.push(toScene([Math.cos(t), Math.sin(t), 0]));
    if (plane === "xz") pts.push(toScene([Math.cos(t), 0, Math.sin(t)]));
    if (plane === "yz") pts.push(toScene([0, Math.cos(t), Math.sin(t)]));
  }
  return pts;
}

function BlochArrow({ x, y, z, color }) {
  const [sx, sy, sz] = toScene([x, y, z]);
  const dir = useMemo(() => new THREE.Vector3(sx, sy, sz), [sx, sy, sz]);
  const length = Math.max(dir.length(), 0.001);
  const quat = useMemo(() => {
    const normDir = length > 1e-4 ? dir.clone().normalize() : new THREE.Vector3(0, 1, 0);
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normDir);
  }, [dir, length]);

  const shaftLen = Math.max(length - 0.1, 0.001);

  return (
    <group quaternion={quat}>
      <mesh position={[0, shaftLen / 2, 0]}>
        <cylinderGeometry args={[0.015, 0.015, shaftLen, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, length, 0]}>
        <coneGeometry args={[0.05, 0.12, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.03, 12, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

export default function Bloch3D({ vector, label }) {
  const { x, y, z } = vector;

  return (
    <div style={{ width: 170, textAlign: "center" }}>
      <div style={{ width: 170, height: 170, borderRadius: "10px", overflow: "hidden", background: "var(--bg)" }}>
        <Canvas camera={{ position: [1.9, 1.5, 1.9], fov: 40 }}>
          <ambientLight intensity={0.8} />
          <pointLight position={[3, 4, 3]} intensity={0.5} />

          <mesh>
            <sphereGeometry args={[1, 24, 16]} />
            <meshBasicMaterial color="#26305c" wireframe transparent opacity={0.4} />
          </mesh>

          <Line points={greatCircle("xy")} color="#3a4578" lineWidth={1} />
          <Line points={greatCircle("xz")} color="#3a4578" lineWidth={1} />
          <Line points={greatCircle("yz")} color="#3a4578" lineWidth={1} />

          <Text position={toScene([0, 0, 1.28])} fontSize={0.16} color="#8b95ab" anchorX="center" anchorY="middle">|0⟩</Text>
          <Text position={toScene([0, 0, -1.28])} fontSize={0.16} color="#8b95ab" anchorX="center" anchorY="middle">|1⟩</Text>
          <Text position={toScene([1.25, 0, 0])} fontSize={0.13} color="#5c6690" anchorX="center" anchorY="middle">+</Text>
          <Text position={toScene([-1.25, 0, 0])} fontSize={0.13} color="#5c6690" anchorX="center" anchorY="middle">−</Text>
          <Text position={toScene([0, 1.28, 0])} fontSize={0.13} color="#5c6690" anchorX="center" anchorY="middle">+i</Text>
          <Text position={toScene([0, -1.28, 0])} fontSize={0.13} color="#5c6690" anchorX="center" anchorY="middle">−i</Text>

          <BlochArrow x={x} y={y} z={z} color="#4cc9f0" />

          <OrbitControls enablePan={false} minDistance={2.2} maxDistance={5} />
        </Canvas>
      </div>
      <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)", marginTop: "4px" }}>
        q{label}: x={x.toFixed(2)} y={y.toFixed(2)} z={z.toFixed(2)}
      </div>
    </div>
  );
}
