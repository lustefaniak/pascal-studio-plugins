import type { FloorplanGeometry, GeometryContext } from '@pascal-app/core'
import type { StudioCameraNode } from './schema'

const CAMERA_COLOR = '#f2b134'

/**
 * The camera drawn on the 2D plan: a dot for the eye and a wedge for what it
 * sees. Aiming a shot is a plan-view job — you place it against the walls of
 * the room, not by orbiting in 3D — so the wedge is the thing that makes the
 * plan usable for framing.
 */
export function buildCameraFloorplan(
  node: StudioCameraNode,
  ctx: GeometryContext,
): FloorplanGeometry {
  const [x, , z] = node.position
  const yaw = node.rotation[1]
  const selected = (ctx as { selected?: boolean }).selected === true

  const children: FloorplanGeometry[] = []

  if (node.projection === 'top') {
    // A top-down shot has no bearing worth drawing; show its coverage instead.
    children.push({
      kind: 'circle',
      cx: x,
      cy: z,
      r: 0.45,
      fill: CAMERA_COLOR,
      fillOpacity: 0.12,
      stroke: CAMERA_COLOR,
      strokeWidth: 0.03,
      strokeDasharray: '0.12 0.08',
    })
  } else {
    const reach = 2.2
    const half = (node.fov * Math.PI) / 360
    const left = yaw - half
    const right = yaw + half
    children.push({
      kind: 'polygon',
      points: [
        [x, z],
        [x + Math.sin(left) * reach, z + Math.cos(left) * reach],
        [x + Math.sin(right) * reach, z + Math.cos(right) * reach],
      ],
      fill: CAMERA_COLOR,
      fillOpacity: 0.14,
      stroke: CAMERA_COLOR,
      strokeWidth: 0.02,
    })
  }

  children.push({
    kind: 'circle',
    cx: x,
    cy: z,
    r: 0.11,
    fill: CAMERA_COLOR,
    fillOpacity: 0.9,
    stroke: '#2b2f38',
    strokeWidth: 0.02,
  })

  if (selected) children.push({ kind: 'move-handle', point: [x, z] })
  return { kind: 'group', children }
}
