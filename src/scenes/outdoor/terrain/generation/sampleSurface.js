import { TERRAIN_GENERATION } from '@/scenes/outdoor/terrain/constants'

function smoothstep (a, b, value) {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function hash (x, z) {
  const value = Math.sin(x * 127.1 + z * 311.7 + TERRAIN_GENERATION.seed) * 43758.5453
  return value - Math.floor(value)
}

function noise (x, z) {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = smoothstep(0, 1, x - ix)
  const fz = smoothstep(0, 1, z - iz)
  const a = hash(ix, iz) * (1 - fx) + hash(ix + 1, iz) * fx
  const b = hash(ix, iz + 1) * (1 - fx) + hash(ix + 1, iz + 1) * fx
  return a * (1 - fz) + b * fz
}

export function sampleSurface (x, z, height, normalY = 1) {
  const settings = TERRAIN_GENERATION.surface
  const px = x / settings.patchSize
  const pz = -z / settings.patchSize
  const value = noise(px, pz) * 0.75 + noise(px * 3.7, pz * 3.7) * 0.25
  const aboveSea = height - TERRAIN_GENERATION.coast.seaLevel
  const grass = smoothstep(0.5 - settings.blendSoftness, 0.5 + settings.blendSoftness, value)
  const highland = smoothstep(65, 140, height)
  const slopeRock = smoothstep(settings.rockSlopeStart, settings.rockSlopeEnd, 1 - normalY)
  const mountain = slopeRock * (0.65 + 0.35 * highland)
  const foothill = smoothstep(18, 38, height)
  // Face 04 dominates; rare seeded marble exposures never exceed 25% locally.
  const marble = smoothstep(0.72, 0.9, noise(px * 0.7 + 43, pz * 0.7 - 19)) * settings.marbleMaxBlend
  const bare = 1 - marble
  return [
    grass * smoothstep(0, settings.dryShoreHeight, aboveSea),
    1 - smoothstep(0, settings.wetShoreHeight, aboveSea),
    mountain,
    foothill,
    bare
  ]
}
