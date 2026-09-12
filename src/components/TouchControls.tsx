"use client";

import { useEffect, useRef } from "react";
import { input } from "@/lib/input";

/** How far from where your thumb landed counts as a full tilt, in CSS pixels. */
const STICK_RANGE = 54;
/** Radians of rotation per pixel dragged. */
const LOOK_SPEED = 0.004;
/**
 * Thumb controls for a coarse pointer: a stick that appears wherever you touch
 * the left half of the screen, drag-to-look on the right half, and two buttons.
 *
 * All of it writes into the input singleton and none of it into React state.
 * A stick that re-rendered the tree on every pointermove would cost more than
 * the frame it is trying to steer, so the knob is moved by writing a transform
 * onto the node directly.
 */
export default function TouchControls() {
  const layer = useRef<HTMLDivElement>(null);
  const stick = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const charge = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const surface = layer.current;
    const base = stick.current;
    const handle = knob.current;
    if (!surface || !base || !handle) return;

    // Which pointer is doing what. A thumb on each half at once has to keep
    // moving and looking apart, so each is tracked by its own pointerId.
    let movePointer: number | null = null;
    let lookPointer: number | null = null;
    let origin = { x: 0, y: 0 };
    let last = { x: 0, y: 0 };

    const showStick = (x: number, y: number) => {
      base.style.left = `${x}px`;
      base.style.top = `${y}px`;
      base.style.opacity = "1";
      handle.style.transform = "translate(-50%, -50%)";
    };

    const hideStick = () => {
      base.style.opacity = "0";
      input.forward = 0;
      input.strafe = 0;
    };

    const onPointerDown = (event: PointerEvent) => {
      // The buttons sit on top of this layer and handle their own pointers.
      if ((event.target as HTMLElement).closest("[data-touch-button]")) return;

      surface.setPointerCapture(event.pointerId);

      if (event.clientX < window.innerWidth / 2) {
        if (movePointer !== null) return;
        movePointer = event.pointerId;
        origin = { x: event.clientX, y: event.clientY };
        showStick(event.clientX, event.clientY);
      } else {
        if (lookPointer !== null) return;
        lookPointer = event.pointerId;
        last = { x: event.clientX, y: event.clientY };
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId === movePointer) {
        let dx = event.clientX - origin.x;
        let dy = event.clientY - origin.y;

        // Clamp to the ring, so a thumb that slides off the stick keeps
        // pointing where it last was rather than accelerating forever.
        const distance = Math.hypot(dx, dy);
        if (distance > STICK_RANGE) {
          dx = (dx / distance) * STICK_RANGE;
          dy = (dy / distance) * STICK_RANGE;
        }

        handle.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        input.strafe = dx / STICK_RANGE;
        input.forward = -dy / STICK_RANGE;
        return;
      }

      if (event.pointerId === lookPointer) {
        // Raw deltas. The controller clamps the pitch, because the limit is on
        // where the camera ends up, not on how far a thumb travelled.
        input.yaw += (event.clientX - last.x) * LOOK_SPEED;
        input.pitch += (event.clientY - last.y) * LOOK_SPEED;
        last = { x: event.clientX, y: event.clientY };
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerId === movePointer) {
        movePointer = null;
        hideStick();
      }
      if (event.pointerId === lookPointer) lookPointer = null;
    };

    surface.addEventListener("pointerdown", onPointerDown);
    surface.addEventListener("pointermove", onPointerMove);
    surface.addEventListener("pointerup", onPointerUp);
    surface.addEventListener("pointercancel", onPointerUp);
    return () => {
      surface.removeEventListener("pointerdown", onPointerDown);
      surface.removeEventListener("pointermove", onPointerMove);
      surface.removeEventListener("pointerup", onPointerUp);
      surface.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  useEffect(() => {
    const button = charge.current;
    if (!button) return;

    let pressedAt = 0;
    let frame = 0;

    // The charge ring fills over the same second the throw impulse ramps over,
    // so what you see is what you are about to throw.
    const tick = () => {
      const held = Math.min(1, (performance.now() - pressedAt) / 1000);
      button.style.setProperty("--charge", `${held}`);
      frame = requestAnimationFrame(tick);
    };

    const onDown = (event: PointerEvent) => {
      event.preventDefault();
      pressedAt = performance.now();
      button.setPointerCapture(event.pointerId);
      frame = requestAnimationFrame(tick);
    };

    const onUp = () => {
      if (pressedAt === 0) return;
      cancelAnimationFrame(frame);
      button.style.setProperty("--charge", "0");
      input.throws.push(performance.now() - pressedAt);
      pressedAt = 0;
    };

    button.addEventListener("pointerdown", onDown);
    button.addEventListener("pointerup", onUp);
    button.addEventListener("pointercancel", onUp);
    return () => {
      cancelAnimationFrame(frame);
      button.removeEventListener("pointerdown", onDown);
      button.removeEventListener("pointerup", onUp);
      button.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return (
    <div ref={layer} className="touch-layer">
      <div ref={stick} className="stick">
        <div ref={knob} className="stick-knob" />
      </div>

      <button
        ref={charge}
        data-touch-button
        className="touch-button throw"
        type="button"
        aria-label="Hold to charge, release to throw"
      >
        throw
      </button>

      <button
        data-touch-button
        className="touch-button jump"
        type="button"
        aria-label="Jump"
        onPointerDown={(event) => {
          event.preventDefault();
          input.jump = true;
        }}
        onPointerUp={() => {
          input.jump = false;
        }}
        onPointerCancel={() => {
          input.jump = false;
        }}
      >
        jump
      </button>
    </div>
  );
}
