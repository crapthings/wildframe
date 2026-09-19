import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { TERRAIN_REFERENCE_SETTINGS } from '@/scenes/outdoor/constants'
import { TERRAIN_REFERENCE_HEIGHT } from '@/scenes/outdoor/constants'

function ignoreRaycast () {}

export function TerrainReference () {
  const terrainRef = useRef()

  useFrame(({ camera }) => {
    terrainRef.current.position.set(
      camera.position.x,
      TERRAIN_REFERENCE_HEIGHT,
      camera.position.z
    )
  })

  return (
    <mesh
      ref={terrainRef}
      name='terrain-reference'
      raycast={ignoreRaycast}
      rotation-x={-Math.PI / 2}
      userData={{ walkable: false }}
    >
      <planeGeometry
        args={[
          TERRAIN_REFERENCE_SETTINGS.renderSize,
          TERRAIN_REFERENCE_SETTINGS.renderSize
        ]}
      />
      <meshStandardMaterial
        color={TERRAIN_REFERENCE_SETTINGS.color}
        metalness={TERRAIN_REFERENCE_SETTINGS.metalness}
        roughness={TERRAIN_REFERENCE_SETTINGS.roughness}
      />
    </mesh>
  )
}
