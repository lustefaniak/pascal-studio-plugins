import { BaseNode, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'

/**
 * Where a note's conversation stands, which is also whose turn it is.
 *
 * - `open` — the person wrote last; waiting for the agent.
 * - `thinking` — the agent picked it up and is working on it.
 * - `answered` — the agent replied (done, or asking back); waiting for the person.
 * - `archived` — settled. Kept in the scene as a record, not drawn in the viewport.
 */
export const NoteStatus = z.enum(['open', 'thinking', 'answered', 'archived'])
export type NoteStatus = z.infer<typeof NoteStatus>

export const NoteAuthor = z.enum(['user', 'agent'])
export type NoteAuthor = z.infer<typeof NoteAuthor>

export const NoteMessage = z.object({
  author: NoteAuthor,
  text: z.string(),
  /** ISO 8601 timestamp. */
  at: z.string(),
})
export type NoteMessage = z.infer<typeof NoteMessage>

/**
 * A note pinned to a place in the scene: a small conversation about what to
 * change there.
 *
 * The point of a note being a node is that it carries the "where" by itself.
 * Describing a change in words ("the second cabinet from the window, move it
 * left a bit") is slow and ambiguous; a pin standing on the spot, optionally
 * tied to the node it is about, is neither. Anything that reads the scene graph
 * — an agent over the editor's HTTP API — sees the note, its position, its
 * target and the whole thread.
 */
export const StudioNoteNode = BaseNode.extend({
  id: objectId('note'),
  type: nodeType('studio:note'),
  position: z.tuple([z.number(), z.number(), z.number()]).default([0, 1.2, 0]),
  /** Node id the note is about, or empty when it is about the place itself. */
  target: z.string().default(''),
  status: NoteStatus.default('open'),
  thread: z.array(NoteMessage).default([]),
})

export type StudioNoteNode = z.infer<typeof StudioNoteNode>
