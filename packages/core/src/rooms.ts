import { WORKER_ORIGIN } from './api'

export type Room = { id: string; label: string }

const NONE: Room = { id: '', label: '— none —' }

/**
 * The project's rooms, from the worker (`GET /studio/project`, which reads the
 * project's own config). A shot carries a room id so whatever consumes the
 * shots — a review tool, a prompt per room — can file it; the ids are the
 * project's business, so they are not written into the plugin.
 *
 * Both arrays are filled in place once the worker answers. The camera
 * inspector's `enum` field takes a static array and reads it on every render,
 * so mutating it is how the list reaches the host's inspector without a
 * plugin API for dynamic options. Until then (or with no worker) the only
 * choice is "none", and a shot keeps whatever id it already has.
 */
export const ROOMS: Room[] = [NONE]
export const ROOM_IDS: string[] = [NONE.id]

let loading: Promise<void> | null = null

export function loadRooms(): Promise<void> {
  loading ??= (async () => {
    try {
      const response = await fetch(`${WORKER_ORIGIN}/studio/project`)
      if (!response.ok) return
      const body = (await response.json()) as { rooms?: Room[] }
      const rooms = (body.rooms ?? []).filter((room) => room.id)
      ROOMS.splice(0, ROOMS.length, NONE, ...rooms)
      ROOM_IDS.splice(0, ROOM_IDS.length, ...ROOMS.map((room) => room.id))
    } catch {
      // Worker down: keep "none" and let the next mount try again.
      loading = null
    }
  })()
  return loading
}

export function roomLabel(id: string): string {
  return ROOMS.find((room) => room.id === id)?.label ?? id
}
