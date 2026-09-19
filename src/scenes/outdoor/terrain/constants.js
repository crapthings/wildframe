export const TERRAIN_GENERATION = {
  seed: 42731,
  regionScaleMeters: 512,
  mapResolution: 256,
  contourInterval: 5,
  boundaryMountains: {
    seedOffset: 1601,
    frequency: 0.006,
    warpFrequency: 0.0018,
    warpAmplitude: 90,
    crestRadius: 455,
    crestVariation: 90,
    foothillWidth: 210,
    widthVariation: 45,
    centerX: -45,
    northSouthStretch: 1.08,
    innerStart: 120,
    innerEnd: 260,
    baseHeight: 24,
    peakHeight: 60,
    peakFrequency: 0.0028,
    ridgeHeight: 60,
    ridgeWidth: 0.85,
    ridgeRounding: 0.12,
    spurHeight: 32,
    detailHeight: 2,
    saddleFloor: 0.3,
    summitStart: 0.5,
    summitEnd: 0.9,
    coastFadeStart: 45,
    coastFadeEnd: 160
  },
  distantSurface: {
    seedOffset: 2309,
    frequency: 0.009,
    octaves: 2,
    variation: 0.18,
    highlandStart: 65,
    highlandEnd: 170,
    // Linear RGB vertex colors; lighting and fog are applied by the material.
    soil: [0.23, 0.21, 0.15],
    grass: [0.16, 0.20, 0.11],
    marble: [0.34, 0.32, 0.27],
    rockFace: [0.22, 0.23, 0.22]
  },
  surface: {
    patchSize: 35,
    blendSoftness: 0.18,
    dryShoreHeight: 2.2,
    wetShoreHeight: 0.65,
    rockSlopeStart: 0.12,
    rockSlopeEnd: 0.38,
    marbleMaxBlend: 0.25
  },
  coast: {
    seaLevel: -1,
    eastShoreX: 365,
    bayInset: 300,
    bayStartZ: -40,
    bayEndZ: 480,
    seedOffset: 809,
    frequency: 0.008,
    octaves: 4,
    amplitude: 42,
    beachWidth: 100,
    beachSlope: 0.12,
    seabedDepth: 28,
    seabedWidth: 100,
    walkClearance: 0.15
  },
  spawn: {
    flatRadius: 24,
    blendRadius: 80
  },
  base: {
    amplitude: 10,
    frequency: 0.0016,
    octaves: 4
  },
  regions: {
    north: {
      amplitude: 22,
      frequency: 0.0028,
      octaves: 4,
      seedOffset: 101
    },
    east: {
      amplitude: 12,
      frequency: 0.006,
      octaves: 3,
      seedOffset: 211
    },
    south: {
      amplitude: 7,
      frequency: 0.004,
      octaves: 3,
      seedOffset: 307
    },
    west: {
      amplitude: 18,
      frequency: 0.0035,
      octaves: 4,
      seedOffset: 401
    }
  }
}

export const TERRAIN_CHUNKS = {
  size: 64,
  segments: 16,
  lodSegments: [16, 8, 4],
  lodRings: [2, 3],
  shoreRefinement: 4,
  shoreRefinementHeight: 2.5,
  shoreRefinementDistance: 35,
  radius: 5,
  streaming: {
    spareChunks: 24,
    retirementGraceMs: 750,
    retirementIntervalMs: 50,
    windowSettleMs: 150
  }
}
