"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";
import type { WebGPURenderer } from "three/webgpu";
import { PMREMGenerator } from "three/webgpu";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";

/**
 * drei's <Environment preset="dawn" environmentIntensity={0.5} blur={1}>,
 * rebuilt by hand.
 *
 * Two reasons it cannot be drei's. Its presets are downloaded from a CDN at
 * runtime, and its prefilter path uses the core PMREMGenerator, which builds a
 * plain ShaderMaterial the node renderer rejects outright ("Material
 * ShaderMaterial is not compatible") and so leaves no environment map at all.
 *
 * The same HDR the preset points at is vendored into public/hdri, so the
 * deployed site fetches nothing off-site.
 */
export default function EnvironmentHdr({
  file,
  blur = 1,
  intensity = 1,
  background = true,
}: {
  file: string;
  blur?: number;
  intensity?: number;
  background?: boolean;
}) {
  const scene = useThree((s) => s.scene);
  const renderer = useThree((s) => s.gl);

  useEffect(() => {
    let disposed = false;
    let envMap: THREE.Texture | null = null;

    new HDRLoader().load(file, (texture) => {
      if (disposed) {
        texture.dispose();
        return;
      }

      // PMREMGenerator must come from three/webgpu. The core one prefilters
      // with a plain ShaderMaterial, which the node renderer rejects outright
      // ("Material ShaderMaterial is not compatible"), leaving no environment
      // map at all and therefore nothing for the glass to refract.
      const pmrem = new PMREMGenerator(renderer as unknown as WebGPURenderer);
      envMap = pmrem.fromEquirectangular(texture).texture;
      pmrem.dispose();
      texture.dispose();

      scene.environment = envMap;
      scene.environmentIntensity = intensity;
      if (background) {
        scene.background = envMap;
        scene.backgroundBlurriness = blur;
      }
    });

    return () => {
      disposed = true;
      scene.environment = null;
      scene.background = null;
      envMap?.dispose();
    };
  }, [file, blur, intensity, background, scene, renderer]);

  return null;
}
