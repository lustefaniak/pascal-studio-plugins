import type { StudioCameraNode } from './schema'

export type Framing = {
  position: [number, number, number]
  target: [number, number, number]
  /** Vertical field of view in degrees, ready for THREE.PerspectiveCamera. */
  fov: number
  /** lookAt needs a roll reference; straight down is the one case where +y is degenerate. */
  up: [number, number, number]
}

const DEG = Math.PI / 180

/**
 * Where the camera looks. Yaw 0 faces +z, which is south on the floor plan —
 * the same convention the plan-derived geometry uses, so a bearing read off
 * the drawing can be typed straight in.
 */
export function framingOf(node: StudioCameraNode, _aspect: number): Framing {
  const [x, y, z] = node.position
  const yaw = node.rotation[1]
  const isTop = node.projection === 'top'
  const pitch = (isTop ? -90 : node.pitch) * DEG

  const horizontal = Math.cos(pitch)
  const dir: [number, number, number] = [
    Math.sin(yaw) * horizontal,
    Math.sin(pitch),
    Math.cos(yaw) * horizontal,
  ]

  // A metre of throw is enough: only the direction matters to lookAt.
  const target: [number, number, number] = [x + dir[0], y + dir[1], z + dir[2]]

  return {
    position: [x, y, z],
    target,
    fov: node.fov,
    // Looking straight down, +y is parallel to the view direction and lookAt
    // degenerates; -z keeps plan north at the top of the frame.
    up: isTop ? [0, 0, -1] : [0, 1, 0],
  }
}

/**
 * Vertical fov to put on the capture camera so the *finished file* ends up with
 * `fov` vertically and `2·atan(tan(fov/2)·requested)` horizontally.
 *
 * The snapshot pipeline renders into a target the size of the editor canvas and
 * only then centre-crops that frame to the requested aspect. So the camera has
 * to be set up for the canvas, never for the output: an aspect that disagrees
 * with the render target stretches the picture, and the crop eats the sides on
 * top of that. Both are invisible in a single image and both re-crop shots that
 * already carry review notes.
 *
 * `camera.aspect` therefore takes `canvas`, and the fov compensates for whatever
 * the crop is about to remove.
 */
export function captureFov({
  fov,
  requested,
  canvas,
}: {
  fov: number
  requested: number
  canvas: number
}): number {
  // Canvas at least as wide as the output: the crop takes the sides, the full
  // height survives, and the vertical fov is already the one asked for.
  if (!Number.isFinite(canvas) || canvas <= 0 || canvas >= requested) return fov
  // Narrower canvas: the crop takes the top and bottom instead, so the frame has
  // to open up vertically for the intended width to make it into the file.
  return (2 * Math.atan(Math.tan((fov * DEG) / 2) * (requested / canvas))) / DEG
}

/**
 * Eye height for a top-down shot that has to contain `extent` (metres, [x, z])
 * around its centre.
 *
 * Measured from the ceiling rather than the floor: framing from the floor cuts
 * the tops of the walls off, because the walls reach up towards the camera.
 *
 * `fov` is vertical, matching THREE.PerspectiveCamera and the shot heights the
 * earlier Python tooling produced — reading it as horizontal instead narrows
 * every frame by the aspect ratio and silently re-crops shots that already had
 * review notes on them.
 */
export function topDownHeight({
  extent,
  ceiling,
  fov,
  aspect,
}: {
  extent: [number, number]
  ceiling: number
  fov: number
  aspect: number
}): number {
  const halfVertical = Math.tan((fov * DEG) / 2)
  const halfHorizontal = halfVertical * aspect
  const byDepth = extent[1] / 2 / Math.max(halfVertical, 0.0001)
  const byWidth = extent[0] / 2 / Math.max(halfHorizontal, 0.0001)
  return ceiling + Math.max(byDepth, byWidth)
}
