# Rules

## Commands

- Only run `pnpm build`, `pnpm lint`, or `pnpm test` when explicitly requested by the user, and never run `pnpm dev`.

## Code Style

- Follow JavaScript Standard Style (standard.js) when writing `.js` and `.jsx` files.

## State Management

- Use Koota for real-time entity state such as position, velocity, and facing. Meshes display entity state; avoid keeping an independent authoritative copy in Zustand.
- Use Zustand for UI snapshots, loading status, and user commands such as teleport requests. Publish map snapshots at a limited rate rather than on every frame.

## Scene Lighting

- Avoid ambient lighting by default. Only add ambient lighting (such as `AmbientLight` or `HemisphereLight`) when explicitly requested by the user.

## Texture Maps

- When using texture maps, process them with the installed `three-hex-tiling` package to reduce visible texture repetition instead of relying on basic repeating UV tiling alone.
