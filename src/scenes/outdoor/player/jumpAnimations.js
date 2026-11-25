import { AnimationClip, MathUtils, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack } from 'three'

const FPS = 30
const FRAME_COUNT = 30
export const JUMP_ACTIONS = {
  standing: 'JumpStanding',
  left: 'JumpLeftLead',
  right: 'JumpRightLead'
}
export const DOUBLE_JUMP_ACTIONS = {
  [JUMP_ACTIONS.standing]: 'DoubleJumpStanding',
  [JUMP_ACTIONS.left]: 'DoubleJumpLeftLead',
  [JUMP_ACTIONS.right]: 'DoubleJumpRightLead'
}
export const JUMP_PHASES = { takeoff: 0, apex: 12 / FPS, contact: 20 / FPS }

// Hips and feet use meters relative to the idle rig. Each foot adds a toe pitch.
// Arms use forward swing and elbow bend in radians. Running pairs are lead/trail
// for the feet and forward/back for the arms, so they mirror cleanly.
const standingDescent = [
  { frame: 16, hips: [-0.015, 0.025], feet: [[0.09, 0.08, 0.02]], chest: 0.14, arms: [[0.52, 0.40]] },
  { frame: 20, hips: [-0.035, 0.01], feet: [[0, 0, 0]], chest: 0.15, arms: [[0.46, 0.31]] },
  { frame: 24, hips: [-0.13, -0.015], feet: [[0, 0, 0]], chest: 0.26, arms: [[0.26, 0.39]] },
  { frame: 30, hips: [0, 0], feet: [[0, 0, 0]], chest: 0, arms: [[0, 0]] }
]

const standingFrames = [
  { frame: 0, hips: [-0.09, -0.04], feet: [[0, 0, 0]], chest: 0.22, arms: [[-0.28, 0.24]] },
  { frame: 4, hips: [0.012, 0.018], feet: [[0.025, -0.025, 0.32]], chest: 0.06, arms: [[0.84, 0.24]] },
  { frame: 7, hips: [-0.018, 0.025], feet: [[0.12, 0.07, 0.12]], chest: 0.12, arms: [[0.98, 0.35]] },
  { frame: 12, hips: [-0.045, 0.042], feet: [[0.20, 0.12, -0.05]], chest: 0.23, arms: [[0.72, 0.54]] },
  ...standingDescent
]

const standingBoostFrames = [
  { frame: 0, hips: [-0.065, 0.028], feet: [[0.16, 0.105, 0.10]], chest: 0.22, arms: [[0.58, 0.78]] },
  { frame: 2, hips: [0.008, 0.022], feet: [[0.064, -0.035, 0.54]], chest: 0.07, arms: [[1.28, 0.37]] },
  { frame: 4, hips: [0.022, 0.016], feet: [[0.031, -0.060, 0.64]], chest: 0.04, arms: [[1.67, 0.24]] },
  { frame: 7, hips: [-0.038, 0.034], feet: [[0.18, 0.112, 0.17]], chest: 0.16, arms: [[1.07, 0.55]] },
  { frame: 12, hips: [-0.052, 0.04], feet: [[0.235, 0.125, -0.05]], chest: 0.24, arms: [[0.70, 0.57]] },
  ...standingDescent
]

const runningDescent = [
  { frame: 16, hips: [-0.022, 0.03], feet: [[0.124, 0.26, -0.17], [0.135, -0.18, 0.38]], chest: 0.18, arms: [[0.68, 0.64], [-0.25, 0.65]] },
  { frame: 20, hips: [-0.042, 0.027], feet: [[0, 0.23, 0], [0.14, -0.17, 0.35]], chest: 0.19, arms: [[0.63, 0.69], [-0.23, 0.70]] },
  { frame: 24, hips: [-0.115, 0.059], feet: [[0, 0.23, 0], [0.10, -0.12, 0.31]], chest: 0.27, arms: [[0.42, 0.73], [-0.05, 0.70]] },
  { frame: 30, hips: [-0.051, 0.067], feet: [[0, 0.106, 0], [0.095, -0.042, 0.18]], chest: 0.19, arms: [[0.20, 0.70], [0.24, 0.73]] }
]

const runningFrames = [
  { frame: 0, hips: [-0.065, 0.015], feet: [[0, 0.22, 0], [0.075, -0.27, 0.51]], chest: 0.21, arms: [[0.82, 0.71], [-0.57, 0.66]] },
  { frame: 4, hips: [-0.014, 0.041], feet: [[0.14, 0.25, -0.10], [0.115, -0.25, 0.59]], chest: 0.20, arms: [[0.91, 0.70], [-0.66, 0.65]] },
  { frame: 7, hips: [-0.04, 0.05], feet: [[0.26, 0.23, -0.16], [0.18, -0.21, 0.51]], chest: 0.23, arms: [[0.94, 0.74], [-0.47, 0.77]] },
  { frame: 12, hips: [-0.047, 0.053], feet: [[0.29, 0.20, -0.13], [0.20, -0.18, 0.46]], chest: 0.23, arms: [[0.73, 0.79], [-0.31, 0.76]] },
  ...runningDescent
]

const runningBoostFrames = [
  { frame: 0, hips: [-0.05, 0.045], feet: [[0.19, 0.24, -0.05], [0.19, -0.16, 0.43]], chest: 0.24, arms: [[0.87, 0.75], [-0.37, 0.70]] },
  { frame: 2, hips: [-0.064, 0.017], feet: [[0.24, 0.23, -0.13], [0.054, -0.265, 0.62]], chest: 0.17, arms: [[1.19, 0.59], [-0.55, 0.69]] },
  { frame: 4, hips: [-0.072, 0.008], feet: [[0.29, 0.20, -0.16], [0.035, -0.29, 0.68]], chest: 0.14, arms: [[1.31, 0.49], [-0.64, 0.67]] },
  { frame: 7, hips: [-0.045, 0.065], feet: [[0.31, 0.22, -0.13], [0.185, -0.19, 0.43]], chest: 0.23, arms: [[0.98, 0.66], [-0.37, 0.74]] },
  { frame: 12, hips: [-0.052, 0.051], feet: [[0.31, 0.20, -0.11], [0.217, -0.16, 0.41]], chest: 0.24, arms: [[0.74, 0.79], [-0.31, 0.76]] },
  ...runningDescent
]

const forward = new Vector3(0, 0, 1)
const right = new Vector3(1, 0, 0)

function placeWorldRotation (bone, rotation) {
  bone.quaternion.copy(bone.parent.getWorldQuaternion(new Quaternion()).invert()).multiply(rotation)
}

function pitch (bone, angle) {
  const rotation = new Quaternion().setFromAxisAngle(right, angle)
  placeWorldRotation(bone, rotation.multiply(bone.getWorldQuaternion(new Quaternion())))
}

function aimBone (bone, axis, direction) {
  const rotation = bone.getWorldQuaternion(new Quaternion())
  const current = axis.clone().applyQuaternion(rotation)
  placeWorldRotation(bone, new Quaternion().setFromUnitVectors(current, direction.normalize()).multiply(rotation))
}

function alignLeg ({ upper, lower, foot, upperAxis, lowerAxis, thigh, shin }) {
  const hip = upper.getWorldPosition(new Vector3())
  const ankle = foot.getWorldPosition(new Vector3())
  const direction = ankle.clone().sub(hip)
  const reach = direction.length()
  const length = MathUtils.clamp(reach, Math.abs(thigh - shin) + 0.001, thigh + shin - 0.001)
  direction.normalize()
  if (length !== reach) {
    ankle.copy(hip).addScaledVector(direction, length)
    foot.position.copy(foot.parent.worldToLocal(ankle.clone()))
  }
  const bend = forward.clone().addScaledVector(direction, -forward.dot(direction))
  if (bend.lengthSq() < 0.0001) bend.set(0, 1, 0).addScaledVector(direction, -direction.y)
  const along = (thigh ** 2 + length ** 2 - shin ** 2) / (2 * length)
  const knee = hip.clone().addScaledVector(direction, along)
    .addScaledVector(bend.normalize(), Math.sqrt(Math.max(0, thigh ** 2 - along ** 2)))
  aimBone(upper, upperAxis, knee.sub(hip))
  aimBone(lower, lowerAxis, ankle.sub(lower.getWorldPosition(new Vector3())))
}

export function createJumpClips (root, scale) {
  const bones = root.getObjectByProperty('isSkinnedMesh', true)?.skeleton?.bones ?? []
  const byName = new Map(bones.map((bone) => [bone.name, bone]))
  const hips = byName.get('Body_1')
  const chest = byName.get('Abdomen')
  const legs = ['L', 'R'].map((side) => ({
    upper: byName.get(`UpperLeg${side}`),
    lower: byName.get(`LowerLeg${side}`),
    foot: byName.get(`Foot${side}`),
    arm: byName.get(`UpperArm${side}`),
    forearm: byName.get(`LowerArm${side}`)
  }))
  if (!hips || !chest || legs.some((leg) => Object.values(leg).some((bone) => !bone))) return null
  for (const leg of legs) {
    const shin = leg.lower.worldToLocal(leg.foot.getWorldPosition(new Vector3()))
    leg.thigh = leg.lower.position.length()
    leg.shin = shin.length()
    leg.upperAxis = leg.lower.position.clone().normalize()
    leg.lowerAxis = shin.normalize()
  }

  const rest = bones.map((bone) => ({
    bone,
    position: bone.position.clone(),
    rotation: bone.quaternion.clone(),
    scale: bone.scale.clone()
  }))
  function restorePose () {
    for (const { bone, position, rotation, scale } of rest) {
      bone.position.copy(position)
      bone.quaternion.copy(rotation)
      bone.scale.copy(scale)
    }
  }

  const times = Array.from({ length: FRAME_COUNT + 1 }, (_, frame) => frame / FPS)
  function bake (name, frames, lead) {
    const poses = bones.map((bone) => ({ bone, positions: [], rotations: [], scales: [] }))
    let key = 0
    for (let frame = 0; frame <= FRAME_COUNT; frame++) {
      if (frame > frames[key + 1].frame) key++
      const a = frames[key]
      const b = frames[key + 1]
      const t = (frame - a.frame) / (b.frame - a.frame)
      const lerp = (from, to) => MathUtils.lerp(from, to, t)
      restorePose()
      hips.position.y += lerp(a.hips[0], b.hips[0]) / scale
      hips.position.z += lerp(a.hips[1], b.hips[1]) / scale
      pitch(chest, lerp(a.chest, b.chest))

      legs.forEach((leg, side) => {
        const footIndex = side === lead ? 0 : 1
        const aFoot = a.feet[footIndex] ?? a.feet[0]
        const bFoot = b.feet[footIndex] ?? b.feet[0]
        leg.foot.position.y += lerp(aFoot[0], bFoot[0]) / scale
        leg.foot.position.z += lerp(aFoot[1], bFoot[1]) / scale
        pitch(leg.foot, lerp(aFoot[2], bFoot[2]))
        alignLeg(leg)

        const armIndex = 1 - footIndex
        const aArm = a.arms[armIndex] ?? a.arms[0]
        const bArm = b.arms[armIndex] ?? b.arms[0]
        pitch(leg.arm, -lerp(aArm[0], bArm[0]))
        pitch(leg.forearm, -lerp(aArm[1], bArm[1]))
      })
      for (const { bone, positions, rotations, scales } of poses) {
        positions.push(...bone.position.toArray())
        rotations.push(...bone.quaternion.toArray())
        scales.push(...bone.scale.toArray())
      }
    }
    return new AnimationClip(name, FRAME_COUNT / FPS, poses.flatMap(({ bone, positions, rotations, scales }) => [
      new VectorKeyframeTrack(`${bone.name}.position`, times, positions),
      new QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, rotations),
      new VectorKeyframeTrack(`${bone.name}.scale`, times, scales)
    ]))
  }

  try {
    return {
      leftFoot: legs[0].foot,
      rightFoot: legs[1].foot,
      clips: [
        bake(JUMP_ACTIONS.standing, standingFrames, 0),
        bake(JUMP_ACTIONS.left, runningFrames, 0),
        bake(JUMP_ACTIONS.right, runningFrames, 1),
        bake(DOUBLE_JUMP_ACTIONS[JUMP_ACTIONS.standing], standingBoostFrames, 0),
        bake(DOUBLE_JUMP_ACTIONS[JUMP_ACTIONS.left], runningBoostFrames, 0),
        bake(DOUBLE_JUMP_ACTIONS[JUMP_ACTIONS.right], runningBoostFrames, 1)
      ]
    }
  } finally {
    restorePose()
    root.updateMatrixWorld(true)
  }
}
