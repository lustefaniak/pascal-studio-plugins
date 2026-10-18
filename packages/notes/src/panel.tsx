'use client'

import { S, useStudioStore } from '@lustefaniak/pascal-studio-core'
import { type AnyNode, type AnyNodeId, sceneRegistry, useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { useMemo, useState } from 'react'
import { Box3, Vector3 } from 'three'
import type { StudioNoteNode } from './schema'
import { useNotesStore } from './store'
import {
  activeOrder,
  lastAt,
  noteTitle,
  STATUS_COLOR,
  STATUS_LABEL,
  withUserMessage,
} from './thread'

type Tab = 'active' | 'archive'

/**
 * A note on the selected thing: on top of its box, tied to it. The box is read
 * from the scene registry and brought into the level's frame, the note's parent.
 * Clicking the spot (the pick system) is the usual way; this one is for a node
 * picked in the outliner or one too small to hit.
 */
function onTopOf(selectedId: string, levelId: string): [number, number, number] | null {
  const object = sceneRegistry.nodes.get(selectedId)
  if (!object) return null
  const box = new Box3().setFromObject(object)
  if (box.isEmpty()) return null
  const top = new Vector3(
    (box.min.x + box.max.x) / 2,
    box.max.y + 0.05,
    (box.min.z + box.max.z) / 2,
  )
  sceneRegistry.nodes.get(levelId)?.worldToLocal(top)
  return [top.x, top.y, top.z]
}

export default function NotesPanel() {
  const nodes = useScene((state) => state.nodes)
  const levelId = useViewer((state) => state.selection.levelId)
  const selectedIds = useViewer((state) => state.selection.selectedIds)
  const view = useStudioStore((state) => state.view)
  const [tab, setTab] = useState<Tab>('active')
  const [draft, setDraft] = useState('')

  const notes = useMemo(
    () =>
      Object.values(nodes as Record<string, { type?: string }>).filter(
        (node): node is StudioNoteNode => node.type === 'studio:note',
      ),
    [nodes],
  )
  const active = notes.filter((note) => note.status !== 'archived').sort(activeOrder)
  const archived = notes
    .filter((note) => note.status === 'archived')
    .sort((a, b) => lastAt(b).localeCompare(lastAt(a)))

  const selectedId = selectedIds?.length === 1 ? (selectedIds[0] as string) : undefined
  const selectedNode = selectedId
    ? (nodes as Record<string, { type?: string; name?: string }>)[selectedId]
    : undefined
  // Pinning a note onto a note makes no sense; treat it as nothing selected.
  const anchor = selectedNode && selectedNode.type !== 'studio:note' ? selectedId : undefined

  const picking = useNotesStore((state) => state.picking)

  const pinByClick = () => {
    if (!draft.trim()) return
    useNotesStore.getState().setPicking({ mode: 'new', text: draft })
    setDraft('')
    setTab('active')
  }

  const pinOnSelection = () => {
    if (!(levelId && anchor && draft.trim())) return
    const position = onTopOf(anchor, levelId)
    if (!position) return
    const node = {
      object: 'node',
      type: 'studio:note',
      id: `note_${Math.random().toString(36).slice(2, 12)}`,
      parentId: levelId,
      visible: true,
      metadata: view ? { view: { position: view.position, yaw: view.yaw } } : {},
      position,
      target: anchor,
      ...withUserMessage({ thread: [] }, draft),
    }
    useScene.getState().createNode(node as unknown as AnyNode, levelId as AnyNodeId)
    useViewer.getState().setSelection({ selectedIds: [node.id as AnyNodeId] })
    setDraft('')
    setTab('active')
  }

  const shown = tab === 'active' ? active : archived
  return (
    <div style={S.body}>
      <textarea
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) pinByClick()
        }}
        placeholder="What should change here?"
        rows={3}
        style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit' }}
        value={draft}
      />
      {picking ? (
        <div style={S.row}>
          <span style={{ ...S.muted, flex: 1 }}>
            {picking.mode === 'new'
              ? 'Click the spot in 3D: a wall, a cabinet, the floor. Drag still orbits.'
              : 'Click the new spot for this note in 3D.'}
          </span>
          <button
            onClick={() => useNotesStore.getState().setPicking(null)}
            style={S.small}
            type="button"
          >
            Cancel (Esc)
          </button>
        </div>
      ) : (
        <>
          <button disabled={!draft.trim()} onClick={pinByClick} style={S.primary} type="button">
            Pin by clicking the spot
          </button>
          {anchor ? (
            <button
              disabled={!(levelId && draft.trim())}
              onClick={pinOnSelection}
              style={S.small}
              type="button"
            >
              {`Pin on the selection: “${selectedNode?.name || selectedNode?.type}”`}
            </button>
          ) : null}
        </>
      )}

      <div style={S.segmented}>
        {(['active', 'archive'] as const).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{ ...S.segment, ...(tab === key ? S.segmentActive : null) }}
            type="button"
          >
            {key === 'active' ? `Active (${active.length})` : `Archive (${archived.length})`}
          </button>
        ))}
      </div>

      <ul style={S.list}>
        {shown.map((note) => (
          <NoteRow
            key={note.id}
            note={note}
            selected={selectedIds?.includes(note.id as AnyNodeId) ?? false}
            targetName={
              note.target
                ? ((nodes as Record<string, { name?: string; type?: string }>)[note.target]?.name ??
                  'missing node')
                : ''
            }
          />
        ))}
        {shown.length === 0 ? (
          <p style={S.muted}>
            {tab === 'active'
              ? 'No open notes. Select something (or look at a spot), write what to change, pin it.'
              : 'Nothing archived yet.'}
          </p>
        ) : null}
      </ul>
    </div>
  )
}

/**
 * One note. Collapsed it is a title and whose turn it is; selected — from the
 * list or by clicking the pin — it opens the thread and a reply box.
 */
function NoteRow({
  note,
  selected,
  targetName,
}: {
  note: StudioNoteNode
  selected: boolean
  targetName: string
}) {
  const view = useStudioStore((state) => state.view)
  const [reply, setReply] = useState('')

  const select = () => useViewer.getState().setSelection({ selectedIds: [note.id as AnyNodeId] })
  const update = (patch: Partial<StudioNoteNode>) =>
    useScene.getState().updateNode(note.id as AnyNodeId, patch as never)

  const send = () => {
    if (!reply.trim()) return
    update(withUserMessage(note, reply))
    setReply('')
  }

  // Look at the pin from where the viewport already is, two metres off.
  const flyTo = () => {
    const [x, y, z] = note.position
    const yaw = view?.yaw ?? 0
    useStudioStore.getState().setFlyTo({
      position: [x - Math.sin(yaw) * 2.2, y + 0.9, z - Math.cos(yaw) * 2.2],
      target: [x, y, z],
    })
  }

  const colour = STATUS_COLOR[note.status]
  return (
    <li style={{ ...S.item, flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
      <button onClick={select} style={S.itemMain} type="button">
        <strong style={S.itemTitle}>{noteTitle(note)}</strong>
        <span style={{ ...S.muted, display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ ...S.badge, background: colour, color: '#ffffff' }}>
            {STATUS_LABEL[note.status]}
          </span>
          {note.thread.length} msg{targetName ? ` · ${targetName}` : ''}
        </span>
      </button>

      {selected ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {note.thread.map((message, index) => (
              <div
                key={`${message.at}-${index}`}
                style={{
                  fontSize: 12,
                  whiteSpace: 'pre-wrap',
                  padding: '5px 7px',
                  borderRadius: 6,
                  background: message.author === 'agent' ? 'var(--accent)' : 'transparent',
                  border: '1px solid var(--border)',
                }}
              >
                <span style={S.muted}>
                  {message.author === 'agent' ? 'Agent' : 'You'} ·{' '}
                  {new Date(message.at).toLocaleString()}
                </span>
                <div>{message.text}</div>
              </div>
            ))}
            {note.status === 'thinking' ? <p style={S.muted}>The agent is working on it…</p> : null}
          </div>
          <textarea
            onChange={(event) => setReply(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) send()
            }}
            placeholder={note.status === 'archived' ? 'Reply to reopen…' : 'Reply…'}
            rows={2}
            style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit' }}
            value={reply}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              disabled={!reply.trim()}
              onClick={send}
              style={{ ...S.small, flex: 1 }}
              type="button"
            >
              Send
            </button>
            <button onClick={flyTo} style={S.small} type="button">
              Go to
            </button>
            <button
              onClick={() => useNotesStore.getState().setPicking({ mode: 'move', noteId: note.id })}
              style={S.small}
              type="button"
            >
              Move
            </button>
            {note.status === 'archived' ? (
              <button onClick={() => update({ status: 'answered' })} style={S.small} type="button">
                Restore
              </button>
            ) : (
              <button onClick={() => update({ status: 'archived' })} style={S.small} type="button">
                Archive
              </button>
            )}
          </div>
        </>
      ) : null}
    </li>
  )
}
