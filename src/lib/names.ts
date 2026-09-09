/** Pure naming helpers — safe to import from the client bundle. */

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function containerNameBase(presetId: string | null | undefined, name: string): string {
  const stem = (presetId ?? 'dev').split('/').pop() ?? 'dev'
  const short = stem.replace(/^generic-/, '').slice(0, 24)
  const slug = slugify(name) || 'device'
  return `simbus-${short}-${slug}`.slice(0, 55)
}

/** First free `{base}`, `{base}-2`, `{base}-3`, … not in `taken`. */
export function nextUniqueName(base: string, taken: Iterable<string>, maxLen = 63): string {
  const takenSet = taken instanceof Set ? taken : new Set(taken)
  if (base && !takenSet.has(base)) return base
  const root = base || 'device'
  for (let n = 2; n < 10000; n++) {
    const suffix = `-${n}`
    const candidate = `${root.slice(0, Math.max(1, maxLen - suffix.length))}${suffix}`
    if (!takenSet.has(candidate)) return candidate
  }
  throw new Error(`No unique name available for "${root}"`)
}
