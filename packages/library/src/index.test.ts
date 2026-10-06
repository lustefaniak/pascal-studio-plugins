import { describe, expect, test } from 'bun:test'
import { libraryHostPanel, libraryPlugin } from './index'

describe('studio:library manifest', () => {
  test('keeps the id scenes already store and targets plugin API v1', () => {
    expect(libraryPlugin.id).toBe('studio:library')
    expect(libraryPlugin.apiVersion).toBe(1)
  })

  test('associates the panel with the plugin', () => {
    expect(libraryHostPanel.pluginId).toBe(libraryPlugin.id)
    expect(libraryHostPanel.pluginUrl).toBe(
      'https://github.com/lustefaniak/pascal-studio-plugins/tree/main/packages/library',
    )
  })
})
