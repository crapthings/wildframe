import { generateChunk } from './generateChunk'
import { sampleDistantColor } from './sampleDistantColor'
import { WORLD_BOUNDS, TERRAIN_BOUNDARY_PADDING } from '@/scenes/outdoor/constants'
import { TERRAIN_CHUNKS } from '@/scenes/outdoor/terrain/constants'

function generateSector (startColumn, startRow, endColumn, endRow, size) {
  const positions = []
  const normals = []
  const colors = []
  const indices = []
  for (let row = startRow; row < endRow; row += 1) {
    for (let column = startColumn; column < endColumn; column += 1) {
      const chunk = generateChunk(column, row, 2)
      const offset = positions.length / 3
      for (let i = 0; i < chunk.positions.length; i += 3) {
        const x = chunk.positions[i] + column * size
        const y = chunk.positions[i + 1]
        const z = chunk.positions[i + 2] + row * size
        positions.push(x, y, z)
        normals.push(chunk.normals[i], chunk.normals[i + 1], chunk.normals[i + 2])
        colors.push(...sampleDistantColor(x, z, y, chunk.blends[i], chunk.blends[i + 2], chunk.details[(i / 3) * 2 + 1], chunk.blends[i + 1]))
      }
      for (const index of chunk.indices) indices.push(index + offset)
    }
  }
  const IndexArray = positions.length / 3 <= 65536 ? Uint16Array : Uint32Array
  return {
    key: `${startColumn},${startRow}`,
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
    indices: new IndexArray(indices)
  }
}

self.onmessage = () => {
  try {
    const { size, distantSectorChunks } = TERRAIN_CHUNKS
    const minColumn = Math.floor((WORLD_BOUNDS.minX - TERRAIN_BOUNDARY_PADDING) / size)
    const maxColumn = Math.ceil((WORLD_BOUNDS.maxX + TERRAIN_BOUNDARY_PADDING) / size)
    const minRow = Math.floor((WORLD_BOUNDS.minZ - TERRAIN_BOUNDARY_PADDING) / size)
    const maxRow = Math.ceil((WORLD_BOUNDS.maxZ + TERRAIN_BOUNDARY_PADDING) / size)
    const total = (maxColumn - minColumn) * (maxRow - minRow)
    const sectors = []
    const buffers = []
    let completed = 0
    for (let row = minRow; row < maxRow; row += distantSectorChunks) {
      for (let column = minColumn; column < maxColumn; column += distantSectorChunks) {
        const endRow = Math.min(row + distantSectorChunks, maxRow)
        const endColumn = Math.min(column + distantSectorChunks, maxColumn)
        const sector = generateSector(column, row, endColumn, endRow, size)
        sectors.push(sector)
        buffers.push(sector.positions.buffer, sector.normals.buffer, sector.colors.buffer, sector.indices.buffer)
        completed += (endRow - row) * (endColumn - column)
        self.postMessage({ progress: completed / total * 100 })
      }
    }
    self.postMessage({ sectors }, buffers)
  } catch (error) {
    self.postMessage({ error: error.message })
  }
}
