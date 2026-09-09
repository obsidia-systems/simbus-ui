import type { APIRoute } from 'astro'

import { readCatalogCache, syncCatalog } from '@/lib/catalog'

export const GET: APIRoute = async () => {
  let presets = readCatalogCache()
  if (presets.length === 0) {
    try {
      presets = await syncCatalog()
    } catch {
      presets = []
    }
  }
  return Response.json(presets)
}

export const POST: APIRoute = async () => {
  try {
    const presets = await syncCatalog()
    return Response.json(presets)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Catalog sync failed'
    return Response.json({ detail: message }, { status: 502 })
  }
}
