import type { Plugin } from '@pascal-app/core'

/**
 * Library — the project's own GLB models, browsable in the editor.
 *
 * Pascal's built-in catalog is fine but fixed; the models that matter here are
 * made-to-measure pieces a project generates with its own scripts. They are
 * served by the local worker on the port their URLs already point at, so a
 * model regenerated on disk shows up on the next page load.
 *
 * No node kinds: models are placed as ordinary `item` nodes, which keeps them
 * selectable, movable and exportable like everything else in the scene.
 */
export const libraryPlugin: Plugin = {
  id: 'studio:library',
  apiVersion: 1,
}

export const libraryHostPanel = {
  id: 'studio:library:panel',
  pluginId: libraryPlugin.id,
  label: 'Library',
  description: 'Local GLB models — dimensions read from the file and a usage count in the scene.',
  icon: { kind: 'iconify' as const, name: 'lucide:boxes' },
  component: () => import('./panel'),
  creator: { name: 'Łukasz Stefaniak', url: 'https://github.com/lustefaniak' },
  pluginUrl: 'https://github.com/lustefaniak/pascal-studio-plugins/tree/main/packages/library',
  defaultInstalled: true,
}
