import type { Plugin } from '@pascal-app/core'

/**
 * IKEA — search the catalog and place a product without leaving the editor.
 *
 * Every product's model lives at a predictable URL, so no browser automation
 * and no Tampermonkey script is involved: the worker searches, downloads and
 * measures, and the panel places the result as a normal `item` node.
 */
export const ikeaPlugin: Plugin = {
  id: 'studio:ikea',
  apiVersion: 1,
}

export const ikeaHostPanel = {
  id: 'studio:ikea:panel',
  pluginId: ikeaPlugin.id,
  label: 'IKEA',
  description: 'Search the IKEA catalog: downloads the model, measures it and places it.',
  icon: { kind: 'iconify' as const, name: 'lucide:shopping-bag' },
  component: () => import('./panel'),
  creator: { name: 'Łukasz Stefaniak', url: 'https://github.com/lustefaniak' },
  pluginUrl: 'https://github.com/lustefaniak/pascal-studio-plugins/tree/main/packages/ikea',
  defaultInstalled: true,
}
