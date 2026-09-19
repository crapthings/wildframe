import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useWorldStore } from '@/scenes/outdoor/state/worldStore'
import { Player, Position, Velocity, simulationWorld } from '@/scenes/outdoor/state/entities'
import { chunkKey } from './chunks'
import { clearTerrainEvents, recordTerrainEvent, recentTerrainEvents } from './terrainEvents.js'

function createCapture () {
  return { intervals: new Float32Array(600), count: 0, cursor: 0, lastTime: 0, lastReport: 0, pending: false, longFrames: [] }
}

function snapshot (capture) {
  const intervals = Array.from(capture.intervals.subarray(0, capture.count)).sort((a, b) => a - b)
  const percentile = (p) => Math.round((intervals[Math.max(0, Math.ceil(intervals.length * p) - 1)] || 0) * 10) / 10
  return {
    sampleFrames: capture.count,
    sampleSeconds: Math.round(intervals.reduce((sum, ms) => sum + ms, 0) / 100) / 10,
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
    p99Ms: percentile(0.99),
    worstMs: percentile(1),
    framesOver33ms: intervals.filter((ms) => ms > 33).length,
    longFrames: capture.longFrames.slice(),
    recentEvents: recentTerrainEvents(performance.now(), 10000)
  }
}

export function FrameDiagnostics () {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const captureRef = useRef(null)
  if (!captureRef.current) captureRef.current = createCapture()

  useEffect(() => {
    const original = gl.render
    function measuredRender (...args) {
      if (args[0] !== scene) return original.apply(this, args)
      const started = performance.now()
      try {
        return original.apply(this, args)
      } finally {
        const durationMs = performance.now() - started
        // CPU submission/driver wait only. This is NOT GPU execution timing.
        if (durationMs > 8 && useWorldStore.getState().sceneEntered) {
          recordTerrainEvent('scene-render-slow', {
            durationMs,
            calls: gl.info.render.calls,
            triangles: gl.info.render.triangles,
            geometries: gl.info.memory.geometries
          }, started)
        }
      }
    }
    gl.render = measuredRender
    return () => {
      if (gl.render === measuredRender) gl.render = original
    }
  }, [gl, scene])

  useEffect(() => {
    const previous = window.__terrainDiagnostics
    const api = {
      report: () => snapshot(captureRef.current),
      reset: () => {
        captureRef.current = createCapture()
        clearTerrainEvents()
      }
    }
    window.__terrainDiagnostics = api
    const onVisibilityChange = () => { captureRef.current.lastTime = 0 }
    document.addEventListener('visibilitychange', onVisibilityChange)
    let observer
    if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
      observer = new PerformanceObserver((list) => {
        if (document.hidden || !useWorldStore.getState().sceneEntered) return
        for (const entry of list.getEntries()) {
          recordTerrainEvent('browser-long-task', { durationMs: entry.duration }, entry.startTime)
        }
      })
      observer.observe({ type: 'longtask' })
    }
    return () => {
      observer?.disconnect()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (window.__terrainDiagnostics === api) {
        if (previous === undefined) delete window.__terrainDiagnostics
        else window.__terrainDiagnostics = previous
      }
    }
  }, [])

  // Measure wall-clock frame intervals before scene updates, not the Perf chart.
  useFrame(() => {
    const capture = captureRef.current
    const now = performance.now()
    if (!useWorldStore.getState().sceneEntered || document.hidden) {
      capture.lastTime = 0
      return
    }
    const previousTime = capture.lastTime
    capture.lastTime = now
    if (!previousTime) return
    const frameMs = now - previousTime
    capture.intervals[capture.cursor] = frameMs
    capture.cursor = (capture.cursor + 1) % capture.intervals.length
    capture.count = Math.min(capture.count + 1, capture.intervals.length)
    if (frameMs > 33) {
      const player = simulationWorld.query(Player, Position, Velocity)[0]
      const position = player?.get(Position)
      const velocity = player?.get(Velocity)
      capture.longFrames.push({
        time: Math.round(now),
        frameMs: Math.round(frameMs * 10) / 10,
        position: position ? { x: position.x, z: position.z, chunk: chunkKey(position.x, position.z) } : null,
        speed: velocity ? Math.hypot(velocity.x, velocity.z) : 0,
        // Correlation only: a nearby event is not proof of the cause.
        recentEvents: recentTerrainEvents(now, frameMs + 100)
      })
      if (capture.longFrames.length > 30) capture.longFrames.shift()
      capture.pending = true
    }
    // Batch reports on a recovered frame, avoiding console spam during a hitch.
    if (capture.pending && frameMs < 25 && now - capture.lastReport > 2000) {
      capture.lastReport = now
      capture.pending = false
      console.info('[terrain long frame]', snapshot(capture))
    }
  }, -100)
  return null
}
