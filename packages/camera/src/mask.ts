/**
 * Room masks: the plan area a shot keeps when it shows only some rooms.
 *
 * A zone outline sits on the wall axes, so the area is the outline grown by a
 * margin that keeps the room's own walls and wall tiles whole (or, for an
 * oblique view, moved in on the camera side). The area is returned as disjoint
 * axis-aligned rectangles, because a clipping region in the renderer is
 * convex: one rectangle is four planes, and a non-convex room (an L, a niche)
 * is drawn once per rectangle.
 *
 * Pure plan maths, no three, so it is tested without a renderer. The Blender
 * engine (`blender_render.py` in the worker) runs the same decomposition.
 */

/**
 * A rectangle on the plan: x east, z south, metres. `top`, when set, keeps only
 * what lies below that height (the cutaway band).
 */
export type PlanRect = { x0: number; x1: number; z0: number; z1: number; top?: number }

/** How far the kept area reaches past the zone outline, in metres. */
export const MASK_MARGIN = 0.14

/** Default height the near walls of an oblique shot are cut down to, metres. */
export const CUTAWAY_HEIGHT = 0.9

const EPS = 1e-6

/**
 * Cut a simple polygon into vertical strips at its vertices and return the
 * inside of each strip as rectangles, merged across strips where they line up.
 * Exact for rectilinear outlines; a slanted edge is approximated by its value
 * in the middle of the strip.
 */
export function polygonRects(polygon: readonly (readonly [number, number])[]): PlanRect[] {
  if (polygon.length < 3) return []
  const xs = [...new Set(polygon.map((p) => p[0]))].sort((a, b) => a - b)
  const strips: PlanRect[] = []
  for (let i = 0; i + 1 < xs.length; i++) {
    const xa = xs[i] as number
    const xb = xs[i + 1] as number
    if (xb - xa < EPS) continue
    const xm = (xa + xb) / 2
    const crossings: number[] = []
    for (let j = 0; j < polygon.length; j++) {
      const p = polygon[j] as readonly [number, number]
      const q = polygon[(j + 1) % polygon.length] as readonly [number, number]
      if (p[0] > xm === q[0] > xm) continue
      crossings.push(p[1] + ((xm - p[0]) * (q[1] - p[1])) / (q[0] - p[0]))
    }
    crossings.sort((a, b) => a - b)
    for (let k = 0; k + 1 < crossings.length; k += 2) {
      const z0 = crossings[k] as number
      const z1 = crossings[k + 1] as number
      if (z1 - z0 > EPS) strips.push({ x0: xa, x1: xb, z0, z1 })
    }
  }
  // Merge a strip into the rectangle that ends where it starts with the same z span.
  const merged: PlanRect[] = []
  for (const strip of strips) {
    const open = merged.find(
      (r) =>
        Math.abs(r.x1 - strip.x0) < EPS &&
        Math.abs(r.z0 - strip.z0) < EPS &&
        Math.abs(r.z1 - strip.z1) < EPS,
    )
    if (open) open.x1 = strip.x1
    else merged.push({ ...strip })
  }
  return merged
}

/**
 * Move every edge of a simple polygon along its outward normal by
 * `distance(normal)` (negative moves it inwards) and join neighbouring edges
 * where their lines meet: a mitred offset, square corners on a rectilinear
 * outline. Collinear and repeated points are dropped first, because two
 * edges on one line have no meeting point.
 */
export function offsetPolygon(
  polygon: readonly (readonly [number, number])[],
  distance: (normal: [number, number]) => number,
): [number, number][] {
  const points: [number, number][] = []
  for (const p of polygon) {
    const last = points[points.length - 1]
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > EPS) points.push([p[0], p[1]])
  }
  if (points.length > 1) {
    const [a, b] = [points[0] as [number, number], points[points.length - 1] as [number, number]]
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) <= EPS) points.pop()
  }
  const corners = points.filter((p, i) => {
    const prev = points[(i + points.length - 1) % points.length] as [number, number]
    const next = points[(i + 1) % points.length] as [number, number]
    const cross = (p[0] - prev[0]) * (next[1] - p[1]) - (p[1] - prev[1]) * (next[0] - p[0])
    return Math.abs(cross) > EPS
  })
  const n = corners.length
  if (n < 3) return corners
  let area = 0
  for (let i = 0; i < n; i++) {
    const p = corners[i] as [number, number]
    const q = corners[(i + 1) % n] as [number, number]
    area += p[0] * q[1] - q[0] * p[1]
  }
  // Edge i runs from corner i to corner i+1, moved out along its normal.
  const lines = corners.map((p, i) => {
    const q = corners[(i + 1) % n] as [number, number]
    const length = Math.hypot(q[0] - p[0], q[1] - p[1])
    const d: [number, number] = [(q[0] - p[0]) / length, (q[1] - p[1]) / length]
    const normal: [number, number] = area > 0 ? [d[1], -d[0]] : [-d[1], d[0]]
    const shift = distance(normal)
    return { p: [p[0] + normal[0] * shift, p[1] + normal[1] * shift] as [number, number], d }
  })
  return lines.map((line, i) => {
    const prev = lines[(i + n - 1) % n] as typeof line
    // Solve prev.p + s·prev.d = line.p + t·line.d for the shared corner.
    const det = prev.d[0] * line.d[1] - prev.d[1] * line.d[0]
    const dx = line.p[0] - prev.p[0]
    const dz = line.p[1] - prev.p[1]
    const s = (dx * line.d[1] - dz * line.d[0]) / det
    return [prev.p[0] + s * prev.d[0], prev.p[1] + s * prev.d[1]] as [number, number]
  })
}

/** `a` minus `b`, as up to four disjoint rectangles; `a`'s cutaway height carries over. */
export function rectMinus(a: PlanRect, b: PlanRect): PlanRect[] {
  if (a.x0 >= b.x1 - EPS || a.x1 <= b.x0 + EPS || a.z0 >= b.z1 - EPS || a.z1 <= b.z0 + EPS) {
    return [a]
  }
  const pieces: PlanRect[] = []
  const x0 = Math.max(a.x0, b.x0)
  const x1 = Math.min(a.x1, b.x1)
  if (b.x0 - a.x0 > EPS) pieces.push({ ...a, x1: b.x0 })
  if (a.x1 - b.x1 > EPS) pieces.push({ ...a, x0: b.x1 })
  if (b.z0 - a.z0 > EPS) pieces.push({ ...a, x0, x1, z1: b.z0 })
  if (a.z1 - b.z1 > EPS) pieces.push({ ...a, x0, x1, z0: b.z1 })
  return pieces
}

/** Where a shot that looks down at an angle sits, for the cutaway. */
export type Cutaway = {
  /** Plan direction from the room to the camera, unit length. */
  toward: readonly [number, number]
  /** Height in metres the walls facing the camera are cut down to. */
  height: number
}

/**
 * The kept area of a shot: every masked zone's outline grown by `margin`, cut
 * into disjoint rectangles. Unknown ids and nodes that are not zones are
 * skipped; an empty result means "no mask".
 *
 * With a `cutaway`, the band along the outline edges that face the camera
 * (from `margin` inside the outline to `margin` outside it) keeps only what is
 * below `cutaway.height`: the near walls, their tiles, doors and whatever stands
 * against them are cut down, the far walls stay full height, and the floor
 * stays. Without it a wall in front of the camera hides the room.
 */
export function maskRects(
  nodes: Record<string, unknown>,
  zoneIds: readonly string[],
  cutaway?: Cutaway,
  margin = MASK_MARGIN,
): PlanRect[] {
  const grown = (_: [number, number]) => margin
  const toward = cutaway?.toward
  const inset = (normal: [number, number]) =>
    toward && normal[0] * toward[0] + normal[1] * toward[1] > 0.3 ? -margin : margin
  const rects: PlanRect[] = []
  for (const id of zoneIds) {
    const zone = nodes[id] as { type?: string; polygon?: [number, number][] } | undefined
    if (zone?.type !== 'zone' || !Array.isArray(zone.polygon)) continue
    const outer = polygonRects(offsetPolygon(zone.polygon, grown))
    if (!cutaway) {
      rects.push(...outer)
      continue
    }
    const inner = polygonRects(offsetPolygon(zone.polygon, inset))
    let band: PlanRect[] = outer.map((r) => ({ ...r, top: cutaway.height }))
    for (const hole of inner) band = band.flatMap((r) => rectMinus(r, hole))
    rects.push(...inner, ...band)
  }
  return rects
}

/** How a box relates to the kept area: drop it, keep it whole, or cut it per rectangle. */
export function classify(
  box: PlanRect & { y0?: number; y1?: number },
  rects: readonly PlanRect[],
): { kind: 'outside' } | { kind: 'inside' } | { kind: 'cut'; rects: PlanRect[] } {
  const y0 = box.y0 ?? Number.NEGATIVE_INFINITY
  const y1 = box.y1 ?? Number.POSITIVE_INFINITY
  const hits = rects.filter(
    (r) =>
      box.x0 < r.x1 - EPS &&
      box.x1 > r.x0 + EPS &&
      box.z0 < r.z1 - EPS &&
      box.z1 > r.z0 + EPS &&
      (r.top === undefined || y0 < r.top - EPS),
  )
  if (hits.length === 0) return { kind: 'outside' }
  const within = hits.some(
    (r) =>
      box.x0 >= r.x0 - EPS &&
      box.x1 <= r.x1 + EPS &&
      box.z0 >= r.z0 - EPS &&
      box.z1 <= r.z1 + EPS &&
      (r.top === undefined || y1 <= r.top + EPS),
  )
  return within ? { kind: 'inside' } : { kind: 'cut', rects: hits }
}
