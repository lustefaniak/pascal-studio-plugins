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
- `shot` is a stable number and `room` an id from the project's room list; both exist for whatever
  consumes the shots and are never reassigned.
- Markers sit on `OVERLAY_LAYER`, which the capture camera disables, so they never appear in a render.
  `K` toggles them in the viewport.
