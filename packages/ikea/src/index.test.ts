import { describe, expect, test } from 'bun:test'
import { ikeaHostPanel, ikeaPlugin } from './index'

describe('studio:ikea manifest', () => {
  test('keeps the id scenes already store and targets plugin API v1', () => {
    expect(ikeaPlugin.id).toBe('studio:ikea')
    expect(ikeaPlugin.apiVersion).toBe(1)
  })

  test('associates the panel with the plugin', () => {
    expect(ikeaHostPanel.pluginId).toBe(ikeaPlugin.id)
    expect(ikeaHostPanel.pluginUrl).toBe(
      'https://github.com/lustefaniak/pascal-studio-plugins/tree/main/packages/ikea',
    )
  })
})
