const FOLD = new Map(
  Object.entries({ ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z' }),
)

/**
 * Camera name → shot filename stem.
 *
 * Mirrors the worker's own slug function exactly: fold accented letters, take
 * the tail after an em dash, slugify. Both the renderer and the marker conversion go
 * through this, which is what makes a re-render overwrite the existing file
 * instead of creating a second one — the review app keys notes by the entry
 * that filename maps to, so a new name silently orphans every note on it.
 */
export function shotSlug(name: string): string {
  const folded = [...name.toLowerCase()].map((ch) => FOLD.get(ch) ?? ch).join('')
  const tail = folded.split('—').pop()?.split(' - ').pop()?.trim() || folded
  return tail.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}
