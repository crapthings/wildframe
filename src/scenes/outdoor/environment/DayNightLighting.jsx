import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, MathUtils } from 'three'
import { DAY_NIGHT_SETTINGS as settings, MOON_SETTINGS, RAIN_SETTINGS, SCENE_SETTINGS, SUN_SETTINGS } from '../constants'
import { applyCelestialLight } from './celestialLight'
import { useWorldStore } from '../state/worldStore'

export function DayNightLighting ({ environmentBlend, rainBlend }) {
  const sun = useRef()
  const transition = useRef(0)
  const lightColors = useMemo(() => ({ sun: new Color(SUN_SETTINGS.color), moon: new Color(MOON_SETTINGS.color) }), [])
  const rainColors = useMemo(() => ({ day: new Color(RAIN_SETTINGS.dayFog), night: new Color(RAIN_SETTINGS.nightFog), mixed: new Color() }), [])
  const colors = useMemo(() => ({ day: new Color(SCENE_SETTINGS.fog.color), night: new Color(settings.nightFogColor) }), [])
  useFrame(({ scene }, delta) => {
    const target = useWorldStore.getState().timeOfDay === 'night' ? 1 : 0
    const step = Math.min(delta, 0.1) / settings.transitionSeconds
    transition.current = MathUtils.clamp(transition.current + Math.sign(target - transition.current) * Math.min(step, Math.abs(target - transition.current)), 0, 1)
    const t = MathUtils.smoothstep(transition.current, 0, 1)
    environmentBlend.current = t
    const rainTarget = useWorldStore.getState().raining ? 1 : 0
    const rainStep = Math.min(delta, 0.1) / RAIN_SETTINGS.transitionSeconds
    rainBlend.current += Math.sign(rainTarget - rainBlend.current) * Math.min(rainStep, Math.abs(rainTarget - rainBlend.current))
    const rain = rainBlend.current
    applyCelestialLight(sun.current, t, rain, lightColors)
    scene.backgroundIntensity = MathUtils.lerp(1, settings.nightBackgroundIntensity, t)
    scene.environmentIntensity = MathUtils.lerp(1, settings.nightEnvironmentIntensity, t) * (1 - rain * 0.25)
    if (scene.fog) {
      scene.fog.color.copy(colors.day).lerp(colors.night, t).lerp(rainColors.mixed.copy(rainColors.day).lerp(rainColors.night, t), rain)
      scene.fog.density = SCENE_SETTINGS.fog.density * (1 + rain * 0.4)
    }
  }, -1)
  return (
    <sunLight
      ref={sun}
      args={[SUN_SETTINGS.color, SUN_SETTINGS.intensity]}
      castShadow
      position={SUN_SETTINGS.position}
      shadow-camera-far={SUN_SETTINGS.shadowCameraFar}
    />
  )
}
