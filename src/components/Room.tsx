"use client";

import { useCollision } from "./CollisionContext";

/**
 * The room itself is the collision-world glTF: what you walk into is what you
 * see. The ceiling is not in the model, and without it the SSGI pass has
 * nothing overhead to bounce light off, so the room reads as an open box.
 *
 * The 2024 version reached into the scene graph and added that ceiling by hand
 * on every render, leaking a mesh each time. Here it is just a mesh.
 */
export default function Room() {
  const { world } = useCollision();

  return (
    <group>
      {world ? <primitive object={world} /> : null}

      <mesh position={[0, 15, 0]} rotation={[Math.PI * 0.5, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshPhysicalMaterial color="blue" />
      </mesh>
    </group>
  );
}
