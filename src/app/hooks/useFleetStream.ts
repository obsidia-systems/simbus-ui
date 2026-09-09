import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import type { PointLive } from '@/types/simbus'

export type FleetMap = Record<string, PointLive[]>

export function useFleetStream() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const source = new EventSource('/api/fleet/stream')
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          frames: Array<{ deviceId: string; points: PointLive[] }>
        }
        const next: FleetMap = {}
        for (const frame of payload.frames ?? []) {
          next[frame.deviceId] = frame.points
        }
        queryClient.setQueryData(['fleet'], next)
      } catch {
        /* ignore malformed frames */
      }
    }
    return () => source.close()
  }, [queryClient])
}
