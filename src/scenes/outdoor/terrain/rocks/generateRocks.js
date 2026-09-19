import { createNoise, smoothstep } from '../generation/noise'
import { sampleTerrainHeight, isTerrainWalkable } from '../generation/sampleTerrain'
import { TERRAIN_CHUNKS, TERRAIN_GENERATION } from '../constants'
import { ROCK_SETTINGS as settings } from './settings'

const noise = createNoise(TERRAIN_GENERATION.seed + settings.seedOffset, settings)

function random (x, z, salt) {
  const n = Math.sin(x * 127.1 + z * 311.7 + salt * 74.7 + TERRAIN_GENERATION.seed) * 43758.5453
  return n - Math.floor(n)
}

export function generateRocks (column, row) {
  const result = []
  const cells = TERRAIN_CHUNKS.size / settings.cellSize
  for (let iz = 0; iz < cells; iz++) {
    for (let ix = 0; ix < cells; ix++) {
      const cx = column * cells + ix
      const cz = row * cells + iz
      const x = (cx + 0.15 + random(cx, cz, 1) * 0.7) * settings.cellSize
      const z = (cz + 0.15 + random(cx, cz, 2) * 0.7) * settings.cellSize
      const density = smoothstep(-0.35, 0.5, noise.GetNoise(x, z))
      if (random(cx, cz, 3) > 0.03 + density * 0.55 || Math.hypot(x, z) < 28) continue
      const size = settings.minSize + Math.pow(random(cx, cz, 4), 2) * (settings.maxSize - settings.minSize)
      if (!isTerrainWalkable(x, z, size)) continue
      const h = sampleTerrainHeight(x, z)
      const dx = sampleTerrainHeight(x + size, z) - sampleTerrainHeight(x - size, z)
      const dz = sampleTerrainHeight(x, z + size) - sampleTerrainHeight(x, z - size)
      if (Math.hypot(dx, dz) / (2 * size) > 0.45) continue
      result.push(x, h - size * 0.2, z, random(cx, cz, 5) * Math.PI * 2,
        size, size * (0.5 + random(cx, cz, 6) * 0.65), size * (0.65 + random(cx, cz, 7) * 0.5),
        Math.floor(random(cx, cz, 8) * settings.variants))
    }
  }
  return new Float32Array(result)
}
