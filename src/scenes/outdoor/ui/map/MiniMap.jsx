import { useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { TerrainMapCanvas } from '@/scenes/outdoor/ui/map/TerrainMapCanvas'
import {
  WORLD_BOUNDS,
  WORLD_HALF_SIZE_METERS,
  WORLD_SIZE_METERS
} from '@/scenes/outdoor/constants'
import { sampleTerrainHeight } from '@/scenes/outdoor/terrain/generation/sampleTerrain'
import { TERRAIN_GENERATION } from '@/scenes/outdoor/terrain/constants'
import { useWorldStore } from '@/scenes/outdoor/state/worldStore'

export function MiniMap () {
  const [isOpen, setIsOpen] = useState(false)
  const [hasOpened, setHasOpened] = useState(false)
  const [mapHint, setMapHint] = useState('Click land to teleport · Tab to close')
  const view = useWorldStore((state) => state.view)
  const requestTeleport = useWorldStore((state) => state.requestTeleport)
  const markerX = (view.x + WORLD_HALF_SIZE_METERS) / WORLD_SIZE_METERS * 100
  const markerY = (view.z + WORLD_HALF_SIZE_METERS) / WORLD_SIZE_METERS * 100
  const isInsideWorld = view.x >= WORLD_BOUNDS.minX &&
    view.x <= WORLD_BOUNDS.maxX &&
    view.z >= WORLD_BOUNDS.minZ &&
    view.z <= WORLD_BOUNDS.maxZ
  const terrainHeight = sampleTerrainHeight(view.x, view.z)

  function toggleMap () {
    setHasOpened(true)
    setIsOpen((value) => !value)
  }

  function teleportFromMap (event) {
    if (!isOpen || event.button !== 0) return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    const u = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width))
    const v = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height))
    const accepted = requestTeleport(
      WORLD_BOUNDS.minX + u * WORLD_SIZE_METERS,
      WORLD_BOUNDS.minZ + v * WORLD_SIZE_METERS
    )
    setMapHint(accepted ? 'Click land to teleport · Tab to close' : 'Cannot teleport to water. Choose a spot on land.')
  }

  useHotkeys(
    'tab',
    (event) => {
      if (event.repeat) return
      toggleMap()
    },
    {
      description: 'Show or hide the map',
      preventDefault: true
    }
  )

  return (
    <>
      <aside
        aria-hidden={!isOpen}
        aria-label='Terrain debug map'
        className={`fixed left-1/2 top-1/2 z-40 w-[min(30rem,calc(100vw-2.5rem))] -translate-x-1/2 -translate-y-1/2 origin-center transition duration-200 ${isOpen ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'}`}
      >
        <div className='rounded-lg border border-white/15 bg-[#101514]/85 p-3 text-white shadow-xl backdrop-blur-md'>
          <div className='mb-2 flex items-center justify-between text-[0.65rem] uppercase tracking-[0.18em] text-white/55'>
            <span>Terrain Debug</span>
            <span>{WORLD_SIZE_METERS} × {WORLD_SIZE_METERS} m</span>
          </div>

          <div
            className='relative aspect-square cursor-crosshair overflow-hidden rounded bg-[#293129]'
            title='Click the map to teleport'
            onClick={teleportFromMap}
          >
            {hasOpened && <TerrainMapCanvas />}
            <div className='absolute inset-x-0 top-1/2 h-px bg-white/10' />
            <div className='absolute inset-y-0 left-1/2 w-px bg-white/10' />
            <span className='absolute left-1/2 top-2 -translate-x-1/2 text-[0.6rem] font-medium text-white/70'>N</span>
            <span className='absolute right-2 top-1/2 -translate-y-1/2 text-[0.6rem] font-medium text-white/70'>E</span>
            <span className='absolute bottom-2 left-1/2 -translate-x-1/2 text-[0.6rem] font-medium text-white/70'>S</span>
            <span className='absolute left-2 top-1/2 -translate-y-1/2 text-[0.6rem] font-medium text-white/70'>W</span>

            {isInsideWorld && (
              <div
                className='absolute h-4 w-4'
                style={{
                  left: `${markerX}%`,
                  top: `${markerY}%`,
                  transform: `translate(-50%, -50%) rotate(${view.heading}rad)`
                }}
              >
                <div className='mx-auto h-0 w-0 border-x-[5px] border-b-[12px] border-x-transparent border-b-white drop-shadow' />
              </div>
            )}
          </div>

          <div className='mt-2 flex items-center justify-between gap-4 font-mono text-[0.65rem] tabular-nums text-white/45'>
            <span>X {view.x.toFixed(1)} · Z {view.z.toFixed(1)} · H {terrainHeight.toFixed(1)} m</span>
            <span>Seed {TERRAIN_GENERATION.seed}</span>
          </div>
          <div className='mt-2 flex items-center gap-2 text-[0.6rem] text-white/40'>
            <span>Low</span>
            <div className='h-1 flex-1 rounded-full bg-gradient-to-r from-[#263528] via-[#7e8456] to-[#d5d0b2]' />
            <span>High</span>
          </div>
          <div className='mt-2 text-center text-[0.65rem] text-white/50'>
            {mapHint}
          </div>
        </div>
      </aside>

      <button
        type='button'
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Close map' : 'Open map'}
        className='fixed bottom-5 left-5 z-40 flex items-center gap-2 rounded border border-white/15 bg-black/45 px-2.5 py-1.5 text-[0.65rem] uppercase tracking-[0.14em] text-white/70 backdrop-blur-sm transition hover:bg-black/60 hover:text-white'
        onClick={toggleMap}
      >
        <kbd className='font-mono text-white'>Tab</kbd>
        <span>Map</span>
      </button>
    </>
  )
}
