import type { APIRoute } from 'astro'

import { DeviceError, getDevice } from '@/lib/devices'
import { readInstanceYaml } from '@/lib/yaml'

export const GET: APIRoute = async ({ params }) => {
  try {
    const device = await getDevice(params.id!)
    if (!device) return Response.json({ detail: 'Device not found' }, { status: 404 })
    const yaml = readInstanceYaml(params.id!)
    return new Response(yaml, { headers: { 'Content-Type': 'text/yaml; charset=utf-8' } })
  } catch (err) {
    if (err instanceof DeviceError) {
      return Response.json({ detail: err.message }, { status: err.status })
    }
    return Response.json({ detail: 'YAML not found' }, { status: 404 })
  }
}
