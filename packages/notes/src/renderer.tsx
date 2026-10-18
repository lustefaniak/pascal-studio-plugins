'use client'

import { type AnyNodeId, useRegistry } from '@pascal-app/core'
import { OVERLAY_LAYER, useNodeEvents } from '@pascal-app/viewer'
import { useLayoutEffect, useRef } from 'react'
import type { Group } from 'three'
import type { StudioNoteNode } from './schema'
import { STATUS_COLOR } from './thread'

/**
 * The pin: a ball in the status colour with a point under it marking the exact
 * spot. On `OVERLAY_LAYER`, like the camera markers, so a note never ends up
 * in a render. An archived note draws nothing (an invisible mesh would still
 * catch clicks); the group stays so the registry keeps an object to select.
 */
export default function StudioNoteRenderer({ node }: { node: StudioNoteNode }) {
  const ref = useRef<Group>(null!)
  useRegistry(node.id as AnyNodeId, node.type, ref)
  const events = useNodeEvents(node as never, node.type as never)

  useLayoutEffect(() => {
    ref.current?.traverse((object) => {
      object.layers.set(OVERLAY_LAYER)
    })
  })

  if (node.status === 'archived') {
    return <group position={node.position} ref={ref} visible={false} />
  }

  const colour = STATUS_COLOR[node.status]
  return (
    <group position={node.position} ref={ref} visible={node.visible} {...events}>
      {/* The tip sits on the spot; the ball floats above it. */}
      <mesh position={[0, 0.06, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.025, 0.12, 12]} />
        <meshStandardMaterial color={colour} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.16, 0]}>
        <sphereGeometry args={[0.06, 20, 14]} />
        <meshStandardMaterial
          color={colour}
          emissive={colour}
          emissiveIntensity={node.status === 'thinking' ? 0.6 : 0.25}
          roughness={0.35}
        />
      </mesh>
    </group>
  )
}
