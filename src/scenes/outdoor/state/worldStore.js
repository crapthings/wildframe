import { create } from 'zustand'
import { WORLD_BOUNDS } from '@/scenes/outdoor/constants'
import { isTerrainWalkable } from '@/scenes/outdoor/terrain/generation/sampleTerrain'

export const useWorldStore = create((set) => ({
  sceneEntered: false,
  raining: false,
  toggleRain: () => set((state) => ({ raining: !state.raining })),
  timeOfDay: 'day',
  setTimeOfDay: (timeOfDay) => {
    if (timeOfDay === 'day' || timeOfDay === 'night') set({ timeOfDay })
  },
  playerReady: false,
  distantReady: false,
  distantProgress: 0,
  surfaceProgress: 0,
  surfaceReady: false,
  renderedChunks: [],
  readyChunks: new Set(),
  terrainLoading: true,
  terrainProgress: 0,
  terrainCenter: null,
  terrainError: null,
  teleportTarget: null,
  requestTeleport: (x, z) => {
    if (!Number.isFinite(x) || !Number.isFinite(z) || !isTerrainWalkable(x, z, 1)) return false
    if (Number.isFinite(x) && Number.isFinite(z)) {
      set({
        teleportTarget: {
          x: Math.max(WORLD_BOUNDS.minX, Math.min(WORLD_BOUNDS.maxX - 0.001, x)),
          z: Math.max(WORLD_BOUNDS.minZ, Math.min(WORLD_BOUNDS.maxZ - 0.001, z))
        }
      })
      return true
    }
  },
  clearTeleport: () => set({ teleportTarget: null }),
  view: {
    heading: 0,
    x: 0,
    z: 0
  },
  setView: (view) => set({ view })
}))
