import type { APIRoute } from 'astro'

import { simbusImage, uiMode } from '@/lib/runtime'

export const GET: APIRoute = async () => {
  return Response.json({
    image: simbusImage(),
    mode: uiMode(),
  })
}
