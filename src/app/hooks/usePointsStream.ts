import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import type { PointLive } from '@/types/simbus'

export function usePointsStream(deviceId: string | undefined, enabled: boolean) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!deviceId || !enabled) return
    const source = new EventSource(`/api/devices/${deviceId}/points/stream`)
    source.onmessage = (event) => {
      try {
        const points = JSON.parse(event.data) as PointLive[]
        queryClient.setQueryData(['points', deviceId], points)
      } catch {
        /* ignore */
      }
    }
    return () => source.close()
  }, [deviceId, enabled, queryClient])
}
