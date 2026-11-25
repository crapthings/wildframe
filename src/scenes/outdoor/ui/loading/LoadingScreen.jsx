import { useEffect, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { useWorldStore } from '@/scenes/outdoor/state/worldStore'
import { LOADING_TIMING } from '@/scenes/outdoor/ui/loading/loadingTiming'

export function LoadingScreen () {
  const { active, errors, progress } = useProgress()
  const entered = useWorldStore((state) => state.sceneEntered)
  const playerReady = useWorldStore((state) => state.playerReady)
  const distantReady = useWorldStore((state) => state.distantReady)
  const distantProgress = useWorldStore((state) => state.distantProgress)
  const surfaceProgress = useWorldStore((state) => state.surfaceProgress)
  const surfaceReady = useWorldStore((state) => state.surfaceReady)
  const terrainProgress = useWorldStore((state) => state.terrainProgress)
  const terrainLoading = useWorldStore((state) => state.terrainLoading)
  const terrainError = useWorldStore((state) => state.terrainError)
  const hasTerrain = useWorldStore((state) => state.readyChunks.size > 0)
  const [percentage, setPercentage] = useState(0)
  const hasErrors = errors.length > 0 || Boolean(terrainError)
  const ready = !active && !terrainLoading && hasTerrain && distantReady && surfaceReady && playerReady && !hasErrors
  const measured = ready ? 100 : Math.min(99, Math.floor(progress * 0.25 + surfaceProgress * 0.25 + terrainProgress * 0.3 + distantProgress * 0.2))

  useEffect(() => {
    if (!entered) setPercentage((previous) => Math.max(previous, measured))
  }, [measured, entered])

  useEffect(() => {
    if (!ready || entered) return
    const timer = window.setTimeout(() => {
      useWorldStore.setState({ sceneEntered: true })
    }, LOADING_TIMING.entryHold)
    return () => window.clearTimeout(timer)
  }, [ready, entered])

  const status = hasErrors ? 'Unable to load the world' : ready ? 'Ready' : active ? 'Loading scene assets' : !surfaceReady ? 'Preparing terrain textures' : !terrainLoading && !distantReady ? 'Generating distant mountains' : 'Generating nearby terrain'

  return (
    <section
      aria-hidden={entered}
      aria-label='Scene loading progress'
      className={`absolute inset-0 z-[60] flex items-center justify-center bg-[radial-gradient(ellipse_at_50%_35%,#283d3e_0%,#142425_45%,#0c1518_100%)] px-8 text-[#e4ece5] transition-opacity duration-700 motion-reduce:transition-none ${entered ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
    >
      <div className='w-full max-w-[18rem]'>
        <p className='mb-3 text-[0.6rem] uppercase tracking-[0.4em] text-white/35'>Outdoor · 01</p>
        <h1 className='text-2xl font-light tracking-[0.22em]'>Wildframe</h1>
        <div className='mb-3 mt-10 flex items-center justify-between text-[0.7rem] text-white/60'>
          <span role='status'>{status}</span>
          {!hasErrors && <span className='font-mono tabular-nums text-white/40'>{percentage}%</span>}
        </div>

        <div role='progressbar' aria-label='Scene preparation progress' aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage} className='h-px overflow-hidden bg-white/15'>
          <div
            className={`h-full ${hasErrors ? 'bg-red-300' : 'bg-[#b7cbbf]'}`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {hasErrors && !entered && (
          <button type='button' onClick={() => window.location.reload()} className='mt-5 rounded border border-white/20 px-4 py-2 text-xs text-white/70 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-white'>
            Reload
          </button>
        )}
      </div>
      <p className='absolute bottom-10 text-center text-[0.65rem] leading-6 tracking-wide text-white/35'>
        WASD to move · Shift to sprint · Space to double jump<br />Drag to look · Scroll to zoom · Tab for map
      </p>
    </section>
  )
}
