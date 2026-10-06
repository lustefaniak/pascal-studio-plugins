'use client'

import { useStudioStore } from '@lustefaniak/pascal-studio-core'
import { type AnyNodeId, useRegistry } from '@pascal-app/core'
import { OVERLAY_LAYER, useNodeEvents } from '@pascal-app/viewer'
import { useLayoutEffect, useRef } from 'react'
import { DoubleSide, type Group } from 'three'
import type { StudioCameraNode } from './schema'

const BODY_COLOR = '#2b2f38'
const LENS_COLOR = '#5b8fc7'
const CONE_COLOR = '#f2b134'
const CLIP_COLOR = '#e5484d'

/**
 * The on-screen marker for a saved shot.
 *
 * Everything here sits on `OVERLAY_LAYER`, the layer the host's capture camera
 * switches off. That is the main reason a shot is a node kind rather than a
 * furniture item: markers used to be ordinary `item` models, so every render
 * run had to flip them to `visible: false` over MCP, save the scene, shoot,
 * and put them back — and an interrupted run left the scene with invisible
 * cameras. Now they are simply never in the picture.
 *
 * The casts on `useNodeEvents` mirror the trees plugin: the hook is typed over
 * the host's hand-maintained node union, which plugin kinds are not part of.
 *
 * With the marker switch off it draws nothing at all rather than an invisible
 * body: a `visible={false}` mesh is still in the raycast in current three, so
 * hiding it that way would leave the cameras stealing clicks — which is half
 * of what the switch is for.
 */
export default function StudioCameraRenderer({ node }: { node: StudioCameraNode }) {
  const ref = useRef<Group>(null!)
  useRegistry(node.id as AnyNodeId, node.type, ref)
  const events = useNodeEvents(node as never, node.type as never)
  const markers = useStudioStore((state) => state.markers)

  // The wedge shows where the shot actually points, so a camera can be aimed
  // by eye in the viewport instead of by typing a pitch and re-rendering.
  const tilt = node.projection === 'top' ? -90 : node.pitch
  const spread = Math.tan((node.fov * Math.PI) / 360) * 1.2
  // The section plane, sized to the frustum at its distance (vertical fov; the
  // width assumes a 16:9 frame, which is what the shots are rendered at). It
  // hangs level from the camera: a cut shot is rendered level with a lens shift.
  const clip = node.clip ?? 0
  const clipH = 2 * Math.tan((node.fov * Math.PI) / 360) * clip

  useLayoutEffect(() => {
    ref.current?.traverse((object) => {
      object.layers.set(OVERLAY_LAYER)
    })
  })

  // The group itself stays, so the host registry keeps a live object for this
  // node and selection from the panel still has somewhere to land.
  if (!markers) return <group ref={ref} position={node.position} visible={false} />

  return (
    <group
      ref={ref}
      position={node.position}
      rotation={[0, node.rotation[1], 0]}
      visible={node.visible}
      {...events}
    >
      {/* Lens points along +z, so the marker agrees with `framingOf`. */}
      <mesh>
        <boxGeometry args={[0.11, 0.08, 0.16]} />
        <meshStandardMaterial color={BODY_COLOR} metalness={0.3} roughness={0.4} />
      </mesh>
      {/*
        Negated on purpose. `framingOf` aims along (sin yaw·cos p, sin p, cos yaw·cos p),
        so a negative pitch looks down — but rotating the mesh about +X by the
        same angle sends its local +z to (0, -sin p, cos p), i.e. the other way.
        Without the sign flip every top-down camera pointed at the ceiling.
      */}
      <group rotation={[(-tilt * Math.PI) / 180, 0, 0]}>
        <mesh position={[0, 0, 0.11]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.028, 0.028, 0.075, 20]} />
          <meshStandardMaterial color={LENS_COLOR} metalness={0.6} roughness={0.15} />
        </mesh>
        {/* Sight line: apex at the lens, opening away along the view direction. */}
        <mesh position={[0, 0, 0.75]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[spread, 1.2, 4, 1, true]} />
          <meshBasicMaterial
            color={CONE_COLOR}
            depthWrite={false}
            opacity={0.35}
            transparent
            wireframe
          />
        </mesh>
      </group>
      {/* The section cut is vertical whatever the tilt (see capture-system). */}
      {clip > 0 && (
        <mesh position={[0, 0, clip]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[(clipH * 16) / 9, clipH]} />
          <meshBasicMaterial
            color={CLIP_COLOR}
            depthWrite={false}
            opacity={0.18}
            side={DoubleSide}
            transparent
          />
        </mesh>
      )}
    </group>
  )
}
