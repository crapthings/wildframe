// Keep outgoing geometry briefly for reversals; never grow the cache unbounded.
export function updateRetirement (cache, wanted, retirement, now, graceMs) {
  const active = new Set(wanted.map((chunk) => chunk.key))
  for (const key of active) retirement.delete(key)
  for (const key of cache.keys()) {
    if (!active.has(key) && !retirement.has(key)) retirement.set(key, now + graceMs)
  }
}

export function nextRetirement (retirement, now, pressure) {
  for (const [key, deadline] of retirement) {
    if (pressure || now >= deadline) return key
  }
  return null
}
