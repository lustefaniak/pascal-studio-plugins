import type { AnyNodeDefinition, Plugin } from '@pascal-app/core'
import { noteDefinition } from './definition'

/**
 * Notes — conversations pinned in the scene.
 *
 * Asking an agent for a change in a 3D model used to mean describing the spot
 * in words. A note stands on the spot instead, optionally tied to the node it
 * is about, and carries a thread with a status that says whose turn it is, so
 * the agent reads the queue straight from the scene graph and answers in place.
 */
export const notesPlugin: Plugin = {
  id: 'studio:note',
  apiVersion: 1,
  nodes: [noteDefinition as unknown as AnyNodeDefinition],
}

export const notesHostPanel = {
  id: 'studio:note:panel',
  pluginId: notesPlugin.id,
  label: 'Notes',
  description: 'Pinned notes for an agent: what to change and where, as a conversation.',
  icon: { kind: 'iconify' as const, name: 'lucide:message-square' },
  component: () => import('./panel'),
  kinds: ['studio:note'],
  creator: { name: 'Łukasz Stefaniak', url: 'https://github.com/lustefaniak' },
  pluginUrl: 'https://github.com/lustefaniak/pascal-studio-plugins/tree/main/packages/notes',
  defaultInstalled: true,
}

export { noteDefinition } from './definition'
export { NoteMessage, NoteStatus, StudioNoteNode } from './schema'
export { noteTitle, STATUS_COLOR, withUserMessage } from './thread'
