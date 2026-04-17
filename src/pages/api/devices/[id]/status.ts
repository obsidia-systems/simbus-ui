import type { APIRoute } from 'astro'

import { proxyGet } from '@/lib/proxy'

export const GET: APIRoute = async ({ params }) => proxyGet(params.id!, '/status')
