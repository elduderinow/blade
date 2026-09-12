"use client";

import { useGLTF } from "@react-three/drei";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import type { Capsule } from "three/examples/jsm/math/Capsule.js";
import { Octree } from "three/examples/jsm/math/Octree.js";

const COLLISION_WORLD_URL = "/model/collision-world.glb";

/**
 * The room is both the thing you see and the thing you walk into. One glTF is
 * loaded, rendered, and fed to an Octree that the player capsule and every
 * thrown sphere test against.
 */
type CollisionValue = {
  world: THREE.Object3D | null;
  octree: React.RefObject<Octree | null>;
  ready: boolean;
  playerCollider: React.RefObject<Capsule | null>;
  playerVelocity: React.RefObject<THREE.Vector3 | null>;
};

const CollisionContext = createContext<CollisionValue | null>(null);

export function useCollision(): CollisionValue {
  const value = useContext(CollisionContext);
  if (!value) throw new Error("useCollision must be used inside <CollisionProvider>");
  return value;
}

export function CollisionProvider({ children }: { children: ReactNode }) {
  const { scene: world } = useGLTF(COLLISION_WORLD_URL);
  const octree = useRef<Octree | null>(null);
  const playerCollider = useRef<Capsule | null>(null);
  const playerVelocity = useRef<THREE.Vector3 | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!world) return;

    world.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    const built = new Octree();
    built.fromGraphNode(world);
    octree.current = built;
    setReady(true);

    return () => {
      octree.current = null;
      setReady(false);
    };
  }, [world]);

  return (
    <CollisionContext.Provider value={{ world, octree, ready, playerCollider, playerVelocity }}>
      {children}
    </CollisionContext.Provider>
  );
}

useGLTF.preload(COLLISION_WORLD_URL);
