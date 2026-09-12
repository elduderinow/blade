"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const DISTANCE = 0.4;
const SIZE = 0.003;
const GAP = 0.001;

/**
 * Four short lines pinned in front of the camera. The 2024 version built them
 * as four separate Line objects with four cloned materials; one geometry of
 * eight vertices drawn as LineSegments is the same picture.
 */
export default function Crosshair() {
  const group = useRef<THREE.Group>(null);
  const forward = useRef(new THREE.Vector3());
  const camera = useThree((s) => s.camera);

  const geometry = useMemo(() => {
    const points = new Float32Array([
      0, GAP, 0, 0, SIZE, 0,
      0, -SIZE, 0, 0, -GAP, 0,
      -SIZE, 0, 0, -GAP, 0, 0,
      GAP, 0, 0, SIZE, 0, 0,
    ]);
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute("position", new THREE.BufferAttribute(points, 3));
    return buffer;
  }, []);

  useFrame(() => {
    if (!group.current) return;
    forward.current.set(0, 0, -1).applyQuaternion(camera.quaternion);
    group.current.position.copy(camera.position).addScaledVector(forward.current, DISTANCE);
    group.current.quaternion.copy(camera.quaternion);
  });

  return (
    <group ref={group}>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial color="#00c203" />
      </lineSegments>
    </group>
  );
}
