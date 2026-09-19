import FastNoiseLite from 'fastnoise-lite'

export function createNoise (seed, settings) {
  const noise = new FastNoiseLite(seed)
  noise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2S)
  noise.SetFrequency(settings.frequency)
  noise.SetFractalType(FastNoiseLite.FractalType.FBm)
  noise.SetFractalOctaves(settings.octaves)
  noise.SetFractalLacunarity(2)
  noise.SetFractalGain(0.5)
  return noise
}

export function smoothstep (start, end, value) {
  const amount = Math.min(1, Math.max(0, (value - start) / (end - start)))
  return amount * amount * (3 - 2 * amount)
}
