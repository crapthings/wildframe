import FastNoiseLite from 'fastnoise-lite'

self.onmessage = ({ data: { resolution, seed } }) => {
  const noise = new FastNoiseLite(seed)
  noise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2S)
  noise.SetFractalType(FastNoiseLite.FractalType.FBm)
  noise.SetFractalOctaves(4)
  noise.SetFrequency(0.035)
  const heights = new Float32Array(resolution * resolution)
  const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10)
  // Blend translated noise domains with periodic values and derivatives.
  for (let y = 0; y < resolution; y += 1) {
    for (let x = 0; x < resolution; x += 1) {
      const u = smooth(x / resolution)
      const v = smooth(y / resolution)
      const a = noise.GetNoise(x, y) * (1 - u) + noise.GetNoise(x - resolution, y) * u
      const b = noise.GetNoise(x, y - resolution) * (1 - u) + noise.GetNoise(x - resolution, y - resolution) * u
      heights[y * resolution + x] = a * (1 - v) + b * v
    }
  }
  const height = (x, y) => heights[((y + resolution) % resolution) * resolution + (x + resolution) % resolution]
  const pixels = new Uint8Array(resolution * resolution * 4)
  for (let y = 0; y < resolution; y += 1) {
    for (let x = 0; x < resolution; x += 1) {
      const dx = (height(x - 1, y) - height(x + 1, y)) * 3
      const dy = (height(x, y - 1) - height(x, y + 1)) * 3
      const length = Math.hypot(dx, dy, 1)
      const index = (y * resolution + x) * 4
      pixels[index] = Math.round((dx / length * 0.5 + 0.5) * 255)
      pixels[index + 1] = Math.round((dy / length * 0.5 + 0.5) * 255)
      pixels[index + 2] = Math.round((1 / length * 0.5 + 0.5) * 255)
      pixels[index + 3] = 255
    }
  }
  self.postMessage({ pixels, resolution }, [pixels.buffer])
}
