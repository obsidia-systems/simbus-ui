import type { APIRoute } from 'astro'

import { db } from '@/db'
import { getContainerStatus } from '@/lib/docker'

export const GET: APIRoute = async () => {
  const rows = await db.query.devices.findMany({
    orderBy: (d, { desc }) => [desc(d.createdAt)],
  })

  const withStatus = await Promise.all(
    rows.map(async (device) => {
      const dockerStatus = device.dockerContainerId
        ? await getContainerStatus(device.dockerContainerId)
        : 'unknown'
      return { ...device, dockerStatus }
    }),
  )

  return Response.json(withStatus)
}
