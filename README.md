# Wildframe

A procedural open-world playground built with React Three Fiber.

Explore a seeded landscape of rolling terrain, mountain ridges, and coastline. Wildframe is an experimental browser-based world, with an emphasis on terrain streaming, third-person exploration, and real-time rendering.

## Current features

- A 1,024 × 1,024 meter world with deterministic terrain generation.
- Worker-generated terrain chunks, distance-based LOD, and bounded streaming caches.
- Blended ground and cliff materials with hex tiling to reduce repetition.
- Procedural ground stones, an animated character, and a sample tree.
- Third-person movement and camera controls.
- Day/night transitions, stars, moonlight, and a rain toggle.
- A terrain debug map with contours and click-to-teleport navigation.
- Development-only frame-time and streaming diagnostics.

This is an early prototype, not a finished game or a general-purpose engine. The playable world is bounded; the distant landscape provides visual continuity. Performance work is ongoing, including occasional chunk-transition hitches and the high-detail sample tree.

## Getting started

Requires Node.js `^20.19.0 || >=22.12.0` and pnpm `12.4.1`.

1. Install dependencies with `pnpm install --frozen-lockfile`.
2. Download and verify the complete asset pack from the [v0.1.0 release](https://github.com/crapthings/wildframe/releases/tag/v0.1.0), then extract it into `public/assets/`, following [the asset setup guide](ASSETS.md).
3. Start the development server with `pnpm dev` and open the URL printed by Vite.

The scene requires local assets; missing terrain textures or the player model will prevent loading from completing. It does not currently provide placeholder replacements.

For a production bundle, run `pnpm build`, then `pnpm preview` to inspect it locally. The package remains `private: true` to prevent accidental npm publication; this does not control GitHub repository visibility.

## Controls

| Input | Action |
| --- | --- |
| W / A / S / D | Move relative to the camera |
| Shift | Sprint |
| Left or right mouse drag | Look around |
| Mouse wheel | Zoom |
| Tab | Toggle the terrain map |
| Click land on the map | Teleport |
| Day / Night / Rain buttons | Change lighting and weather |

## Structure

`src/scenes/outdoor/` contains the first scene, including its terrain generation, streaming, materials, player, camera, environment, and UI. See [the scene guide](src/scenes/outdoor/README.md) for implementation details and performance diagnostics.

The main stack is React, Three.js, React Three Fiber, Drei, FastNoise Lite, Koota, and Zustand. Koota owns live entity state; Zustand owns UI state and commands.

## Licensing and assets

No open-source license has been selected for the project code yet. The third-party models, textures, and environments distributed in the asset pack are CC0 assets from Poly Haven and Quaternius; their license does not apply to the project code. See [ASSETS.md](ASSETS.md) for setup and release-archive distribution, and [THIRD_PARTY_ASSETS.md](THIRD_PARTY_ASSETS.md) for source and license records.
