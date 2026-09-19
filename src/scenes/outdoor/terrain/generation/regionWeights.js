import { TERRAIN_GENERATION } from '@/scenes/outdoor/terrain/constants'

function smoothstep (start, end, value) {
  const amount = Math.min(1, Math.max(0, (value - start) / (end - start)))
  return amount * amount * (3 - 2 * amount)
}

export function sampleRegionWeights (x, z) {
  const normalizedX = x / TERRAIN_GENERATION.regionScaleMeters
  const normalizedZ = z / TERRAIN_GENERATION.regionScaleMeters
  const distance = Math.hypot(normalizedX, normalizedZ)
  const directionalBlend = smoothstep(0.08, 0.35, distance)
  const rawWeights = {
    north: Math.max(0, -normalizedZ),
    east: Math.max(0, normalizedX),
    south: Math.max(0, normalizedZ),
    west: Math.max(0, -normalizedX)
  }
  const total = Object.values(rawWeights).reduce((sum, value) => sum + value, 0)

  if (total === 0) {
    return {
      north: 0.25,
      east: 0.25,
      south: 0.25,
      west: 0.25
    }
  }

  return Object.fromEntries(
    Object.entries(rawWeights).map(([region, value]) => [
      region,
      0.25 * (1 - directionalBlend) + value / total * directionalBlend
    ])
  )
}
