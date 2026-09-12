"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useState } from "react";
import { WebGPURenderer } from "three/webgpu";
import { CollisionProvider } from "./CollisionContext";
import Crosshair from "./Crosshair";
import EnvironmentHdr from "./EnvironmentHdr";
import Player from "./Player";
import Post from "./Post";
import Room from "./Room";
import SkySphere from "./SkySphere";
import Spheres from "./Spheres";

type Backend = "webgpu" | "webgl";

export default function BladeScene() {
  const [backend, setBackend] = useState<Backend | null>(null);
  const [failed, setFailed] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const onChange = () => setLocked(document.pointerLockElement !== null);
    document.addEventListener("pointerlockchange", onChange);
    return () => document.removeEventListener("pointerlockchange", onChange);
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

  return (
    <>
      <Canvas
        id="blade-canvas"
        dpr={1.5}
        // "percentage" rather than r3f's default: the default is
        // PCFSoftShadowMap, which the WebGPU renderer no longer has.
        shadows="percentage"
        camera={{ fov: 35, near: 0.1, far: 1000, position: [0, 1, 0] }}
        gl={createRenderer}
      >
        <Suspense fallback={null}>
          <CollisionProvider>
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

      {locked ? null : (
        <div className="enter">
          <h1>Blade</h1>
          <p>
            Click to look around
            <br />
            <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> move · <kbd>Space</kbd> jump
            <br />
            Hold and release the mouse to throw
            <br />
            <kbd>Esc</kbd> to let go of the pointer
          </p>
        </div>
      )}

      {backend ? <p className="backend">{backend}</p> : null}
    </>
  );
}
