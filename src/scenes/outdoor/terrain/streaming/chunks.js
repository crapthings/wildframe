import { TERRAIN_BOUNDARY_PADDING, WORLD_BOUNDS } from '@/scenes/outdoor/constants'
import { TERRAIN_CHUNKS } from '@/scenes/outdoor/terrain/constants'

export function chunkKey (x, z) {
  return `${Math.floor(x / TERRAIN_CHUNKS.size)},${Math.floor(z / TERRAIN_CHUNKS.size)}`
}

export function surroundingChunks (x, z) {
  const { size, radius } = TERRAIN_CHUNKS
  const cx = Math.floor(x / size)
  const cz = Math.floor(z / size)
  const chunks = []
  for (let dz = -radius; dz <= radius; dz += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const column = cx + dx
      const row = cz + dz
      if (column * size >= WORLD_BOUNDS.maxX + TERRAIN_BOUNDARY_PADDING ||
        (column + 1) * size <= WORLD_BOUNDS.minX - TERRAIN_BOUNDARY_PADDING ||
        row * size >= WORLD_BOUNDS.maxZ + TERRAIN_BOUNDARY_PADDING ||
        (row + 1) * size <= WORLD_BOUNDS.minZ - TERRAIN_BOUNDARY_PADDING) continue
      const ring = Math.max(Math.abs(dx), Math.abs(dz))
      const lod = ring <= TERRAIN_CHUNKS.lodRings[0] ? 0 : ring <= TERRAIN_CHUNKS.lodRings[1] ? 1 : 2
      chunks.push({ key: `${column},${row}`, column, row, lod, distance: dx * dx + dz * dz })
    }
  }
  return chunks.sort((a, b) => a.distance - b.distance)
}
