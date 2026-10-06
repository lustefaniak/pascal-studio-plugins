import { BaseNode, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'

/**
 * How a shot is framed. `eye` is a normal standing view; `top` looks straight
 * down and asks the capture to drop the ceiling, which would otherwise fill
 * the whole frame with its underside.
 */
export const ShotProjection = z.enum(['eye', 'top'])
export type ShotProjection = z.infer<typeof ShotProjection>

/**
 * A saved camera. Pascal has no camera node of its own, so before this plugin
 * a shot was an `item` holding a marker GLB plus a `metadata` blob that a
 * Python script had to re-interpret. Here the framing *is* the node: move it
 * with the normal gizmo, edit the lens in the inspector, and the capture
 * system reads the very same numbers.
 *
 * `pitch` is degrees rather than radians because it is typed by a human in the
 * inspector; negative looks down. Yaw lives in `rotation[1]` so the host's
 * rotate handle drives it for free, and 0 looks south (+z), matching the plan
 * convention the rest of the project uses.
 */
export const StudioCameraNode = BaseNode.extend({
  id: objectId('camera'),
  type: nodeType('studio:camera'),
  position: z.tuple([z.number(), z.number(), z.number()]).default([0, 1.35, 0]),
  rotation: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  /** Vertical field of view in degrees — the axis THREE.PerspectiveCamera uses. */
  fov: z.number().min(10).max(150).default(62),
  /** Tilt in degrees; negative looks down. */
  pitch: z.number().min(-90).max(90).default(0),
  projection: ShotProjection.default('eye'),
  /**
   * Stable shot number. The review app keys notes by it, so it is assigned
   * once and never reused — renumbering would silently move every comment.
   */
  shot: z.number().int().min(0).default(0),
  /** Room id from the project's room list (see `loadRooms`), or empty when the shot spans several. */
  room: z.string().default(''),
  /**
   * Node ids hidden for the length of this shot only — a wall, its paint, the
   * item standing in the way. Lets a camera stand behind a wall and see the whole
   * room, the cutaway view a small room needs, while the editor keeps the
   * wall. Hidden like the ceiling of a top-down shot: Object3D visibility, put
   * back before the readback.
   */
  hide: z.array(z.string()).default([]),
  /**
   * Section plane, in metres from the camera along the view direction; 0 is off.
   * Everything nearer than the plane is left out of the shot — SketchUp's section
   * cut, aimed with the camera. It is the capture camera's near plane, so it cuts
   * merged wall meshes and slabs alike with nothing to list by hand: stand behind a
   * wall and set the plane just past its room-side face. Shadows still come from
   * the full scene, so the room stays lit as if the wall were there.
   */
  clip: z.number().min(0).max(30).default(0),
})

export type StudioCameraNode = z.infer<typeof StudioCameraNode>
