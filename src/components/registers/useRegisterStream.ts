import { useEffect, useRef, useState } from 'react'

import type { RegisterSnapshot } from '@/types/simbus'

type StreamState = 'connecting' | 'live' | 'error' | 'closed'

export function useRegisterStream(deviceId: string) {
  const [snapshot, setSnapshot] = useState<RegisterSnapshot | null>(null)
  const [state, setState] = useState<StreamState>('connecting')
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    let active = true

    function connect() {
      if (!active) return
      setState('connecting')

      const es = new EventSource(`/api/devices/${deviceId}/registers/stream`)
      esRef.current = es

      function handleEvent(e: MessageEvent) {
        if (!active) return
        try {
          const parsed = JSON.parse(e.data) as RegisterSnapshot
          setSnapshot(parsed)
          setState('live')
        } catch {
          // malformed frame — ignore
        }
      }

      // onmessage only fires for unnamed events (type "message").
      // Simbus may send named events like "event: tick" — cover both.
      es.onmessage = handleEvent
      for (const name of ['tick', 'registers', 'update', 'snapshot']) {
        es.addEventListener(name, handleEvent)
      }

      es.onerror = () => {
        es.close()
        if (!active) return
        setState('error')
        // Reconnect after 3 s
        setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      active = false
      esRef.current?.close()
    }
  }, [deviceId])

  return { snapshot, state }
}
