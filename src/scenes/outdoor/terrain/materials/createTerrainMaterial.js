import 'three-hex-tiling'
import { MeshStandardMaterial, ShaderChunk } from 'three'
import { TERRAIN_SETTINGS } from '@/scenes/outdoor/constants'
import { applyHeightFog } from './heightFog'

export function createTerrainMaterial (textures) {
  const [map, normalMap, roughnessMap, grassColor, grassNormal, grassRoughness, mountainColor, mountainNormal, mountainRoughness, foothillPacked, foothillNormal, barePacked, bareNormal] = textures
  const material = new MeshStandardMaterial({
    map,
    normalMap,
    roughnessMap,
    metalness: TERRAIN_SETTINGS.metalness,
    roughness: TERRAIN_SETTINGS.roughness,
    hexTiling: TERRAIN_SETTINGS.hexTiling
  })
  const hexCompile = material.onBeforeCompile
  material.onBeforeCompile = function (shader, renderer) {
    hexCompile.call(this, shader, renderer)
    applyHeightFog(shader)
    Object.assign(shader.uniforms, {
      grassColor: { value: grassColor },
      grassNormal: { value: grassNormal },
      grassRoughness: { value: grassRoughness },
      mountainColor: { value: mountainColor },
      mountainNormal: { value: mountainNormal },
      mountainRoughness: { value: mountainRoughness },
      foothillPacked: { value: foothillPacked },
      foothillNormal: { value: foothillNormal },
      barePacked: { value: barePacked },
      bareNormal: { value: bareNormal },
      mountainScale: { value: 1 / TERRAIN_SETTINGS.mountainTextureWorldSize },
      wetDarkening: { value: TERRAIN_SETTINGS.wetDarkening },
      wetRoughness: { value: TERRAIN_SETTINGS.wetRoughness }
    })
    shader.vertexShader = 'attribute vec3 terrainBlend;\nvarying vec3 vTerrainBlend;\nvarying vec3 mountainPosition;\nvarying vec3 mountainGeometricNormal;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvTerrainBlend = terrainBlend;')
    shader.vertexShader = 'attribute vec2 terrainDetails;\nvarying vec2 vTerrainDetails;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('vTerrainBlend = terrainBlend;', 'vTerrainBlend = terrainBlend; vTerrainDetails = terrainDetails;')
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nmountainPosition = (modelMatrix * vec4(position, 1.0)).xyz;\nmountainGeometricNormal = mat3(modelMatrix) * normal;')
    shader.fragmentShader = 'varying vec3 vTerrainBlend;\nvarying vec3 mountainPosition;\nvarying vec3 mountainGeometricNormal;\n' + shader.fragmentShader
    shader.fragmentShader = 'varying vec2 vTerrainDetails;\n' + shader.fragmentShader
    // Extend the installed hex-tiling algorithm to array layers, preserving its blending.
    const arrayHex = ShaderChunk.tilebreaking_pars_fragment
      .slice(ShaderChunk.tilebreaking_pars_fragment.indexOf('vec4 textureNoTileNeyret('))
      .replace('textureNoTileNeyret(sampler2D samp, vec2 uv)', 'transitionHex(sampler2DArray samp, vec2 uv, float layer)')
      .replace('texture(samp, U, 99.)', 'texture(samp, vec3(U, layer), 99.)')
      .replaceAll('C(', 'TRANSITION_C(')
    shader.fragmentShader = shader.fragmentShader.replace('void main() {', `
      #define TRANSITION_C(I) (srgb2rgb(textureGrad(samp, vec3(U / hexTilingPatchScale - rnd22(I), layer), Gx, Gy)) - meanColor * float(hexTilingUseContrastCorrectedBlending))
      ${arrayHex}
      #undef TRANSITION_C
      uniform sampler2D grassColor;
      uniform sampler2D grassNormal;
      uniform sampler2D grassRoughness;
      uniform sampler2D mountainColor;
      uniform sampler2D mountainNormal;
      uniform sampler2D mountainRoughness;
      uniform highp sampler2DArray foothillPacked;
      uniform highp sampler2DArray foothillNormal;
      uniform sampler2D barePacked;
      uniform sampler2D bareNormal;
      uniform float mountainScale;
      uniform float wetDarkening;
      uniform float wetRoughness;
      vec3 mountainWeights() {
        vec3 w = pow(abs(normalize(mountainGeometricNormal)), vec3(4.0));
        return w / (w.x + w.y + w.z);
      }
      vec4 mountainSample(sampler2D tex) {
        vec3 p = mountainPosition * mountainScale;
        vec3 w = mountainWeights();
        return textureNoTileNeyret(tex, p.zy) * w.x
          + textureNoTileNeyret(tex, p.xz) * w.y
          + textureNoTileNeyret(tex, p.xy) * w.z;
      }
      vec4 mountainLayer(sampler2D tex, bool rough) {
        float weight = vTerrainDetails.y;
        if (weight < 0.001) return mountainSample(tex);
        vec4 detail = mountainSample(barePacked);
        detail = rough ? vec4(detail.a) : vec4(detail.rgb, 1.0);
        if (weight > 0.999) return detail;
        return mix(mountainSample(tex), detail, weight);
      }
      vec3 mountainNormalAt(vec2 uv) {
        float weight = vTerrainDetails.y;
        if (weight < 0.001) return textureNoTileNeyret(mountainNormal, uv).xyz * 2.0 - 1.0;
        vec3 detail = textureNoTileNeyret(bareNormal, uv).xyz;
        if (weight < 0.999) detail = mix(textureNoTileNeyret(mountainNormal, uv).xyz, detail, weight);
        return detail * 2.0 - 1.0;
      }
      vec3 mountainMappedNormal(vec3 base) {
        vec3 p = mountainPosition * mountainScale;
        vec3 w = mountainWeights();
        vec3 nx = mountainNormalAt(p.zy);
        vec3 ny = mountainNormalAt(p.xz);
        vec3 nz = mountainNormalAt(p.xy);
        return normalize(
          getTangentFrame(-vViewPosition, base, p.zy) * nx * w.x +
          getTangentFrame(-vViewPosition, base, p.xz) * ny * w.y +
          getTangentFrame(-vViewPosition, base, p.xy) * nz * w.z);
      }
      vec4 terrainSample(sampler2D rock, sampler2D grass, vec2 coords) {
        float weight = clamp(vTerrainBlend.x, 0.0, 1.0);
        if (weight < 0.001) return textureNoTileNeyret(rock, coords);
        if (weight > 0.999) return textureNoTileNeyret(grass, coords);
        return mix(textureNoTileNeyret(rock, coords), textureNoTileNeyret(grass, coords), weight);
      }
      vec4 foothillSample(sampler2D rock, sampler2D grass, vec2 coords, highp sampler2DArray detailMap, int channel) {
        float weight = vTerrainDetails.x;
        if (weight < 0.001) return terrainSample(rock, grass, coords);
        float summit = smoothstep(65.0, 140.0, mountainPosition.y);
        float exposed = smoothstep(0.08, 0.3, 1.0 - normalize(mountainGeometricNormal).y) * summit;
        vec4 detail;
        if (summit < 0.001) detail = transitionHex(detailMap, coords, 0.0);
        else if (summit > 0.999) detail = transitionHex(detailMap, coords, 1.0);
        else detail = mix(transitionHex(detailMap, coords, 0.0), transitionHex(detailMap, coords, 1.0), summit);
        if (exposed > 0.001) detail = mix(detail, transitionHex(detailMap, coords, 2.0), exposed * 0.6);
        if (channel == 1) detail = vec4(detail.a);
        else if (channel == 0) detail.a = 1.0;
        if (weight > 0.999) return detail;
        return mix(terrainSample(rock, grass, coords), detail, weight);
      }
      void main() {
    `)
    for (const [chunk, rock, grass, uv] of [
      ['map_fragment', 'map', 'grassColor', 'vMapUv'],
      ['normal_fragment_maps', 'normalMap', 'grassNormal', 'vNormalMapUv'],
      ['roughnessmap_fragment', 'roughnessMap', 'grassRoughness', 'vRoughnessMapUv']
    ]) {
      let source = ShaderChunk[chunk].replace(
          `textureNoTileNeyret(${rock}, ${uv})`,
          `terrainSample(${rock}, ${grass}, ${uv})`
        )
      if (chunk === 'map_fragment') {
        source = source.replace('terrainSample(map, grassColor, vMapUv)', '(vTerrainBlend.z > 0.999 ? mountainSample(mountainColor) : (vTerrainBlend.z < 0.001 ? terrainSample(map, grassColor, vMapUv) : mix(terrainSample(map, grassColor, vMapUv), mountainSample(mountainColor), vTerrainBlend.z)))')
      } else if (chunk === 'roughnessmap_fragment') {
        source = source.replace('terrainSample(roughnessMap, grassRoughness, vRoughnessMapUv)', '(vTerrainBlend.z > 0.999 ? mountainSample(mountainRoughness) : (vTerrainBlend.z < 0.001 ? terrainSample(roughnessMap, grassRoughness, vRoughnessMapUv) : mix(terrainSample(roughnessMap, grassRoughness, vRoughnessMapUv), mountainSample(mountainRoughness), vTerrainBlend.z)))')
      } else {
        source = `vec3 terrainBaseNormal = normal;\nif (vTerrainBlend.z < 0.999) {\n${source}\n}\nif (vTerrainBlend.z > 0.001) { normal = normalize(mix(normal, mountainMappedNormal(terrainBaseNormal), vTerrainBlend.z)); }`
      }
      const detailMap = chunk === 'normal_fragment_maps' ? 'foothillNormal' : 'foothillPacked'
      const channel = chunk === 'roughnessmap_fragment' ? 1 : chunk === 'normal_fragment_maps' ? 2 : 0
      source = source.replaceAll(`terrainSample(${rock}, ${grass}, ${uv})`, `foothillSample(${rock}, ${grass}, ${uv}, ${detailMap}, ${channel})`)
        .replaceAll('mountainSample(mountainColor)', 'mountainLayer(mountainColor, false)')
        .replaceAll('mountainSample(mountainRoughness)', 'mountainLayer(mountainRoughness, true)')
      shader.fragmentShader = shader.fragmentShader.replace(`#include <${chunk}>`, source)
    }
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\ndiffuseColor.rgb *= mix(1.0, wetDarkening, vTerrainBlend.y);'
    ).replace(
      '#include <metalnessmap_fragment>',
      'roughnessFactor = mix(roughnessFactor, wetRoughness, vTerrainBlend.y);\n#include <metalnessmap_fragment>'
    )
  }
  material.customProgramCacheKey = () => 'terrain-transition-array-hex-v5'
  return material
}
