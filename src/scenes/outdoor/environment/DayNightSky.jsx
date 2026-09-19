import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useEnvironment } from '@react-three/drei'
import { BackSide, Color, ShaderMaterial } from 'three'
import { OUTDOOR_ASSETS } from '../assets'
import { DAY_NIGHT_SETTINGS, RAIN_SETTINGS, SCENE_SETTINGS } from '../constants'

export function DayNightSky ({ environmentBlend, rainBlend }) {
  const map = useEnvironment({ files: OUTDOOR_ASSETS.environment })
  const scene = useThree((state) => state.scene)
  const sky = useRef()
  const night = useMemo(() => new Color(DAY_NIGHT_SETTINGS.nightSkyColor), [])
  const material = useMemo(() => new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    uniforms: { rain: { value: 0 }, rainDay: { value: new Color(RAIN_SETTINGS.daySky) }, rainNight: { value: new Color(RAIN_SETTINGS.nightSky) }, skyMap: { value: map }, nightColor: { value: night }, blend: { value: 0 }, brightness: { value: 1 } },
    vertexShader: `varying vec3 skyDirection;
      void main() {
        skyDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `uniform sampler2D skyMap;
      uniform float rain;
      uniform vec3 rainDay;
      uniform vec3 rainNight;
      uniform vec3 nightColor;
      uniform float blend;
      uniform float brightness;
      varying vec3 skyDirection;
      #include <common>
      void main() {
        vec3 direction = normalize(skyDirection);
        vec2 uv = equirectUv(direction);
        gl_FragColor = vec4(texture2D(skyMap, uv).rgb * brightness, 1.0);
        #include <tonemapping_fragment>
        // Fade after tone mapping so even the HDR sun disappears smoothly.
        gl_FragColor.rgb = mix(gl_FragColor.rgb, nightColor, blend);
        vec3 overcast = mix(rainDay, rainNight, blend) * mix(1.12, 0.72, smoothstep(0.0, 1.0, direction.y));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, overcast, rain);
        #include <colorspace_fragment>
      }`
  }), [map, night])
  useEffect(() => () => material.dispose(), [material])
  useLayoutEffect(() => {
    const previous = scene.background
    scene.background = map
    return () => { scene.background = previous }
  }, [scene, map])
  useFrame(({ camera }) => {
    const t = environmentBlend.current
    scene.background = t === 0 ? map : night
    sky.current.visible = (t > 0 && t < 1) || rainBlend.current > 0
    material.uniforms.rain.value = rainBlend.current
    sky.current.position.copy(camera.position)
    material.uniforms.blend.value = t
    material.uniforms.brightness.value = scene.backgroundIntensity
  })
  return (
    <mesh ref={sky} renderOrder={-1000} frustumCulled={false} scale={SCENE_SETTINGS.camera.far * 0.95} material={material}>
      <sphereGeometry args={[1, 32, 16]} />
    </mesh>
  )
}
