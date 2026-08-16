export function wrap(n, max) {
  return (n + max) % max
}

export function wrappedDelta(value, size) {
  let d = value % size
  if (d > size / 2) d -= size
  if (d < -size / 2) d += size
  return d
}

export function wrappedManhattanDistance(ax, ay, bx, by, width, height) {
  const dx = Math.abs(wrappedDelta(ax - bx, width))
  const dy = Math.abs(wrappedDelta(ay - by, height))
  return dx + dy
}
