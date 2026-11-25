import 'three-hex-tiling'
import { memo, useEffect, useMemo, useRef } from 'react'
import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { DynamicDrawUsage, IcosahedronGeometry, InstancedBufferAttribute, MeshStandardMaterial, Object3D, RepeatWrapping, SRGBColorSpace } from 'three'
import { OUTDOOR_ASSETS } from '@/scenes/outdoor/assets'
import { TERRAIN_SETTINGS } from '@/scenes/outdoor/constants'
import { createNoise } from '../generation/noise'
import { TERRAIN_CHUNKS, TERRAIN_GENERATION } from '../constants'
import { applyHeightFog } from '../materials/heightFog'
import { ROCK_SETTINGS as settings } from './settings'
import { recordTerrainEvent } from '../streaming/terrainEvents.js'

const CHUNK_SIZE = TERRAIN_CHUNKS.size
const CAMERA_CELL_SIZE = CHUNK_SIZE / 4
const RENDER_DISTANCE = settings.renderRadius * CHUNK_SIZE
const FADE_IN_SECONDS = settings.fadeInMs / 1000
const CAPACITY = (Math.ceil((RENDER_DISTANCE * 2 + CAMERA_CELL_SIZE) / settings.cellSize) + 1) ** 2

// Use the whole camera cell so a batch can stay active while the camera moves inside it.
function withinRockRange (x, z, size, cameraX, cameraZ) {
  const dx = Math.max(cameraX - x - size, x - cameraX - CAMERA_CELL_SIZE, 0)
  const dz = Math.max(cameraZ - z - size, z - cameraZ - CAMERA_CELL_SIZE, 0)
  return dx * dx + dz * dz < RENDER_DISTANCE ** 2
}

export const Rocks = memo(function Rocks ({ chunks, coverage }) {
  const loaded = useTexture([OUTDOOR_ASSETS.groundStone.color, OUTDOOR_ASSETS.groundStone.normal, OUTDOOR_ASSETS.groundStone.roughness])
  const [color, normal, roughness] = loaded
  const batches = useRef([])
  const selection = useRef(null)
  const transform = useMemo(() => new Object3D(), [])
  const bindBatches = useMemo(() => Array.from({ length: settings.variants }, (_, index) => (mesh) => {
    batches.current[index] = mesh
    if (mesh) mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    selection.current = null
  }), [])
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
      shader.vertexShader = 'attribute float rockFadeStartedAt;\n' + shader.vertexShader
      coverage.applyNear(shader, '(modelMatrix * instanceMatrix[3]).xz', `
        smoothstep(0.0, ${FADE_IN_SECONDS.toFixed(3)}, terrainCoverageTime - rockFadeStartedAt)
      `)
      shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
        #include <project_vertex>
        if (nearTerrainWeight <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      `)
    }
    material.customProgramCacheKey = () => 'outdoor-rock-entry-coverage'
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
      geometry.setAttribute('rockFadeStartedAt', new InstancedBufferAttribute(new Float32Array(CAPACITY), 1).setUsage(DynamicDrawUsage))
      return geometry
    })
    return { maps, material, geometries }
  }, [color, normal, roughness, coverage])
  useEffect(() => () => {
    resources.maps.forEach((map) => map.dispose())
    resources.geometries.forEach((geometry) => geometry.dispose())
    resources.material.dispose()
  }, [resources])
  useFrame(({ camera }) => {
    const x = Math.floor(camera.position.x / CAMERA_CELL_SIZE) * CAMERA_CELL_SIZE
    const z = Math.floor(camera.position.z / CAMERA_CELL_SIZE) * CAMERA_CELL_SIZE
    const previous = selection.current
    const sameCell = previous?.x === x && previous.z === z
    if (sameCell && previous.chunks === chunks) return

    const nearby = chunks.filter((chunk) => withinRockRange(chunk.column * CHUNK_SIZE, chunk.row * CHUNK_SIZE, CHUNK_SIZE, x, z))
    if (sameCell && previous.nearby.length === nearby.length &&
        nearby.every((chunk, index) => chunk.buffers.rocks === previous.nearby[index].buffers.rocks)) {
      previous.chunks = chunks
      return
    }

    const start = performance.now()
    const startSeconds = start / 1000
    const startedAt = new Map()
    for (const batch of batches.current) batch.count = 0
    for (const chunk of nearby) {
      const { rocks } = chunk.buffers
      const previousTimes = previous?.startedAt.get(rocks)
      const times = new Float32Array(rocks.length / 8)
      startedAt.set(rocks, times)
      for (let i = 0; i < rocks.length; i += 8) {
        if (!withinRockRange(rocks[i], rocks[i + 2], 0, x, z)) continue
        // Retain the original start time when the same stone survives a batch rebuild.
        const rock = i / 8
        times[rock] = previousTimes?.[rock] || startSeconds
        const batch = batches.current[rocks[i + 7]]
        transform.position.set(rocks[i], rocks[i + 1], rocks[i + 2])
        transform.rotation.set(0, rocks[i + 3], 0)
        transform.scale.set(rocks[i + 4], rocks[i + 5], rocks[i + 6])
        transform.updateMatrix()
        batch.setMatrixAt(batch.count, transform.matrix)
        batch.geometry.getAttribute('rockFadeStartedAt').setX(batch.count, times[rock])
        batch.count += 1
      }
    }
    let instances = 0
    for (const batch of batches.current) {
      batch.visible = batch.count > 0
      const fadeStart = batch.geometry.getAttribute('rockFadeStartedAt')
      batch.instanceMatrix.clearUpdateRanges()
      fadeStart.clearUpdateRanges()
      if (batch.count) {
        batch.instanceMatrix.addUpdateRange(0, batch.count * 16)
        batch.instanceMatrix.needsUpdate = true
        fadeStart.addUpdateRange(0, batch.count)
        fadeStart.needsUpdate = true
        batch.computeBoundingSphere()
      }
      instances += batch.count
    }
    selection.current = { x, z, chunks, nearby, startedAt }
    recordTerrainEvent('rocks-update', { instances, cpuMs: performance.now() - start })
  })

  return resources.geometries.map((geometry, index) => (
    <instancedMesh key={index} ref={bindBatches[index]} args={[geometry, resources.material, CAPACITY]} count={0} receiveShadow />
  ))
})
