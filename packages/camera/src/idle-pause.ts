/**
 * Stops the viewer's frame loop while nothing happens.
 *
 * The host's `FrameLimiter` advances 50 frames a second whether or not anything
 * changed, and the only off switch is the viewer's `renderPaused` flag. This
 * sets it after `quietMs` without activity and clears it on the next one.
 * Activity is input, a scene change, an asset load or a capture in progress;
 * the caller wires those up and calls `wake()` / `hold()`.
 *
 * The quiet period is not just a debounce: camera damping and the temporal
 * effects keep converging for a while after the last input, and both need
 * frames to get there.
 *
 * Only a pause set here is ever cleared here, so a host that pauses the
 * viewer for its own reasons keeps its pause.
 */
export type IdlePause = {
  /** Activity: render now, pause again after the quiet period. */
  wake: () => void
  /** Keep rendering until the returned release is called (a capture). */
  hold: () => () => void
  /** True while this controller holds the viewer paused. */
  paused: () => boolean
  dispose: () => void
}

type Timer = ReturnType<typeof globalThis.setTimeout>

export function createIdlePause({
  setRenderPaused,
  quietMs = 3000,
  schedule = globalThis.setTimeout,
  cancel = globalThis.clearTimeout,
}: {
  setRenderPaused: (value: boolean) => void
  quietMs?: number
  schedule?: (callback: () => void, delay: number) => Timer
  cancel?: (timer: Timer) => void
}): IdlePause {
  let paused = false
  let holds = 0
  let timer: Timer | null = null
  let disposed = false

  const setPaused = (value: boolean) => {
    if (paused === value) return
    paused = value
    setRenderPaused(value)
  }

  const wake = () => {
    if (disposed) return
    setPaused(false)
    if (timer !== null) cancel(timer)
    timer = null
    if (holds > 0) return
    timer = schedule(() => {
      timer = null
      if (holds === 0) setPaused(true)
    }, quietMs)
  }

  const hold = () => {
    holds++
    wake()
    let released = false
    return () => {
      if (released) return
      released = true
      holds--
      wake()
    }
  }

  const dispose = () => {
    if (timer !== null) cancel(timer)
    timer = null
    setPaused(false)
    disposed = true
  }

  wake()
  return { wake, hold, paused: () => paused, dispose }
}
