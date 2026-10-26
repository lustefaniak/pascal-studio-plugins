import { describe, expect, test } from 'bun:test'
import { createIdlePause } from './idle-pause'

function setup() {
  const calls: boolean[] = []
  let pending: (() => void) | null = null
  const idle = createIdlePause({
    setRenderPaused: (value) => calls.push(value),
    schedule: (callback) => {
      pending = callback
      return 1 as unknown as ReturnType<typeof setTimeout>
    },
    cancel: () => {
      pending = null
    },
  })
  const elapse = () => {
    const callback = pending
    pending = null
    callback?.()
  }
  return { idle, calls, elapse }
}

describe('idle pause', () => {
  test('pauses after the quiet period and resumes on activity', () => {
    const { idle, calls, elapse } = setup()
    expect(idle.paused()).toBe(false)
    elapse()
    expect(idle.paused()).toBe(true)
    idle.wake()
    expect(idle.paused()).toBe(false)
    expect(calls).toEqual([true, false])
  })

  test('activity restarts the quiet period', () => {
    const { idle, elapse } = setup()
    idle.wake()
    idle.wake()
    elapse()
    expect(idle.paused()).toBe(true)
  })

  test('a hold keeps rendering until released', () => {
    const { idle, elapse } = setup()
    const release = idle.hold()
    elapse()
    expect(idle.paused()).toBe(false)
    release()
    release()
    elapse()
    expect(idle.paused()).toBe(true)
  })

  test('dispose leaves the viewer running', () => {
    const { idle, calls, elapse } = setup()
    elapse()
    idle.dispose()
    idle.wake()
    elapse()
    expect(idle.paused()).toBe(false)
    expect(calls).toEqual([true, false])
  })
})
