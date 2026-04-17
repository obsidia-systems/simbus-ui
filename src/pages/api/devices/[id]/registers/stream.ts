import type { APIRoute } from 'astro'

import { proxySse } from '@/lib/proxy'

export const GET: APIRoute = async ({ params }) => proxySse(params.id!)
