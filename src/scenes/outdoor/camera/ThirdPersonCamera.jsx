import { useLayoutEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils, Raycaster, Vector3 } from 'three'
import { SCENE_SETTINGS, THIRD_PERSON_CONTROLS_SETTINGS as SETTINGS } from '@/scenes/outdoor/constants'
import { sampleTerrainHeight } from '@/scenes/outdoor/terrain/generation/sampleTerrain'
import { TERRAIN_CHUNKS, TERRAIN_GENERATION } from '@/scenes/outdoor/terrain/constants'
import { recordTerrainEvent } from '../terrain/streaming/terrainEvents.js'

export function ThirdPersonCamera () {
  const { camera, gl, get, set } = useThree()
  const rig = useMemo(() => {
    const target = new Vector3(...SCENE_SETTINGS.controlsTarget)
    const offset = new Vector3(...SCENE_SETTINGS.camera.position).sub(target)
    return {
      target,
      focus: target.clone(),
      desiredFocus: new Vector3(),
      lookPoint: new Vector3(),
      direction: new Vector3(),
      raycaster: new Raycaster(),
      hits: [],
      yaw: Math.atan2(offset.x, offset.z),
      pitch: Math.asin(offset.y / offset.length()),
      distance: offset.length(),
      armLength: offset.length(),
      snap: true
    }
  }, [])

  useLayoutEffect(() => {
    const previous = get().controls
    set({ controls: rig })
    const canvas = gl.domElement
    const previousTouchAction = canvas.style.touchAction
    canvas.style.touchAction = 'none'
    let pointer = null
    let lastX = 0
    let lastY = 0
    const stop = () => {
      if (pointer !== null && canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer)
      pointer = null
    }
    const down = (event) => {
      if (pointer !== null || (event.button !== 0 && event.button !== 2)) return
      event.preventDefault()
      pointer = event.pointerId
      lastX = event.clientX
      lastY = event.clientY
      canvas.setPointerCapture(pointer)
    }
    const move = (event) => {
      if (event.pointerId !== pointer) return
      rig.yaw -= (event.clientX - lastX) * SETTINGS.sensitivity
      rig.pitch = MathUtils.clamp(
        rig.pitch + (event.clientY - lastY) * SETTINGS.sensitivity,
        SETTINGS.minPitch, SETTINGS.maxPitch
      )
      lastX = event.clientX
      lastY = event.clientY
    }
    const up = (event) => {
      if (event.pointerId === pointer) stop()
    }
    const wheel = (event) => {
      event.preventDefault()
      const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1)
      rig.distance = MathUtils.clamp(
        rig.distance * Math.exp(MathUtils.clamp(pixels * SETTINGS.zoomSensitivity, -1, 1)),
        SETTINGS.minDistance, SETTINGS.maxDistance
      )
    }
    const contextMenu = (event) => event.preventDefault()
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)
    canvas.addEventListener('lostpointercapture', up)
    canvas.addEventListener('wheel', wheel, { passive: false })
    canvas.addEventListener('contextmenu', contextMenu)
    window.addEventListener('blur', stop)
    return () => {
      stop()
      canvas.style.touchAction = previousTouchAction
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
      canvas.removeEventListener('lostpointercapture', up)
      canvas.removeEventListener('wheel', wheel)
      canvas.removeEventListener('contextmenu', contextMenu)
      window.removeEventListener('blur', stop)
      set({ controls: previous })
    }
  }, [camera, gl, get, set, rig])

  useFrame(({ scene }, delta) => {
    const started = import.meta.env.DEV ? performance.now() : 0
    const dt = Math.min(delta, 0.1)
    rig.desiredFocus.copy(rig.target)
    rig.desiredFocus.y += SETTINGS.lookHeight
    if (rig.snap) rig.focus.copy(rig.desiredFocus)
    else rig.focus.lerp(rig.desiredFocus, 1 - Math.exp(-SETTINGS.followSpeed * dt))
    rig.focus.y = Math.max(rig.focus.y, sampleTerrainHeight(rig.focus.x, rig.focus.z) + SETTINGS.clearance)

    // Looking up tilts the view instead of pushing the orbit below the ground.
    const orbitPitch = Math.max(0, rig.pitch)
    rig.direction.set(
      Math.sin(rig.yaw) * Math.cos(orbitPitch),
      Math.sin(orbitPitch),
      Math.cos(rig.yaw) * Math.cos(orbitPitch)
    )
    // Check the actual rendered terrain, including slopes between camera and player.
    rig.raycaster.set(rig.focus, rig.direction)
    rig.raycaster.far = rig.distance + SETTINGS.clearance
    rig.hits.length = 0
    let checkedChunks = 0
    for (const object of scene.children) {
      if (!object.userData.walkable) continue
      const dx = Math.max(object.position.x - rig.focus.x, 0, rig.focus.x - object.position.x - TERRAIN_CHUNKS.size)
      const dz = Math.max(object.position.z - rig.focus.z, 0, rig.focus.z - object.position.z - TERRAIN_CHUNKS.size)
      if (dx * dx + dz * dz > (rig.distance + SETTINGS.clearance) ** 2) continue
      object.updateWorldMatrix(true, false)
      checkedChunks += 1
      rig.raycaster.intersectObject(object, false, rig.hits)
    }
    const available = rig.hits.length
      ? Math.max(0.1, rig.hits[0].distance - SETTINGS.clearance)
      : rig.distance
    const safeDistance = Math.min(rig.distance, available)
    rig.armLength = rig.snap || safeDistance < rig.armLength
      ? safeDistance
      : MathUtils.damp(rig.armLength, safeDistance, SETTINGS.zoomSpeed, dt)
    camera.position.copy(rig.focus).addScaledVector(rig.direction, rig.armLength)
    camera.position.y = Math.max(
      camera.position.y,
      TERRAIN_GENERATION.coast.seaLevel + SETTINGS.clearance,
      sampleTerrainHeight(camera.position.x, camera.position.z) + SETTINGS.clearance
    )
    rig.lookPoint.copy(rig.focus)
    if (rig.pitch < 0) {
      rig.lookPoint.y += rig.armLength * Math.tan(-rig.pitch)
    }
    camera.lookAt(rig.lookPoint)
    rig.snap = false
    if (import.meta.env.DEV) {
      const durationMs = performance.now() - started
      if (durationMs > 4) recordTerrainEvent('camera-slow-update', { durationMs, checkedChunks }, started)
    }
  })

  return null
}
