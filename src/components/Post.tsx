"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import type { PerspectiveCamera } from "three";
import { RenderPipeline, UnsignedByteType, type WebGPURenderer } from "three/webgpu";
import {
  diffuseColor,
  mrt,
  normalView,
  packNormalToRGB,
  output,
  pass,
  sample,
  unpackRGBToNormal,
  vec4,
  velocity,
} from "three/tsl";
import { ssgi } from "three/examples/jsm/tsl/display/SSGINode.js";
import { traa } from "three/examples/jsm/tsl/display/TRAANode.js";

/**
 * Screen-space global illumination, and it is the whole lighting rig: both
 * lights in the 2024 scene sit at intensity 0, so every photon in the room
 * comes from the environment map and from this pass bouncing it around.
 *
 * The settings were leva sliders in 2024. These are the values they were left
 * at.
 */
const SSGI_SETTINGS = {
  sliceCount: 1,
  stepCount: 7,
  radius: 3,
  expFactor: 2,
  thickness: 1.28,
  backfaceLighting: 0,
  aoIntensity: 2.1,
  giIntensity: 4,
  useLinearThickness: true,
  useScreenSpaceSampling: true,
};

export default function Post() {
  const renderer = useThree((s) => s.gl) as unknown as WebGPURenderer;
  const scene = useThree((s) => s.scene);
  // The canvas only ever makes a perspective camera; SSGI needs its fov and
  // near/far planes to reconstruct view positions from depth.
  const camera = useThree((s) => s.camera as PerspectiveCamera);

  const pipeline = useMemo(() => {
    const composed = new RenderPipeline(renderer);

    // SSGI needs four targets: the lit frame, the flat albedo it bounces,
    // view normals, and per-pixel motion for the temporal pass.
    const scenePass = pass(scene, camera);
    scenePass.setMRT(
      mrt({
        output,
        diffuseColor,
        normal: packNormalToRGB(normalView),
        velocity,
      }),
    );

    // Normals and albedo do not need float precision. Byte targets halve the
    // bandwidth this pass costs, which is most of what it costs.
    scenePass.getTexture("diffuseColor").type = UnsignedByteType;
    scenePass.getTexture("normal").type = UnsignedByteType;

    const color = scenePass.getTextureNode("output");
    const diffuse = scenePass.getTextureNode("diffuseColor");
    const depth = scenePass.getTextureNode("depth");
    const normal = scenePass.getTextureNode("normal");
    const motion = scenePass.getTextureNode("velocity");

    const sceneNormal = sample((uv) => unpackRGBToNormal(normal.sample(uv)));

    const gi = ssgi(color, depth, sceneNormal, camera);
    for (const [key, value] of Object.entries(SSGI_SETTINGS)) {
      (gi as unknown as Record<string, { value: unknown }>)[key].value = value;
    }

    // Occlusion darkens what was already lit; indirect light is added on top
    // of the flat albedo, so a red wall throws red light.
    const composite = vec4(color.rgb.mul(gi.a).add(diffuse.rgb.mul(gi.rgb)), color.a);

    composed.outputNode = gi.useTemporalFiltering
      ? traa(composite, depth, motion, camera)
      : composite;

    return composed;
  }, [renderer, scene, camera]);

  useEffect(() => () => pipeline.dispose(), [pipeline]);

  // Priority above 0 takes the loop from r3f, so the composed frame is what
  // reaches the canvas rather than a plain scene render.
  useFrame(() => {
    pipeline.render();
  }, 1);

  return null;
}
