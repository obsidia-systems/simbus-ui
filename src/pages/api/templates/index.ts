import type { APIRoute } from 'astro'

import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/db'
import { templates } from '@/db/schema'

export const GET: APIRoute = async () => {
  const rows = await db.select().from(templates).orderBy(templates.createdAt)
  return Response.json(rows)
}

const createSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().nullish(),
  sourcePresetId: z.string().nullish(),
  yamlConfig: z.string().min(1),
})

export const POST: APIRoute = async ({ request }) => {
  const parsed = createSchema.safeParse(await request.json())
  if (!parsed.success) {
    return Response.json({ detail: parsed.error.flatten() }, { status: 400 })
  }
  const row = {
    id: crypto.randomUUID(),
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    sourcePresetId: parsed.data.sourcePresetId ?? null,
    yamlConfig: parsed.data.yamlConfig,
    createdAt: Date.now(),
  }
  await db.insert(templates).values(row)
  return Response.json(row, { status: 201 })
}

export const DELETE: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id')
  if (!id) return Response.json({ detail: 'id required' }, { status: 400 })
  await db.delete(templates).where(eq(templates.id, id))
  return new Response(null, { status: 204 })
}
