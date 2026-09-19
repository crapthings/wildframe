import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { DataTexture, MeshStandardMaterial, NearestFilter } from 'three'
import { useWorldStore } from '@/scenes/outdoor/state/worldStore'
import { TERRAIN_CHUNKS } from './constants'
import { TERRAIN_BOUNDARY_PADDING, WORLD_BOUNDS } from '@/scenes/outdoor/constants'
import { applyHeightFog } from './materials/heightFog'

const MIN = WORLD_BOUNDS.minX - TERRAIN_BOUNDARY_PADDING
const EXTENT = WORLD_BOUNDS.maxX + TERRAIN_BOUNDARY_PADDING - MIN
const GRID = EXTENT / TERRAIN_CHUNKS.size

export function DistantTerrain () {
  const [data, setData] = useState(null)
  const rendered = useWorldStore((state) => state.renderedChunks)
  const mask = useMemo(() => {
    const texture = new DataTexture(new Uint8Array(GRID * GRID * 4), GRID, GRID)
    texture.minFilter = texture.magFilter = NearestFilter
    texture.needsUpdate = true
    return texture
  }, [])
  const material = useMemo(() => {
    const result = new MeshStandardMaterial({ vertexColors: true, roughness: 1 })
    const compile = result.onBeforeCompile
    result.onBeforeCompile = function (shader, renderer) {
      compile.call(this, shader, renderer)
      applyHeightFog(shader)
      shader.uniforms.nearCoverage = { value: mask }
      shader.vertexShader = 'varying vec2 distantWorld;\n' + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ndistantWorld = position.xz;')
      shader.fragmentShader = 'uniform sampler2D nearCoverage;\nvarying vec2 distantWorld;\n' + shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace('void main() {', `void main() {
        if (texture2D(nearCoverage, (distantWorld - vec2(${MIN.toFixed(1)})) / ${EXTENT.toFixed(1)}).r > 0.5) discard;
      `)
    }
    result.customProgramCacheKey = () => 'distant-terrain-height-fog-v1'
    return result
  }, [mask])
  useEffect(() => {
    const fail = () => useWorldStore.setState({ terrainError: 'Failed to generate distant mountains. Please reload.' })
    let worker
    try {
      worker = new Worker(new URL('./generation/distant.worker.js', import.meta.url), { type: 'module' })
      worker.onmessage = ({ data }) => {
        if ('progress' in data) {
          useWorldStore.setState({ distantProgress: data.progress })
          return
        }
        if (data.error) fail()
        else setData(data)
        worker.terminate()
      }
      worker.onerror = fail
      worker.postMessage({})
    } catch { fail() }
    return () => { worker?.terminate() }
  }, [])
  useLayoutEffect(() => {
    mask.image.data.fill(0)
    for (const key of rendered) {
      const [column, row] = key.split(',').map(Number)
      const x = column - MIN / TERRAIN_CHUNKS.size
      const z = row - MIN / TERRAIN_CHUNKS.size
      if (x >= 0 && z >= 0 && x < GRID && z < GRID) mask.image.data[(z * GRID + x) * 4] = 255
    }
    mask.needsUpdate = true
  }, [rendered, mask])
  useLayoutEffect(() => {
    if (data) useWorldStore.setState({ distantReady: true })
  }, [data])
  useEffect(() => () => {
    material.dispose()
    mask.dispose()
  }, [material, mask])
  if (!data) return null
  return (
    <mesh name='distant-terrain' material={material}>
      <bufferGeometry>
        <bufferAttribute attach='attributes-position' args={[data.positions, 3]} />
        <bufferAttribute attach='attributes-normal' args={[data.normals, 3]} />
        <bufferAttribute attach='attributes-color' args={[data.colors, 3]} />
        <bufferAttribute attach='index' args={[data.indices, 1]} />
      </bufferGeometry>
    </mesh>
  )
}
