import { describe, expect, test } from 'bun:test'
import { notesHostPanel, notesPlugin } from './index'
import { StudioNoteNode } from './schema'
import { activeOrder, noteTitle, withUserMessage } from './thread'

describe('studio:note manifest', () => {
  test('contributes the studio:note kind on plugin API v1', () => {
    expect(notesPlugin.apiVersion).toBe(1)
    expect(notesPlugin.nodes?.map((definition) => definition.kind)).toEqual(['studio:note'])
    expect(notesHostPanel.pluginId).toBe(notesPlugin.id)
  })
})

describe('note thread', () => {
  const at = new Date('2026-10-18T10:00:00Z')
  const note = StudioNoteNode.parse({
    id: 'note_abc',
    type: 'studio:note',
    thread: [{ author: 'agent', text: 'Moved it.', at: at.toISOString() }],
    status: 'archived',
  })

  test('a reply hands the turn back to the agent, also reopening an archived note', () => {
    const next = withUserMessage(note, '  one more cm  ', at)
    expect(next.status).toBe('open')
    expect(next.thread.at(-1)).toEqual({
      author: 'user',
      text: 'one more cm',
      at: at.toISOString(),
    })
  })

  test('title falls back to the first line of the thread', () => {
    expect(noteTitle({ name: undefined, thread: [] })).toBe('Empty note')
    expect(noteTitle(note)).toBe('Moved it.')
  })

  test('the agent queue sorts before the person’s', () => {
    const open = StudioNoteNode.parse({ id: 'note_a', type: 'studio:note', status: 'open' })
    const answered = StudioNoteNode.parse({ id: 'note_b', type: 'studio:note', status: 'answered' })
    expect([answered, open].sort(activeOrder).map((n) => n.status)).toEqual(['open', 'answered'])
  })
})
