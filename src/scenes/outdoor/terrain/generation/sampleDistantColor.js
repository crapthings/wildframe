import { TERRAIN_GENERATION } from '@/scenes/outdoor/terrain/constants'
import { createNoise, smoothstep } from './noise'

const settings = TERRAIN_GENERATION.distantSurface
const colorNoise = createNoise(TERRAIN_GENERATION.seed + settings.seedOffset, settings)

export function sampleDistantColor (x, z, height, grass, rock, face, wet) {
  const variation = colorNoise.GetNoise(x, z)
  const highland = smoothstep(settings.highlandStart, settings.highlandEnd, height)
  const exposed = rock + (1 - rock) * highland * 0.35
  const brightness = (1 + variation * settings.variation) * (1 - wet * 0.45)
  return settings.soil.map((soil, channel) => {
    const ground = soil + (settings.grass[channel] - soil) * grass
    const cliff = settings.marble[channel] + (settings.rockFace[channel] - settings.marble[channel]) * face
    return (ground + (cliff - ground) * exposed) * brightness
  })
}
