import type { AnyNodeDefinition, Plugin } from '@pascal-app/core'
import { cameraDefinition } from './definition'

/**
 * Cameras — saved shots as scene nodes.
 *
 * A shot used to be a marker item plus a `metadata` blob that a Python script
 * re-interpreted, and rendering one meant driving Chrome from outside: a
 * `__THREE_DEVTOOLS__` hook to reach the camera, synthetic pointer moves to
 * force a frame, guesswork to hide the grid, and a canvas read-back. Here the
 * framing is the node, the markers live on the overlay layer so they are never
 * in the picture, and the render goes through the host's own snapshot pipeline.
 */
export const cameraPlugin: Plugin = {
  id: 'studio:camera',
  apiVersion: 1,
  nodes: [cameraDefinition as unknown as AnyNodeDefinition],
}

export const cameraHostPanel = {
  id: 'studio:camera:panel',
  pluginId: cameraPlugin.id,
  label: 'Cameras',
  description: 'Saved shots: framing preview, aiming and rendering through the worker.',
  icon: { kind: 'iconify' as const, name: 'lucide:camera' },
  component: () => import('./panel'),
  kinds: ['studio:camera'],
  creator: { name: 'Łukasz Stefaniak', url: 'https://github.com/lustefaniak' },
  pluginUrl: 'https://github.com/lustefaniak/pascal-studio-plugins/tree/main/packages/camera',
  defaultInstalled: true,
}

export { cameraDefinition } from './definition'
export { framingOf, topDownHeight } from './framing'
export { StudioCameraNode } from './schema'
