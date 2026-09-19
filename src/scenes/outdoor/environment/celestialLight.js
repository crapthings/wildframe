import { MathUtils } from 'three'
import { DAY_NIGHT_SETTINGS, MOON_SETTINGS, SUN_SETTINGS } from '../constants'

// Change direction only while the shared light is dark. Reversible mid-transition.
export function applyCelestialLight (light, blend, rain, colors) {
  const moon = blend >= MOON_SETTINGS.takeoverAt
  const settings = moon ? MOON_SETTINGS : SUN_SETTINGS
  const height = moon
    ? MathUtils.lerp(DAY_NIGHT_SETTINGS.nightSunHeight, settings.position[1], MathUtils.smoothstep(blend, MOON_SETTINGS.takeoverAt, 1))
    : MathUtils.lerp(settings.position[1], DAY_NIGHT_SETTINGS.nightSunHeight, blend)
  light.position.set(settings.position[0], height, settings.position[2])
  light.color.copy(moon ? colors.moon : colors.sun)
  const wasDark = light.intensity === 0
  light.intensity = settings.intensity * MathUtils.smoothstep(height, 0, settings.position[1]) * (1 - rain * (moon ? MOON_SETTINGS.rainAttenuation : 0.85))
  light.shadow.autoUpdate = light.intensity > 0
  if (wasDark && light.intensity > 0) light.shadow.needsUpdate = true
}
