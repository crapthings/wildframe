import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useWorldStore } from '@/scenes/outdoor/state/worldStore'
import { chunkKey, surroundingChunks } from '@/scenes/outdoor/terrain/streaming/chunks'
import { TERRAIN_CHUNKS } from '@/scenes/outdoor/terrain/constants'
import { recordTerrainEvent } from './terrainEvents.js'
import { nextRetirement, updateRetirement } from './chunkRetirement.js'

const STREAMING = TERRAIN_CHUNKS.streaming
const MAX_CACHED_CHUNKS = (TERRAIN_CHUNKS.radius * 2 + 1) ** 2 + STREAMING.spareChunks

export function useTerrainChunks () {
  const previousLods = useRef(new Map())
  const centerKey = useWorldStore((state) => {
    const center = state.teleportTarget || state.view
    return chunkKey(center.x, center.z)
  })
  const wanted = useMemo(() => {
    const [x, z] = centerKey.split(',').map(Number)
    return surroundingChunks(x * TERRAIN_CHUNKS.size, z * TERRAIN_CHUNKS.size).map((chunk) => {
      const old = previousLods.current.get(chunk.key)
      const ring = Math.max(Math.abs(chunk.column - x), Math.abs(chunk.row - z))
      // Keep higher detail for one additional ring before downgrading.
      if (old !== undefined && old < chunk.lod && ring <= TERRAIN_CHUNKS.lodRings[old] + 1) chunk.lod = old
      return chunk
    })
  }, [centerKey])
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
      const next = desired.current.find((chunk) => cache.current.get(chunk.key)?.lod !== chunk.lod)
      if (!next) return
      busy = true
      jobStarted = performance.now()
      worker.postMessage(next)
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
      useWorldStore.setState({ readyChunks: new Set(), terrainLoading: true })
    }
  }, [])

  useEffect(() => {
    const now = performance.now()
    windowChangedAt.current = now
    if (import.meta.env.DEV) recordTerrainEvent('window-change', {
      center: centerKey,
      newChunks: wanted.filter((chunk) => !cache.current.has(chunk.key)).length,
      lodRebuilds: wanted.filter((chunk) => cache.current.has(chunk.key) && cache.current.get(chunk.key).lod !== chunk.lod).length
    })
    desired.current = wanted
    previousLods.current = new Map(wanted.map((chunk) => [chunk.key, chunk.lod]))
    updateRetirement(cache.current, wanted, retirement.current, now, STREAMING.retirementGraceMs)
    const [x, z] = centerKey.split(',').map(Number)
    // Retained chunks must also get current distances (especially on teleport),
    // otherwise old stones and shadow casters remain incorrectly classified near.
    for (const [key, existing] of cache.current) {
      const distance = (existing.column - x) ** 2 + (existing.row - z) ** 2
      if (existing.distance !== distance) cache.current.set(key, { ...existing, distance })
    }
    awaitingCommit.current = true
    setChunks([...cache.current.values()])
  }, [wanted, centerKey])

  useFrame(() => {
    if (awaitingCommit.current || document.hidden) return
    const now = performance.now()
    const entered = useWorldStore.getState().sceneEntered
    if (entered && now - windowChangedAt.current < STREAMING.windowSettleMs) return

    const data = pending.current
    const descriptor = data && desired.current.find((chunk) => chunk.key === data.key && chunk.lod === data.lod)
    if (data && !descriptor) {
      pending.current = null
      pump.current()
    }
    const pressure = descriptor && !cache.current.has(data.key) && cache.current.size >= MAX_CACHED_CHUNKS
    const retiring = nextRetirement(retirement.current, now, pressure)
    if (retiring !== null && now - lastRetirement.current >= STREAMING.retirementIntervalMs) {
      retirement.current.delete(retiring)
      cache.current.delete(retiring)
      lastRetirement.current = now
      awaitingCommit.current = true
      recordTerrainEvent('chunk-retire', { key: retiring, cached: cache.current.size, pressure: Boolean(pressure) })
      setChunks([...cache.current.values()])
      return
    }
    if (!descriptor || pressure) return
    const previous = cache.current.get(data.key)
    cache.current.set(data.key, { ...descriptor, ...data, rocks: previous?.rocks || data.rocks })
    pending.current = null
    awaitingCommit.current = true
    recordTerrainEvent('chunk-submit', { key: data.key, lod: data.lod, cached: cache.current.size })
    setChunks([...cache.current.values()])
  }, -50)

  // Publish readiness only after the meshes have been committed.
  useLayoutEffect(() => {
    const wantedLods = new Map(wanted.map((chunk) => [chunk.key, chunk.lod]))
    const readyChunks = new Set(chunks.filter((chunk) => wantedLods.get(chunk.key) === chunk.lod).map((chunk) => chunk.key))
    const complete = wanted.filter((chunk) => readyChunks.has(chunk.key)).length
    const previousRendered = useWorldStore.getState().renderedChunks
    const keys = chunks.map((chunk) => chunk.key)
    const renderedChunks = keys.length === previousRendered.length && keys.every((key, index) => key === previousRendered[index]) ? previousRendered : keys
    useWorldStore.setState({
      renderedChunks,
      readyChunks,
      terrainLoading: complete < wanted.length,
      terrainProgress: wanted.length ? complete / wanted.length * 100 : 100,
      terrainCenter: centerKey
    })
    if (awaitingCommit.current) recordTerrainEvent('chunk-commit', { center: centerKey })
    awaitingCommit.current = false
    pump.current()
  }, [chunks, wanted, centerKey])

  return chunks
}
