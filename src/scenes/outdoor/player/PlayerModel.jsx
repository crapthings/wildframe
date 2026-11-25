import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import { AnimationClip, AnimationMixer, Box3, MathUtils, Vector3, VectorKeyframeTrack } from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { OUTDOOR_ASSETS } from '@/scenes/outdoor/assets'
import { PLAYER_SETTINGS } from '@/scenes/outdoor/constants'
import { JumpState, Velocity } from '@/scenes/outdoor/state/entities'
import { useWorldStore } from '@/scenes/outdoor/state/worldStore'
import { createJumpClips, DOUBLE_JUMP_ACTIONS, JUMP_ACTIONS, JUMP_PHASES } from './jumpAnimations.js'

const SOURCE_JUMP_PHASES = { takeoff: 0.205, boost: 0.34, apex: 0.42, contact: 0.625 }

function inPlaceJump (clip) {
  const root = clip.tracks.find((track) => track.name === 'Bone.position')
  const foot = clip.tracks.find((track) => track.name === 'FootL.position')
  if (!root || !foot) return clip

  // Both feet rise together in the source clip. Subtract that lift from the rig.
  const rootAt = root.createInterpolant()
  const values = new Float32Array(foot.values.length)
  for (let i = 0; i < foot.times.length; i++) {
    const offset = i * 3
    values.set(rootAt.evaluate(foot.times[i]), offset)
    values[offset + 1] -= foot.values[offset + 1] - foot.values[1]
  }
  const rootTrack = new VectorKeyframeTrack(root.name, foot.times, values)
  return new AnimationClip(clip.name, clip.duration, clip.tracks.map((track) => track === root ? rootTrack : track), clip.blendMode)
}

export function PlayerModel ({ playerRef }) {
  const { scene, animations } = useGLTF(OUTDOOR_ASSETS.player)
  const model = useMemo(() => {
    const root = clone(scene)
    root.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = true
        object.receiveShadow = true
        // Animated limbs can extend past the bind-pose bounds.
        object.frustumCulled = false
      }
    })
    // The file opens in a walking pose; normalize against the actual idle pose.
    const preview = new AnimationMixer(root)
    const idle = animations.find((clip) => clip.name === 'Idle')
    if (idle) {
      preview.clipAction(idle).play()
      preview.update(0)
    }
    root.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(root, true)
    const center = bounds.getCenter(new Vector3())
    const scale = PLAYER_SETTINGS.height / bounds.getSize(new Vector3()).y
    const jumpRig = createJumpClips(root, scale)
    preview.stopAllAction()
    preview.uncacheRoot(root)
    const clips = jumpRig
      ? [...animations, ...jumpRig.clips]
      : animations.map((clip) => clip.name === 'Jump' ? inPlaceJump(clip) : clip)
    return { root, scale, offset: [-center.x * scale, -bounds.min.y * scale, -center.z * scale], clips, jumpRig }
  }, [scene, animations])
  const { actions, mixer } = useAnimations(model.clips, model.root)
  const current = useRef({ action: null, jumpAction: null, airborne: false })

  useLayoutEffect(() => {
    useWorldStore.setState({ playerReady: true })
    return () => useWorldStore.setState({ playerReady: false })
  }, [])
  useEffect(() => () => {
    current.current = { action: null, jumpAction: null, airborne: false }
    model.root.traverse((object) => {
      if (object.isSkinnedMesh) object.skeleton.dispose()
    })
  }, [model])

  // Set the action and playback rate before useAnimations advances the mixer.
  useFrame((_, delta) => {
    const player = playerRef.current
    const velocity = player?.get(Velocity)
    const speed = velocity ? Math.hypot(velocity.x, velocity.z) : 0
    const entered = useWorldStore.getState().sceneEntered
    const jump = player?.get(JumpState)
    const airborne = entered && jump?.jumpsUsed > 0
    const moving = speed >= 0.1
    const animation = current.current
    const startedJump = airborne && !animation.airborne
    if (startedJump) {
      if (!model.jumpRig) animation.jumpAction = 'Jump'
      else if (!moving) animation.jumpAction = JUMP_ACTIONS.standing
      else {
        const left = model.jumpRig.leftFoot.getWorldPosition(new Vector3())
        const right = model.jumpRig.rightFoot.getWorldPosition(new Vector3())
        const lead = (left.x - right.x) * velocity.x + (left.z - right.z) * velocity.z
        animation.jumpAction = lead > 0 ? JUMP_ACTIONS.left : JUMP_ACTIONS.right
      }
    }
    animation.airborne = airborne

    const doubleAction = DOUBLE_JUMP_ACTIONS[animation.jumpAction]
    const wasJumping = animation.jumpAction !== null &&
      (animation.action === animation.jumpAction || animation.action === doubleAction)
    const landingElapsed = jump?.landedAt ? (performance.now() - jump.landedAt) / 1000 : Infinity
    const landingDuration = moving ? 0.08 : 0.18
    const landing = !airborne && wasJumping && landingElapsed < landingDuration
    const jumpAction = airborne
      ? (jump.jumpsUsed === 2 && doubleAction ? doubleAction : animation.jumpAction)
      : (landing ? animation.action : null)
    let state = 'Idle'
    if (entered && jumpAction && actions[jumpAction]) state = jumpAction
    else if (entered && moving) state = speed > PLAYER_SETTINGS.movementSpeed * 1.1 ? 'Run' : 'Walk'
    const next = actions[state]
    if (!next) return
    const isJumping = state === jumpAction
    const isDoubleJump = state === doubleAction
    const changed = animation.action !== state
    if (changed) {
      const fade = isDoubleJump ? 0.065 : isJumping || wasJumping ? 0.07 : PLAYER_SETTINGS.animationFade
      if (isDoubleJump) {
        // Early presses can arrive while the takeoff still blends with locomotion.
        for (const clip of model.clips) {
          const action = mixer.existingAction(clip, model.root)
          if (action?.isScheduled() && action.getEffectiveWeight() > 0) {
            action.setEffectiveWeight(action.getEffectiveWeight()).fadeOut(fade)
          }
        }
      } else if (animation.action) actions[animation.action]?.fadeOut(fade)
      next.reset().setEffectiveWeight(1).fadeIn(fade).play()
      animation.action = state
    }
    if (isJumping) {
      const phases = model.jumpRig ? JUMP_PHASES : SOURCE_JUMP_PHASES
      let phase
      if (airborne) {
        const firstJump = jump.jumpsUsed === 1
        const launchSpeed = firstJump ? PLAYER_SETTINGS.jumpSpeed : PLAYER_SETTINGS.doubleJumpSpeed
        const landingSpeed = launchSpeed * Math.sqrt(PLAYER_SETTINGS.fallGravity / PLAYER_SETTINGS.gravity)
        const risingRatio = MathUtils.clamp(velocity.y / launchSpeed, 0, 1)
        const takeoff = firstJump || isDoubleJump ? phases.takeoff : SOURCE_JUMP_PHASES.boost
        const riseProgress = 1 - (isDoubleJump ? risingRatio : risingRatio ** 2)
        phase = velocity.y >= 0
          ? MathUtils.lerp(takeoff, phases.apex, riseProgress)
          : MathUtils.lerp(phases.apex, phases.contact, MathUtils.smoothstep(-velocity.y, 0, landingSpeed))
      } else {
        phase = MathUtils.lerp(phases.contact, 1, MathUtils.smoothstep(landingElapsed, 0, landingDuration))
      }
      const time = next.getClip().duration * phase
      next.setEffectiveTimeScale(0)
      next.time = changed || startedJump || landing ? time : MathUtils.damp(next.time, time, 32, delta)
    } else if (state !== 'Idle') {
      const clipSpeed = state === 'Walk' ? PLAYER_SETTINGS.walkClipSpeed : PLAYER_SETTINGS.runClipSpeed
      const movementDeltaScale = delta > 0 ? Math.min(1, PLAYER_SETTINGS.maxMovementDeltaSeconds / delta) : 1
      next.setEffectiveTimeScale(speed * movementDeltaScale / clipSpeed)
    }
  }, -1)

  return (
    <group position={[0, -PLAYER_SETTINGS.height / 2, 0]} rotation={[0, PLAYER_SETTINGS.modelYaw, 0]}>
      <group position={model.offset} scale={model.scale}>
        <primitive object={model.root} dispose={null} />
      </group>
    </group>
  )
}
