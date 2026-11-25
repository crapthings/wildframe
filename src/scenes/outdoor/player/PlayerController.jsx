import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import { MathUtils, Raycaster, Vector3 } from 'three'
import { PLAYER_SETTINGS, MOVEMENT_KEYS } from '@/scenes/outdoor/constants'
import { WORLD_BOUNDS } from '@/scenes/outdoor/constants'
import { PlayerModel } from './PlayerModel'
import { isTerrainWalkable, sampleTerrainHeight } from '@/scenes/outdoor/terrain/generation/sampleTerrain'
import { useWorldStore } from '@/scenes/outdoor/state/worldStore'
import { chunkKey } from '@/scenes/outdoor/terrain/streaming/chunks'
import { Facing, JumpState, Player, Position, Velocity, simulationWorld } from '@/scenes/outdoor/state/entities'
import { recordTerrainEvent } from '../terrain/streaming/terrainEvents.js'

const FOOTPRINT_RADIUS = PLAYER_SETTINGS.radius

function stopHorizontal (velocity) {
  velocity.x = 0
  velocity.z = 0
}

function clearJumpInput (input) {
  input.held = false
  input.expiresAt = 0
}

function sampleGroundHeight (scene, ground, key, x, z) {
  if (ground.key !== key || !ground.mesh?.parent) {
    ground.key = key
    ground.mesh = scene.getObjectByName(`terrain-${key}`)
  }
  const mesh = ground.mesh
  if (mesh) {
    mesh.updateWorldMatrix(true, false)
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
    const top = mesh.geometry.boundingBox.max.y + mesh.matrixWorld.elements[13]
    ground.raycaster.ray.origin.set(x, top + 1, z)
    ground.raycaster.intersectObject(mesh, false, ground.hits)
    const hit = ground.hits[0]
    ground.hits.length = 0
    if (hit) return hit.point.y
  }
  return sampleTerrainHeight(x, z)
}

export function PlayerController () {
  const meshRef = useRef()
  const playerRef = useRef()
  const cameraForward = useRef(new Vector3())
  const cameraRight = useRef(new Vector3())
  const movementDirection = useRef(new Vector3())
  const targetVelocity = useRef(new Vector3())
  const velocity = useRef(new Vector3())
  const blockedKeys = useRef(new Set())
  const jumpInput = useRef({ held: false, expiresAt: 0 })
  const waitingForChunk = useRef(null)
  const ground = useMemo(() => ({
    raycaster: new Raycaster(new Vector3(), new Vector3(0, -1, 0)),
    key: null,
    mesh: null,
    hits: []
  }), [])
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls)
  const [, getKeys] = useKeyboardControls()

  useLayoutEffect(() => {
    const player = simulationWorld.spawn(Player, Position, Velocity, Facing, JumpState)
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
      stopHorizontal(velocity.current)
      clearJumpInput(jumpInput.current)
      for (const { name } of MOVEMENT_KEYS) blockedKeys.current.add(name)
    }
    const releaseKey = (event) => {
      if (event.code === 'Space') {
        jumpInput.current.held = false
        return
      }
      for (const { name, keys } of MOVEMENT_KEYS) {
        if (keys.includes(event.code)) blockedKeys.current.delete(name)
      }
    }
    const pressKey = (event) => {
      if (event.code !== 'Space') {
        if (!event.repeat) releaseKey(event)
        return
      }
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return
      const target = event.target
      if (target instanceof Element && (target.isContentEditable || target.closest('button, input, textarea, select, a[href], [role=button]'))) return
      event.preventDefault()
      const world = useWorldStore.getState()
      if (event.repeat || !world.sceneEntered || world.teleportTarget || world.terrainError) return
      jumpInput.current.held = true
      jumpInput.current.expiresAt = performance.now() + PLAYER_SETTINGS.jumpBufferMs
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

  // Publish movement before the model advances its animation.
  useFrame(({ scene }, delta) => {
    const mesh = meshRef.current

    const player = playerRef.current
    if (!mesh || !player) return
    const input = jumpInput.current
    const now = performance.now()
    const position = player.get(Position)
    mesh.position.copy(position)
    mesh.rotation.y = player.get(Facing).yaw

    const world = useWorldStore.getState()
    if (!world.sceneEntered) {
      stopHorizontal(velocity.current)
      clearJumpInput(input)
      for (const { name } of MOVEMENT_KEYS) blockedKeys.current.add(name)
      return
    }
    if (world.terrainError || (world.teleportTarget && (
      world.terrainLoading ||
      world.terrainCenter !== chunkKey(world.teleportTarget.x, world.teleportTarget.z)
    ))) {
      stopHorizontal(velocity.current)
      clearJumpInput(input)
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
        stopHorizontal(velocity.current)
        return
      }
      const y = sampleGroundHeight(scene, ground, chunkKey(x, z), x, z) + PLAYER_SETTINGS.height / 2

      camera.position.x += x - mesh.position.x
      camera.position.y += y - mesh.position.y
      camera.position.z += z - mesh.position.z
      mesh.position.set(x, y, z)
      position.copy(mesh.position)
      controls.target.copy(mesh.position)
      controls.snap = true
      velocity.current.set(0, 0, 0)
      player.set(JumpState, { jumpsUsed: 0, landedAt: 0 })
      clearJumpInput(input)
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
      stopHorizontal(velocity.current)
      clearJumpInput(input)
      for (const { name } of MOVEMENT_KEYS) blockedKeys.current.add(name)
    }
    if (document.hidden) return
    const isPressed = (name) => !editing && keys[name] && !blockedKeys.current.has(name)
    const inputX = Number(isPressed('right')) - Number(isPressed('left'))
    const inputZ = Number(isPressed('forward')) - Number(isPressed('backward'))
    const hasMovementInput = inputX !== 0 || inputZ !== 0
    const frameDelta = Math.min(
      delta,
      PLAYER_SETTINGS.maxMovementDeltaSeconds
    )
    const previousJumps = player.get(JumpState).jumpsUsed
    let jumpsUsed = previousJumps
    if (input.expiresAt > now && jumpsUsed < 2) {
      velocity.current.y = jumpsUsed === 0 ? PLAYER_SETTINGS.jumpSpeed : PLAYER_SETTINGS.doubleJumpSpeed
      jumpsUsed += 1
      input.expiresAt = 0
    }

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

    const acceleration = previousJumps > 0 ? PLAYER_SETTINGS.airAcceleration : PLAYER_SETTINGS.movementAcceleration
    const deceleration = previousJumps > 0 ? PLAYER_SETTINGS.airDeceleration : PLAYER_SETTINGS.movementDeceleration
    const smoothing = hasMovementInput ? acceleration : deceleration

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

    if (!hasMovementInput && Math.hypot(velocity.current.x, velocity.current.z) < PLAYER_SETTINGS.movementEpsilon) {
      stopHorizontal(velocity.current)
      if (jumpsUsed === 0) return
    }

    // The footprint remains inside the world at every yaw angle.
    const footprintRadius = FOOTPRINT_RADIUS
    const halfHeight = PLAYER_SETTINGS.height / 2
    const previousX = position.x
    const previousZ = position.z
    const requestedX = previousX + velocity.current.x * frameDelta
    const requestedZ = previousZ + velocity.current.z * frameDelta
    let nextX = MathUtils.clamp(
      requestedX,
      WORLD_BOUNDS.minX + footprintRadius,
      WORLD_BOUNDS.maxX - footprintRadius
    )
    let nextZ = MathUtils.clamp(
      requestedZ,
      WORLD_BOUNDS.minZ + footprintRadius,
      WORLD_BOUNDS.maxZ - footprintRadius
    )
    let nextChunk = chunkKey(nextX, nextZ)
    if (nextX !== previousX || nextZ !== previousZ) {
      const ready = world.readyChunks.has(nextChunk)
      if (!ready) {
        if (import.meta.env.DEV && waitingForChunk.current !== nextChunk) {
          recordTerrainEvent('movement-waiting-for-chunk', { key: nextChunk, x: nextX, z: nextZ })
          waitingForChunk.current = nextChunk
        }
      } else if (import.meta.env.DEV && waitingForChunk.current !== null) {
        recordTerrainEvent('movement-chunk-ready', { key: waitingForChunk.current })
        waitingForChunk.current = null
      }
      if (!ready || !isTerrainWalkable(nextX, nextZ, FOOTPRINT_RADIUS)) {
        stopHorizontal(velocity.current)
        if (jumpsUsed === 0) return
        // Keep falling if a chunk or the shoreline blocks horizontal movement.
        nextX = previousX
        nextZ = previousZ
        nextChunk = chunkKey(nextX, nextZ)
      }
    }
    const groundY = sampleGroundHeight(scene, ground, nextChunk, nextX, nextZ) + halfHeight
    let nextY = groundY
    let landedAt = 0
    if (jumpsUsed > 0) {
      const launchVelocity = jumpsUsed === 1 && !input.held
        ? Math.min(velocity.current.y, PLAYER_SETTINGS.shortJumpSpeed)
        : velocity.current.y
      // Split the step at the apex so faster falling starts independently of frame rate.
      const risingTime = Math.min(frameDelta, Math.max(0, launchVelocity / PLAYER_SETTINGS.gravity))
      const fallingTime = frameDelta - risingTime
      const fallingVelocity = launchVelocity - PLAYER_SETTINGS.gravity * risingTime
      velocity.current.y = fallingVelocity - PLAYER_SETTINGS.fallGravity * fallingTime
      const airborneY = position.y +
        (launchVelocity + fallingVelocity) * risingTime / 2 +
        (fallingVelocity + velocity.current.y) * fallingTime / 2
      nextY = Math.max(groundY, airborneY)
      if (airborneY <= groundY && velocity.current.y <= 0) {
        velocity.current.y = 0
        jumpsUsed = 0
        landedAt = now
      }
    }
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
    if (jumpsUsed !== previousJumps) player.set(JumpState, { jumpsUsed, landedAt })
    player.set(Facing, { yaw: mesh.rotation.y })
    if (controls?.target) {
      controls.target.copy(mesh.position)
    }
  }, -2)

  return (
    <group ref={meshRef} position={PLAYER_SETTINGS.position}>
      <PlayerModel playerRef={playerRef} />
    </group>
  )
}
