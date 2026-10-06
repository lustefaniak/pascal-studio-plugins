import { create } from 'zustand'

export type ShotJob = {
  requestId: string
  cameraIds: string[]
  width: number
  height: number
  /** Agent-issued jobs report completion back to the worker; panel jobs do not. */
  fromWorker: boolean
}

type StudioState = {
  /**
   * Whether camera markers are drawn in the viewport at all.
   *
   * Off means the renderer emits no geometry, so a marker neither hides the
   * furniture behind it nor swallows the click meant for it — the two reasons
   * this switch exists. It changes nothing about a render: markers sit on
   * `OVERLAY_LAYER`, which the capture camera has switched off either way.
   */
  markers: boolean
  setMarkers: (markers: boolean) => void
  toggleMarkers: () => void

  /** The job the capture system should pick up next, or null when idle. */
  job: ShotJob | null
  busy: boolean
  /** Short human-readable progress line shown in the panel. */
  status: string
  lastError: string | null
  /** Shot names written during the current session, newest first. */
  recent: string[]
  /**
   * Live pose of the viewport camera, republished by the capture system.
   * The panel lives outside the R3F canvas and so cannot reach `useThree`;
   * this is what lets "save the current view as a shot" work.
   */
  view: { position: [number, number, number]; yaw: number; pitch: number } | null
  setView: (view: StudioState['view']) => void

  /** Camera the panel wants a preview thumbnail of, and the result. */
  previewOf: string | null
  preview: { cameraId: string; url: string } | null
  requestPreview: (cameraId: string | null) => void
  setPreview: (preview: StudioState['preview']) => void

  /** Pose the viewport should jump to, consumed by the capture system. */
  flyTo: { position: [number, number, number]; target: [number, number, number] } | null
  setFlyTo: (flyTo: StudioState['flyTo']) => void

  requestShots: (job: Omit<ShotJob, 'requestId' | 'fromWorker'> & Partial<ShotJob>) => void
  takeJob: () => ShotJob | null
  setBusy: (busy: boolean) => void
  setStatus: (status: string) => void
  setError: (error: string | null) => void
  noteShot: (name: string) => void
}

let counter = 0

/**
 * The marker switch outlives a reload, because forgetting it is the whole
 * annoyance: it is turned off to work on the furniture, and a page refresh
 * putting a dozen cones back over the room undoes that silently. Kept in
 * `localStorage` rather than in the scene — it is a per-browser view setting,
 * not a property of the building, and writing it to the graph would make every
 * toggle a scene revision.
 */
const MARKERS_KEY = 'studio:camera:markers'

function readMarkers(): boolean {
  try {
    return globalThis.localStorage?.getItem(MARKERS_KEY) !== '0'
  } catch {
    // Private mode, or a server render where there is no storage at all.
    return true
  }
}

function writeMarkers(markers: boolean) {
  try {
    globalThis.localStorage?.setItem(MARKERS_KEY, markers ? '1' : '0')
  } catch {
    // Not worth surfacing: the toggle still works for this session.
  }
}

/**
 * Panel and capture system talk through this store rather than the host's
 * event bus: `emitter` is typed over a fixed union of host events, and plugins
 * are expected to own their state (see the plugin authoring guide).
 */
export const useStudioStore = create<StudioState>((set, get) => ({
  markers: readMarkers(),
  job: null,
  busy: false,
  status: '',
  lastError: null,
  recent: [],
  view: null,
  previewOf: null,
  preview: null,
  flyTo: null,

  setMarkers: (markers) => {
    writeMarkers(markers)
    set({ markers })
  },
  toggleMarkers: () => get().setMarkers(!get().markers),

  setView: (view) => set({ view }),
  requestPreview: (previewOf) => set({ previewOf }),
  setPreview: (preview) => {
    // Revoke the previous object URL: previews refresh on every parameter
    // tweak, so holding them would leak a bitmap per keystroke.
    const previous = get().preview
    if (previous && previous.url !== preview?.url) URL.revokeObjectURL(previous.url)
    set({ preview })
  },
  setFlyTo: (flyTo) => set({ flyTo }),

  requestShots: (job) =>
    set({
      job: {
        requestId: job.requestId ?? `panel-${++counter}`,
        cameraIds: job.cameraIds,
        width: job.width,
        height: job.height,
        fromWorker: job.fromWorker ?? false,
      },
      lastError: null,
    }),

  takeJob: () => {
    const { job } = get()
    if (job) set({ job: null })
    return job
  },

  setBusy: (busy) => set({ busy }),
  setStatus: (status) => set({ status }),
  setError: (lastError) => set({ lastError }),
  noteShot: (name) => set({ recent: [name, ...get().recent].slice(0, 20) }),
}))
