import type { APIRoute } from 'astro'

import { fleetPointsSnapshot } from '@/lib/fleet'

export const GET: APIRoute = async ({ request }) => {
  const encoder = new TextEncoder()
  let closed = false
  let inFlight = false
  let interval: ReturnType<typeof setInterval> | undefined

  const stream = new ReadableStream({
    start(controller) {
      const close = () => {
        if (closed) return
        closed = true
        if (interval) clearInterval(interval)
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }

      const send = (payload: unknown) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
        } catch {
          close()
        }
      }

      const tick = async () => {
        if (closed || inFlight) return
        inFlight = true
        try {
          const frames = await fleetPointsSnapshot()
          send({ frames })
        } catch {
          send({ frames: [] })
        } finally {
          inFlight = false
        }
      }

      void tick()
      interval = setInterval(() => {
        void tick()
      }, 2000)

      request.signal.addEventListener('abort', close)
    },
    cancel() {
      closed = true
      if (interval) clearInterval(interval)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
