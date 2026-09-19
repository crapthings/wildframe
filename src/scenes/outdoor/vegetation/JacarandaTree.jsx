import 'three-hex-tiling'
import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { LoadingManager } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OUTDOOR_ASSETS } from '../assets'
import { TERRAIN_SETTINGS, TREE_SETTINGS as settings } from '../constants'
import { useWorldStore } from '../state/worldStore'
import { sampleTerrainHeight } from '../terrain/generation/sampleTerrain'
import { applyHeightFog } from '../terrain/materials/heightFog'

function disposeTree (root) {
  const resources = new Set()
  root.traverse((object) => {
    if (!object.isMesh) return
    resources.add(object.geometry)
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      resources.add(material)
      for (const value of Object.values(material)) if (value?.isTexture) resources.add(value)
    }
  })
  resources.forEach((resource) => resource.dispose())
}

export function JacarandaTree () {
  const entered = useWorldStore((state) => state.sceneEntered)
  const [tree, setTree] = useState(null)
  const root = useRef()
  useEffect(() => {
    if (!entered) return
    let cancelled = false
    let loaded
    // A separate manager keeps this optional, heavy asset out of entry progress.
    const loader = new GLTFLoader(new LoadingManager())
    loader.load(OUTDOOR_ASSETS.jacarandaTree, (gltf) => {
      loaded = gltf.scene
      if (cancelled) { disposeTree(loaded); return }
      loaded.traverse((object) => {
        if (!object.isMesh) return
        object.castShadow = false
        object.receiveShadow = false
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          const leaves = material.name.includes('leaves')
          // Preserve authored foliage UVs; tile breaking is for the bark surfaces.
          if (!leaves) material.hexTiling = TERRAIN_SETTINGS.hexTiling
          else {
            material.normalScale.setScalar(settings.leaves.normalStrength)
            material.envMapIntensity = settings.leaves.environmentIntensity
            material.metalness = 0
            material.roughness = 1
            // Verified RGB JPEG and vertex alpha uniformly 255 (fully opaque).
            // Its leaves are modeled geometry, not alpha-cutout cards.
            material.transparent = false
            material.opacity = 1
            material.depthWrite = true
          }
          const compile = material.onBeforeCompile
          material.onBeforeCompile = function (shader, renderer) {
            compile.call(this, shader, renderer)
            applyHeightFog(shader)
            if (leaves) {
              // A multiplier alone cannot raise low values from the roughness map.
              shader.fragmentShader = shader.fragmentShader.replace(
                '#include <roughnessmap_fragment>',
                `#include <roughnessmap_fragment>\nroughnessFactor = max(roughnessFactor, ${settings.leaves.minimumRoughness.toFixed(3)});`
              )
            }
          }
          const cacheKey = material.customProgramCacheKey.bind(material)
          material.customProgramCacheKey = () => `jacaranda-height-fog-v2-${leaves ? settings.leaves.minimumRoughness : 'bark'}-${cacheKey()}`
          material.needsUpdate = true
        }
      })
      setTree(loaded)
    }, undefined, (error) => {
      if (!cancelled) console.warn('Jacaranda tree failed to load', error)
    })
    return () => {
      cancelled = true
      if (loaded) disposeTree(loaded)
    }
  }, [entered])

  useFrame(({ camera }) => {
    if (!root.current) return
    const distance = Math.hypot(camera.position.x - settings.x, camera.position.z - settings.z)
    root.current.visible = distance < (root.current.visible ? settings.hideDistance : settings.showDistance)
  })

  if (!tree) return null
  return (
    <group ref={root} position={[settings.x, sampleTerrainHeight(settings.x, settings.z) - settings.sink, settings.z]} rotation={[0, settings.yaw, 0]} scale={settings.scale}>
      <primitive object={tree} dispose={null} />
    </group>
  )
}
