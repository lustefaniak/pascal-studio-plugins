'use client'

import { type AnyNode, type AnyNodeId, sceneRegistry, useScene } from '@pascal-app/core'
import { setSurfaceRaycastLayers, useViewer } from '@pascal-app/viewer'
import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { type Object3D, Raycaster, Vector2, Vector3 } from 'three'
import { useNotesStore } from './store'
import { withUserMessage } from './thread'

/** Kinds that are the surroundings, not the thing a note is about. */
const NOT_A_TARGET = new Set(['level', 'building', 'site'])

/** How far off the clicked surface the pin's tip stands, so it is not inside it. */
const LIFT = 0.02

/**
 * Click-to-pin. While the panel has armed a pick, the next left click in the
 * 3D view is ours: its release is caught in the capture phase, before the
 * host's own selection sees it, and raycast against the real surfaces (the batched walls
 * included, see `setSurfaceRaycastLayers`). The first hit that belongs to a
 * scene node gives the spot, the surface normal and the node the note is about.
 *
 * Mounted once per registered kind, like the camera plugin's capture system,
 * so it runs whether or not any note exists yet.
 */
export default function NotePickSystem() {
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const scene = useThree((state) => state.scene)
  const picking = useNotesStore((state) => state.picking)

  useEffect(() => {
    if (!picking) return
    const canvas = gl.domElement
    const previousCursor = canvas.style.cursor
    canvas.style.cursor = 'crosshair'

    const raycaster = new Raycaster()
    setSurfaceRaycastLayers(raycaster.layers)

    const nodeOf = (object: Object3D | null): string | null => {
      const owners = new Map<Object3D, string>()
      for (const [id, registered] of sceneRegistry.nodes) owners.set(registered, id)
      for (let o = object; o; o = o.parent) {
        const id = owners.get(o)
        if (id) return id
      }
      return null
    }

    const swallow = (event: Event) => {
      event.stopPropagation()
      event.preventDefault()
    }

    // A drag still orbits the view: only a press released where it started is a pick.
    let downAt: [number, number] | null = null
    const onDown = (event: PointerEvent) => {
      downAt = event.button === 0 ? [event.clientX, event.clientY] : null
    }

    const onUp = (event: PointerEvent) => {
      if (!downAt || event.button !== 0) return
      const moved = Math.hypot(event.clientX - downAt[0], event.clientY - downAt[1])
      downAt = null
      if (moved > 5) return
      swallow(event)
      const rect = canvas.getBoundingClientRect()
      const ndc = new Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      )
      raycaster.setFromCamera(ndc, camera)
      const nodes = useScene.getState().nodes as Record<string, { type?: string }>
      for (const hit of raycaster.intersectObjects(scene.children, true)) {
        const id = nodeOf(hit.object)
        const kind = id ? nodes[id]?.type : undefined
        if (!(id && kind) || kind === 'studio:note' || kind === 'studio:camera') continue
        const normal = hit.face
          ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
          : new Vector3(0, 1, 0)
        place(hit.point.clone().addScaledVector(normal, LIFT), NOT_A_TARGET.has(kind) ? '' : id, [
          normal.x,
          normal.y,
          normal.z,
        ])
        return
      }
    }

    const place = (world: Vector3, target: string, normal: [number, number, number]) => {
      const current = useNotesStore.getState().picking
      useNotesStore.getState().setPicking(null)
      const levelId = useViewer.getState().selection.levelId
      if (!(current && levelId)) return
      const local = sceneRegistry.nodes.get(levelId)?.worldToLocal(world.clone()) ?? world
      const position: [number, number, number] = [local.x, local.y, local.z]
      // Where the person stood: "on the right" in a note only means something with this.
      const forward = camera.getWorldDirection(new Vector3())
      const view = {
        position: [camera.position.x, camera.position.y, camera.position.z],
        yaw: Math.atan2(forward.x, forward.z),
      }
      const metadata = { normal, view }
      if (current.mode === 'move') {
        const note = useScene.getState().nodes[current.noteId as AnyNodeId] as
          | { metadata?: Record<string, unknown> }
          | undefined
        useScene
          .getState()
          .updateNode(
            current.noteId as AnyNodeId,
            { position, target, metadata: { ...(note?.metadata ?? {}), ...metadata } } as never,
          )
        useViewer.getState().setSelection({ selectedIds: [current.noteId as AnyNodeId] })
        return
      }
      const node = {
        object: 'node',
        type: 'studio:note',
        id: `note_${Math.random().toString(36).slice(2, 12)}`,
        parentId: levelId,
        visible: true,
        metadata,
        position,
        target,
        ...withUserMessage({ thread: [] }, current.text),
      }
      useScene.getState().createNode(node as unknown as AnyNode, levelId as AnyNodeId)
      useViewer.getState().setSelection({ selectedIds: [node.id as AnyNodeId] })
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') useNotesStore.getState().setPicking(null)
    }

    canvas.addEventListener('pointerdown', onDown, { capture: true })
    canvas.addEventListener('pointerup', onUp, { capture: true })
    // The host selects on click too; while picking, that click is ours.
    canvas.addEventListener('click', swallow, { capture: true })
    window.addEventListener('keydown', onKey)
    return () => {
      canvas.style.cursor = previousCursor
      canvas.removeEventListener('pointerdown', onDown, { capture: true })
      canvas.removeEventListener('pointerup', onUp, { capture: true })
      canvas.removeEventListener('click', swallow, { capture: true })
      window.removeEventListener('keydown', onKey)
    }
  }, [picking, gl, camera, scene])

  return null
}
