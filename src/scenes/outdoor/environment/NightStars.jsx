import { useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import { MathUtils } from 'three'
import { STAR_SETTINGS } from '../constants'

export function NightStars ({ environmentBlend, rainBlend }) {
  const stars = useRef()
  const opacity = useRef({ value: 0 })
  useLayoutEffect(() => {
    const points = stars.current
    const material = points.material
    const compile = material.onBeforeCompile
    const cacheKey = material.customProgramCacheKey
    points.visible = false
    points.frustumCulled = false
    material.onBeforeCompile = function (shader, renderer) {
      compile.call(this, shader, renderer)
      shader.uniforms.nightOpacity = opacity.current
      shader.vertexShader = 'varying float starElevation;\n' + shader.vertexShader.replace('void main() {', 'void main() { starElevation = normalize(position).y;')
      shader.fragmentShader = 'uniform float nightOpacity;\nvarying float starElevation;\n' + shader.fragmentShader.replace(
        '#include <tonemapping_fragment>',
        'gl_FragColor.a *= nightOpacity * smoothstep(0.0, 0.12, starElevation);\n#include <tonemapping_fragment>'
      )
    }
    material.customProgramCacheKey = () => 'night-stars-fade-v1'
    material.needsUpdate = true
    return () => {
      material.onBeforeCompile = compile
      material.customProgramCacheKey = cacheKey
      material.needsUpdate = true
    }
  }, [])
  useFrame(({ camera }) => {
    if (!stars.current) return
    opacity.current.value = MathUtils.smoothstep(environmentBlend.current, 0.55, 1) * (1 - rainBlend.current)
    stars.current.visible = opacity.current.value > 0.001
    stars.current.position.copy(camera.position)
  })
  return <Stars ref={stars} {...STAR_SETTINGS} fade />
}
