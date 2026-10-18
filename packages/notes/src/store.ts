import { create } from 'zustand'

/**
 * What the next click in the 3D view does: pin a new note with this text, or
 * move an existing note onto the clicked spot. `null` leaves clicks to the host.
 */
export type Picking = { mode: 'new'; text: string } | { mode: 'move'; noteId: string } | null

/**
 * The bridge between the Notes panel, which sits outside the canvas, and the
 * pick system inside it, which is the only place that can raycast.
 */
export const useNotesStore = create<{
  picking: Picking
  setPicking: (picking: Picking) => void
}>((set) => ({
  picking: null,
  setPicking: (picking) => set({ picking }),
}))
