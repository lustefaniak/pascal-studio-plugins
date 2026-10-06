import type { NodeDefinition } from '@pascal-app/core'
import { buildCameraFloorplan } from './floorplan'
import { cameraParametrics } from './parametrics'
import { StudioCameraNode } from './schema'

type CameraDefinition = NodeDefinition<typeof StudioCameraNode> & Record<string, unknown>

/**
 * A saved shot as a scene node.
 *
 * Deliberately not `floorPlaced`: a camera hangs at eye height and must not be
 * lifted onto whatever slab happens to be under it. It is movable on all three
 * axes so height can be dragged, and rotatable on Y only — a rolled camera is
 * never what anyone wants here.
 */
export const cameraDefinition: CameraDefinition = {
  kind: 'studio:camera',
  schemaVersion: 1,
  schema: StudioCameraNode,
  category: 'furnish',
  snapProfile: 'item',

  defaults: () => ({
    object: 'node',
    parentId: null,
    visible: true,
    metadata: {},
    position: [0, 1.35, 0],
    rotation: [0, 0, 0],
    fov: 62,
    pitch: 0,
    projection: 'eye',
    shot: 0,
    room: '',
    hide: [],
    clip: 0,
  }),

  capabilities: {
    movable: { axes: ['x', 'y', 'z'], gridSnap: false },
    rotatable: { axes: ['y'] },
    selectable: { hitVolume: 'bbox' },
    duplicable: true,
    deletable: true,
    groupable: true,
  },

  parametrics: cameraParametrics,
  floorplan: buildCameraFloorplan,

  renderer: { kind: 'parametric', module: () => import('./renderer') },
  // The system is the capture engine. It is mounted per registered kind rather
  // than per node, so it runs even in a scene with no cameras yet — that is
  // what lets it listen for render requests from an agent.
  system: { module: () => import('./capture-system'), priority: 8 },

  presentation: {
    label: 'Camera (shot)',
    description: 'A saved frame: position, lens and shot number.',
    icon: { kind: 'iconify', name: 'lucide:camera' },
    paletteSection: 'furnish',
  },

  mcp: {
    description:
      'A saved camera shot. Position, yaw (rotation[1], 0 looks south/+z), fov and pitch in degrees, ' +
      'plus a stable shot number and room id used by the review app. Rendered by the Studio plugin ' +
      'through the host snapshot pipeline; markers sit on the overlay layer and never appear in a render.',
  },
}
