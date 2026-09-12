"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useState } from "react";
import { WebGPURenderer } from "three/webgpu";
import { bindMouseThrow, input, isTouchDevice, releaseInput } from "@/lib/input";
import { CollisionProvider } from "./CollisionContext";
import DebugHandle from "./DebugHandle";
import Crosshair from "./Crosshair";
import EnvironmentHdr from "./EnvironmentHdr";
import Player from "./Player";
import Post from "./Post";
import Room from "./Room";
import SkySphere from "./SkySphere";
import Spheres from "./Spheres";
import TouchControls from "./TouchControls";

type Backend = "webgpu" | "webgl";

export default function BladeScene() {
  const [backend, setBackend] = useState<Backend | null>(null);
  const [failed, setFailed] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [touch, setTouch] = useState<boolean | null>(null);
  const [debug, setDebug] = useState(false);

  // Which control surface this device gets can only be known in the browser,
  // and it decides what the whole scene mounts, so nothing renders until it is.
  useEffect(() => {
    const coarse = isTouchDevice();
    input.touch = coarse;
    setTouch(coarse);
    setDebug(new URLSearchParams(window.location.search).has("debug"));
  }, []);

  // Desktop: the pointer lock is what engages the controls.
  useEffect(() => {
    if (touch !== false) return;

    const onChange = () => {
      const locked = document.pointerLockElement !== null;
      input.active = locked;
      if (!locked) releaseInput();
      setEngaged(locked);
    };

    document.addEventListener("pointerlockchange", onChange);
    return () => document.removeEventListener("pointerlockchange", onChange);
  }, [touch]);

  useEffect(() => {
    if (touch !== false) return;
    const canvas = document.getElementById("blade-canvas");
    if (!canvas) return;
    return bindMouseThrow(canvas);
  }, [touch, backend]);

  // Touch: a tap engages them, and there is nothing to release them again, so
  // the overlay is gone for good once the room starts.
  const start = useCallback(() => {
    input.active = true;
    setEngaged(true);
    // Worth a try on Android, where it reclaims the address bar. iOS Safari on
    // a phone does not have it at all, and other browsers can reject it either
    // by throwing or by rejecting, so both have to be swallowed.
    try {
      void document.documentElement.requestFullscreen?.().catch(() => {});
    } catch {
      // Fullscreen is a nicety. Not having it changes nothing about the room.
    }
  }, []);

  /**
   * WebGPU where available, WebGL 2 otherwise. SSGI and TRAA are node graphs,
   * so they compile to WGSL or GLSL from the same source either way, though
   * the pass is heavy enough that WebGL 2 will feel it.
   */
  const createRenderer = useCallback(async (props: object) => {
    const hasWebGPU = typeof navigator !== "undefined" && "gpu" in navigator;

    const renderer = new WebGPURenderer({
      ...(props as ConstructorParameters<typeof WebGPURenderer>[0]),
      forceWebGL: !hasWebGPU,
      powerPreference: "high-performance",
      antialias: false,
      alpha: false,
      stencil: false,
    });

    try {
      await renderer.init();
    } catch (error) {
      setFailed(true);
      throw error;
    }

    renderer.shadowMap.enabled = true;

    const active = renderer.backend as { isWebGPUBackend?: boolean };
    setBackend(active.isWebGPUBackend === true ? "webgpu" : "webgl");
    return renderer;
  }, []);

  if (failed) {
    return (
      <div className="status">
        <p>This scene could not start a GPU context.</p>
        <p className="muted">It needs WebGPU or WebGL 2.</p>
      </div>
    );
  }

  if (touch === null) return <div className="status">Loading the room…</div>;

  return (
    <>
      <Canvas
        id="blade-canvas"
        // A phone runs the same SSGI pass as a desktop over four times the
        // pixels per CSS pixel. Rendering at 1 keeps it on its feet.
        dpr={touch ? 1 : 1.5}
        // "percentage" rather than r3f's default: the default is
        // PCFSoftShadowMap, which the WebGPU renderer no longer has.
        shadows="percentage"
        // The rotation is not decoration: r3f points a camera at the origin
        // unless the prop carries one, and this camera spawns at (0, 1, 0), so
        // "look at the origin" means look straight down at the floor. Level and
        // facing -z is what the room was built to be entered from.
        camera={{ fov: 35, near: 0.1, far: 1000, position: [0, 1, 0], rotation: [0, 0, 0] }}
        gl={createRenderer}
      >
        <Suspense fallback={null}>
          <CollisionProvider>
            {debug ? <DebugHandle /> : null}
            <Player />
            <Room />
            <Spheres />
            <Crosshair />
            <SkySphere />
            <EnvironmentHdr file="/hdri/kiara_1_dawn_1k.hdr" intensity={0.5} blur={1} background={false} />
            <Post />
          </CollisionProvider>
        </Suspense>
      </Canvas>

      {touch && engaged ? <TouchControls /> : null}

      {engaged ? null : (
        <div className={touch ? "enter tappable" : "enter"} onPointerDown={touch ? start : undefined}>
          <h1>Blade</h1>
          {touch ? (
            <p>
              Tap to start
              <br />
              Left thumb to move · drag the right to look
              <br />
              Hold <kbd>throw</kbd> to charge, let go to throw
            </p>
          ) : (
            <p>
              Click to look around
              <br />
              <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> move · <kbd>Space</kbd> jump
              <br />
              Hold and release the mouse to throw
              <br />
              <kbd>Esc</kbd> to let go of the pointer
            </p>
          )}
        </div>
      )}

      {backend ? <p className="backend">{backend}</p> : null}
    </>
  );
}
