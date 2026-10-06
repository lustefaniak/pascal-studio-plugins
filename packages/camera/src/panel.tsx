'use client'

import { loadRooms, roomLabel, S, useStudioStore } from '@lustefaniak/pascal-studio-core'
import { type AnyNode, type AnyNodeId, useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useMemo, useState } from 'react'
import { framingOf } from './framing'
import type { StudioCameraNode } from './schema'

const RESOLUTIONS: { label: string; w: number; h: number }[] = [
  { label: '1K', w: 1024, h: 1024 },
  { label: 'HD', w: 1920, h: 1080 },
  { label: '2K', w: 2048, h: 1152 },
]

export default function CameraPanel() {
  // Re-render once the project's rooms arrive, so labels replace raw ids.
  const [, setRoomsLoaded] = useState(0)
  useEffect(() => {
    void loadRooms().then(() => setRoomsLoaded((n) => n + 1))
  }, [])

  const nodes = useScene((state) => state.nodes)
  const levelId = useViewer((state) => state.selection.levelId)
  const view = useStudioStore((state) => state.view)
  const busy = useStudioStore((state) => state.busy)
  const status = useStudioStore((state) => state.status)
  const error = useStudioStore((state) => state.lastError)
  const recent = useStudioStore((state) => state.recent)
  const markers = useStudioStore((state) => state.markers)
  const [resolution, setResolution] = useState(RESOLUTIONS[1]!)

  const cameras = useMemo(
    () =>
      Object.values(nodes as Record<string, { type?: string }>).filter(
        (node): node is StudioCameraNode => node.type === 'studio:camera',
      ),
    [nodes],
  )

  const render = (ids: string[]) =>
    useStudioStore.getState().requestShots({
      cameraIds: ids,
      width: resolution.w,
      height: resolution.h,
    })

  /**
   * Framing is done by flying the viewport somewhere and liking what you see,
   * so the primary way to make a shot is to freeze the current view.
   */
  const saveCurrentView = () => {
    if (!(view && levelId)) return
    const used = new Set(cameras.map((camera) => camera.shot))
    let shot = 900
    while (used.has(shot)) shot += 1
    const node = {
      object: 'node',
      type: 'studio:camera',
      id: `camera_${Math.random().toString(36).slice(2, 12)}`,
      parentId: levelId,
      visible: true,
      metadata: {},
      name: `Shot ${shot}`,
      position: view.position,
      rotation: [0, view.yaw, 0],
      fov: 62,
      pitch: Math.round(view.pitch),
      projection: 'eye',
      shot,
      room: '',
    }
    useScene.getState().createNode(node as unknown as AnyNode, levelId as AnyNodeId)
    useViewer.getState().setSelection({ selectedIds: [node.id as AnyNodeId] })
  }

  return (
    <div style={S.body}>
      <button
        disabled={!(view && levelId)}
        onClick={saveCurrentView}
        style={S.primary}
        type="button"
      >
        Save current view as a shot
      </button>

      {/*
        Markers on/off. Worth a button of its own rather than hiding each
        camera by hand in the outliner: the cones are what obscures the room
        and eats clicks while furnishing, and they are always turned back on
        a minute later. Same switch as the K key — see `capture-system.tsx`.
      */}
      <div style={S.row}>
        <span style={S.muted}>Camera markers (K)</span>
        <div style={S.segmented}>
          <button
            onClick={() => useStudioStore.getState().setMarkers(true)}
            style={{ ...S.segment, ...(markers ? S.segmentActive : null) }}
            type="button"
          >
            Visible
          </button>
          <button
            onClick={() => useStudioStore.getState().setMarkers(false)}
            style={{ ...S.segment, ...(markers ? null : S.segmentActive) }}
            type="button"
          >
            Hidden
          </button>
        </div>
      </div>

      <div style={S.row}>
        <span style={S.muted}>Resolution</span>
        <div style={S.segmented}>
          {RESOLUTIONS.map((option) => (
            <button
              key={option.label}
              onClick={() => setResolution(option)}
              style={{
                ...S.segment,
                ...(option.label === resolution.label ? S.segmentActive : null),
              }}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <button
        disabled={busy || cameras.length === 0}
        onClick={() => render([])}
        style={S.primary}
        type="button"
      >
        {busy ? `Rendering… ${status}` : `Render all (${cameras.length})`}
      </button>

      {error ? <p style={S.error}>{error}</p> : null}

      <ul style={S.list}>
        {cameras.map((camera) => (
          <CameraRow busy={busy} camera={camera} key={camera.id} onRender={render} />
        ))}
        {cameras.length === 0 ? (
          <p style={S.muted}>No shots yet. Frame a view in 3D and click “Save current view”.</p>
        ) : null}
      </ul>

      {recent.length > 0 ? <p style={S.muted}>Saved: {recent.slice(0, 6).join(', ')}</p> : null}
    </div>
  )
}

/**
 * One shot. Selecting it opens a live preview rendered by the same pipeline
 * the final image goes through, plus the two moves that make aiming bearable:
 * put the viewport *into* the shot, and push the viewport back *into* the node.
 */
function CameraRow({
  camera,
  busy,
  onRender,
}: {
  camera: StudioCameraNode
  busy: boolean
  onRender: (ids: string[]) => void
}) {
  const selectedIds = useViewer((state) => state.selection.selectedIds)
  const preview = useStudioStore((state) => state.preview)
  const view = useStudioStore((state) => state.view)
  const selected = selectedIds?.includes(camera.id as AnyNodeId) ?? false

  // Re-preview whenever anything that changes the picture changes. Debounced,
  // because dragging a slider in the inspector would otherwise queue a render
  // per frame.
  const signature = `${camera.position.join()}|${camera.rotation[1]}|${camera.fov}|${camera.pitch}|${camera.projection}|${camera.clip}`
  useEffect(() => {
    if (!selected) return
    const timer = setTimeout(() => useStudioStore.getState().requestPreview(camera.id), 350)
    return () => clearTimeout(timer)
  }, [selected, camera.id, signature])

  useEffect(() => {
    if (!selected) return
    return () => {
      if (useStudioStore.getState().previewOf === camera.id) {
        useStudioStore.getState().requestPreview(null)
      }
    }
  }, [selected, camera.id])

  const select = () => useViewer.getState().setSelection({ selectedIds: [camera.id as AnyNodeId] })

  const flyTo = () => {
    const shot = framingOf(camera, 16 / 9)
    useStudioStore.getState().setFlyTo({ position: shot.position, target: shot.target })
  }

  const saveView = () => {
    if (!view) return
    useScene.getState().updateNode(
      camera.id as AnyNodeId,
      {
        position: view.position,
        rotation: [0, view.yaw, 0],
        pitch: Math.round(view.pitch),
      } as never,
    )
  }

  return (
    <li style={{ ...S.item, flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={select} style={S.itemMain} type="button">
          <strong style={S.itemTitle}>{camera.name || `Shot ${camera.shot}`}</strong>
          <span style={S.muted}>
            {camera.shot ? `no. ${camera.shot}` : 'unnumbered'}
            {camera.room ? ` · ${roomLabel(camera.room)}` : ''}
            {camera.projection === 'top' ? ' · top-down' : ` · ${camera.fov}° / ${camera.pitch}°`}
          </span>
        </button>
        <button disabled={busy} onClick={() => onRender([camera.id])} style={S.small} type="button">
          Render
        </button>
      </div>

      {selected ? (
        <>
          {preview?.cameraId === camera.id ? (
            <img alt="Shot preview" src={preview.url} style={S.preview} />
          ) : (
            <p style={S.muted}>Rendering preview…</p>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={flyTo} style={{ ...S.small, flex: 1 }} type="button">
              Go to shot
            </button>
            <button
              disabled={!view}
              onClick={saveView}
              style={{ ...S.small, flex: 1 }}
              type="button"
            >
              Save view here
            </button>
          </div>
        </>
      ) : null}
    </li>
  )
}
