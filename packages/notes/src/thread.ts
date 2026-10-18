import type { NoteMessage, NoteStatus, StudioNoteNode } from './schema'

/** One colour per status, shared by the pin, the plan dot and the panel badge. */
export const STATUS_COLOR: Record<NoteStatus, string> = {
  open: '#3b82f6',
  thinking: '#f59e0b',
  answered: '#22c55e',
  archived: '#8b8f98',
}

export const STATUS_LABEL: Record<NoteStatus, string> = {
  open: 'waiting for agent',
  thinking: 'agent working',
  answered: 'your turn',
  archived: 'archived',
}

/** The node's name if set, otherwise the first line of the first message. */
export function noteTitle(note: Pick<StudioNoteNode, 'name' | 'thread'>): string {
  if (note.name) return note.name
  const first = note.thread[0]?.text.split('\n')[0]?.trim() ?? ''
  if (!first) return 'Empty note'
  return first.length > 60 ? `${first.slice(0, 59).trimEnd()}…` : first
}

/**
 * The person's reply: appended to the thread, and the turn goes back to the
 * agent — including on an archived note, which writing to reopens.
 */
export function withUserMessage(
  note: Pick<StudioNoteNode, 'thread'>,
  text: string,
  now = new Date(),
): { thread: NoteMessage[]; status: NoteStatus } {
  return {
    thread: [...note.thread, { author: 'user', text: text.trim(), at: now.toISOString() }],
    status: 'open',
  }
}

/** Notes that still need someone: the agent's queue first, then the person's. */
export function activeOrder(a: StudioNoteNode, b: StudioNoteNode): number {
  const rank: Record<NoteStatus, number> = { thinking: 0, open: 1, answered: 2, archived: 3 }
  return rank[a.status] - rank[b.status] || lastAt(b).localeCompare(lastAt(a))
}

export function lastAt(note: Pick<StudioNoteNode, 'thread'>): string {
  return note.thread.at(-1)?.at ?? ''
}
