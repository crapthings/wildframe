import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import { AnimationMixer, Box3, Vector3 } from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { OUTDOOR_ASSETS } from '@/scenes/outdoor/assets'
import { PLAYER_SETTINGS } from '@/scenes/outdoor/constants'
import { Velocity } from '@/scenes/outdoor/state/entities'
import { useWorldStore } from '@/scenes/outdoor/state/worldStore'

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
    preview.stopAllAction()
    preview.uncacheRoot(root)
    return { root, scale, offset: [-center.x * scale, -bounds.min.y * scale, -center.z * scale] }
  }, [scene, animations])
  const { actions } = useAnimations(animations, model.root)
  const current = useRef(null)

  useLayoutEffect(() => {
    useWorldStore.setState({ playerReady: true })
    return () => useWorldStore.setState({ playerReady: false })
  }, [])
  useEffect(() => () => {
    current.current = null
    model.root.traverse((object) => {
      if (object.isSkinnedMesh) object.skeleton.dispose()
    })
  }, [model])

  useFrame(() => {
    const velocity = playerRef.current?.get(Velocity)
    const speed = velocity ? Math.hypot(velocity.x, velocity.z) : 0
    const state = !useWorldStore.getState().sceneEntered || speed < 0.1 ? 'Idle' : speed > PLAYER_SETTINGS.movementSpeed * 1.1 ? 'Run' : 'Walk'
    if (current.current === state) return
    const next = actions[state]
    if (!next) return
    if (current.current) actions[current.current]?.fadeOut(PLAYER_SETTINGS.animationFade)
    next.reset().fadeIn(PLAYER_SETTINGS.animationFade).play()
    current.current = state
  })

  return (
    <group position={[0, -PLAYER_SETTINGS.height / 2, 0]} rotation={[0, PLAYER_SETTINGS.modelYaw, 0]}>
      <group position={model.offset} scale={model.scale}>
        <primitive object={model.root} dispose={null} />
      </group>
    </group>
  )
}
