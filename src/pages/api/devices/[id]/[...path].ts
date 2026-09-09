import type { APIRoute } from 'astro'

import { proxyRequest, proxySse } from '@/lib/proxy'

const METHODS = new Set(['GET', 'POST', 'PATCH', 'DELETE', 'PUT'])

const handler: APIRoute = async ({ params, request }) => {
  if (!METHODS.has(request.method)) {
    return new Response(null, { status: 405 })
  }

  const rest = params.path
  const suffix = Array.isArray(rest) ? rest.join('/') : (rest ?? '')
  const url = new URL(request.url)
  const path = `/${suffix}${url.search}`

  if (path.includes('/stream')) {
    return proxySse(params.id!, path)
  }

  const headers = new Headers()
  const contentType = request.headers.get('content-type')
  if (contentType) headers.set('Content-Type', contentType)

  const body =
    request.method === 'GET' || request.method === 'DELETE'
      ? undefined
      : await request.arrayBuffer()

  return proxyRequest(params.id!, path, {
    method: request.method,
    headers,
    body: body && body.byteLength > 0 ? body : undefined,
  })
}

export const GET = handler
export const POST = handler
export const PATCH = handler
export const PUT = handler
export const DELETE = handler
