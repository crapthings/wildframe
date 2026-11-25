import { DataTexture, FloatType, MathUtils, NearestFilter, RGBAFormat } from 'three'
import { TERRAIN_BOUNDARY_PADDING, WORLD_BOUNDS } from '@/scenes/outdoor/constants'
import { TERRAIN_CHUNKS } from '../constants'
import { coverageDither } from '../materials/coverageDither.js'

const MIN = WORLD_BOUNDS.minX - TERRAIN_BOUNDARY_PADDING
const EXTENT = WORLD_BOUNDS.maxX + TERRAIN_BOUNDARY_PADDING - MIN
const GRID = EXTENT / TERRAIN_CHUNKS.size
const FADE_SECONDS = TERRAIN_CHUNKS.streaming.fadeMs / 1000

const coverageLookup = `
  uniform highp sampler2D terrainCoverageMap;
  uniform float terrainCoverageTime;
  float nearTerrainCoverage(vec2 world) {
    vec3 transition = texture2D(terrainCoverageMap, (world - ${MIN.toFixed(1)}) / ${EXTENT.toFixed(1)}).rgb;
    float progress = smoothstep(0.0, ${FADE_SECONDS.toFixed(3)}, terrainCoverageTime - transition.z);
    return mix(transition.x, transition.y, progress);
  }
`

export class TerrainCoverage {
  #texture = new DataTexture(new Float32Array(GRID * GRID * 4), GRID, GRID, RGBAFormat, FloatType)
  #time = { value: 0 }

  constructor () {
    this.#texture.minFilter = this.#texture.magFilter = NearestFilter
    this.#texture.needsUpdate = true
  }

  setTime (now) {
    this.#time.value = now / 1000
  }

  update (chunks, wantedLods, animate, now) {
    const data = this.#texture.image.data
    const time = now / 1000
    let changed = false
    for (const { key, column, row } of chunks) {
      const x = column - MIN / TERRAIN_CHUNKS.size
      const z = row - MIN / TERRAIN_CHUNKS.size
      const offset = (z * GRID + x) * 4
      const target = Number(wantedLods.has(key))
      if (data[offset + 1] === target && (animate || data[offset] === target)) continue
      // Sample the previous fade at the reversal point so its coverage stays continuous.
      const progress = MathUtils.smoothstep(time - data[offset + 2], 0, FADE_SECONDS)
      data[offset] = animate ? MathUtils.lerp(data[offset], data[offset + 1], progress) : target
      data[offset + 1] = target
      data[offset + 2] = time
      changed = true
    }
    if (changed) this.#texture.needsUpdate = true
  }

  reset () {
    this.#texture.image.data.fill(0)
    this.#texture.needsUpdate = true
  }

  dispose () {
    this.#texture.dispose()
  }

  #bind (shader) {
    shader.uniforms.terrainCoverageMap = { value: this.#texture }
    shader.uniforms.terrainCoverageTime = this.#time
  }

  applyNear (shader, position = `modelMatrix[3].xz + ${(TERRAIN_CHUNKS.size / 2).toFixed(1)}`, opacity = '1.0') {
    this.#bind(shader)
    shader.vertexShader = `varying float nearTerrainWeight;\n${coverageLookup}\n` + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vec2 terrainCoveragePosition = ${position};
      nearTerrainWeight = nearTerrainCoverage(terrainCoveragePosition) * (${opacity});
    `)
    shader.fragmentShader = `varying float nearTerrainWeight;\n${coverageDither}\n` + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      if (nearTerrainWeight < 1.0 && coverageThreshold() >= nearTerrainWeight) discard;
      #include <opaque_fragment>
    `)
  }

  applyDistant (shader) {
    this.#bind(shader)
    shader.vertexShader = 'varying vec2 coverageWorld;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      coverageWorld = (modelMatrix * vec4(position, 1.0)).xz;
    `)
    shader.fragmentShader = `varying vec2 coverageWorld;\n${coverageLookup}\n${coverageDither}\n` + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace('void main() {', `void main() {
      float nearTerrainWeight = nearTerrainCoverage(coverageWorld);
      if (nearTerrainWeight >= 1.0 || (nearTerrainWeight > 0.0 && coverageThreshold() < nearTerrainWeight)) discard;
    `)
  }
}
