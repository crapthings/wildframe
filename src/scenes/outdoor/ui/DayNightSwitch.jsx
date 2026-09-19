import { useWorldStore } from '../state/worldStore'

export function DayNightSwitch () {
  const timeOfDay = useWorldStore((state) => state.timeOfDay)
  const setTimeOfDay = useWorldStore((state) => state.setTimeOfDay)
  const raining = useWorldStore((state) => state.raining)
  const toggleRain = useWorldStore((state) => state.toggleRain)
  return (
    <div role='group' aria-label='Time of day and weather' className='absolute left-4 top-4 z-40 flex gap-1 rounded-lg border border-white/15 bg-black/35 p-1 text-xs text-white/70 backdrop-blur-sm'>
      {[['day', 'Day'], ['night', 'Night']].map(([value, label]) => (
        <button key={value} type='button' aria-pressed={timeOfDay === value} onClick={() => setTimeOfDay(value)} className={`rounded-md px-3 py-2 transition-colors focus-visible:outline focus-visible:outline-white/80 ${timeOfDay === value ? 'bg-white/20 text-white' : 'hover:bg-white/10'}`}>
          {label}
        </button>
      ))}
      <button type='button' role='switch' aria-checked={raining} aria-label='Rain' onClick={toggleRain} className={`ml-1 rounded-md border-l border-white/15 px-3 py-2 focus-visible:outline focus-visible:outline-white/80 ${raining ? 'bg-white/20 text-white' : 'hover:bg-white/10'}`}>
        Rain {raining ? 'On' : 'Off'}
      </button>
    </div>
  )
}
