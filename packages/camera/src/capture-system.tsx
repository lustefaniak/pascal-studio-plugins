'use client'

import {
  completeShotRequest,
  loadRooms,
  nextShotRequest,
  postSceneGlb,
  postShot,
  shotSlug,
  useStudioStore,
} from '@lustefaniak/pascal-studio-core'
import { emitter, sceneRegistry, useScene } from '@pascal-app/core'
import { exportSceneToGlb } from '@pascal-app/editor'
import * as viewerApi from '@pascal-app/viewer'
import {
  createSnapshotPipeline,
  GRID_LAYER,
  OVERLAY_LAYER,
  type SnapshotPipeline,
  temporarilyHideNodeTypes,
  useViewer,
} from '@pascal-app/viewer'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { type Object3D, PerspectiveCamera, Vector3 } from 'three'
import type { WebGPURenderer } from 'three/webgpu'
import { captureFov, framingOf, topDownHeight } from './framing'
import type { StudioCameraNode } from './schema'

/** Near plane of a shot without a section cut. */
const DEFAULT_NEAR = 0.05

/** Reused so the per-frame pose publisher allocates nothing. */
const scratch = new Vector3()

/** Panel preview size. Small enough to re-render on every parameter tweak. */
const PREVIEW_WIDTH = 480
const PREVIEW_HEIGHT = 270

/**
 * Renders saved shots straight out of the live scene.
 *
 * This is the piece that retires the browser-automation detour. The old route
 * drove Chrome from outside: install a `__THREE_DEVTOOLS__` hook before page
 * load to get at the camera, nudge the canvas with synthetic pointer moves so
 * React Three Fiber would draw a frame, hide the editor's grid and helpers by
 * guessing at material types, then read the canvas back as a data URL. Every
 * one of those steps is a host feature here: the capture camera is ours, the
 * snapshot pipeline renders on demand into its own target, and grid and
 * overlay objects are excluded by layer.
 *
 * Mounted once per registered kind (not per node), so it is running even when
 * the scene holds no cameras yet — which is what lets it poll for agent work.
 */
/** Hide the given nodes' objects; the returned function puts each one back as it was. */
function temporarilyHideNodes(ids: readonly string[]): () => void {
  const saved = new Map<Object3D, boolean>()
  for (const id of ids) {
    const object = sceneRegistry.nodes.get(id)
    if (object && !saved.has(object)) {
      saved.set(object, object.visible)
      object.visible = false
    }
  }
  return () => {
    saved.forEach((wasVisible, object) => {
      object.visible = wasVisible
    })
  }
}

/** Unmerge for one capture: own draw calls back, merged wall meshes off. */
function standDownBatches(scene: Object3D): () => void {
  emitter.emit('thumbnail:before-capture', undefined)
  const merged: Object3D[] = []
  scene.traverse((object) => {
    if (object.name === 'wall-batch' && object.visible) merged.push(object)
  })
  for (const object of merged) object.visible = false
  return () => {
    for (const object of merged) object.visible = true
    emitter.emit('thumbnail:after-capture', undefined)
  }
}

/** A scene whose build count stops moving for this long holds a node nothing will settle. */
const SCENE_BUILD_STALL_MS = 15_000
/** However busy the scene, a render waits no longer than this for it. */
const SCENE_BUILD_MAX_MS = 120_000

/**
 * Wait until the scene has built what a shot shows — walls, slabs, every item's
 * model. A headless renderer takes its first job seconds after the page opens,
 * and a capture then draws whatever has loaded: a top view without walls, or
 * the default view instead of the shot's camera.
 *
 * Newer hosts export `pendingSceneBuildCount()` (the viewer's own scene-ready
 * test, used by the host's thumbnail capture); it is read off the module at
 * runtime so the plugin still builds against releases without it. Without it,
 * the fallback waits for the node count to stop changing for a few seconds.
 */
async function untilSceneBuilt(): Promise<void> {
  const pending = (viewerApi as { pendingSceneBuildCount?: () => number }).pendingSceneBuildCount
  const started = performance.now()
  const measure = pending ?? (() => Object.keys(useScene.getState().nodes).length)
  let last = measure()
  let changedAt = started
  for (;;) {
    const now = performance.now()
    if (now - started > SCENE_BUILD_MAX_MS) return
    if (pending ? last === 0 : last > 0 && now - changedAt > 3_000) return
    if (pending && now - changedAt > SCENE_BUILD_STALL_MS) return
    await new Promise((resolve) => setTimeout(resolve, 100))
    const next = measure()
    if (next !== last) {
      last = next
      changedAt = performance.now()
    }
  }
}

export default function StudioCaptureSystem() {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const viewCamera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls)

  const cameraRef = useRef<PerspectiveCamera | null>(null)
  const pipelineRef = useRef<SnapshotPipeline | null>(null)
  const runningRef = useRef(false)
  const previewingRef = useRef<string | null>(null)
  const publishedAt = useRef(0)

  // Republish the viewport pose so the panel — which sits outside the canvas
  // and cannot use `useThree` — can offer "save the current view as a shot".
  // Throttled: the panel only needs it when the user reaches for the button.
  useFrame(({ clock }) => {
    const now = clock.elapsedTime
    if (now - publishedAt.current < 0.25) return
    publishedAt.current = now
    const forward = viewCamera.getWorldDirection(scratch)
    useStudioStore.getState().setView({
      position: [viewCamera.position.x, viewCamera.position.y, viewCamera.position.z],
      yaw: Math.atan2(forward.x, forward.z),
      pitch: (Math.asin(Math.max(-1, Math.min(1, forward.y))) * 180) / Math.PI,
    })
  })

  // One camera and one pipeline for the session: building the SSGI graph is
  // expensive, and it is bound to the camera object it was created with, so
  // the camera is mutated per shot rather than replaced.
  // The project's room list for the inspector; this system is mounted
  // whatever panel is open, so the list is there before anyone opens Cameras.
  useEffect(() => {
    void loadRooms()
  }, [])

  useEffect(() => {
    const camera = new PerspectiveCamera(60, 16 / 9, DEFAULT_NEAR, 400)
    camera.layers.disable(OVERLAY_LAYER)
    camera.layers.disable(GRID_LAYER)
    cameraRef.current = camera

    let live = true
    void createSnapshotPipeline({
      renderer: gl as unknown as WebGPURenderer,
      scene,
      camera,
    }).then((pipeline) => {
      if (!live) {
        pipeline?.dispose()
        return
      }
      pipelineRef.current = pipeline
    })

    return () => {
      live = false
      pipelineRef.current?.dispose()
      pipelineRef.current = null
    }
  }, [gl, scene])

  /**
   * Point the capture camera at a shot and read back one frame.
   *
   * Shared by real renders and panel previews on purpose: a preview that went
   * through a different code path would stop being a preview the moment the
   * two drifted.
   */
  async function capture(cameraId: string, width: number, height: number): Promise<Blob | null> {
    const camera = cameraRef.current
    const pipeline = pipelineRef.current
    if (!(camera && pipeline)) return null

    const nodes = useScene.getState().nodes as Record<string, { type?: string }>
    const node = nodes[cameraId] as StudioCameraNode | undefined
    if (node?.type !== 'studio:camera') return null

    const aspect = width / height
    const bounds = levelExtent(nodes)
    const shot = framingOf(node, aspect)

    // A top-down camera's height *is* its framing — how much of the floor fits
    // in the shot. Those heights are deliberate (a per-room top shot sits far
    // lower than a whole-storey one), so they are honoured as stored. The fit
    // below is only for a camera not yet raised above the ceiling, where the
    // alternative is a picture of the wall tops from inside the storey.
    const eye =
      node.projection === 'top' && shot.position[1] <= bounds.ceiling
        ? ([
            shot.position[0],
            topDownHeight({
              extent: bounds.extent,
              ceiling: bounds.ceiling,
              fov: node.fov,
              aspect,
            }),
            shot.position[2],
          ] as [number, number, number])
        : shot.position

    // `framingOf` returns a target one metre along the view direction, so the
    // direction survives the height override a top-down shot applies.
    const direction = new Vector3(
      shot.target[0] - shot.position[0],
      shot.target[1] - shot.position[1],
      shot.target[2] - shot.position[2],
    )
    // A section cut is a vertical plane, as in SketchUp. The cut is the near
    // plane, which is perpendicular to the view, so a shot with a cut looks
    // level and gets its tilt as a vertical lens shift instead: the same framing,
    // verticals stay vertical, and the plane removes a wall from floor to ceiling
    // rather than only its top.
    const cut = (node.clip ?? 0) > 0 && node.projection !== 'top'
    if (cut) direction.y = 0
    camera.position.set(eye[0], eye[1], eye[2])
    camera.up.set(shot.up[0], shot.up[1], shot.up[2])
    camera.lookAt(camera.position.clone().add(direction))
    // The pipeline draws at canvas resolution and centre-crops afterwards, so
    // the projection belongs to the canvas and the fov absorbs the crop — see
    // `captureFov`. Setting the output aspect here instead squeezes the frame
    // and quietly narrows every shot.
    const canvasAspect = gl.domElement.width / gl.domElement.height
    camera.fov = captureFov({ fov: shot.fov, requested: aspect, canvas: canvasAspect })
    camera.aspect = Number.isFinite(canvasAspect) && canvasAspect > 0 ? canvasAspect : aspect
    // The section plane is the near plane: anything closer is simply not drawn.
    camera.near = cut ? node.clip : DEFAULT_NEAR
    camera.clearViewOffset()
    if (cut) {
      // Shift the frustum by the tilt: a direction `pitch` below the horizon sits
      // tan(pitch)/tan(fov/2) from the centre in NDC, i.e. half that in frame heights.
      const height = gl.domElement.height
      const shift = Math.tan((node.pitch * Math.PI) / 180) / Math.tan((camera.fov * Math.PI) / 360)
      camera.setViewOffset(
        gl.domElement.width,
        height,
        0,
        (-shift * height) / 2,
        gl.domElement.width,
        height,
      )
    }
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()

    const viewer = useViewer.getState()
    pipeline.applyEnvironment({
      theme: viewer.sceneTheme,
      transparent: false,
      grade: viewer.shading === 'rendered',
      edges: viewer.edges,
      camera,
    })

    // Looking down at a roofed storey otherwise fills the frame with the
    // underside of the ceiling. Visibility is restored right after the render,
    // before the GPU readback.
    const restoreCeiling =
      node.projection === 'top' ? temporarilyHideNodeTypes(['ceiling']) : () => {}
    // Walls, doors and items are drawn by merged per-level meshes, so hiding a
    // node's own object alone changes nothing. The thumbnail capture event hands
    // every node its own draw call back (the same handshake the editor's
    // thumbnail generator uses); the merged wall mesh is then switched off for
    // the shot, which leaves each node's own object to hide.
    const hideIds = node.hide ?? []
    const restoreBatches = hideIds.length > 0 ? standDownBatches(scene) : () => {}
    const restoreHidden = temporarilyHideNodes(hideIds)
    const restore = () => {
      restoreHidden()
      restoreBatches()
      restoreCeiling()
    }
    try {
      const result = await pipeline.capture({
        captureMode: 'standard',
        standardSize: { w: width, h: height },
      })
      return result.blob
    } finally {
      restore()
    }
  }

  // The scene as GLB, for the worker's API and offline renderers, through the
  // editor's own exporter: node ids as names, real materials, export-only
  // geometry for instanced kinds. Runs only in the worker's headless editor
  // (the worker hands exports to no other tab) until Pascal can export
  // without a browser.
  async function exportScene(requestId: string) {
    try {
      const root = scene.getObjectByName('scene-renderer')
      if (!root) throw new Error('scene-renderer group not found')
      await untilSceneBuilt()
      // Instanced kinds swap their invisible proxies for real geometry while
      // exporting; the same dance as the editor's own export button.
      useViewer.getState().setExporting(true)
      try {
        await nextFrames()
        // Hidden nodes stay in: the renderer decides what a shot hides.
        const glb = await exportSceneToGlb(root, useScene.getState().nodes, { onlyVisible: false })
        await postSceneGlb(requestId, new Blob([glb], { type: 'model/gltf-binary' }))
      } finally {
        useViewer.getState().setExporting(false)
      }
      await completeShotRequest(requestId)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await completeShotRequest(requestId, message).catch(() => {})
    }
  }

  // Long-poll the worker so an agent can ask for shots while the editor sits
  // open. An idle editor holds one request open instead of spinning.
  useEffect(() => {
    const controller = new AbortController()
    let stopped = false

    const poll = async () => {
      while (!stopped) {
        try {
          const request = await nextShotRequest(controller.signal)
          if (request?.kind === 'export') {
            await exportScene(request.requestId)
          } else if (request) {
            useStudioStore.getState().requestShots({ ...request, fromWorker: true })
          }
        } catch {
          if (stopped) return
          // Worker down or restarting: back off rather than hammer it.
          await new Promise((resolve) => setTimeout(resolve, 3000))
        }
      }
    }
    void poll()

    return () => {
      stopped = true
      controller.abort()
    }
  }, [])

  // "Go to shot": drop the viewport straight into a saved shot, so aiming is
  // done with the normal camera controls at full size instead of by typing
  // angles and re-rendering to see what happened.
  useEffect(
    () =>
      useStudioStore.subscribe((state) => {
        const target = state.flyTo
        if (!target) return
        useStudioStore.getState().setFlyTo(null)
        ;(
          controls as {
            setLookAt?: (
              px: number,
              py: number,
              pz: number,
              tx: number,
              ty: number,
              tz: number,
              transition?: boolean,
            ) => void
          } | null
        )?.setLookAt?.(...target.position, ...target.target, true)
      }),
    [controls],
  )

  // Preview thumbnails for the panel — same pipeline as a real shot, just
  // small and kept in memory, so what the panel shows is what the render gives.
  useEffect(
    () =>
      useStudioStore.subscribe((state) => {
        const wanted = state.previewOf
        if (!wanted || previewingRef.current === wanted || runningRef.current) return
        previewingRef.current = wanted
        void (async () => {
          try {
            const blob = await capture(wanted, PREVIEW_WIDTH, PREVIEW_HEIGHT)
            if (blob && useStudioStore.getState().previewOf === wanted) {
              useStudioStore
                .getState()
                .setPreview({ cameraId: wanted, url: URL.createObjectURL(blob) })
            }
          } catch {
            // A preview is a convenience; failing one must not break the panel.
          } finally {
            previewingRef.current = null
          }
        })()
      }),
    [],
  )

  /**
   * `K` toggles the camera markers.
   *
   * It lives here because this system is mounted whatever panel is open, and
   * the markers are in the way precisely while working on something else —
   * having to go back to the Cameras panel to get them out of the picture is
   * the annoyance, not the clicking. `K` is free: the host binds 1/2/3, F, Z,
   * V, B, M, X, R and T, and Cmd/Ctrl+K for the command palette, hence the
   * modifier check. Typing is respected, otherwise renaming a shot to
   * "Kitchen" would flicker the markers on every k.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'k' && event.key !== 'K') return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target?.isContentEditable) return
      if (target && /^(input|textarea|select)$/i.test(target.tagName)) return
      event.preventDefault()
      useStudioStore.getState().toggleMarkers()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Drain jobs one at a time; captures share a single render target. Draining
  // in a loop rather than per notification matters because a job queued while
  // one is running produces no further store event to wake us with.
  useEffect(() => {
    const drain = async () => {
      if (runningRef.current) return
      runningRef.current = true
      try {
        for (;;) {
          const job = useStudioStore.getState().takeJob()
          if (!job) return
          await run(job)
        }
      } finally {
        runningRef.current = false
      }
    }
    return useStudioStore.subscribe((state) => {
      if (state.job) void drain()
    })
  }, [])

  async function run(job: {
    requestId: string
    cameraIds: string[]
    width: number
    height: number
    fromWorker: boolean
  }) {
    const store = useStudioStore.getState()
    store.setBusy(true)
    store.setError(null)

    try {
      if (!(cameraRef.current && pipelineRef.current)) {
        throw new Error('The snapshot pipeline is still building — try again in a moment.')
      }

      const nodes = useScene.getState().nodes as Record<string, { type?: string }>
      const cameras = Object.values(nodes).filter(
        (node): node is StudioCameraNode => node.type === 'studio:camera',
      )
      const wanted = job.cameraIds.length
        ? cameras.filter((node) => job.cameraIds.includes(node.id))
        : cameras
      if (wanted.length === 0) throw new Error('No cameras to render.')

      store.setStatus('Waiting for the scene to finish building…')
      await untilSceneBuilt()

      for (const [index, node] of wanted.entries()) {
        store.setStatus(`${index + 1}/${wanted.length}: ${node.name || node.id}`)
        const blob = await capture(node.id, job.width, job.height)
        if (!blob) continue

        const name = shotName(node)
        await postShot({
          requestId: job.requestId,
          name,
          blob: await toPng(blob),
          meta: {
            nodeId: node.id,
            label: node.name ?? '',
            shot: node.shot,
            room: node.room,
            projection: node.projection,
            fov: node.fov,
            pitch: node.pitch,
            width: job.width,
            height: job.height,
          },
        })
        useStudioStore.getState().noteShot(name)
      }

      store.setStatus(`Done: ${wanted.length}`)
      if (job.fromWorker) await completeShotRequest(job.requestId)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      useStudioStore.getState().setError(message)
      useStudioStore.getState().setStatus('')
      if (job.fromWorker) await completeShotRequest(job.requestId, message).catch(() => {})
    } finally {
      useStudioStore.getState().setBusy(false)
    }
  }

  return null
}

/**
 * Filename for a shot.
 *
 * Deliberately the bare slug, with no shot-number prefix: this is the naming
 * the worker produced, the review app's manifest is keyed by filename, and the
 * notes hang off the number that filename already maps to. Prefixing the number
 * would write `900_kitchen_from_door.png` beside the existing
 * `kitchen_from_door.png` — a second entry, a second number, and every note left
 * behind on the old picture. Re-rendering has to overwrite, not accumulate.
 */
function shotName(node: StudioCameraNode): string {
  return shotSlug(node.name ?? '') || `shot_${node.shot}`
}

/** Two animation frames: long enough for React to commit export-only geometry. */
function nextFrames(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  )
}

/**
 * The host pipeline encodes webp — small, and right for the catalog thumbnails
 * it was built for. The review app indexes `.png`, and re-encoding here rather
 * than in the worker keeps the worker free of an image library.
 */
async function toPng(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0)
  bitmap.close()
  return canvas.convertToBlob({ type: 'image/png' })
}

/** Plan extent and ceiling height of the storey, used to frame top-down shots. */
function levelExtent(nodes: Record<string, any>): {
  extent: [number, number]
  ceiling: number
} {
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minZ = Number.POSITIVE_INFINITY
  let maxZ = Number.NEGATIVE_INFINITY
  let ceiling = 2.7

  for (const node of Object.values(nodes)) {
    if (node?.type === 'level' && typeof node.height === 'number') {
      ceiling = Math.max(ceiling, node.height)
    }
    if (node?.type !== 'wall') continue
    for (const point of [node.start, node.end]) {
      if (!Array.isArray(point)) continue
      minX = Math.min(minX, point[0])
      maxX = Math.max(maxX, point[0])
      minZ = Math.min(minZ, point[1])
      maxZ = Math.max(maxZ, point[1])
    }
  }

  if (!Number.isFinite(minX)) return { extent: [12, 12], ceiling }
  return { extent: [maxX - minX, maxZ - minZ], ceiling }
}
