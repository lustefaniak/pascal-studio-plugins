import type { ParametricDescriptor } from '@pascal-app/core'
import type { StudioNoteNode } from './schema'

/**
 * The inspector shows only what is set by hand. The thread is edited in the
 * Notes panel, where it reads as a conversation rather than as a list field.
 */
export const noteParametrics: ParametricDescriptor<StudioNoteNode> = {
  groups: [
    {
      label: 'Note',
      fields: [
        {
          key: 'status',
          kind: 'enum',
          options: ['open', 'thinking', 'answered', 'archived'],
        },
      ],
    },
    {
      label: 'Position',
      fields: [{ key: 'position', kind: 'vec3' }],
    },
  ],
}
