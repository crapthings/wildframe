# Outdoor scene

`OutdoorScene.jsx` assembles the 3D scene; `src/App.jsx` composes it with the loading and map UI.

```text
outdoor/
  assets.js              Asset URLs
  constants.js           Scene, camera, lighting and material settings
  environment/           Sky and lighting
  camera/                Third-person camera and map snapshot publishing
  player/                Box renderer and movement
  state/                 Koota entities and Zustand UI/command state
  terrain/
    Terrain.jsx          Chunk rendering
    TerrainReference.jsx Visual-only ground reference
    constants.js         Seed, generation parameters and LOD settings
    generation/          Pure samplers, mesh generation and terrain Worker
    streaming/           Chunk selection, scheduling and resource lifetime
    materials/           Terrain shader construction
  ocean/                 Water rendering and noise Worker
  ui/
    loading/             Initial and background loading indicators
    map/                 Debug map UI, canvas and drawing
```

Generation code must not depend on React, UI stores, or render components. The renderer and map use the same terrain sampler. Koota owns live entity data; Zustand owns commands, loading state and low-frequency UI snapshots. Worker URLs remain relative to their importing modules.

Terrain texture preparation lives in `terrain/materials/textures`: `surface.worker.js` fetches/decodes inputs in parallel and packs color/roughness and normal arrays off the UI thread. `useSurfaceTextures` owns the worker and GPU texture lifetime. Buffers are transferred, and results are retained for the terrain mount rather than recomputed during render retries. Static assets remain under `public/assets`.

Loading progress combines resource completion (25%), surface preparation (25%), committed terrain chunks (30%) and distant terrain rows (20%). Environment and terrain textures have separate Suspense boundaries so they do not delay terrain workers. Entry also waits for the textured terrain's first render; progress represents completed work, not elapsed time or synthetic uniform speed.

Mountain rock is dominated by Rock Face 04. Marble Cliff 05 appears only in rare seeded patches, capped at 25% local mixing. `terrainDetails.y` stores the Rock Face 04 weight; settings live in `terrain/constants.js`. Both use world-space triplanar hex tiling, with world Y as the vertical UV axis on cliff faces. Rock Face 03 is used by the instanced decorative ground stones in `terrain/rocks`, not the terrain material.

Transition surfaces use Coast Land Rocks 01 at the foot, Aerial Rocks 02 on high gentle slopes, and Rock 01 on exposed upper slopes. Three 1024px layers share color/roughness and normal texture arrays, extending the installed hex-tiling function to array sampling. This preserves sampler count and draw calls, but blending layers increases texture fetches. Grass and Rocky Terrain remain the lowland base.

Ground stones use four seeded deformed geometries and hex-tiled Rock Face 03. The terrain Worker generates LOD-independent placements on a jittered world grid, with FastNoise density and water/steep-slope/spawn exclusions. Only nearby chunks contribute to four shared instance batches; stones receive but do not cast shadows and have no collision yet. Distribution, size and render radius are configured in `terrain/rocks/settings.js`.

Chunk window changes retain outgoing meshes for 750 ms instead of immediately unmounting a row. Resident chunk data is capped at 145 entries (121 desired plus 24 spare), with at most one completed Worker result waiting outside that cache. Returning to a retained chunk cancels retirement. Capacity pressure can shorten the grace period, but retirement removes only one chunk every 50 ms and never shares a scheduler frame with a chunk submission. After a window change, submissions/retirements wait 150 ms once the scene has been entered; initial entry is not delayed. Settings live in `TERRAIN_CHUNKS.streaming`.

Retained chunks still participate in distant-terrain coverage until actually unmounted, and their distances are refreshed for stone/shadow selection. Teleport readiness counts only the requested window and LOD. Terrain meshes explicitly own their geometry; LOD replacement and unmount enqueue its disposal one resource per animation frame, independently of the scene lifetime. StrictMode re-attachment cancels queued disposal. The resident chunk limit does not include geometry awaiting disposal.

## Movement hitch diagnostics (development only)

`FrameDiagnostics` measures wall-clock intervals between scene frames, independent of the Perf chart. It retains 600 intervals, the latest 30 frames over 33 ms, and up to 200 terrain events. It batches `[terrain long frame]` console reports at most once every two seconds on a recovered frame. Hidden-tab intervals are excluded. No per-frame React or Zustand updates are introduced.

In the browser console, run `window.__terrainDiagnostics.reset()`, walk along one axis for 20 seconds, then run `window.__terrainDiagnostics.report()`. Repeat while sprinting and while standing still. The report includes frame-time percentiles, long-frame positions/speeds, and recent events. To copy a report in Chrome DevTools, use `copy(JSON.stringify(window.__terrainDiagnostics.report(), null, 2))`.

Events distinguish window changes/new chunks/LOD rebuilds, Worker generation time and main-thread round-trip time, chunk submissions/commits/retirements, geometry disposal, rock matrix updates, React terrain renders over 4 ms, camera updates over 4 ms, and movement blocked by missing ready chunks. `scene-render-slow` measures scene renderer calls over 8 ms, including CPU submission and possible driver stalls, NOT GPU execution time. The development-only renderer wrapper is restored on cleanup. Supported browsers also record main-thread tasks over 50 ms via `PerformanceObserver`. Worker time is not main-thread blocking time; React render time excludes GPU work. Event correlation alone does not establish causation or identify GC. GPU uploads and GC require a browser Performance recording for confirmation.
