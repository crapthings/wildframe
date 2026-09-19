import 'three-hex-tiling'
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useTexture } from '@react-three/drei'
import { DynamicDrawUsage, IcosahedronGeometry, MeshStandardMaterial, Object3D, RepeatWrapping, SRGBColorSpace } from 'three'
import { OUTDOOR_ASSETS } from '@/scenes/outdoor/assets'
import { TERRAIN_SETTINGS } from '@/scenes/outdoor/constants'
import { createNoise } from '../generation/noise'
import { TERRAIN_CHUNKS, TERRAIN_GENERATION } from '../constants'
import { applyHeightFog } from '../materials/heightFog'
import { ROCK_SETTINGS as settings } from './settings'
import { recordTerrainEvent } from '../streaming/terrainEvents.js'

const CAPACITY = (settings.renderRadius * 2 + 1) ** 2 * (TERRAIN_CHUNKS.size / settings.cellSize) ** 2
const nearby = (chunks) => chunks.filter((chunk) => chunk.distance <= settings.renderRadius ** 2 && chunk.rocks)

function RockBatch ({ geometry, material, instances }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const start = performance.now()
    const object = new Object3D()
    ref.current.count = instances.length
    ref.current.instanceMatrix.setUsage(DynamicDrawUsage)
    instances.forEach((data, index) => {
      object.position.set(data[0], data[1], data[2])
      object.rotation.set(0, data[3], 0)
      object.scale.set(data[4], data[5], data[6])
      object.updateMatrix()
      ref.current.setMatrixAt(index, object.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.instanceMatrix.clearUpdateRanges()
    if (instances.length) ref.current.instanceMatrix.addUpdateRange(0, instances.length * 16)
    ref.current.computeBoundingSphere()
    recordTerrainEvent('rocks-update', { instances: instances.length, cpuMs: performance.now() - start })
  }, [instances])
  return <instancedMesh ref={ref} args={[geometry, material, CAPACITY]} receiveShadow />
}

export const Rocks = memo(function Rocks ({ chunks }) {
  const loaded = useTexture([OUTDOOR_ASSETS.groundStone.color, OUTDOOR_ASSETS.groundStone.normal, OUTDOOR_ASSETS.groundStone.roughness])
  const [color, normal, roughness] = loaded
  const resources = useMemo(() => {
    // Clone sampler state so other users of the cached texture remain unaffected.
    const maps = [color, normal, roughness].map((source, index) => {
      const map = source.clone()
      if (index === 0) map.colorSpace = SRGBColorSpace
      map.wrapS = map.wrapT = RepeatWrapping
      map.repeat.setScalar(2 / settings.textureSize)
      map.anisotropy = TERRAIN_SETTINGS.anisotropy
      map.needsUpdate = true
      return map
    })
    const material = new MeshStandardMaterial({ map: maps[0], normalMap: maps[1], roughnessMap: maps[2], roughness: 1, hexTiling: TERRAIN_SETTINGS.hexTiling })
    const compile = material.onBeforeCompile
    material.onBeforeCompile = function (shader, renderer) {
      compile.call(this, shader, renderer)
      applyHeightFog(shader)
      shader.vertexShader = shader.vertexShader.replace('terrainFogHeight = (modelMatrix * vec4(position, 1.0)).y;', 'terrainFogHeight = (modelMatrix * instanceMatrix * vec4(position, 1.0)).y;')
    }
    material.customProgramCacheKey = () => 'outdoor-rock-height-fog-v1'
    const geometries = Array.from({ length: settings.variants }, (_, variant) => {
      const geometry = new IcosahedronGeometry(1, 2)
      const noise = createNoise(TERRAIN_GENERATION.seed + settings.seedOffset + variant, { frequency: 1.7, octaves: 2 })
      const positions = geometry.attributes.position
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i)
        const y = positions.getY(i)
        const z = positions.getZ(i)
        const shape = 1 + noise.GetNoise(x + y * 0.7, z - y * 0.4) * 0.3
        positions.setXYZ(i, x * shape, Math.max(-0.6, y * shape) + 0.6, z * shape)
      }
      geometry.computeVertexNormals()
      geometry.computeBoundingSphere()
      return geometry
    })
    return { maps, material, geometries }
  }, [color, normal, roughness])
  useEffect(() => () => {
    resources.maps.forEach((map) => map.dispose())
    resources.geometries.forEach((geometry) => geometry.dispose())
    resources.material.dispose()
  }, [resources])
  const groups = useMemo(() => {
    const groups = Array.from({ length: settings.variants }, () => [])
    for (const chunk of chunks) {
      if (chunk.distance > settings.renderRadius * settings.renderRadius || !chunk.rocks) continue
      for (let i = 0; i < chunk.rocks.length; i += 8) groups[chunk.rocks[i + 7]].push(chunk.rocks.subarray(i, i + 8))
    }
    return groups
  }, [chunks])
  return groups.map((instances, index) => (
    <RockBatch key={index} geometry={resources.geometries[index]} material={resources.material} instances={instances} />
  ))
}, (previous, next) => {
  const a = nearby(previous.chunks)
  const b = nearby(next.chunks)
  return a.length === b.length && a.every((chunk, index) => chunk.key === b[index].key && chunk.rocks === b[index].rocks)
})
