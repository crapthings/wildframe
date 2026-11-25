import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, extend } from '@react-three/fiber'
import { KeyboardControls } from '@react-three/drei'
import { ThirdPersonCamera } from '@/scenes/outdoor/camera/ThirdPersonCamera'
import { Perf } from 'r3f-perf'
import { SunLight } from 'three/addons/lights/SunLight.js'
import { Atmosphere } from '@/scenes/outdoor/environment/Atmosphere'
import { PlayerController } from '@/scenes/outdoor/player/PlayerController'
import { Terrain } from '@/scenes/outdoor/terrain/Terrain'
import { DistantTerrain } from '@/scenes/outdoor/terrain/DistantTerrain'
import { Ocean } from '@/scenes/outdoor/ocean/Ocean'
import { TerrainReference } from '@/scenes/outdoor/terrain/TerrainReference'
import {
  MOVEMENT_KEYS,
  SCENE_SETTINGS
} from '@/scenes/outdoor/constants'
import { CameraTracker } from '@/scenes/outdoor/camera/CameraTracker'
import { FrameDiagnostics } from './terrain/streaming/FrameDiagnostics.jsx'
import { JacarandaTree } from './vegetation/JacarandaTree'
import { DayNightLighting } from './environment/DayNightLighting'
import { TerrainCoverage } from './terrain/streaming/terrainCoverage.js'

extend({ SunLight })

export function OutdoorScene () {
  const environmentBlend = useRef(0)
  const rainBlend = useRef(0)
  const terrainCoverage = useMemo(() => new TerrainCoverage(), [])
  useEffect(() => () => terrainCoverage.dispose(), [terrainCoverage])
  return (
    <KeyboardControls map={MOVEMENT_KEYS}>
      <Canvas camera={SCENE_SETTINGS.camera} dpr={SCENE_SETTINGS.dpr} shadows>
        {import.meta.env.DEV && <Perf position='top-right' />}
        {import.meta.env.DEV && <FrameDiagnostics />}
        <fogExp2
          attach='fog'
          args={[SCENE_SETTINGS.fog.color, SCENE_SETTINGS.fog.density]}
        />
        <DayNightLighting environmentBlend={environmentBlend} rainBlend={rainBlend} />
        <Suspense fallback={null}><Atmosphere environmentBlend={environmentBlend} rainBlend={rainBlend} /></Suspense>
        <Suspense fallback={null}><PlayerController /></Suspense>
        <TerrainReference />
        <Terrain coverage={terrainCoverage} />
        <JacarandaTree />
        <DistantTerrain coverage={terrainCoverage} />
        <Ocean />
        <ThirdPersonCamera />
        <CameraTracker />
      </Canvas>
    </KeyboardControls>
  )
}
