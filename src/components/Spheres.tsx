"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useCollision } from "./CollisionContext";

const COUNT = 50;
const RADIUS = 0.1;
const GRAVITY = 30;
const STEPS_PER_FRAME = 5;

// Where the ball leaves your hands: forward and a little down and right of the
// camera, which is where the rifle's nozzle sat in the 2024 scene.
const OFFSET_FORWARD = 0.9;
const OFFSET_RIGHT = 0.2;
const OFFSET_DOWN = 0.11;

type Ball = { collider: THREE.Sphere; velocity: THREE.Vector3 };

/**
 * Fifty balls, thrown one at a time in a ring buffer. Hold the mouse to charge
 * the throw. They bounce off the world octree, off the player, and off each
 * other.
 *
 * They are one InstancedMesh here rather than fifty meshes sharing a geometry.
 * Same pixels, one draw call, and the SSGI pass reads the same depth either
 * way.
 */
export default function Spheres() {
  const camera = useThree((s) => s.camera);
  const { octree, ready, playerCollider, playerVelocity } = useCollision();

  const instances = useRef<THREE.InstancedMesh>(null);
  const next = useRef(0);
  const pressedAt = useRef(0);

  const balls = useMemo<Ball[]>(
    () =>
      Array.from({ length: COUNT }, () => ({
        // Parked below the floor until thrown.
        collider: new THREE.Sphere(new THREE.Vector3(0, -100, 0), RADIUS),
        velocity: new THREE.Vector3(),
      })),
    [],
  );

  // Reused every frame so the simulation allocates nothing.
  const scratch = useMemo(
    () => ({
      forward: new THREE.Vector3(),
      right: new THREE.Vector3(),
      down: new THREE.Vector3(),
      nozzle: new THREE.Vector3(),
      center: new THREE.Vector3(),
      normal: new THREE.Vector3(),
      v1: new THREE.Vector3(),
      v2: new THREE.Vector3(),
      matrix: new THREE.Matrix4(),
    }),
    [],
  );

  // Park every instance below the floor on mount. Without this the matrices
  // start as identity and all fifty balls sit in one lump at the origin until
  // the first simulated frame, which only runs once the pointer is locked.
  useEffect(() => {
    const mesh = instances.current;
    if (!mesh) return;
    balls.forEach((ball, index) => {
      scratch.matrix.setPosition(ball.collider.center);
      mesh.setMatrixAt(index, scratch.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [balls, scratch]);

  useEffect(() => {
    const canvas = document.getElementById("blade-canvas");
    if (!canvas) return;

    const onMouseDown = () => {
      pressedAt.current = performance.now();
    };

    const onMouseUp = () => {
      if (!document.pointerLockElement || !playerVelocity.current) return;

      const ball = balls[next.current];
      scratch.forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
      scratch.right.set(1, 0, 0).applyQuaternion(camera.quaternion);
      scratch.down.set(0, -1, 0).applyQuaternion(camera.quaternion);

      ball.collider.center
        .copy(camera.position)
        .addScaledVector(scratch.forward, OFFSET_FORWARD)
        .addScaledVector(scratch.right, OFFSET_RIGHT)
        .addScaledVector(scratch.down, OFFSET_DOWN);

      // Charge: held longer throws harder, levelling off around 200.
      const impulse = 80 + 120 * (1 - Math.exp((pressedAt.current - performance.now()) * 0.001));
      ball.velocity
        .copy(scratch.forward)
        .multiplyScalar(impulse)
        .addScaledVector(playerVelocity.current, 3);

      next.current = (next.current + 1) % balls.length;
    };

    canvas.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [balls, camera, playerVelocity, scratch]);

  useFrame((_, delta) => {
    const world = octree.current;
    const mesh = instances.current;
    const collider = playerCollider.current;
    const velocity = playerVelocity.current;
    if (!ready || !world || !mesh || !collider || !velocity) return;

    const deltaTime = Math.min(0.05, delta) / STEPS_PER_FRAME;

    for (let step = 0; step < STEPS_PER_FRAME; step++) {
      for (const ball of balls) {
        ball.collider.center.addScaledVector(ball.velocity, deltaTime);

        const hit = world.sphereIntersect(ball.collider);
        if (hit) {
          // 1.5 rather than 2: a bounce that keeps a little under half its energy.
          ball.velocity.addScaledVector(hit.normal, -hit.normal.dot(ball.velocity) * 1.5);
          ball.collider.center.addScaledVector(hit.normal, hit.depth);
        } else {
          ball.velocity.y -= GRAVITY * deltaTime;
        }

        ball.velocity.addScaledVector(ball.velocity, Math.exp(-1.5 * deltaTime) - 1);

        // Against the player capsule: test its two caps and its middle.
        scratch.center.addVectors(collider.start, collider.end).multiplyScalar(0.5);
        const reach = collider.radius + ball.collider.radius;
        for (const point of [collider.start, collider.end, scratch.center]) {
          const distance2 = point.distanceToSquared(ball.collider.center);
          if (distance2 >= reach * reach) continue;

          scratch.normal.subVectors(point, ball.collider.center).normalize();
          scratch.v1.copy(scratch.normal).multiplyScalar(scratch.normal.dot(velocity));
          scratch.v2.copy(scratch.normal).multiplyScalar(scratch.normal.dot(ball.velocity));

          velocity.add(scratch.v2).sub(scratch.v1);
          ball.velocity.add(scratch.v1).sub(scratch.v2);
          ball.collider.center.addScaledVector(
            scratch.normal,
            -(reach - Math.sqrt(distance2)) / 2,
          );
        }
      }

      // Ball against ball, every pair once.
      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          const a = balls[i];
          const b = balls[j];
          const distance2 = a.collider.center.distanceToSquared(b.collider.center);
          const reach = a.collider.radius + b.collider.radius;
          if (distance2 >= reach * reach) continue;

          scratch.normal.subVectors(a.collider.center, b.collider.center).normalize();
          scratch.v1.copy(scratch.normal).multiplyScalar(scratch.normal.dot(a.velocity));
          scratch.v2.copy(scratch.normal).multiplyScalar(scratch.normal.dot(b.velocity));

          a.velocity.add(scratch.v2).sub(scratch.v1);
          b.velocity.add(scratch.v1).sub(scratch.v2);

          const push = (reach - Math.sqrt(distance2)) / 2;
          a.collider.center.addScaledVector(scratch.normal, push);
          b.collider.center.addScaledVector(scratch.normal, -push);
        }
      }
    }

    balls.forEach((ball, index) => {
      scratch.matrix.setPosition(ball.collider.center);
      mesh.setMatrixAt(index, scratch.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={instances}
      args={[undefined, undefined, COUNT]}
      castShadow
      receiveShadow
      // The instance matrices move every frame and start parked under the
      // floor, so the mesh's own bounds are never right. Culling it by them
      // makes thrown balls vanish.
      frustumCulled={false}
    >
      <icosahedronGeometry args={[RADIUS, 5]} />
      <meshLambertMaterial color="#dede8d" />
    </instancedMesh>
  );
}
