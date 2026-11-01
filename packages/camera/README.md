# @lustefaniak/pascal-studio-camera

Pascal editor plugin `studio:camera`: saved camera shots as scene nodes, with a Cameras panel for
framing preview, aiming and rendering. Part of the [Pascal Studio plugins](../../README.md); needs
the studio worker ([contract](../core#the-worker)) to write renders to disk.

## Shots

- `fov` is **vertical**, as in `THREE.PerspectiveCamera`. The capture renders at canvas resolution
  and then crops to the requested aspect, so a file never holds more pixels than the canvas.
- `clip` is a **section cut**: a vertical plane at that many metres in front of the camera, `0` is
  off. Everything nearer is left out of the shot — put the camera behind a wall and the plane just
  past the wall's inner face. It is the capture camera's near plane, so it cuts the host's merged wall
  meshes and slabs with no list of nodes to maintain. A near plane is perpendicular to the view, so a
  shot with a cut is rendered **level** and its `pitch` becomes a vertical lens shift: the same
  framing, verticals stay vertical (two-point perspective), and the wall goes from floor to ceiling.
  The marker draws the plane in the viewport.
- `hide` lists node ids hidden for that shot only (single items in the way).
- `projection` is `eye`, `top` or `ortho`. An `ortho` shot is a parallel projection along yaw and
  `pitch`, `span` metres high, centred on the node's position: pitch -90 gives an orthographic plan,
  yaw 45° with pitch -35.26° an isometric view. The snapshot pipeline is built for one perspective
  camera, so the browser engine draws it as a telephoto from 300 m away (about 3 % scale change
  across a 10 m room); the Blender engine uses a true orthographic camera. `top`, `ortho` looking
  down and any camera above the ceiling drop the ceiling.
- `mask` lists zone ids the shot keeps; empty shows the whole scene. The kept area is each zone's
  outline (on the wall axes) grown by 0.14 m, so the room's own walls and tiles stay whole. A
  masked shot looking down at an angle (isometric, or perspective from above) also gets a cutaway:
  in a band 0.14 m either side of the outline edges that face the camera, only what is below
  `cutaway` metres (default 0.9, 0 off) is kept, so the near walls with their tiles, doors and
  fittings are cut down and stop hiding the room, while the far walls stay full height. `mask.ts` offsets the outline and cuts it into disjoint axis-aligned rectangles (exact for
  rectilinear rooms). For the shot, a mesh entirely outside is hidden, and a mesh crossing the
  outline is put in a `ClippingGroup` with the four vertical planes (plus the cutaway plane) of each
  rectangle it touches,
  cloned once per further rectangle, because a clipping region is convex. It works in every
  projection. Shadows are not clipped, so a removed neighbour still shades the room.

## Idle frame loop

The host advances 50 frames a second whether or not anything changes. While this plugin is loaded,
the frame loop stops after 3 s without activity and starts again on the next one. Activity is
pointer, wheel or keyboard input, a scene change (scripted writes included), a viewer state change,
an asset that finishes loading, or a capture in progress. A pause set by the host is never cleared.

- `?studio-idle-pause=0` keeps the host's constant frame loop.
- `?studio-idle-pause=debug` counts what woke the loop in `window.__studioIdleWakes`.
