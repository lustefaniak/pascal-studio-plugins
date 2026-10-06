import { describe, expect, test } from 'bun:test'
import { cameraHostPanel, cameraPlugin } from './index'

describe('studio:camera manifest', () => {
  test('keeps the id scenes already store and targets plugin API v1', () => {
    expect(cameraPlugin.id).toBe('studio:camera')
    expect(cameraPlugin.apiVersion).toBe(1)
  })

  test('contributes the studio:camera node kind', () => {
    expect(cameraPlugin.nodes?.map((definition) => definition.kind)).toEqual(['studio:camera'])
  })

  test('associates the panel with the plugin', () => {
    expect(cameraHostPanel.pluginId).toBe(cameraPlugin.id)
    expect(cameraHostPanel.pluginUrl).toBe(
      'https://github.com/lustefaniak/pascal-studio-plugins/tree/main/packages/camera',
    )
  })
})
