export const coverageDither = `
  float coverageThreshold() {
    vec2 pixel = floor(gl_FragCoord.xy);
    return fract(52.9829189 * fract(dot(pixel, vec2(0.06711056, 0.00583715))));
  }
`
