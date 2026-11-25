import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useWorldStore } from '@/scenes/outdoor/state/worldStore'
import { chunkKey, surroundingChunks } from '@/scenes/outdoor/terrain/streaming/chunks'
import { TERRAIN_CHUNKS } from '@/scenes/outdoor/terrain/constants'
import { recordTerrainEvent } from './terrainEvents.js'
import { nextRetirement, updateRetirement } from './chunkRetirement.js'

const STREAMING = TERRAIN_CHUNKS.streaming
const MAX_CACHED_CHUNKS = (TERRAIN_CHUNKS.radius * 2 + 1) ** 2 + STREAMING.spareChunks

// Keep transferred arrays out of React's development-time prop traversal.
class ChunkBuffers {
  #mesh
  #rocks

  constructor (mesh, rocks) {
    this.#mesh = mesh
    this.#rocks = rocks
  }

  get mesh () { return this.#mesh }
  get rocks () { return this.#rocks }
}

export function useTerrainChunks (coverage) {
  const centerKey = useWorldStore((state) => {
    const center = state.teleportTarget || state.view
    return chunkKey(center.x, center.z)
  })
  const wanted = useMemo(() => {
    const [x, z] = centerKey.split(',').map(Number)
    return surroundingChunks(x * TERRAIN_CHUNKS.size, z * TERRAIN_CHUNKS.size)
  }, [centerKey])
  const wantedLods = useMemo(() => new Map(wanted.map((chunk) => [chunk.key, chunk.lod])), [wanted])
  const cache = useRef(new Map())
  const desired = useRef([])
  const pump = useRef(() => {})
  const awaitingCommit = useRef(false)
  const pending = useRef(null)
  const retirement = useRef(new Map())
  const windowChangedAt = useRef(0)
  const lastRetirement = useRef(0)
  const [chunks, setChunks] = useState([])

  useEffect(() => {
    let worker
    let busy = false
    let failed = false
    let jobStarted = 0
    const fail = () => {
      failed = true
      useWorldStore.setState({ terrainError: 'Failed to generate terrain. Please reload.' })
    }
    try {
      worker = new Worker(new URL('../generation/terrain.worker.js', import.meta.url), { type: 'module' })
    } catch {
      fail()
      return
    }
    pump.current = () => {
      if (busy || failed || awaitingCommit.current || pending.current) return
      const next = desired.current.find((chunk) => {
        const existing = cache.current.get(chunk.key)
        return !existing || existing.lod > chunk.lod
      })
      if (!next) return
      busy = true
      jobStarted = performance.now()
      worker.postMessage({ ...next, withRocks: !cache.current.has(next.key) })
    }
    worker.onmessage = ({ data }) => {
      if (data.error) {
        fail()
        return
      }
      if (import.meta.env.DEV) recordTerrainEvent('chunk-result', {
        key: data.key,
        lod: data.lod,
        turnaroundMs: performance.now() - jobStarted,
        worker: data.diagnostics,
        bytes: Object.values(data).reduce((sum, value) => sum + (ArrayBuffer.isView(value) ? value.byteLength : 0), 0)
      })
      // One transferable result at most. The frame scheduler admits it or retires
      // one old chunk, never both in the same frame.
      busy = false
      pending.current = data
    }
    worker.onerror = fail
    worker.onmessageerror = fail
    pump.current()
    return () => {
      worker.terminate()
      awaitingCommit.current = false
      pending.current = null
      retirement.current.clear()
      pump.current = () => {}
      cache.current.clear()
      coverage.reset()
      useWorldStore.setState({ readyChunks: new Set(), terrainLoading: true })
    }
  }, [coverage])

  useEffect(() => {
    const now = performance.now()
    windowChangedAt.current = now
    if (import.meta.env.DEV) recordTerrainEvent('window-change', {
      center: centerKey,
      newChunks: wanted.filter((chunk) => !cache.current.has(chunk.key)).length,
      lodRebuilds: wanted.filter((chunk) => cache.current.get(chunk.key)?.lod > chunk.lod).length
    })
    desired.current = wanted
    updateRetirement(cache.current, wanted, retirement.current, now, STREAMING)
    const [x, z] = centerKey.split(',').map(Number)
    // Refresh shadow caster distances for retained chunks as the window moves.
    for (const [key, existing] of cache.current) {
      const distance = (existing.column - x) ** 2 + (existing.row - z) ** 2
      if (existing.distance !== distance) cache.current.set(key, { ...existing, distance })
    }
    awaitingCommit.current = true
    setChunks([...cache.current.values()])
  }, [wanted, centerKey])

  useFrame(() => {
    const now = performance.now()
    coverage.setTime(now)
    if (awaitingCommit.current || document.hidden) return
    const { sceneEntered, teleportTarget } = useWorldStore.getState()
    if (sceneEntered && !teleportTarget && now - windowChangedAt.current < STREAMING.windowSettleMs) return

    const data = pending.current
    const requested = data && desired.current.find((chunk) => chunk.key === data.key)
    const previous = requested && cache.current.get(data.key)
    const rocks = previous?.buffers.rocks ?? data?.rocks
    const usable = Boolean(requested && data.lod <= requested.lod && (!previous || data.lod < previous.lod) && rocks)
    // An upgrade can outlive an eviction. Request the rocks again if their chunk left the cache.
    if (data && !usable) {
      pending.current = null
      pump.current()
    }
    const pressure = usable && !previous && cache.current.size >= MAX_CACHED_CHUNKS
    const retiring = nextRetirement(retirement.current, now, pressure)
    const canRetire = (pressure && teleportTarget) || now - lastRetirement.current >= STREAMING.retirementIntervalMs
    if (retiring !== null && canRetire) {
      retirement.current.delete(retiring)
      cache.current.delete(retiring)
      lastRetirement.current = now
      awaitingCommit.current = true
      recordTerrainEvent('chunk-retire', { key: retiring, cached: cache.current.size, pressure })
      setChunks([...cache.current.values()])
      return
    }
    if (!usable || pressure) return
    cache.current.set(data.key, { ...requested, lod: data.lod, buffers: new ChunkBuffers(data, rocks) })
    pending.current = null
    awaitingCommit.current = true
    recordTerrainEvent('chunk-submit', { key: data.key, lod: data.lod, cached: cache.current.size })
    setChunks([...cache.current.values()])
  }, -50)

  // Publish readiness only after the meshes have been committed.
  useLayoutEffect(() => {
    coverage.update(chunks, wantedLods, useWorldStore.getState().sceneEntered, performance.now())
    const readyChunks = new Set(chunks.filter((chunk) => chunk.lod <= wantedLods.get(chunk.key)).map((chunk) => chunk.key))
    const previousRendered = useWorldStore.getState().renderedChunks
    const keys = chunks.map((chunk) => chunk.key)
    const renderedChunks = keys.length === previousRendered.length && keys.every((key, index) => key === previousRendered[index]) ? previousRendered : keys
    useWorldStore.setState({
      renderedChunks,
      readyChunks,
      terrainLoading: readyChunks.size < wantedLods.size,
      terrainProgress: wantedLods.size ? readyChunks.size / wantedLods.size * 100 : 100,
      terrainCenter: centerKey
    })
    if (awaitingCommit.current) recordTerrainEvent('chunk-commit', { center: centerKey })
    awaitingCommit.current = false
    pump.current()
  }, [chunks, wantedLods, centerKey, coverage])

  return chunks
}
