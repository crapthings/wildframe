import { recordTerrainEvent } from './terrainEvents.js'

const pending = new Set()
let frame = 0

function disposeNext () {
  frame = 0
  const geometry = pending.values().next().value
  if (!geometry) return
  pending.delete(geometry)
  const started = import.meta.env.DEV ? performance.now() : 0
  geometry.dispose()
  if (import.meta.env.DEV) recordTerrainEvent('terrain-geometry-dispose', {
    durationMs: performance.now() - started,
    remaining: pending.size
  }, started)
  if (pending.size) frame = requestAnimationFrame(disposeNext)
}

export function retainTerrainGeometry (geometry) {
  // React StrictMode may clean up and immediately re-attach the same resource.
  pending.delete(geometry)
  if (!pending.size && frame) {
    cancelAnimationFrame(frame)
    frame = 0
  }
}

export function retireTerrainGeometry (geometry) {
  pending.add(geometry)
  if (!frame) frame = requestAnimationFrame(disposeNext)
}
