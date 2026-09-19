import { Environment, SpotLight } from '@react-three/drei'
import { OUTDOOR_ASSETS } from '../assets'
import { NightStars } from './NightStars'
import { Rain } from './Rain'
import { DayNightSky } from './DayNightSky'
import { SUN_BEAM_SETTINGS, SUN_SETTINGS } from '@/scenes/outdoor/constants'
import { useWorldStore } from '../state/worldStore'

export function Atmosphere ({ environmentBlend, rainBlend }) {
  const night = useWorldStore((state) => state.timeOfDay === 'night')
  return (
    <>
      <Environment files={OUTDOOR_ASSETS.environment} />
      <DayNightSky environmentBlend={environmentBlend} rainBlend={rainBlend} />
      <NightStars environmentBlend={environmentBlend} rainBlend={rainBlend} />
      <Rain environmentBlend={environmentBlend} rainBlend={rainBlend} />
      <SpotLight
        {...SUN_BEAM_SETTINGS}
        opacity={night ? 0 : SUN_BEAM_SETTINGS.opacity}
        position={SUN_SETTINGS.position}
      />
    </>
  )
}
