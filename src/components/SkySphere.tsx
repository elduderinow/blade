"use client";

import { BackSide } from "three";

const RADIUS = 400;

/**
 * A black shell around everything. The environment map lights the room but
 * must not be visible through the doorway, and this is cheaper than clearing
 * to a colour behind a composed pipeline whose output is opaque.
 */
export default function SkySphere() {
  return (
    <mesh name="sky-sphere" renderOrder={-1}>
      <sphereGeometry args={[RADIUS, 32, 24]} />
      <meshBasicMaterial color="black" side={BackSide} depthWrite={false} />
    </mesh>
  );
}
