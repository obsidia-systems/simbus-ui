import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import type { APIRoute } from 'astro'

import { checkYamlFile } from '@/lib/catalog'

export const POST: APIRoute = async ({ request }) => {
  const body = (await request.json()) as { yaml?: string }
  if (typeof body.yaml !== 'string' || !body.yaml.trim()) {
    return Response.json({ detail: 'yaml is required' }, { status: 400 })
  }
  const tmp = path.join(os.tmpdir(), `simbus-check-${crypto.randomUUID()}.yaml`)
  await fs.writeFile(tmp, body.yaml, 'utf8')
  try {
    const result = await checkYamlFile(tmp)
    return Response.json(result, { status: result.ok ? 200 : 422 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'check failed'
    return Response.json({ ok: false, output: message }, { status: 502 })
  } finally {
    await fs.unlink(tmp).catch(() => {})
  }
}
