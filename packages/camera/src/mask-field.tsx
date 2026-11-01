'use client'

import { useScene } from '@pascal-app/core'
import type { StudioCameraNode } from './schema'

/**
 * The shot's room mask in the inspector: one checkbox per zone in the scene,
 * by name. Ticking nothing shows the whole scene.
 */
export default function MaskField({
  node,
  onUpdate,
}: {
  node: StudioCameraNode
  onUpdate: (patch: Partial<StudioCameraNode>) => void
}) {
  const nodes = useScene((state) => state.nodes) as Record<string, { type?: string; name?: string }>
  const zones = Object.entries(nodes)
    .filter(([, n]) => n?.type === 'zone')
    .map(([id, n]) => ({ id, name: n.name || id }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const mask = node.mask ?? []
  const toggle = (id: string) =>
    onUpdate({ mask: mask.includes(id) ? mask.filter((m) => m !== id) : [...mask, id] })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12 }}>
      <span style={{ opacity: 0.7 }}>Keep only these rooms</span>
      {zones.map((zone) => (
        <label key={zone.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            checked={mask.includes(zone.id)}
            onChange={() => toggle(zone.id)}
            type="checkbox"
          />
          {zone.name}
        </label>
      ))}
    </div>
  )
}
