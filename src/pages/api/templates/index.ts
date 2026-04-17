import type { APIRoute } from 'astro'

import { db } from '@/db'
import { templates } from '@/db/schema'

export const GET: APIRoute = async () => {
  const rows = await db.select().from(templates).orderBy(templates.createdAt)
  return Response.json(rows)
}
