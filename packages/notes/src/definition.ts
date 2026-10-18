import type { NodeDefinition } from '@pascal-app/core'
import { buildNoteFloorplan } from './floorplan'
import { noteParametrics } from './parametrics'
import { StudioNoteNode } from './schema'

type NoteDefinition = NodeDefinition<typeof StudioNoteNode> & Record<string, unknown>

/**
 * A note as a scene node. Not `floorPlaced`: a pin hangs where it was put —
 * at the height of a socket, over a worktop — and must not be dropped onto the
 * slab. Movable on all three axes, never rotated.
 */
export const noteDefinition: NoteDefinition = {
  kind: 'studio:note',
  schemaVersion: 1,
  schema: StudioNoteNode,
  category: 'furnish',
  snapProfile: 'item',

  defaults: () => ({
    object: 'node',
    parentId: null,
    visible: true,
    metadata: {},
    position: [0, 1.2, 0],
    target: '',
    status: 'open',
    thread: [],
  }),

  capabilities: {
    movable: { axes: ['x', 'y', 'z'], gridSnap: false },
    selectable: { hitVolume: 'bbox' },
    duplicable: false,
    deletable: true,
    groupable: false,
  },

  parametrics: noteParametrics,
  floorplan: buildNoteFloorplan,

  renderer: { kind: 'parametric', module: () => import('./renderer') },
  // Click-to-pin needs the canvas, so it lives in a system; mounted per kind,
  // it is there before the first note exists.
  system: { module: () => import('./pick-system'), priority: 9 },

  presentation: {
    label: 'Note',
    description: 'A pinned conversation about what to change here.',
    icon: { kind: 'iconify', name: 'lucide:message-square' },
    paletteSection: 'furnish',
  },

  mcp: {
    description:
      'A note pinned in the scene: a conversation between the person and an agent about a change ' +
      'at this spot. `target` is the id of the node it is about (may be empty), `thread` the ' +
      'messages ({author: user|agent, text, at}), `metadata.view` where the person stood when pinning ' +
      '(position, yaw; 0 looks south/+z) and `metadata.normal` the surface it was pinned on. ' +
      '`status` says whose turn it is: open = waiting for the ' +
      'agent, thinking = the agent is on it, answered = waiting for the person, archived = settled. ' +
      'An agent picks up an open note by setting thinking, does the change, then appends its reply ' +
      'and sets answered. It archives only when the person says the matter is closed.',
  },
}
