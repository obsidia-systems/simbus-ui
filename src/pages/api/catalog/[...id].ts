import type { APIRoute } from 'astro'

import { getPreset, readPresetYaml } from '@/lib/catalog'

export const GET: APIRoute = async ({ params }) => {
  const rest = params.id
  const id = Array.isArray(rest) ? rest.join('/') : (rest ?? '')
  const preset = getPreset(id)
  if (!preset) return Response.json({ detail: 'Preset not found' }, { status: 404 })
  try {
    const yaml = readPresetYaml(id)
    return Response.json({ ...preset, yaml })
  } catch {
    return Response.json(
      { detail: 'Preset YAML missing from cache. Sync the catalog.' },
      { status: 404 },
    )
  }
}
