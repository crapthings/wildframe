// Decode and pack away from the UI thread; transfer buffers without copying.
self.onmessage = async ({ data: { layers, bare } }) => {
  try {
    const urls = [...layers.flat(), ...bare]
    let complete = 0
    const images = await Promise.all(urls.map(async (url) => {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Texture ${response.status}: ${url}`)
      const image = await createImageBitmap(await response.blob())
      self.postMessage({ progress: ++complete / urls.length * 60 })
      return image
    }))
    const read = (image, size) => {
      const canvas = new OffscreenCanvas(size, size)
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(image, 0, 0, size, size)
      return ctx.getImageData(0, 0, size, size).data
    }
    const size = 1024
    const packed = new Uint8Array(size * size * 4 * layers.length)
    const normal = new Uint8Array(packed.length)
    const pack = (color, rough, normals, output, normalOutput, dimension, offset = 0) => {
      for (let y = 0; y < dimension; y++) {
        for (let x = 0; x < dimension; x++) {
          const src = (y * dimension + x) * 4
          const dst = offset + ((dimension - y - 1) * dimension + x) * 4
          output[dst] = color[src]
          output[dst + 1] = color[src + 1]
          output[dst + 2] = color[src + 2]
          output[dst + 3] = rough[src + 1]
          if (normalOutput) {
            normalOutput[dst] = normals[src]
            normalOutput[dst + 1] = normals[src + 1]
            normalOutput[dst + 2] = normals[src + 2]
            normalOutput[dst + 3] = normals[src + 3]
          }
        }
      }
    }
    for (let layer = 0; layer < layers.length; layer++) {
      pack(read(images[layer * 3], size), read(images[layer * 3 + 2], size), read(images[layer * 3 + 1], size), packed, normal, size, layer * size * size * 4)
      self.postMessage({ progress: 60 + (layer + 1) / (layers.length + 1) * 40 })
    }
    const bareSize = 2048
    const barePacked = new Uint8Array(bareSize * bareSize * 4)
    pack(read(images[images.length - 2], bareSize), read(images[images.length - 1], bareSize), null, barePacked, null, bareSize)
    images.forEach((image) => image.close())
    self.postMessage({ packed, normal, barePacked, size, bareSize, depth: layers.length }, [packed.buffer, normal.buffer, barePacked.buffer])
  } catch (error) {
    self.postMessage({ error: error.message })
  }
}
