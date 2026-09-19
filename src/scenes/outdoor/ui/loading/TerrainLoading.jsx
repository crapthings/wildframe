import { useEffect, useRef, useState } from 'react'
import { useWorldStore } from '@/scenes/outdoor/state/worldStore'
import { LOADING_TIMING } from '@/scenes/outdoor/ui/loading/loadingTiming'

export function TerrainLoading () {
  const entered = useWorldStore((state) => state.sceneEntered)
  const loading = useWorldStore((state) => state.terrainLoading)
  const progress = useWorldStore((state) => state.terrainProgress)
  const error = useWorldStore((state) => state.terrainError)
  const teleporting = useWorldStore((state) => state.teleportTarget !== null)
  const busy = entered && (loading || teleporting || Boolean(error))
  const percentage = busy ? Math.max(0, Math.min(100, Math.floor(progress))) : 100
  const [visible, setVisible] = useState(false)
  const shownAt = useRef(0)

  useEffect(() => {
    let timer
    if (busy) {
      if (!visible) {
        timer = window.setTimeout(() => {
          shownAt.current = performance.now()
          setVisible(true)
        }, error || teleporting ? 0 : LOADING_TIMING.showDelay)
      }
    } else if (visible) {
      timer = window.setTimeout(() => setVisible(false), Math.max(
        LOADING_TIMING.hideDelay,
        LOADING_TIMING.minimumVisible - (performance.now() - shownAt.current)
      ))
    }
    // A new load cancels the pending hide without unmounting the indicator.
    return () => window.clearTimeout(timer)
  }, [busy, visible, error, teleporting])

  return (
    <div
      role='status'
      aria-hidden={!visible || !entered}
      className={`pointer-events-none fixed inset-x-0 bottom-10 z-50 mx-auto w-52 text-[0.65rem] text-white/75 transition-opacity duration-300 motion-reduce:transition-none ${visible && entered ? 'opacity-100' : 'opacity-0'}`}
    >
      <div className='mb-2 flex justify-between'>
        <span className='drop-shadow-md'>{error || (!busy ? 'Terrain ready' : teleporting ? 'Preparing destination' : 'Loading distant terrain')}</span>
        {!error && teleporting && <span>{percentage}%</span>}
      </div>
      {!error && (
        <div role='progressbar' aria-label='Terrain generation progress' aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage} className='h-px overflow-hidden rounded bg-white/15 shadow-sm'>
          <div className='h-full bg-white/65' style={{ width: `${percentage}%` }} />
        </div>
      )}
    </div>
  )
}
