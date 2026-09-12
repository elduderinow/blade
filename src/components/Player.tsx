"use client";

import { PointerLockControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { Capsule } from "three/examples/jsm/math/Capsule.js";
import { input } from "@/lib/input";
import { useCollision } from "./CollisionContext";

const GRAVITY = 30;
const STEPS_PER_FRAME = 5;
const JUMP_SPEED = 15;
/** How far you can look up or down before you would be upside down. */
const PITCH_LIMIT = Math.PI / 2 - 0.01;

/**
 * three.js's own FPS demo controller: a capsule stepped five times a frame
 * against the world octree, with the camera riding its top cap.
 *
 * It reads the input singleton rather than the keyboard, so the same controller
 * runs from a keyboard or from a thumbstick.
 */
function Controller() {
  const camera = useThree((s) => s.camera);
  const { octree, ready, playerCollider, playerVelocity } = useCollision();

  const direction = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const step = useRef(new THREE.Vector3());
  const onFloor = useRef(false);

  useEffect(() => {
    camera.rotation.order = "YXZ";
  }, [camera]);

  /**
   * WASD and ZQSD both work, which is how the 2024 version had it: Ray's
   * keyboard is AZERTY. Keys are held as a set and folded down to the same two
   * axes the thumbstick writes, so the controller sees one kind of input.
   */
  useEffect(() => {
    const held = { forward: false, backward: false, left: false, right: false };

    const set = (code: string, down: boolean) => {
      if (code === "KeyW" || code === "KeyZ") held.forward = down;
      else if (code === "KeyS") held.backward = down;
      else if (code === "KeyA" || code === "KeyQ") held.left = down;
      else if (code === "KeyD") held.right = down;
      else if (code === "Space") input.jump = down;
      else return;

      input.forward = (held.forward ? 1 : 0) - (held.backward ? 1 : 0);
      input.strafe = (held.right ? 1 : 0) - (held.left ? 1 : 0);
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
    if (!input.active || !ready || !octree.current) return;

    // On touch there is no pointer lock to rotate the camera for us, so the
    // accumulated drag is applied here and consumed.
    if (input.yaw !== 0 || input.pitch !== 0) {
      camera.rotation.y -= input.yaw;
      camera.rotation.x = Math.max(
        -PITCH_LIMIT,
        Math.min(PITCH_LIMIT, camera.rotation.x - input.pitch),
      );
      input.yaw = 0;
      input.pitch = 0;
    }

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
      if (input.forward !== 0) {
        velocity.addScaledVector(direction.current, speed * input.forward);
      }

      right.current.crossVectors(direction.current, camera.up).normalize();
      if (input.strafe !== 0) {
        velocity.addScaledVector(right.current, speed * input.strafe);
      }

      if (onFloor.current && input.jump) velocity.y = JUMP_SPEED;
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
      {/* Pointer lock does not exist on a coarse pointer, where the touch
          overlay turns drags into camera rotation instead. */}
      {input.touch ? null : <PointerLockControls makeDefault selector="#blade-canvas" />}
      <Controller />
    </>
  );
}
