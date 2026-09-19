import { useEffect, useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import { MathUtils, Vector3 } from 'three'
import { PLAYER_SETTINGS, MOVEMENT_KEYS } from '@/scenes/outdoor/constants'
import { WORLD_BOUNDS } from '@/scenes/outdoor/constants'
import { PlayerModel } from './PlayerModel'
import { isTerrainWalkable, sampleTerrainHeight } from '@/scenes/outdoor/terrain/generation/sampleTerrain'
import { useWorldStore } from '@/scenes/outdoor/state/worldStore'
import { chunkKey } from '@/scenes/outdoor/terrain/streaming/chunks'
import { Facing, Player, Position, Velocity, simulationWorld } from '@/scenes/outdoor/state/entities'
import { recordTerrainEvent } from '../terrain/streaming/terrainEvents.js'

const FOOTPRINT_RADIUS = PLAYER_SETTINGS.radius

export function PlayerController () {
  const meshRef = useRef()
  const playerRef = useRef()
  const cameraForward = useRef(new Vector3())
  const cameraRight = useRef(new Vector3())
  const movementDirection = useRef(new Vector3())
  const targetVelocity = useRef(new Vector3())
  const velocity = useRef(new Vector3())
  const blockedKeys = useRef(new Set())
  const waitingForChunk = useRef(null)
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls)
  const [, getKeys] = useKeyboardControls()

  useLayoutEffect(() => {
    const player = simulationWorld.spawn(Player, Position, Velocity, Facing)
    player.get(Position).set(...PLAYER_SETTINGS.position)
    velocity.current = player.get(Velocity)
    playerRef.current = player
    return () => {
      playerRef.current = null
      player.destroy()
    }
  }, [])

  useEffect(() => {
    const resetMovement = () => {
      velocity.current.set(0, 0, 0)
      for (const { name } of MOVEMENT_KEYS) blockedKeys.current.add(name)
    }
    const releaseKey = (event) => {
      for (const { name, keys } of MOVEMENT_KEYS) {
        if (keys.includes(event.code)) blockedKeys.current.delete(name)
      }
    }
    const pressKey = (event) => {
      if (!event.repeat) releaseKey(event)
    }
    const onVisibilityChange = () => {
      if (document.hidden) resetMovement()
    }

    window.addEventListener('blur', resetMovement)
    window.addEventListener('keydown', pressKey)
    window.addEventListener('keyup', releaseKey)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('blur', resetMovement)
      window.removeEventListener('keydown', pressKey)
      window.removeEventListener('keyup', releaseKey)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  useFrame((_, delta) => {
    const mesh = meshRef.current

    const player = playerRef.current
    if (!mesh || !player) return
    const position = player.get(Position)
    mesh.position.copy(position)
    mesh.rotation.y = player.get(Facing).yaw

    const world = useWorldStore.getState()
    if (!world.sceneEntered) {
      velocity.current.set(0, 0, 0)
      for (const { name } of MOVEMENT_KEYS) blockedKeys.current.add(name)
      return
    }
    if (world.terrainError || (world.teleportTarget && (
      world.terrainLoading ||
      world.terrainCenter !== chunkKey(world.teleportTarget.x, world.teleportTarget.z)
    ))) {
      velocity.current.set(0, 0, 0)
      return
    }
    if (world.teleportTarget && controls) {
      const x = MathUtils.clamp(
        world.teleportTarget.x,
        WORLD_BOUNDS.minX + FOOTPRINT_RADIUS,
        WORLD_BOUNDS.maxX - FOOTPRINT_RADIUS
      )
      const z = MathUtils.clamp(
        world.teleportTarget.z,
        WORLD_BOUNDS.minZ + FOOTPRINT_RADIUS,
        WORLD_BOUNDS.maxZ - FOOTPRINT_RADIUS
      )
      if (!isTerrainWalkable(x, z, FOOTPRINT_RADIUS)) {
        world.clearTeleport()
        velocity.current.set(0, 0, 0)
        return
      }
      const y = sampleTerrainHeight(x, z) + PLAYER_SETTINGS.height / 2

      camera.position.x += x - mesh.position.x
      camera.position.y += y - mesh.position.y
      camera.position.z += z - mesh.position.z
      mesh.position.set(x, y, z)
      position.copy(mesh.position)
      controls.target.copy(mesh.position)
      controls.snap = true
      velocity.current.set(0, 0, 0)
      targetVelocity.current.set(0, 0, 0)
      for (const { name } of MOVEMENT_KEYS) blockedKeys.current.add(name)
      camera.getWorldDirection(cameraForward.current)
      world.setView({
        x,
        z,
        heading: Math.atan2(cameraForward.current.x, -cameraForward.current.z)
      })
      world.clearTeleport()
      return
    }

    const keys = getKeys()
    const activeElement = document.activeElement
    const editing = activeElement?.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement?.tagName)
    if (document.hidden || editing) {
      velocity.current.set(0, 0, 0)
      for (const { name } of MOVEMENT_KEYS) blockedKeys.current.add(name)
      return
    }
    const isPressed = (name) => keys[name] && !blockedKeys.current.has(name)
    const inputX = Number(isPressed('right')) - Number(isPressed('left'))
    const inputZ = Number(isPressed('forward')) - Number(isPressed('backward'))
    const hasMovementInput = inputX !== 0 || inputZ !== 0
    const frameDelta = Math.min(
      delta,
      PLAYER_SETTINGS.maxMovementDeltaSeconds
    )

    targetVelocity.current.set(0, 0, 0)

    if (hasMovementInput) {
      if (controls && Number.isFinite(controls.yaw)) {
        cameraForward.current.set(-Math.sin(controls.yaw), 0, -Math.cos(controls.yaw))
      } else {
        camera.getWorldDirection(cameraForward.current)
      }
      cameraForward.current.y = 0
      cameraForward.current.normalize()
      cameraRight.current
        .crossVectors(cameraForward.current, camera.up)
        .normalize()
      movementDirection.current
        .copy(cameraForward.current)
        .multiplyScalar(inputZ)
        .addScaledVector(cameraRight.current, inputX)
        .normalize()
      targetVelocity.current
        .copy(movementDirection.current)
        .multiplyScalar(isPressed('sprintLeft') || isPressed('sprintRight')
          ? PLAYER_SETTINGS.sprintSpeed
          : PLAYER_SETTINGS.movementSpeed)
    }

    const smoothing = hasMovementInput
      ? PLAYER_SETTINGS.movementAcceleration
      : PLAYER_SETTINGS.movementDeceleration

    velocity.current.x = MathUtils.damp(
      velocity.current.x,
      targetVelocity.current.x,
      smoothing,
      frameDelta
    )
    velocity.current.z = MathUtils.damp(
      velocity.current.z,
      targetVelocity.current.z,
      smoothing,
      frameDelta
    )

    if (
      !hasMovementInput &&
      velocity.current.lengthSq() < PLAYER_SETTINGS.movementEpsilon ** 2
    ) {
      velocity.current.set(0, 0, 0)
      return
    }

    // The footprint remains inside the world at every yaw angle.
    const footprintRadius = FOOTPRINT_RADIUS
    const halfHeight = PLAYER_SETTINGS.height / 2
    const previousX = position.x
    const previousZ = position.z
    const requestedX = previousX + velocity.current.x * frameDelta
    const requestedZ = previousZ + velocity.current.z * frameDelta
    const nextX = MathUtils.clamp(
      requestedX,
      WORLD_BOUNDS.minX + footprintRadius,
      WORLD_BOUNDS.maxX - footprintRadius
    )
    const nextZ = MathUtils.clamp(
      requestedZ,
      WORLD_BOUNDS.minZ + footprintRadius,
      WORLD_BOUNDS.maxZ - footprintRadius
    )
    const nextChunk = chunkKey(nextX, nextZ)
    if (!world.readyChunks.has(nextChunk)) {
      if (import.meta.env.DEV && waitingForChunk.current !== nextChunk) {
        recordTerrainEvent('movement-waiting-for-chunk', { key: nextChunk, x: nextX, z: nextZ })
        waitingForChunk.current = nextChunk
      }
      velocity.current.set(0, 0, 0)
      return
    }
    if (import.meta.env.DEV && waitingForChunk.current !== null) {
      recordTerrainEvent('movement-chunk-ready', { key: waitingForChunk.current })
      waitingForChunk.current = null
    }
    if (!isTerrainWalkable(nextX, nextZ, FOOTPRINT_RADIUS)) {
      velocity.current.set(0, 0, 0)
      return
    }
    const nextY = sampleTerrainHeight(nextX, nextZ) + halfHeight
    const movementX = nextX - previousX
    const movementZ = nextZ - previousZ

    if (nextX !== requestedX) velocity.current.x = 0
    if (nextZ !== requestedZ) velocity.current.z = 0

    if (Math.hypot(movementX, movementZ) > PLAYER_SETTINGS.movementEpsilon * frameDelta) {
      const targetRotation = Math.atan2(movementX, movementZ)
      const rotationDifference = Math.atan2(
        Math.sin(targetRotation - mesh.rotation.y),
        Math.cos(targetRotation - mesh.rotation.y)
      )
      mesh.rotation.y += rotationDifference * (
        1 - Math.exp(-PLAYER_SETTINGS.rotationSpeed * frameDelta)
      )
    }

    mesh.position.set(nextX, nextY, nextZ)
    position.copy(mesh.position)
    player.set(Facing, { yaw: mesh.rotation.y })
    if (controls?.target) {
      controls.target.copy(mesh.position)
    }
  })

  return (
    <group ref={meshRef} position={PLAYER_SETTINGS.position}>
      <PlayerModel playerRef={playerRef} />
    </group>
  )
}
