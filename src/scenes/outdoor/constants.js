export const WORLD_SIZE_METERS = 1024
export const WORLD_HALF_SIZE_METERS = WORLD_SIZE_METERS / 2
export const TERRAIN_REFERENCE_HEIGHT = -2
// Extend through the streamed terrain window; fog hides its outer edge.
export const TERRAIN_BOUNDARY_PADDING = 384

export const WORLD_BOUNDS = {
  minX: -WORLD_HALF_SIZE_METERS,
  maxX: WORLD_HALF_SIZE_METERS,
  minZ: -WORLD_HALF_SIZE_METERS,
  maxZ: WORLD_HALF_SIZE_METERS
}

export const TREE_SETTINGS = {
  x: 24,
  z: -20,
  scale: 0.65,
  yaw: 0.7,
  sink: 0.25,
  fadeStartDistance: 180,
  fadeEndDistance: 210,
  fadeSeconds: 0.42,
  leaves: {
    normalStrength: 0.35,
    minimumRoughness: 0.75,
    environmentIntensity: 0.8
  }
}

export const SCENE_SETTINGS = {
  camera: {
    position: [6, 4.8, 9.2],
    fov: 60,
    near: 0.05,
    far: 1000
  },
  controlsTarget: [0, 0.7, 0],
  dpr: 1,
  fog: {
    color: '#c6ced2',
    density: 0.0028,
    mountainDensityScale: 0.55,
    heightStart: 15,
    heightEnd: 100
  }
}

export const SUN_SETTINGS = {
  color: 0xfff2e3,
  intensity: 3,
  position: [30, 45, 20],
  shadowCameraFar: 60
}

export const MOON_SETTINGS = {
  color: '#c4d5ed',
  intensity: 0.22,
  position: [-30, 38, -24],
  takeoverAt: 0.65,
  rainAttenuation: 0.85
}

export const DAY_NIGHT_SETTINGS = {
  transitionSeconds: 2.5,
  nightSunHeight: -35,
  nightBackgroundIntensity: 0.008,
  nightSkyColor: '#070d16',
  nightEnvironmentIntensity: 0.1,
  nightFogColor: '#0b1321'
}

export const RAIN_SETTINGS = {
  count: 1600,
  radius: 28,
  height: 32,
  speed: 18,
  length: 0.7,
  transitionSeconds: 1.5,
  daySky: '#657782',
  nightSky: '#060c14',
  dayFog: '#667782',
  nightFog: '#09121c'
}

export const STAR_SETTINGS = {
  radius: 350,
  depth: 80,
  count: 2500,
  factor: 5,
  saturation: 0,
  speed: 0.25
}

export const SUN_BEAM_SETTINGS = {
  angle: 0.35,
  anglePower: 4,
  attenuation: 80,
  castShadow: false,
  color: '#fff2e3',
  distance: 70,
  intensity: 0,
  opacity: 0.035,
  radiusBottom: 14,
  radiusTop: 1
}

export const TERRAIN_SETTINGS = {
  anisotropy: 8,
  metalness: 0,
  roughness: 1,
  textureWorldSize: 3,
  mountainTextureWorldSize: 14,
  wetDarkening: 0.55,
  wetRoughness: 0.32,
  hexTiling: {
    patchScale: 2,
    useContrastCorrectedBlending: true,
    lookupSkipThreshold: 0.01,
    textureSampleCoefficientExponent: 8
  }
}

export const TERRAIN_REFERENCE_SETTINGS = {
  color: '#687258',
  metalness: 0,
  renderSize: SCENE_SETTINGS.camera.far * 3,
  roughness: 1
}

export const OCEAN_SETTINGS = {
  color: '#247e91',
  roughness: 0.28,
  metalness: 0.2,
  waveStrength: 0.22,
  waveSpeed: 0.025,
  waveWorldSize: 18,
  noiseResolution: 128,
  noiseSeedOffset: 1201,
  renderSize: SCENE_SETTINGS.camera.far * 6
}

export const PLAYER_SETTINGS = {
  position: [0, 0.9, 0],
  height: 1.8,
  radius: 0.35,
  modelYaw: 0,
  animationFade: 0.2,
  movementSpeed: 1.6,
  sprintSpeed: 4.5,
  // Rearward speed of the planted foot at the clips' normal playback rate.
  walkClipSpeed: 1.1,
  runClipSpeed: 3.2,
  movementAcceleration: 18,
  movementDeceleration: 32,
  airAcceleration: 9,
  airDeceleration: 3,
  movementEpsilon: 0.01,
  jumpSpeed: 5.8,
  shortJumpSpeed: 3.2,
  doubleJumpSpeed: 5.4,
  jumpBufferMs: 110,
  gravity: 18,
  fallGravity: 27,
  rotationSpeed: 18,
  maxMovementDeltaSeconds: 0.1
}

export const MOVEMENT_KEYS = [
  { name: 'forward', keys: ['KeyW'] },
  { name: 'backward', keys: ['KeyS'] },
  { name: 'left', keys: ['KeyA'] },
  { name: 'right', keys: ['KeyD'] },
  { name: 'sprintLeft', keys: ['ShiftLeft'] },
  { name: 'sprintRight', keys: ['ShiftRight'] }
]

export const THIRD_PERSON_CONTROLS_SETTINGS = {
  minDistance: 2.5,
  maxDistance: 18,
  minPitch: -Math.PI * 0.36,
  maxPitch: Math.PI * 0.47,
  sensitivity: 0.004,
  zoomSensitivity: 0.001,
  followSpeed: 14,
  zoomSpeed: 10,
  lookHeight: 0.65,
  clearance: 0.4
}
