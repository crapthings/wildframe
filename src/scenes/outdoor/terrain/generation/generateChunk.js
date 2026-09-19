import { sampleCoastDistance, sampleTerrainHeight } from '@/scenes/outdoor/terrain/generation/sampleTerrain'
import { sampleSurface } from '@/scenes/outdoor/terrain/generation/sampleSurface'
import { TERRAIN_CHUNKS, TERRAIN_GENERATION } from '@/scenes/outdoor/terrain/constants'

export function generateChunk (column, row, lod = 0) {
  const { size, shoreRefinement, shoreRefinementHeight } = TERRAIN_CHUNKS
  const segments = TERRAIN_CHUNKS.lodSegments[lod]
  const boundaryStep = size / TERRAIN_CHUNKS.segments
  const step = size / segments
  const positions = []
  const normals = []
  const uvs = []
  const blends = []
  const details = []
  const indices = []
  const vertices = new Map()
  const heights = new Map()
  const heightAt = (x, z) => {
    const key = `${x},${z}`
    if (!heights.has(key)) heights.set(key, sampleTerrainHeight(column * size + x, row * size + z))
    return heights.get(key)
  }
  const vertex = (x, z) => {
    const key = `${x},${z}`
    if (vertices.has(key)) return vertices.get(key)
    const index = positions.length / 3
    const height = heightAt(x, z)
    const worldX = column * size + x
    const worldZ = row * size + z
    positions.push(x, height, z)
    // Fixed world-space derivative interval keeps both sides of every seam identical.
    const nx = heightAt(x - 1, z) - heightAt(x + 1, z)
    const nz = heightAt(x, z - 1) - heightAt(x, z + 1)
    const length = Math.hypot(nx, 2, nz)
    normals.push(nx / length, 2 / length, nz / length)
    uvs.push(worldX, -worldZ)
    const weights = sampleSurface(worldX, worldZ, height, 2 / length)
    blends.push(...weights.slice(0, 3))
    details.push(...weights.slice(3))
    vertices.set(key, index)
    return index
  }
  const edgeSegments = (a, b) => {
    const distance = sampleCoastDistance(
      column * size + (a[0] + b[0]) / 2,
      row * size + (a[1] + b[1]) / 2
    )
    if (Math.abs(distance) > TERRAIN_CHUNKS.shoreRefinementDistance) return 1
    const sea = TERRAIN_GENERATION.coast.seaLevel
    const values = [heightAt(...a), heightAt(...b), heightAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)]
    return Math.min(...values) <= sea + shoreRefinementHeight &&
      Math.max(...values) >= sea - shoreRefinementHeight ? shoreRefinement : 1
  }
  for (let z = 0; z < size; z += step) {
    for (let x = 0; x < size; x += step) {
      // Clockwise viewed from above: upward-facing triangles in X/Z space.
      const corners = [[x, z], [x, z + step], [x + step, z + step], [x + step, z]]
      const ring = []
      for (let edge = 0; edge < 4; edge += 1) {
        const a = corners[edge]
        const b = corners[(edge + 1) % 4]
        const boundary = (a[0] === b[0] && (a[0] === 0 || a[0] === size)) ||
          (a[1] === b[1] && (a[1] === 0 || a[1] === size))
        // Every LOD uses exactly the same boundary polyline, including coastal refinement.
        const sections = boundary ? step / boundaryStep : 1
        for (let section = 0; section < sections; section += 1) {
          const start = [a[0] + (b[0] - a[0]) * section / sections, a[1] + (b[1] - a[1]) * section / sections]
          const end = [a[0] + (b[0] - a[0]) * (section + 1) / sections, a[1] + (b[1] - a[1]) * (section + 1) / sections]
          const count = boundary || lod === 0 ? edgeSegments(start, end) : 1
          for (let i = 0; i < count; i += 1) {
            const t = i / count
            ring.push(vertex(start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t))
          }
        }
      }
      if (ring.length === 4) {
        const [a, b, c, d] = ring
        indices.push(a, b, d, d, b, c)
        continue
      }
      const center = vertex(x + step / 2, z + step / 2)
      for (let i = 0; i < ring.length; i += 1) indices.push(center, ring[i], ring[(i + 1) % ring.length])
    }
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    blends: new Float32Array(blends),
    details: new Float32Array(details),
    indices: new Uint16Array(indices)
  }
}
