"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { input } from "@/lib/input";

declare global {
  interface Window {
    blade?: { scene: unknown; camera: unknown; renderer: unknown; input: typeof input };
  }
}

/**
 * Puts the scene, camera, renderer and input on `window.blade`, so a running
 * page can be inspected from the console or over the DevTools protocol. Only
 * mounted when the URL carries `?debug`, since it pins the whole scene graph to
 * a global and would keep it alive across a hot reload.
 */
export default function DebugHandle() {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    window.blade = { scene, camera, renderer: gl, input };
    return () => {
      delete window.blade;
    };
  }, [scene, camera, gl]);

  return null;
}
