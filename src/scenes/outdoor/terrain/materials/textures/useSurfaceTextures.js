import { useEffect, useState } from 'react'
import { DataArrayTexture, DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace } from 'three'
import { OUTDOOR_ASSETS } from '@/scenes/outdoor/assets'
import { useWorldStore } from '@/scenes/outdoor/state/worldStore'

export function useSurfaceTextures () {
  const [textures, setTextures] = useState(null)
  useEffect(() => {
    let worker
    let result
    const fail = () => useWorldStore.setState({ terrainError: 'Failed to prepare terrain textures. Please reload.' })
    useWorldStore.setState({ surfaceProgress: 0, surfaceReady: false })
    try {
      worker = new Worker(new URL('./surface.worker.js', import.meta.url), { type: 'module' })
      worker.onerror = fail
      worker.onmessageerror = fail
      worker.onmessage = ({ data }) => {
        if (data.error) { fail(); worker.terminate(); return }
        if ('progress' in data) {
          useWorldStore.setState({ surfaceProgress: data.progress })
          return
        }
        result = [new DataArrayTexture(data.packed, data.size, data.size, data.depth), new DataArrayTexture(data.normal, data.size, data.size, data.depth), new DataTexture(data.barePacked, data.bareSize, data.bareSize)]
        result.forEach((texture, index) => {
          if (index !== 1) texture.colorSpace = SRGBColorSpace
          texture.wrapS = texture.wrapT = RepeatWrapping
          texture.generateMipmaps = true
          texture.minFilter = LinearMipmapLinearFilter
          texture.magFilter = LinearFilter
          texture.needsUpdate = true
        })
        setTextures(result)
        useWorldStore.setState({ surfaceProgress: 100 })
        worker.terminate()
      }
      worker.postMessage({
        layers: [OUTDOOR_ASSETS.foothill, OUTDOOR_ASSETS.mountain, OUTDOOR_ASSETS.bareRock].map((asset) => [asset.color, asset.normal, asset.roughness]),
        bare: [OUTDOOR_ASSETS.rockFace.color, OUTDOOR_ASSETS.rockFace.roughness]
      })
    } catch { fail() }
    return () => {
      worker?.terminate()
      result?.forEach((texture) => texture.dispose())
    }
  }, [])
  return textures
}
