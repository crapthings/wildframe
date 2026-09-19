import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import 'three-hex-tiling'
import { DataTexture, LinearFilter, LinearMipmapLinearFilter, MeshStandardMaterial, RepeatWrapping } from 'three'
import { OCEAN_SETTINGS } from '@/scenes/outdoor/constants'
import { TERRAIN_GENERATION } from '@/scenes/outdoor/terrain/constants'

export function Ocean () {
  const mesh = useRef()
  const time = useMemo(() => ({ value: 0 }), [])
  const noiseMap = useMemo(() => ({ value: null }), [])
  const noiseReady = useMemo(() => ({ value: 0 }), [])
  useEffect(() => {
    let texture
    const worker = new Worker(new URL('./oceanNoise.worker.js', import.meta.url), { type: 'module' })
    worker.onmessage = ({ data: { pixels, resolution } }) => {
      texture = new DataTexture(pixels, resolution, resolution)
      texture.wrapS = texture.wrapT = RepeatWrapping
      texture.magFilter = LinearFilter
      texture.minFilter = LinearMipmapLinearFilter
      texture.generateMipmaps = true
      texture.needsUpdate = true
      noiseMap.value = texture
      noiseReady.value = 1
      worker.terminate()
    }
    worker.onerror = () => {
      console.warn('海面噪声生成失败，暂时使用平静海面')
      worker.terminate()
    }
    worker.postMessage({
      resolution: OCEAN_SETTINGS.noiseResolution,
      seed: TERRAIN_GENERATION.seed + OCEAN_SETTINGS.noiseSeedOffset
    })
    return () => {
      worker.terminate()
      noiseMap.value = null
      noiseReady.value = 0
      texture?.dispose()
    }
  }, [noiseMap, noiseReady])
  const material = useMemo(() => {
    const result = new MeshStandardMaterial({
      color: OCEAN_SETTINGS.color,
      roughness: OCEAN_SETTINGS.roughness,
      metalness: OCEAN_SETTINGS.metalness,
      hexTiling: { patchScale: 2, useContrastCorrectedBlending: false }
    })
    const baseCompile = result.onBeforeCompile
    result.onBeforeCompile = function (shader, renderer) {
      baseCompile.call(this, shader, renderer)
      shader.uniforms.oceanTime = time
      shader.uniforms.waveStrength = { value: OCEAN_SETTINGS.waveStrength }
      shader.uniforms.waveWorldSize = { value: OCEAN_SETTINGS.waveWorldSize }
      shader.uniforms.oceanNoise = noiseMap
      shader.uniforms.oceanNoiseReady = noiseReady
      shader.vertexShader = 'varying vec2 oceanWorld;\n' + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\noceanWorld = (modelMatrix * vec4(position, 1.0)).xz;'
      )
      shader.fragmentShader = 'varying vec2 oceanWorld;\nuniform float oceanTime;\nuniform float waveStrength;\nuniform float waveWorldSize;\nuniform sampler2D oceanNoise;\nuniform float oceanNoiseReady;\n' + shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `
        #include <normal_fragment_maps>
        vec2 waveUv = oceanWorld / waveWorldSize;
        vec2 rippleA = textureNoTileNeyret(oceanNoise, waveUv + vec2(oceanTime, oceanTime * 0.37)).rg * 2.0 - 1.0;
        vec2 rippleB = textureNoTileNeyret(oceanNoise, waveUv * 2.13 + vec2(-oceanTime * 0.61, oceanTime * 0.83) + 17.3).rg * 2.0 - 1.0;
        vec2 slope = rippleA + rippleB * 0.45;
        vec3 ripple = vec3(slope.x, 0.0, slope.y);
        normal = normalize(normal + mat3(viewMatrix) * ripple * waveStrength * oceanNoiseReady);
      `)
    }
    result.customProgramCacheKey = () => 'ocean-fastnoise-hex-v2'
    return result
  }, [time, noiseMap, noiseReady])
  useEffect(() => () => material.dispose(), [material])
  useFrame(({ camera, clock }) => {
    time.value = clock.elapsedTime * OCEAN_SETTINGS.waveSpeed
    mesh.current.position.x = camera.position.x
    mesh.current.position.z = camera.position.z
  })
  return (
    <mesh ref={mesh} material={material} name='ocean' rotation-x={-Math.PI / 2} position-y={TERRAIN_GENERATION.coast.seaLevel}>
      <planeGeometry args={[OCEAN_SETTINGS.renderSize, OCEAN_SETTINGS.renderSize]} />
    </mesh>
  )
}
