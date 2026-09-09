import type { APIRoute } from 'astro'

import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { templates } from '@/db/schema'

export const GET: APIRoute = async ({ params }) => {
  const row = await db.query.templates.findFirst({ where: eq(templates.id, params.id!) })
  if (!row) return Response.json({ detail: 'Not found' }, { status: 404 })
  return Response.json(row)
}

export const PATCH: APIRoute = async ({ params, request }) => {
  const body = (await request.json()) as {
    name?: string
    yamlConfig?: string
    description?: string
  }
  const existing = await db.query.templates.findFirst({ where: eq(templates.id, params.id!) })
  if (!existing) return Response.json({ detail: 'Not found' }, { status: 404 })
  await db
    .update(templates)
    .set({
      name: body.name ?? existing.name,
      yamlConfig: body.yamlConfig ?? existing.yamlConfig,
      description: body.description ?? existing.description,
    })
    .where(eq(templates.id, params.id!))
  const row = await db.query.templates.findFirst({ where: eq(templates.id, params.id!) })
  return Response.json(row)
}

export const DELETE: APIRoute = async ({ params }) => {
  await db.delete(templates).where(eq(templates.id, params.id!))
  return new Response(null, { status: 204 })
}
