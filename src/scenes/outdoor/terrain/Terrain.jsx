import { Profiler, Suspense, useEffect, useLayoutEffect, useMemo, useRef, memo } from 'react'
import { useTexture } from '@react-three/drei'
import { BufferAttribute, BufferGeometry, RepeatWrapping, SRGBColorSpace } from 'three'
import { OUTDOOR_ASSETS } from '@/scenes/outdoor/assets'
import { TERRAIN_SETTINGS } from '@/scenes/outdoor/constants'
import { TERRAIN_CHUNKS } from '@/scenes/outdoor/terrain/constants'
import { useTerrainChunks } from '@/scenes/outdoor/terrain/streaming/useTerrainChunks'
import { createTerrainMaterial } from '@/scenes/outdoor/terrain/materials/createTerrainMaterial'
import { useSurfaceTextures } from './materials/textures/useSurfaceTextures'
import { useWorldStore } from '@/scenes/outdoor/state/worldStore'
import { Rocks } from './rocks/Rocks'
import { recordTerrainEvent } from './streaming/terrainEvents.js'
import { retainTerrainGeometry, retireTerrainGeometry } from './streaming/geometryDisposal.js'

function recordTerrainRender (id, phase, actualDuration, baseDuration, startTime, commitTime) {
  if (actualDuration > 4) recordTerrainEvent('terrain-react-render', {
    phase,
    renderMs: actualDuration,
    startTime,
    commitTime
  }, commitTime)
}

export function Terrain () {
  const chunks = useTerrainChunks()
  const surfaces = useSurfaceTextures()
  const meshes = <Suspense fallback={null}><TerrainMeshes chunks={chunks} surfaces={surfaces} /></Suspense>
  return import.meta.env.DEV ? <Profiler id='terrain' onRender={recordTerrainRender}>{meshes}</Profiler> : meshes
}

function TerrainMeshes ({ chunks, surfaces }) {
  const rendered = useRef(false)
  const [colorMap, normalMap, roughnessMap, grassColor, grassNormal, grassRoughness, mountainColor, mountainNormal, mountainRoughness, bareNormal] = useTexture([
    OUTDOOR_ASSETS.terrain.color,
    OUTDOOR_ASSETS.terrain.normal,
    OUTDOOR_ASSETS.terrain.roughness,
    OUTDOOR_ASSETS.grass.color,
    OUTDOOR_ASSETS.grass.normal,
    OUTDOOR_ASSETS.grass.roughness,
    OUTDOOR_ASSETS.cliff.color,
    OUTDOOR_ASSETS.cliff.normal,
    OUTDOOR_ASSETS.cliff.roughness,
    OUTDOOR_ASSETS.rockFace.normal,
    OUTDOOR_ASSETS.groundStone.color, OUTDOOR_ASSETS.groundStone.normal, OUTDOOR_ASSETS.groundStone.roughness
  ])
  const [footPacked, footNormal, barePacked] = surfaces || []
  const textures = useMemo(
    () => [colorMap, normalMap, roughnessMap, grassColor, grassNormal, grassRoughness, mountainColor, mountainNormal, mountainRoughness],
    [colorMap, normalMap, roughnessMap, grassColor, grassNormal, grassRoughness, mountainColor, mountainNormal, mountainRoughness]
  )
  const material = useMemo(() => footPacked ? createTerrainMaterial([...textures, footPacked, footNormal, barePacked, bareNormal]) : null, [textures, footPacked, footNormal, barePacked, bareNormal])
  useEffect(() => () => material?.dispose(), [material])
  const textureRepeat = 1 / TERRAIN_SETTINGS.textureWorldSize

  useLayoutEffect(() => {
    if (!footPacked) return
    colorMap.colorSpace = SRGBColorSpace
    grassColor.colorSpace = SRGBColorSpace
    mountainColor.colorSpace = SRGBColorSpace

    for (const texture of [...textures, footPacked, footNormal, barePacked, bareNormal]) {
      texture.wrapS = RepeatWrapping
      texture.wrapT = RepeatWrapping
      texture.repeat.set(textureRepeat, textureRepeat)
      texture.offset.set(0, 0)
      texture.anisotropy = TERRAIN_SETTINGS.anisotropy
      texture.needsUpdate = true
    }
  }, [textureRepeat, textures, colorMap, grassColor, mountainColor, footPacked, footNormal, barePacked, bareNormal])

  useLayoutEffect(() => {
    rendered.current = false
    useWorldStore.setState({ surfaceReady: false })
    return () => useWorldStore.setState({ surfaceReady: false })
  }, [material])

  if (!material) return null

  return <>{chunks.map((chunk) => (
    <TerrainChunk key={chunk.key} chunk={chunk} material={material} rendered={rendered} />
  ))}<Rocks chunks={chunks} /></>
}

const TerrainChunk = memo(function TerrainChunk ({ chunk, material, rendered }) {
  const { positions, normals, uvs, blends, details, indices } = chunk
  const geometry = useMemo(() => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    geometry.setAttribute('normal', new BufferAttribute(normals, 3))
    geometry.setAttribute('uv', new BufferAttribute(uvs, 2))
    geometry.setAttribute('terrainBlend', new BufferAttribute(blends, 3))
    geometry.setAttribute('terrainDetails', new BufferAttribute(details, 2))
    geometry.setIndex(new BufferAttribute(indices, 1))
    return geometry
  }, [positions, normals, uvs, blends, details, indices])
  useLayoutEffect(() => {
    retainTerrainGeometry(geometry)
    return () => retireTerrainGeometry(geometry)
  }, [geometry])
  return (
    <mesh
      key={chunk.key}
      name={`terrain-${chunk.key}`}
      castShadow={chunk.distance <= 4}
      position={[chunk.column * TERRAIN_CHUNKS.size, 0, chunk.row * TERRAIN_CHUNKS.size]}
      receiveShadow
      userData={{ walkable: true }}
      material={material}
      geometry={geometry}
      dispose={null}
      onAfterRender={() => {
        if (!rendered.current) {
          rendered.current = true
          useWorldStore.setState({ surfaceReady: true })
        }
      }}
    />
  )
}, (a, b) => a.material === b.material && a.chunk.positions === b.chunk.positions &&
  a.chunk.normals === b.chunk.normals && a.chunk.indices === b.chunk.indices &&
  a.chunk.uvs === b.chunk.uvs && a.chunk.blends === b.chunk.blends && a.chunk.details === b.chunk.details &&
  (a.chunk.distance <= 4) === (b.chunk.distance <= 4))
