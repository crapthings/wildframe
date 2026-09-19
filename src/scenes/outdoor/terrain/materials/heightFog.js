import { SCENE_SETTINGS } from '@/scenes/outdoor/constants'

export function applyHeightFog (shader) {
  const fog = SCENE_SETTINGS.fog
  shader.vertexShader = 'varying float terrainFogHeight;\n' + shader.vertexShader
  shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nterrainFogHeight = (modelMatrix * vec4(position, 1.0)).y;')
  shader.fragmentShader = 'varying float terrainFogHeight;\n' + shader.fragmentShader
  shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', `
    #ifdef USE_FOG
      float heightFade = smoothstep(${fog.heightStart.toFixed(1)}, ${fog.heightEnd.toFixed(1)}, terrainFogHeight);
      float density = fogDensity * mix(1.0, ${fog.mountainDensityScale.toFixed(2)}, heightFade);
      float amount = 1.0 - exp(-density * density * vFogDepth * vFogDepth);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, amount);
    #endif
  `)
}
