# Blade

A first-person room you can walk around and throw balls in. Rendered with
three.js on **WebGPU**, with screen-space global illumination and temporal
anti-aliasing written in TSL.

Click the canvas to take the pointer, `W` `A` `S` `D` (or `Z` `Q` `S` `D`) to
move, `Space` to jump, hold and release the mouse to throw a ball. `Esc` gives
the pointer back.

## Running it

```bash
npm install
npm run dev
```

`next dev` compiles the scene chunk lazily and that chunk is large. On a slow
machine `npm run build && npm start` gets you to a rendered frame much sooner.

## What is in it

- **Renderer** — `WebGPURenderer` from `three/webgpu`, falling back to WebGL 2
  when `navigator.gpu` is missing. The badge in the corner says which one you
  got.
- **Collision** — a `three-stdlib` `Octree` built from `collision-world.glb`,
  with a capsule player and a ball simulation, both stepped five times a frame.
- **Lighting** — no lights at all. A dawn HDRI drives the environment and SSGI
  bounces it around the room.
- **Post** — `RenderPipeline` with an MRT pass feeding `ssgi()` and `traa()`.

## How the port differs

The source scene was one route inside a larger Next.js portfolio. This is that
route on its own, and a few things changed on the way out.

**Lights are gone rather than zeroed.** The original kept an ambient light and a
directional light in the tree with `intensity={0}`, left over from before SSGI
landed. Two lights that emit nothing still cost a uniform buffer and a shadow
map slot, so they are deleted here. The scene looks identical.

**Rifle, wand and targets are gone.** They were already commented out of the
original's `Room`, and the wand's 2 MB glb was the largest asset in the repo.
The throwable balls are the whole of the interaction now, so the ball spawns at
what used to be the rifle's nozzle: 0.9 forward, 0.2 right, 0.11 down of the
camera. That offset is kept exactly so the throw arc is unchanged.

**Fifty balls became one InstancedMesh.** The original built fifty `THREE.Mesh`
objects sharing a geometry and a material, added to a group on the first frame.
Same pixels, fifty draw calls. Here they are instances of one mesh whose
matrices are written each frame, and `frustumCulled` is off because the mesh's
own bounds are never right for instances that move.

**The balls are parked on mount.** In the original the group is empty until the
first simulated frame, which only runs once the pointer is locked. Instanced
matrices start as identity instead, so all fifty would sit in a lump at the
origin until then. An effect pushes them to their parked position under the
floor at mount.

**The crosshair is one `lineSegments`.** It was four separate `THREE.Line`
objects constructed imperatively.

**The glTF is rendered, not `scene.add`ed.** The original loaded the world and
added it to the scene by hand inside the collision context. Here the context
only owns the octree and the player state, and `Room` renders the loaded scene
with `<primitive>`. Same result, one owner per concern.

**r186 renames.** `directionToColor` and `colorToDirection` became
`packNormalToRGB` and `unpackRGBToNormal`, `transformedNormalView` became
`normalView`, and `PostProcessing` became `RenderPipeline`. The SSGI uniform
names are unchanged from r181, so the tuned settings carried over untouched.

**`shadows="percentage"`.** Bare `shadows` on an r3f canvas selects
`PCFSoftShadowMap`, which `WebGPURenderer` does not have.

## Known rough edges

- A thrown ball moves about 0.8 units per collision substep at full charge while
  its radius is 0.1, so it can tunnel through a thin floor. This is inherited
  from the source and from the three.js demo the source came from.
- SSGI plus TRAA is expensive. On a software rasteriser it is well under one
  frame a second. It wants a real GPU.
