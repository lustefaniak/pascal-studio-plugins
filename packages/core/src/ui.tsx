'use client'

import { type AnyNode, type AnyNodeId, useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { useCallback, useMemo } from 'react'
import { type LibraryModel, WORKER_ORIGIN } from './api'
import { useStudioStore } from './store'

/**
 * Places a library model as a plain `item` node.
 *
 * Items are a host kind, so a model dropped this way stays selectable,
 * movable and exportable with everything else — the plugin only supplies the
 * URL and the measured bounding box, which is what collision checks and the
 * grey stand-in box are drawn from.
 */
export function usePlaceModel() {
  const levelId = useViewer((state) => state.selection.levelId)
  const view = useStudioStore((state) => state.view)

  return useCallback(
    (model: LibraryModel) => {
      if (!levelId) return
      // Drop it where the user is looking, not at the origin.
      const at = view ? [view.position[0], 0, view.position[2]] : [0, 0, 0]
      const node = {
        object: 'node',
        type: 'item',
        id: `item_${Math.random().toString(36).slice(2, 12)}`,
        parentId: levelId,
        visible: true,
        metadata: {},
        name: model.name,
        position: at,
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        asset: {
          id: model.path.replace(/\.glb$/i, ''),
          category: 'furniture',
          name: model.name,
          thumbnail: '',
          src: model.url,
          dimensions: model.dimensions ?? [1, 1, 1],
          // Measured, not assumed: `dimensions` is drawn around the node's
          // origin, so a model authored off a bottom corner needs shifting
          // back under its own box or the two part company on the plan.
          offset: model.offset ?? [0, 0, 0],
          // `?? []` on purpose: a model fetched straight from an import may
          // predate the sidecar that carries tags, and a bare spread of
          // `undefined` takes the whole panel down with "tags is not iterable".
          tags: [model.source, ...(model.tags ?? [])],
        },
      }
      useScene.getState().createNode(node as unknown as AnyNode, levelId as AnyNodeId)
      useViewer.getState().setSelection({ selectedIds: [node.id as AnyNodeId] })
    },
    [levelId, view],
  )
}

/**
 * How many times each model is already placed, keyed by its file path.
 *
 * Answers "did I already add this?" without leaving the panel — the reason it
 * matters is that the same product is easy to search for twice, and a second
 * copy lands silently on top of the first.
 */
export function useSceneUsage(): Map<string, number> {
  const nodes = useScene((state) => state.nodes)
  return useMemo(() => {
    const counts = new Map<string, number>()
    for (const node of Object.values(
      nodes as Record<string, { type?: string; asset?: { src?: string } }>,
    )) {
      const src = node?.type === 'item' ? node.asset?.src : undefined
      if (!src) continue
      // Only the path matters: the port moves between worker restarts.
      const path = src.replace(/^https?:\/\/[^/]+\//, '').split('?')[0]!
      counts.set(path, (counts.get(path) ?? 0) + 1)
    }
    return counts
  }, [nodes])
}

export function workerHint(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : String(cause)
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return `Cannot reach the studio worker on ${WORKER_ORIGIN}. Start it with worker.py --serve.`
  }
  return message
}

// Inline styles on purpose: host panels must not ship global CSS, and the
// host's own CSS variables carry the theme.
export const S: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 },
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: 10,
    overflowY: 'auto',
    minHeight: 0,
  },
  row: { display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: 6,
    borderRadius: 6,
    border: '1px solid var(--border)',
  },
  itemMain: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flex: 1,
    minWidth: 0,
    textAlign: 'left',
    background: 'transparent',
    border: 'none',
    color: 'inherit',
    cursor: 'pointer',
    padding: 0,
  },
  itemTitle: { fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  muted: { fontSize: 11, color: 'var(--muted-foreground)' },
  badge: {
    fontSize: 10,
    padding: '1px 5px',
    borderRadius: 4,
    background: 'var(--accent)',
    color: 'var(--foreground)',
    whiteSpace: 'nowrap',
  },
  primary: {
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--accent)',
    color: 'var(--foreground)',
    fontSize: 12,
    cursor: 'pointer',
  },
  small: {
    padding: '4px 8px',
    borderRadius: 5,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--foreground)',
    fontSize: 11,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  segmented: { display: 'flex', gap: 2 },
  segment: {
    padding: '3px 8px',
    borderRadius: 5,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--muted-foreground)',
    fontSize: 11,
    cursor: 'pointer',
  },
  segmentActive: { background: 'var(--accent)', color: 'var(--foreground)' },
  input: {
    flex: 1,
    minWidth: 0,
    padding: '5px 8px',
    borderRadius: 5,
    border: '1px solid var(--border)',
    background: 'var(--background)',
    color: 'var(--foreground)',
    fontSize: 12,
  },
  thumb: { width: 34, height: 34, objectFit: 'contain', borderRadius: 4 },
  preview: { width: '100%', borderRadius: 6, border: '1px solid var(--border)', display: 'block' },
  error: { fontSize: 11, color: 'var(--destructive, #e5484d)', margin: 0 },
}
