import { generateChunk } from '@/scenes/outdoor/terrain/generation/generateChunk'
import { generateRocks } from '../rocks/generateRocks'

self.onmessage = ({ data: { key, column, row, lod = 0 } }) => {
  try {
    const started = performance.now()
    const data = generateChunk(column, row, lod)
    const terrainDone = performance.now()
    data.rocks = generateRocks(column, row)
    const diagnostics = import.meta.env.DEV ? {
      terrainMs: terrainDone - started,
      rocksMs: performance.now() - terrainDone
    } : undefined
    self.postMessage({ key, lod, ...data, diagnostics }, Object.values(data).map((array) => array.buffer))
  } catch (error) {
    self.postMessage({ key, error: error.message })
  }
}
