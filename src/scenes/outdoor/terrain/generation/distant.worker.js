import { generateChunk } from './generateChunk'
import { sampleDistantColor } from './sampleDistantColor'
import { WORLD_BOUNDS, TERRAIN_BOUNDARY_PADDING } from '@/scenes/outdoor/constants'
import { TERRAIN_CHUNKS } from '@/scenes/outdoor/terrain/constants'

self.onmessage = () => {
  try {
    const positions = []
    const normals = []
    const colors = []
    const indices = []
    const { size } = TERRAIN_CHUNKS
    const min = Math.floor((WORLD_BOUNDS.minX - TERRAIN_BOUNDARY_PADDING) / size)
    const max = Math.ceil((WORLD_BOUNDS.maxX + TERRAIN_BOUNDARY_PADDING) / size)
    for (let row = min; row < max; row += 1) {
      for (let column = min; column < max; column += 1) {
        const chunk = generateChunk(column, row, 2)
        const offset = positions.length / 3
        for (let i = 0; i < chunk.positions.length; i += 3) {
          positions.push(chunk.positions[i] + column * size, chunk.positions[i + 1], chunk.positions[i + 2] + row * size)
          normals.push(chunk.normals[i], chunk.normals[i + 1], chunk.normals[i + 2])
          const rock = chunk.blends[i + 2]
          const green = chunk.blends[i]
          colors.push(...sampleDistantColor(
            chunk.positions[i] + column * size,
            chunk.positions[i + 2] + row * size,
            chunk.positions[i + 1], green, rock,
            chunk.details[(i / 3) * 2 + 1], chunk.blends[i + 1]
          ))
        }
        for (const index of chunk.indices) indices.push(index + offset)
      }
      self.postMessage({ progress: (row - min + 1) / (max - min) * 100 })
    }
    const data = {
      positions: new Float32Array(positions), normals: new Float32Array(normals),
      colors: new Float32Array(colors), indices: new Uint32Array(indices)
    }
    self.postMessage(data, Object.values(data).map((array) => array.buffer))
  } catch (error) {
    self.postMessage({ error: error.message })
  }
}
