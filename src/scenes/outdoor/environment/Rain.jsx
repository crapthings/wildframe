import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, Color, ShaderMaterial, Vector3 } from 'three'
import { RAIN_SETTINGS as settings } from '../constants'

export function Rain ({ environmentBlend, rainBlend }) {
  const ref = useRef()
  const resources = useMemo(() => {
    const geometry = new BufferGeometry()
    const positions = new Float32Array(settings.count * 6)
    const ends = new Float32Array(settings.count * 2)
    let seed = 7291
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
    for (let i = 0; i < settings.count; i++) {
      const x = random() * settings.radius * 2
      const y = random() * settings.height
      const z = random() * settings.radius * 2
      positions.set([x, y, z, x, y, z], i * 6)
      ends[i * 2 + 1] = 1
    }
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    geometry.setAttribute('end', new BufferAttribute(ends, 1))
    const material = new ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { time: { value: 0 }, strength: { value: 0 }, night: { value: 0 }, center: { value: new Vector3() }, color: { value: new Color('#b9cfdf') } },
      vertexShader: `uniform float time; uniform vec3 center; attribute float end; varying float alpha;
        void main() {
          vec3 p = position;
          p.xz = mod(p.xz - center.xz + vec2(${settings.radius.toFixed(1)}), ${ (settings.radius * 2).toFixed(1) }) + center.xz - vec2(${settings.radius.toFixed(1)});
          p.y = mod(p.y - time * ${settings.speed.toFixed(1)} - center.y, ${settings.height.toFixed(1)}) + center.y - 8.0;
          p += vec3(-0.12, ${settings.length.toFixed(2)}, 0.0) * end;
          alpha = (1.0 - end * 0.65) * (1.0 - smoothstep(16.0, ${settings.radius.toFixed(1)}, length(p.xz - center.xz)));
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `uniform float strength; uniform float night; uniform vec3 color; varying float alpha;
        void main() {
          gl_FragColor = vec4(color * mix(1.0, 0.25, night), alpha * strength * mix(0.38, 0.22, night));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    })
    return { geometry, material }
  }, [])
  useEffect(() => () => { resources.geometry.dispose(); resources.material.dispose() }, [resources])
  useFrame(({ camera, clock }) => {
    ref.current.visible = rainBlend.current > 0.001
    const uniforms = resources.material.uniforms
    uniforms.time.value = clock.elapsedTime
    uniforms.strength.value = rainBlend.current
    uniforms.night.value = environmentBlend.current
    uniforms.center.value.copy(camera.position)
  })
  return <lineSegments ref={ref} geometry={resources.geometry} material={resources.material} frustumCulled={false} />
}
