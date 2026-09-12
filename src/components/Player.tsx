"use client";

import { PointerLockControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { Capsule } from "three/examples/jsm/math/Capsule.js";
import { useCollision } from "./CollisionContext";

const GRAVITY = 30;
const STEPS_PER_FRAME = 5;
const JUMP_SPEED = 15;

/**
 * three.js's own FPS demo controller: a capsule stepped five times a frame
 * against the world octree, with the camera riding its top cap.
 *
 * WASD and ZQSD both work, which is how the 2024 version had it: Ray's keyboard
 * is AZERTY.
 */
function Controller() {
  const camera = useThree((s) => s.camera);
  const { octree, ready, playerCollider, playerVelocity } = useCollision();

  const direction = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const step = useRef(new THREE.Vector3());
  const onFloor = useRef(false);
  const keys = useRef({ forward: false, backward: false, left: false, right: false, jump: false });

  useEffect(() => {
    camera.rotation.order = "YXZ";
  }, [camera]);

  useEffect(() => {
    const set = (code: string, down: boolean) => {
      if (code === "KeyW" || code === "KeyZ") keys.current.forward = down;
      if (code === "KeyS") keys.current.backward = down;
      if (code === "KeyA" || code === "KeyQ") keys.current.left = down;
      if (code === "KeyD") keys.current.right = down;
      if (code === "Space") keys.current.jump = down;
    };

    const onKeyDown = (event: KeyboardEvent) => set(event.code, true);
    const onKeyUp = (event: KeyboardEvent) => set(event.code, false);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useFrame((_, delta) => {
    if (!document.pointerLockElement || !ready || !octree.current) return;

    if (!playerCollider.current || !playerVelocity.current) {
      playerCollider.current = new Capsule(
        new THREE.Vector3(0, 0.35, 0),
        new THREE.Vector3(0, 1, 0),
        0.35,
      );
      playerVelocity.current = new THREE.Vector3();
    }

    const world = octree.current;
    const collider = playerCollider.current;
    const velocity = playerVelocity.current;
    const deltaTime = Math.min(0.05, delta) / STEPS_PER_FRAME;

    for (let i = 0; i < STEPS_PER_FRAME; i++) {
      camera.getWorldDirection(direction.current);
      direction.current.y = 0;
      direction.current.normalize();

      const speed = deltaTime * (onFloor.current ? 25 : 8);
      if (keys.current.forward) velocity.addScaledVector(direction.current, speed);
      if (keys.current.backward) velocity.addScaledVector(direction.current, -speed);

      right.current.crossVectors(direction.current, camera.up).normalize();
      if (keys.current.right) velocity.addScaledVector(right.current, speed);
      if (keys.current.left) velocity.addScaledVector(right.current, -speed);

      if (onFloor.current && keys.current.jump) velocity.y = JUMP_SPEED;
      if (!onFloor.current) velocity.y -= GRAVITY * deltaTime;

      // Damping, weaker in the air so a jump keeps its arc.
      const damping = Math.exp(-4 * deltaTime) - 1;
      velocity.addScaledVector(velocity, onFloor.current ? damping : damping * 0.1);

      step.current.copy(velocity).multiplyScalar(deltaTime);
      collider.translate(step.current);

      const hit = world.capsuleIntersect(collider);
      onFloor.current = false;
      if (hit) {
        onFloor.current = hit.normal.y > 0;
        if (!onFloor.current) {
          velocity.addScaledVector(hit.normal, -hit.normal.dot(velocity));
        }
        if (hit.depth >= 1e-10) {
          collider.translate(hit.normal.multiplyScalar(hit.depth));
        }
      }
    }

    camera.position.copy(collider.end);
  });

  return null;
}

export default function Player() {
  return (
    <>
      <PointerLockControls makeDefault selector="#blade-canvas" />
      <Controller />
    </>
  );
}
