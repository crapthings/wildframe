import { createNoise, smoothstep } from './noise'
import { sampleMountainHeight } from './sampleMountains'
import { TERRAIN_GENERATION } from '@/scenes/outdoor/terrain/constants'
import { sampleRegionWeights } from '@/scenes/outdoor/terrain/generation/regionWeights'
import { WORLD_BOUNDS } from '@/scenes/outdoor/constants'

function toUnitRange (value) {
  return value * 0.5 + 0.5
}

const baseNoise = createNoise(TERRAIN_GENERATION.seed, TERRAIN_GENERATION.base)
const coast = TERRAIN_GENERATION.coast
const coastNoise = createNoise(TERRAIN_GENERATION.seed + coast.seedOffset, coast)
const mountains = TERRAIN_GENERATION.boundaryMountains
const regionNoise = Object.fromEntries(
  Object.entries(TERRAIN_GENERATION.regions).map(([region, settings]) => [
    region,
    createNoise(TERRAIN_GENERATION.seed + settings.seedOffset, settings)
  ])
)

export function sampleCoastDistance (x, z) {
  return coast.eastShoreX - coast.bayInset * smoothstep(
    coast.bayStartZ, coast.bayEndZ, z
  ) + coastNoise.GetNoise(x, z) * coast.amplitude - x
}

export function sampleTerrainHeight (x, z) {
  const weights = sampleRegionWeights(x, z)
  const baseHeight = toUnitRange(baseNoise.GetNoise(x, z)) * TERRAIN_GENERATION.base.amplitude
  const regionalHeight = Object.entries(TERRAIN_GENERATION.regions).reduce(
    (height, [region, settings]) => {
      const noiseHeight = toUnitRange(regionNoise[region].GetNoise(x, z))
      return height + noiseHeight * settings.amplitude * weights[region]
    },
    0
  )
  const distanceFromSpawn = Math.hypot(x, z)
  const spawnBlend = smoothstep(
    TERRAIN_GENERATION.spawn.flatRadius,
    TERRAIN_GENERATION.spawn.blendRadius,
    distanceFromSpawn
  )

  const distance = sampleCoastDistance(x, z)
  if (distance <= 0) {
    return coast.seaLevel - coast.seabedDepth * (1 - Math.exp(distance / coast.seabedWidth))
  }
  const coastFade = smoothstep(mountains.coastFadeStart, mountains.coastFadeEnd, distance)
  let mountainHeight = 0
  if (coastFade > 0) {
    mountainHeight = sampleMountainHeight(x, z) * coastFade * spawnBlend
  }
  const inlandHeight = (baseHeight + regionalHeight) * spawnBlend + mountainHeight
  const blend = smoothstep(0, coast.beachWidth, distance)
  const beachHeight = coast.seaLevel + distance * coast.beachSlope
  return beachHeight * (1 - blend) + inlandHeight * blend
}

export function isTerrainWalkable (x, z, radius = 0) {
  if (x - radius < WORLD_BOUNDS.minX || x + radius > WORLD_BOUNDS.maxX ||
    z - radius < WORLD_BOUNDS.minZ || z + radius > WORLD_BOUNDS.maxZ) return false
  const minimum = coast.seaLevel + coast.walkClearance
  if (sampleTerrainHeight(x, z) < minimum) return false
  if (!radius) return true
  return sampleTerrainHeight(x - radius, z) >= minimum &&
    sampleTerrainHeight(x + radius, z) >= minimum &&
    sampleTerrainHeight(x, z - radius) >= minimum &&
    sampleTerrainHeight(x, z + radius) >= minimum
}
