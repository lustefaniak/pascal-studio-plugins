# @lustefaniak/pascal-studio-notes

Pascal editor plugin `studio:note`: notes pinned in the scene, each a short conversation between
the person working on the model and an agent. Part of the [Pascal Studio plugins](../../README.md).
It needs no worker: a note is an ordinary scene node, so anything that reads the scene graph sees it.

## Why

Asking an agent to change a 3D model meant describing the spot in words: "the second cabinet from
the window, a bit to the left". A note stands on the spot instead, optionally tied to the node it is
about, so the agent gets the place, the thing and the request in one read.

## The node

| field | |
|---|---|
| `position` | the spot, in the level's frame |
| `target` | id of the node the note is about, or empty |
| `thread` | messages, `{author: 'user' \| 'agent', text, at}` |
| `status` | whose turn it is (below) |

| status | meaning | pin |
|---|---|---|
| `open` | the person wrote last, waiting for the agent | blue |
| `thinking` | the agent picked it up | amber |
| `answered` | the agent replied, done or asking back | green |
| `archived` | settled; kept as a record, not drawn | — |

A reply from the person always sets `open`, which also reopens an archived note.

## The panel

Write what should change, press **Pin by clicking the spot** and click it in the 3D view: a wall, a
cabinet, the floor. The pin lands on that surface, tied to the node that was hit, and keeps where the
camera stood (`metadata.view`) and the surface normal (`metadata.normal`), so "on the right" in the
text can be read later. A drag still orbits the view; Esc cancels. **Pin on the selection** puts it on
top of a node picked in the outliner instead.

Selecting a note — in the list or by clicking its pin — opens the thread with a reply box, **Go to**,
**Move** (click the new spot) and **Archive**. ⌘/Ctrl+Enter sends.

## For an agent

Read the scene (`GET /api/scenes/<id>`), take the nodes with `type: "studio:note"` that are `open`,
set `thinking` while working, then append `{author: "agent", text, at}` and set `answered`. Write the
graph back with `expectedVersion` (and `X-Scene-Live: 1` if the host has the live-events patch, so an
open tab shows the reply at once). Archive only when the person says the matter is settled.
