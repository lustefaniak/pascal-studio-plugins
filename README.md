# Pascal Studio plugins

Plugins for the [Pascal editor](https://github.com/pascalorg/editor), built for interior design work
on a real flat. Each plugin is its own package and works without the others; they share one package
of plumbing.

| package | plugin | panel | what it does |
|---|---|---|---|
| [`@lustefaniak/pascal-studio-camera`](packages/camera) | `studio:camera` | Cameras | Saved shots as scene nodes: framing preview, aiming, a vertical section cut per shot, rendering through the host's snapshot pipeline — also from a headless browser. |
| [`@lustefaniak/pascal-studio-library`](packages/library) | `studio:library` | Library | The project's own GLB models, with dimensions read from the file and a usage count in the scene. Refreshes as models are regenerated on disk. |
| [`@lustefaniak/pascal-studio-ikea`](packages/ikea) | `studio:ikea` | IKEA | Search the IKEA catalog, pick a colour or size variant, download the model, measure it and place it. |
| [`@lustefaniak/pascal-studio-core`](packages/core) | — | — | The studio worker client, the project's room list, the shared store and model placement. |

Every package is structurally a third-party plugin, the same shape as
[`pascalorg/plugin-trees`](https://github.com/pascalorg/plugin-trees): it ships TypeScript sources,
peer-depends on `@pascal-app/{core,viewer,editor}` and imports nothing private. The plugins target
plugin API v1. The UI is English; Pascal has no localisation layer for a plugin to hook into.

All three panels talk to a small local HTTP service, the **studio worker** — see
[`packages/core`](packages/core#the-worker) for its contract.

## Using a plugin in a host

Pascal has no runtime plugin loader yet, so a plugin is compiled into the editor build. In a
checkout of `pascalorg/editor`, for each plugin you want (the camera one shown):

1. Add the package (and `@lustefaniak/pascal-studio-core`) to `apps/editor/package.json`.
2. Add both names to `transpilePackages` in `apps/editor/next.config.ts` — the packages ship
   sources, not a build.
3. Register the plugin in `apps/editor/lib/bootstrap.ts`, next to the first-party ones:

```ts
import { cameraHostPanel, cameraPlugin } from '@lustefaniak/pascal-studio-camera'

extendPluginDiscovery(async () => [cameraPlugin])
registerEditorHostPanel(cameraHostPanel)
```

Plugin and node ids keep the `studio:` prefix: `studio:camera` nodes are stored in scenes, and
renaming a kind is a migration.

## Development

A bun workspace; the checks run against the published `@pascal-app/*` packages, no editor needed.

```bash
bun install
bun run check-types
bun run lint          # biome, with the editor's own config
bun test
```

## License

MIT
