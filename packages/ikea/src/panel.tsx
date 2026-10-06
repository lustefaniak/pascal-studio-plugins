'use client'

import {
  fetchIkeaProduct,
  type IkeaHit,
  type IkeaPart,
  type IkeaProduct,
  type IkeaQuality,
  type IkeaVariant,
  importIkea,
  listLibrary,
  S,
  searchIkea,
  usePlaceModel,
  useSceneUsage,
  workerHint,
} from '@lustefaniak/pascal-studio-core'
import { useEffect, useState } from 'react'

/**
 * IKEA catalog.
 *
 * Every product's model sits at a predictable URL, so the whole catalog is
 * reachable without a browser — but the endpoints send no CORS headers, so the
 * search goes through the worker, which also caches it. Caching is not just
 * speed: the same few queries get repeated across sessions, and a cached hit
 * list still works when IKEA is unreachable.
 *
 * A search row is one finish in one size of something IKEA sells in a dozen,
 * and the fittings that go inside a wardrobe frame never come back from a
 * search at all. So a row opens: the worker reads the variant matrix and the
 * product page, and the colours, the other widths, what a set is made of and
 * what goes inside it all become placeable from here.
 */

type Kind = 'all' | 'set' | 'single'

const KINDS: { id: Kind; label: string }[] = [
  { id: 'all', label: 'All' },
  // SPR vs ART is IKEA's own split between a ready-made combination and a
  // single article — the difference between a PAX with doors and a bare frame.
  { id: 'set', label: 'Sets' },
  { id: 'single', label: 'Single' },
]

// A ceiling on how good a model to download, not a level: what a product
// actually publishes varies from six levels to none, so `better` and `max`
// resolve against the product page and fall back to the light `mini`.
const QUALITIES: { id: IkeaQuality; label: string }[] = [
  { id: 'mini', label: 'light' },
  { id: 'better', label: 'better' },
  { id: 'max', label: 'max' },
]

const price = (value: number | null) => (value == null ? '' : `${value.toFixed(0)} PLN`)

const dotted = (...parts: (string | number | null | undefined)[]) =>
  parts.filter((part) => part !== '' && part != null).join(' · ')

export default function IkeaPanel() {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<IkeaHit[] | null>(null)
  const [kind, setKind] = useState<Kind>('all')
  const [quality, setQuality] = useState<IkeaQuality>('better')
  const [cached, setCached] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [opened, setOpened] = useState<string | null>(null)
  const [product, setProduct] = useState<IkeaProduct | null>(null)
  const [loading, setLoading] = useState(false)
  const [imported, setImported] = useState<Map<string, string>>(new Map())
  const place = usePlaceModel()
  const usage = useSceneUsage()

  // Which products are already downloaded, so a repeat search shows it.
  useEffect(() => {
    listLibrary()
      .then((data) => {
        const map = new Map<string, string>()
        for (const model of data.models) {
          // The quality level rides in the filename after the id, so a model
          // imported as `…-80483438-rqp3.glb` still counts as downloaded.
          const id = model.path.match(/(\d{6,})(?:-[a-z0-9]+)?\.glb$/)?.[1]
          if (id) map.set(id, model.path)
        }
        setImported(map)
      })
      .catch(() => {})
  }, [hits, pending])

  const run = async () => {
    if (!query.trim()) return
    setError(null)
    setHits(null)
    setOpened(null)
    setProduct(null)
    try {
      const result = await searchIkea(query.trim())
      setHits(result.hits)
      setCached(Boolean(result.cached))
    } catch (cause) {
      setError(workerHint(cause))
    }
  }

  const open = async (hit: IkeaHit) => {
    if (opened === hit.id) {
      setOpened(null)
      return
    }
    setOpened(hit.id)
    setProduct(null)
    setLoading(true)
    setError(null)
    try {
      setProduct(await fetchIkeaProduct(hit.id))
    } catch (cause) {
      setError(workerHint(cause))
    } finally {
      setLoading(false)
    }
  }

  /** Shared by every list here — a hit, a variant, a part, an accessory. */
  const take = async (id: string, label: string) => {
    setPending(id)
    setError(null)
    try {
      place(await importIkea(id, label, quality))
    } catch (cause) {
      setError(workerHint(cause))
    } finally {
      setPending(null)
    }
  }

  /**
   * `id` as the search returns it keeps the `s` of a set; the library names
   * files after the bare digits, which is also all the model endpoint knows.
   */
  const bare = (id: string) => id.replace(/\D/g, '')

  const state = (id: string, model: boolean) => {
    const path = imported.get(bare(id))
    const placed = path ? (usage.get(path) ?? 0) : 0
    // A downloaded model can be placed again whatever IKEA says today — the
    // file is already on disk.
    return { placed, downloaded: Boolean(path), placeable: model || Boolean(path) }
  }

  const shown = (hits ?? []).filter(
    (hit) => kind === 'all' || (kind === 'set' ? hit.itemType === 'SPR' : hit.itemType !== 'SPR'),
  )

  return (
    <div style={S.body}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void run()
        }}
        style={S.row}
      >
        <input
          onChange={(event) => setQuery(event.target.value)}
          placeholder="e.g. pax, malm, desk"
          style={S.input}
          value={query}
        />
        <button style={S.small} type="submit">
          Search
        </button>
      </form>

      {hits ? (
        <>
          <div style={S.row}>
            <div style={S.segmented}>
              {KINDS.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => setKind(entry.id)}
                  style={kind === entry.id ? { ...S.segment, ...S.segmentActive } : S.segment}
                  type="button"
                >
                  {entry.label}
                </button>
              ))}
            </div>
            {cached ? <span style={S.muted}>cached</span> : null}
          </div>
          <div style={S.row}>
            <span style={S.muted}>Model</span>
            <div style={S.segmented}>
              {QUALITIES.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => setQuality(entry.id)}
                  style={quality === entry.id ? { ...S.segment, ...S.segmentActive } : S.segment}
                  type="button"
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}

      {error ? <p style={S.error}>{error}</p> : null}

      <ul style={S.list}>
        {shown.map((hit) => {
          const { placed, downloaded, placeable } = state(hit.id, hit.model)
          return (
            <Entry
              action={
                placeable ? (
                  <button
                    disabled={pending === hit.id}
                    onClick={() => void take(hit.id, `${hit.name} ${hit.typeName} ${hit.color}`)}
                    style={S.small}
                    type="button"
                  >
                    {pending === hit.id ? '…' : 'Place'}
                  </button>
                ) : null
              }
              badges={
                <>
                  {hit.itemType === 'SPR' ? <span style={S.badge}>set</span> : null}
                  <Status downloaded={downloaded} model={hit.model} placed={placed} />
                </>
              }
              key={hit.id}
              onTitleClick={() => void open(hit)}
              subtitle={dotted(
                hit.typeName,
                hit.measure,
                hit.color,
                price(hit.price),
                // IKEA counts the siblings, not the family — so this row plus
                // 13 others is the 14 the opened list shows.
                hit.variantCount > 0 ? `${hit.variantCount} other variants` : '',
              )}
              thumbnail={hit.thumbnail}
              title={hit.name}
            >
              {opened === hit.id ? (
                loading ? (
                  <p style={S.muted}>Loading variants…</p>
                ) : product ? (
                  <Details onPlace={take} pending={pending} product={product} state={state} />
                ) : null
              ) : null}
            </Entry>
          )
        })}
        {hits && shown.length === 0 ? <p style={S.muted}>No results.</p> : null}
      </ul>
    </div>
  )
}

/**
 * Variants, set contents and accessories for the opened product.
 *
 * The axis chips filter rather than select: IKEA's matrix is not always full
 * (PAX comes in four colours but not every colour in every size), so picking a
 * colour and a width that do not exist together has to leave an empty list
 * instead of resolving to the wrong product.
 */
function Details({
  onPlace,
  pending,
  product,
  state,
}: {
  onPlace: (id: string, label: string) => void
  pending: string | null
  product: IkeaProduct
  state: (id: string, model: boolean) => { placed: number; downloaded: boolean; placeable: boolean }
}) {
  const [pick, setPick] = useState<Record<string, string>>({})

  const toggle = (axis: string, value: string) =>
    setPick((current) => {
      const next = { ...current }
      if (next[axis] === value) delete next[axis]
      else next[axis] = value
      return next
    })

  const variants = product.variants.filter((variant) =>
    Object.entries(pick).every(([axis, value]) => variant.options[axis] === value),
  )

  const row = (
    id: string,
    label: string,
    title: string,
    subtitle: string,
    thumbnail: string,
    model: boolean,
    extra?: React.ReactNode,
  ) => {
    const { placed, downloaded, placeable } = state(id, model)
    return (
      <Entry
        action={
          placeable ? (
            <button
              disabled={pending === id}
              onClick={() => onPlace(id, label)}
              style={S.small}
              type="button"
            >
              {pending === id ? '…' : 'Place'}
            </button>
          ) : null
        }
        badges={
          <>
            {extra}
            <Status downloaded={downloaded} model={model} placed={placed} />
          </>
        }
        key={id}
        subtitle={subtitle}
        thumbnail={thumbnail}
        title={title}
      />
    )
  }

  /**
   * A set's part or an accessory. The range name goes on top on its own — it
   * is short and never truncates, unlike the description, which in a column
   * this narrow would lose its tail to the ellipsis.
   */
  const article = (part: IkeaPart) =>
    row(
      part.id,
      `${part.name} ${part.typeName}`,
      part.name,
      dotted(part.typeName, part.id),
      part.thumbnail,
      part.model,
      part.quantity > 1 ? <span style={S.badge}>×{part.quantity}</span> : null,
    )

  return (
    <div style={{ ...S.list, width: '100%', paddingLeft: 8, gap: 8 }}>
      {product.variants.length > 1 ? (
        <section style={S.list}>
          <Heading>Variants ({product.variants.length})</Heading>
          {product.axes.map((axis) => (
            <div key={axis.id} style={{ ...S.segmented, flexWrap: 'wrap' }}>
              {axis.values.map((value) => (
                <button
                  key={value}
                  onClick={() => toggle(axis.id, value)}
                  style={pick[axis.id] === value ? { ...S.segment, ...S.segmentActive } : S.segment}
                  type="button"
                >
                  {value}
                </button>
              ))}
            </div>
          ))}
          <ul style={S.list}>
            {variants.map((variant: IkeaVariant) =>
              row(
                variant.id,
                `${variant.name} ${variant.typeName} ${variant.color}`,
                // Colour on top, size below: the panel is one column wide and
                // both on one line means the ellipsis eats whichever is second.
                variant.color || variant.name,
                dotted(
                  variant.measure,
                  price(variant.price),
                  variant.current ? 'from results' : '',
                ),
                variant.thumbnail || product.thumbnail,
                variant.model,
              ),
            )}
            {variants.length === 0 ? (
              <p style={S.muted}>IKEA does not combine these options.</p>
            ) : null}
          </ul>
        </section>
      ) : null}

      {product.parts.length > 0 ? (
        <section style={S.list}>
          <Heading>In this set ({product.parts.length})</Heading>
          <ul style={S.list}>{product.parts.map((part: IkeaPart) => article(part))}</ul>
        </section>
      ) : null}

      {product.related.map((group) => (
        <section key={group.group} style={S.list}>
          <Heading>{group.group}</Heading>
          <ul style={S.list}>{group.items.map((item) => article(item))}</ul>
        </section>
      ))}
    </div>
  )
}

function Heading({ children }: { children: React.ReactNode }) {
  return <strong style={{ ...S.muted, textTransform: 'uppercase' }}>{children}</strong>
}

/** Whether the thing can be placed, and whether it already is. */
function Status({
  downloaded,
  model,
  placed,
}: {
  downloaded: boolean
  model: boolean
  placed: number
}) {
  if (placed > 0) return <span style={S.badge}>in scene ×{placed}</span>
  if (downloaded) return <span style={S.badge}>downloaded</span>
  // Said plainly rather than as a disabled button: there is nothing to click,
  // and these rows sit at the bottom of every list the worker returns.
  if (!model) return <span style={S.badge}>no 3D model</span>
  return null
}

/**
 * One row: picture, two lines of text, badges, an action, and whatever the
 * caller wants to unfold underneath. The picture zooms in place — a 34 px
 * thumbnail cannot tell a white desk from an oak one, and this panel is the
 * only place the product is ever seen.
 */
function Entry({
  action,
  badges,
  children,
  onTitleClick,
  subtitle,
  thumbnail,
  title,
}: {
  action?: React.ReactNode
  badges?: React.ReactNode
  children?: React.ReactNode
  onTitleClick?: () => void
  subtitle: string
  thumbnail: string
  title: string
}) {
  const [zoomed, setZoomed] = useState(false)
  const text = (
    <>
      <strong style={S.itemTitle}>{title}</strong>
      <span style={S.muted}>{subtitle}</span>
    </>
  )
  return (
    <li style={{ ...S.item, flexWrap: 'wrap' }}>
      {thumbnail ? (
        <button
          aria-label="Zoom photo"
          onClick={() => setZoomed(!zoomed)}
          style={{ ...S.small, padding: 0, border: 'none', lineHeight: 0 }}
          type="button"
        >
          <img alt="" src={thumbnail} style={S.thumb} />
        </button>
      ) : null}
      {onTitleClick ? (
        <button onClick={onTitleClick} style={S.itemMain} type="button">
          {text}
        </button>
      ) : (
        <span style={S.itemMain}>{text}</span>
      )}
      {badges}
      {action}
      {zoomed && thumbnail ? <img alt={title} src={thumbnail} style={S.preview} /> : null}
      {children}
    </li>
  )
}
