/**
 * One mutable object that the simulation reads every frame and whichever control
 * surface is attached writes into: keyboard and pointer lock on a desktop, the
 * touch overlay on a phone.
 *
 * It is a module singleton rather than a React context for two reasons. It is
 * written by DOM handlers that live outside the Canvas and read by components
 * inside it, which are separate reconciler roots. And it changes several times a
 * frame, so holding it in React state would re-render the tree at input rate for
 * values that nothing renders.
 */
export type InputState = {
  /** Controls are engaged: pointer locked, or the touch overlay started. */
  active: boolean;
  /** This device is driven by touch, so there is no pointer lock to wait for. */
  touch: boolean;
  /** -1 back to 1 forward. Analogue on a thumbstick, on or off on a key. */
  forward: number;
  /** -1 left to 1 right. */
  strafe: number;
  jump: boolean;
  /**
   * Look deltas in radians, accumulated between frames and consumed by the
   * controller. Only used on touch: pointer lock rotates the camera itself.
   */
  yaw: number;
  pitch: number;
  /** Charge durations in ms, one per throw, drained by the ball simulation. */
  throws: number[];
};

export const input: InputState = {
  active: false,
  touch: false,
  forward: 0,
  strafe: 0,
  jump: false,
  yaw: 0,
  pitch: 0,
  throws: [],
};

/** Drop any movement still held when the controls are let go of. */
export function releaseInput() {
  input.forward = 0;
  input.strafe = 0;
  input.jump = false;
  input.yaw = 0;
  input.pitch = 0;
  input.throws.length = 0;
}

/**
 * Touch rather than "is this a phone": a coarse pointer is the thing that
 * actually matters, since it is also what makes pointer lock unavailable.
 */
export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

/**
 * Desktop throwing. Press on the canvas to start charging, release anywhere to
 * throw, which is how the 2024 scene had it: releasing outside the canvas should
 * still fire rather than leaving the charge stuck down.
 */
export function bindMouseThrow(canvas: HTMLElement): () => void {
  let pressedAt = 0;

  const onMouseDown = () => {
    pressedAt = performance.now();
  };

  const onMouseUp = () => {
    if (!input.active || pressedAt === 0) return;
    input.throws.push(performance.now() - pressedAt);
    pressedAt = 0;
  };

  canvas.addEventListener("mousedown", onMouseDown);
  document.addEventListener("mouseup", onMouseUp);
  return () => {
    canvas.removeEventListener("mousedown", onMouseDown);
    document.removeEventListener("mouseup", onMouseUp);
  };
}
