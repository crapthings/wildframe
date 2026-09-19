import { TERRAIN_GENERATION } from '@/scenes/outdoor/terrain/constants'
import { createNoise, smoothstep } from './noise'

const settings = TERRAIN_GENERATION.boundaryMountains
const seed = TERRAIN_GENERATION.seed + settings.seedOffset
const warp = createNoise(seed + 17, { frequency: settings.warpFrequency, octaves: 2 })
const ridgeNoise = createNoise(seed, { frequency: settings.frequency, octaves: 2 })
const peakNoise = createNoise(seed + 43, { frequency: settings.peakFrequency, octaves: 1 })

export function sampleMountainHeight (x, z) {
  // A cheap inner rejection preserves the open center and avoids noise work there.
  const rawRadius = Math.hypot(x - settings.centerX, z / settings.northSouthStretch)
  if (rawRadius + settings.warpAmplitude * 1.5 < settings.innerStart) return 0
  const wx = x - settings.centerX + warp.GetNoise(x, z) * settings.warpAmplitude
  const wz = (z + warp.GetNoise(x + 1937, z - 827) * settings.warpAmplitude) / settings.northSouthStretch
  const radius = Math.hypot(wx, wz)
  if (radius <= settings.innerStart) return 0

  // Sampling on a circle gives a continuous longitudinal coordinate without an angle seam.
  // Crest displacement and peak groups stay coherent across the width of the range.
  const alongX = wx / radius * settings.crestRadius
  const alongZ = wz / radius * settings.crestRadius
  const crest = settings.crestRadius + warp.GetNoise(alongX - 643, alongZ + 1291) * settings.crestVariation
  const width = settings.foothillWidth + warp.GetNoise(alongX + 337, alongZ + 719) * settings.widthVariation
  const offset = (radius - crest) / width
  const envelope = Math.exp(-2 * offset * offset) * smoothstep(settings.innerStart, settings.innerEnd, radius)
  if (envelope < 0.00001) return 0

  const group = smoothstep(-0.45, 0.5, peakNoise.GetNoise(alongX, alongZ))
  const summit = smoothstep(settings.summitStart, settings.summitEnd, group)
  const saddle = settings.saddleFloor + (1 - settings.saddleFloor) * group
  const mainRidge = Math.exp(-offset * offset / settings.ridgeWidth ** 2)

  // Rounded ridged noise makes connected side spurs, without the sharp abs() cusps.
  const n = ridgeNoise.GetNoise(wx, wz)
  const rounded = Math.sqrt(n * n + settings.ridgeRounding ** 2) - settings.ridgeRounding
  const spur = Math.max(0, 1 - rounded)
  const secondary = ridgeNoise.GetNoise(wx * 1.9 + 829, wz * 1.9 - 413)
  const detail = secondary * settings.detailHeight * spur * spur
  const shoulders = settings.baseHeight + settings.spurHeight * spur * spur
  const crestHeight = mainRidge * (settings.ridgeHeight * saddle + settings.peakHeight * summit)
  return envelope * Math.max(0, shoulders + crestHeight + detail)
}
