import { createWorld, trait } from 'koota'
import { Vector3 } from 'three'

// Frame-rate simulation data lives here; Zustand receives only UI snapshots.
export const Position = trait(() => new Vector3())
export const Velocity = trait(() => new Vector3())
export const Facing = trait({ yaw: 0 })
export const JumpState = trait({ jumpsUsed: 0, landedAt: 0 })
export const Player = trait()
export const simulationWorld = createWorld()
