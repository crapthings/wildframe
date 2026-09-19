import { OutdoorScene } from '@/scenes/outdoor/OutdoorScene'
import { LoadingScreen } from '@/scenes/outdoor/ui/loading/LoadingScreen'
import { MiniMap } from '@/scenes/outdoor/ui/map/MiniMap'
import { TerrainLoading } from '@/scenes/outdoor/ui/loading/TerrainLoading'
import { useWorldStore } from '@/scenes/outdoor/state/worldStore'
import { DayNightSwitch } from '@/scenes/outdoor/ui/DayNightSwitch'

export function App () {
  const entered = useWorldStore((state) => state.sceneEntered)
  return (
    <main className='fixed inset-0 bg-slate-50'>
      <OutdoorScene />
      {entered && <MiniMap />}
      {entered && <DayNightSwitch />}
      <TerrainLoading />
      <LoadingScreen />
    </main>
  )
}
