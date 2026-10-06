import { ROOM_IDS } from '@lustefaniak/pascal-studio-core/rooms'
import type { ParametricDescriptor } from '@pascal-app/core'
import type { StudioCameraNode } from './schema'

/**
 * The lens, in the host's inspector. These numbers used to live in a
 * `metadata` blob on an item node and be re-read by a Python script; declaring
 * them here means the host renders the whole panel and every edit is a normal
 * undoable scene change.
 */
export const cameraParametrics: ParametricDescriptor<StudioCameraNode> = {
  groups: [
    {
      label: 'Framing',
      fields: [
        { key: 'projection', kind: 'enum', options: ['eye', 'top'], display: 'segmented' },
        {
          key: 'fov',
          kind: 'number',
          unit: '°',
          min: 10,
          max: 150,
          step: 1,
        },
        {
          key: 'pitch',
          kind: 'number',
          unit: '°',
          min: -90,
          max: 90,
          step: 1,
          // A top-down shot pins the tilt at -90; showing an editable field
          // that the capture ignores would just mislead.
          visibleIf: (node) => node.projection !== 'top',
        },
        // Section plane distance; the marker draws the plane so it can be set by eye.
        { key: 'clip', kind: 'number', unit: 'm', min: 0, max: 30, step: 0.05 },
      ],
    },
    {
      label: 'Shot',
      fields: [
        { key: 'shot', kind: 'number', min: 0, max: 9999, step: 1 },
        { key: 'room', kind: 'enum', options: ROOM_IDS },
      ],
    },
    {
      label: 'Position',
      fields: [{ key: 'position', kind: 'vec3' }],
    },
  ],
}
