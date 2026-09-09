import type { APIRoute } from 'astro'

import { DeviceError, getDevice, removeDevice, updateDeviceYaml } from '@/lib/devices'

export const GET: APIRoute = async ({ params }) => {
  const device = await getDevice(params.id!)
  if (!device) return Response.json({ detail: 'Device not found' }, { status: 404 })
  return Response.json(device)
}

export const PATCH: APIRoute = async ({ params, request }) => {
  const body = (await request.json()) as { yaml?: string }
  if (typeof body.yaml !== 'string') {
    return Response.json({ detail: 'yaml is required' }, { status: 400 })
  }
  try {
    const device = await updateDeviceYaml(params.id!, body.yaml)
    return Response.json(device)
  } catch (err) {
    if (err instanceof DeviceError) {
      return Response.json({ detail: err.message }, { status: err.status })
    }
    return Response.json({ detail: 'Update failed' }, { status: 500 })
  }
}

export const DELETE: APIRoute = async ({ params }) => {
  try {
    await removeDevice(params.id!)
    return new Response(null, { status: 204 })
  } catch (err) {
    if (err instanceof DeviceError) {
      return Response.json({ detail: err.message }, { status: err.status })
    }
    return Response.json({ detail: 'Remove failed' }, { status: 500 })
  }
}
