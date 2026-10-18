import type { FloorplanGeometry, GeometryContext } from '@pascal-app/core'
import type { StudioNoteNode } from './schema'
import { STATUS_COLOR } from './thread'

/**
 * A note on the 2D plan: a dot in its status colour. Most notes are about a
 * layout, and the plan is where a layout is judged, so the pins have to be
 * there too. Archived notes are left off.
 */
export function buildNoteFloorplan(node: StudioNoteNode, ctx: GeometryContext): FloorplanGeometry {
  const [x, , z] = node.position
  const selected = (ctx as { selected?: boolean }).selected === true
  if (node.status === 'archived') return { kind: 'group', children: [] }

  const colour = STATUS_COLOR[node.status]
  const children: FloorplanGeometry[] = [
    {
      kind: 'circle',
      cx: x,
      cy: z,
      r: 0.16,
      fill: colour,
      fillOpacity: 0.18,
      stroke: colour,
      strokeWidth: 0.02,
    },
    {
      kind: 'circle',
      cx: x,
      cy: z,
      r: 0.07,
      fill: colour,
      fillOpacity: 0.95,
      stroke: '#ffffff',
      strokeWidth: 0.015,
    },
  ]
  if (selected) children.push({ kind: 'move-handle', point: [x, z] })
  return { kind: 'group', children }
}
