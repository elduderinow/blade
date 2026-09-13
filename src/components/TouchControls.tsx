"use client";

import { useEffect, useRef } from "react";
import { input } from "@/lib/input";

/** Radians of rotation per pixel dragged. */
const LOOK_SPEED = 0.004;

type Direction = "up" | "down" | "left" | "right";

/**
 * Thumb controls for a coarse pointer: a four-way pad bottom left, drag
 * anywhere else to look, and two buttons on the right.
 *
 * The pad is four buttons rather than a stick because a stick needs a thumb to
 * stay put on a surface that is also the thing you are looking at, and on a
 * phone held in landscape there is nowhere to put it that is not already under
 * a hand. Buttons you can find without looking.
 *
 * All of it writes into the input singleton and none of it into React state. A
 * pad that re-rendered the tree on every pointermove would cost more than the
 * frame it is trying to steer, so the pressed styling is a class written onto
 * the node directly.
 */
export default function TouchControls() {
  const layer = useRef<HTMLDivElement>(null);
  const pad = useRef<HTMLDivElement>(null);
  const charge = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const surface = layer.current;
    const padEl = pad.current;
    if (!surface || !padEl) return;

    // Which pointer is holding which direction. A thumb can slide from one
    // arrow onto another without lifting, and two thumbs can hold a diagonal,
    // so the mapping has to be per pointer rather than per button.
    const holding = new Map<number, Direction>();
    let lookPointer: number | null = null;
    let last = { x: 0, y: 0 };

    const directionAt = (x: number, y: number): Direction | null => {
      const el = document.elementFromPoint(x, y);
      const arrow = (el as HTMLElement | null)?.closest?.("[data-dir]");
      return (arrow?.getAttribute("data-dir") as Direction | undefined) ?? null;
    };

    /**
     * Recomputed from every held direction at once. Opposing arrows cancel,
     * which is what a stick would do and what the keyboard already does.
     */
    const apply = () => {
      const held = new Set(holding.values());
      input.forward = (held.has("up") ? 1 : 0) - (held.has("down") ? 1 : 0);
      input.strafe = (held.has("right") ? 1 : 0) - (held.has("left") ? 1 : 0);

      for (const arrow of padEl.querySelectorAll<HTMLElement>("[data-dir]")) {
        arrow.classList.toggle("held", held.has(arrow.dataset.dir as Direction));
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      // The throw and jump buttons handle their own pointers.
      if (target.closest("[data-touch-button]")) return;

      surface.setPointerCapture(event.pointerId);

      const direction = directionAt(event.clientX, event.clientY);
      if (direction) {
        holding.set(event.pointerId, direction);
        apply();
        return;
      }

      // Anything that is not the pad looks around, either half of the screen.
      // Reserving a half for movement costs the half of a landscape phone that
      // is easiest to reach.
      if (lookPointer !== null) return;
      lookPointer = event.pointerId;
      last = { x: event.clientX, y: event.clientY };
    };

    const onPointerMove = (event: PointerEvent) => {
      if (holding.has(event.pointerId)) {
        const direction = directionAt(event.clientX, event.clientY);
        // Sliding off the pad entirely releases, rather than sticking on the
        // last arrow the thumb happened to cross.
        if (direction) holding.set(event.pointerId, direction);
        else holding.delete(event.pointerId);
        apply();
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
      if (holding.delete(event.pointerId)) apply();
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
      input.forward = 0;
      input.strafe = 0;
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
      <div ref={pad} className="dpad">
        <span className="dpad-arrow up" data-dir="up" aria-label="Forward" />
        <span className="dpad-arrow left" data-dir="left" aria-label="Left" />
        <span className="dpad-arrow right" data-dir="right" aria-label="Right" />
        <span className="dpad-arrow down" data-dir="down" aria-label="Back" />
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
