import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import { useWorldStore } from '@/scenes/outdoor/state/worldStore'
import { Player, Position, simulationWorld } from '@/scenes/outdoor/state/entities'

const UPDATE_INTERVAL = 0.1

export function CameraTracker () {
  const direction = useRef(new Vector3())
  const nextUpdate = useRef(0)

  useFrame(({ camera, clock }) => {
    if (clock.elapsedTime < nextUpdate.current) return

    nextUpdate.current = clock.elapsedTime + UPDATE_INTERVAL
    camera.getWorldDirection(direction.current)
    const player = simulationWorld.query(Player, Position)[0]
    if (!player) return
    const position = player.get(Position)

    useWorldStore.getState().setView({
      heading: Math.atan2(direction.current.x, -direction.current.z),
      x: position.x,
      z: position.z
    })
  })

  return null
}
