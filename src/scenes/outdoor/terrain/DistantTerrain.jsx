import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { MeshStandardMaterial } from 'three'
import { useWorldStore } from '@/scenes/outdoor/state/worldStore'
import { applyHeightFog } from './materials/heightFog'

export function DistantTerrain ({ coverage }) {
  const [sectors, setSectors] = useState(null)
  const material = useMemo(() => {
    const result = new MeshStandardMaterial({ vertexColors: true, roughness: 1 })
    const compile = result.onBeforeCompile
    result.onBeforeCompile = function (shader, renderer) {
      compile.call(this, shader, renderer)
      applyHeightFog(shader)
      coverage.applyDistant(shader)
    }
    result.customProgramCacheKey = () => 'distant-terrain-height-fog-coverage'
    return result
  }, [coverage])
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
        else setSectors(data.sectors)
        worker.terminate()
      }
      worker.onerror = fail
      worker.postMessage({})
    } catch { fail() }
    return () => { worker?.terminate() }
  }, [])
  useLayoutEffect(() => {
    if (sectors) useWorldStore.setState({ distantReady: true })
  }, [sectors])
  useEffect(() => () => material.dispose(), [material])
  if (!sectors) return null
  return (
    <group name='distant-terrain'>
      {sectors.map((sector) => (
        <mesh key={sector.key} name={`distant-terrain-${sector.key}`} material={material}>
          <bufferGeometry>
            <bufferAttribute attach='attributes-position' args={[sector.positions, 3]} />
            <bufferAttribute attach='attributes-normal' args={[sector.normals, 3]} />
            <bufferAttribute attach='attributes-color' args={[sector.colors, 3]} />
            <bufferAttribute attach='index' args={[sector.indices, 1]} />
          </bufferGeometry>
        </mesh>
      ))}
    </group>
  )
}
