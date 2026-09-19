// Bounded, development-only history. No per-frame React/Zustand updates.
const events = []

export function recordTerrainEvent (type, detail, time = performance.now()) {
  if (!import.meta.env.DEV) return
  events.push({ time, type, ...detail })
  if (events.length > 200) events.shift()
}

export function recentTerrainEvents (now, windowMs = 250) {
  return events.filter((event) => event.time <= now && now - (event.time + (event.durationMs || 0)) < windowMs)
}

export function clearTerrainEvents () {
  events.length = 0
}
