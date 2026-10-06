/**
 * Shared plumbing for the three studio plugins (camera, library, ikea).
 *
 * They are separate plugins because they are installed, enabled and evolved
 * separately — but they all talk to the same local worker and place models the
 * same way, and duplicating that per plugin would mean three copies of the
 * placement rules to keep in step.
 */
export {
  completeShotRequest,
  fetchIkeaProduct,
  type IkeaHit,
  type IkeaPart,
  type IkeaProduct,
  type IkeaQuality,
  type IkeaVariant,
  importIkea,
  type LibraryModel,
  listLibrary,
  nextShotRequest,
  postSceneGlb,
  postShot,
  type ShotRequest,
  searchIkea,
  WORKER_ORIGIN,
  watchLibrary,
} from './api'
export { shotSlug } from './naming'
export { loadRooms, ROOM_IDS, ROOMS, type Room, roomLabel } from './rooms'
export { type ShotJob, useStudioStore } from './store'
export { S, usePlaceModel, useSceneUsage, workerHint } from './ui'
