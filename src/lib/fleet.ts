import { db } from '@/db'
import { getContainerStatus } from '@/lib/docker'
import { getDeviceApiUrl } from '@/lib/proxy'
import type { PointLive } from '@/types/simbus'

export async function fleetPointsSnapshot(): Promise<
  Array<{ deviceId: string; points: PointLive[] }>
> {
  const rows = await db.query.devices.findMany()
  const frames: Array<{ deviceId: string; points: PointLive[] }> = []

  await Promise.all(
    rows.map(async (device) => {
      if (!device.dockerContainerId) return
      const status = await getContainerStatus(device.dockerContainerId)
      if (status !== 'running') return
      const apiUrl = await getDeviceApiUrl(device.id)
      if (!apiUrl) return
      try {
        const res = await fetch(`${apiUrl}/points`, { signal: AbortSignal.timeout(2500) })
        if (!res.ok) return
        const points = (await res.json()) as PointLive[]
        frames.push({ deviceId: device.id, points })
      } catch {
        /* skip unreachable */
      }
    }),
  )

  return frames
}
