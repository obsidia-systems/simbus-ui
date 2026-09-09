import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'

import { load } from 'js-yaml'

import { docker, getContainerLogs } from '@/lib/docker'
import { catalogDir } from '@/lib/paths'
import { simbusImage, yamlBind } from '@/lib/runtime'
import { extractTar } from '@/lib/tar'

export interface CatalogPreset {
  id: string
  source: 'builtin' | 'community'
  filename: string
  name: string
  description: string
  type: string
  yamlPath: string
}

interface Manifest {
  image: string
  syncedAt: number
  presets: CatalogPreset[]
}

function manifestPath(): string {
  return path.join(catalogDir(), 'manifest.json')
}

export function readCatalogCache(): CatalogPreset[] {
  try {
    const raw = fs.readFileSync(manifestPath(), 'utf8')
    const manifest = JSON.parse(raw) as Manifest
    return manifest.presets ?? []
  } catch {
    return []
  }
}

export function getPreset(id: string): CatalogPreset | undefined {
  return readCatalogCache().find((p) => p.id === id)
}

export function readPresetYaml(id: string): string {
  const preset = getPreset(id)
  if (!preset) throw new Error(`Preset not found: ${id}`)
  return fs.readFileSync(preset.yamlPath, 'utf8')
}

function parsePresetMeta(yaml: string): { name: string; description: string; type: string } {
  const doc = load(yaml) as Record<string, unknown> | null
  if (!doc || typeof doc !== 'object') {
    return { name: 'Untitled', description: '', type: 'unknown' }
  }
  const description = typeof doc.description === 'string' ? doc.description.trim() : ''
  return {
    name: typeof doc.name === 'string' ? doc.name : 'Untitled',
    description,
    type: typeof doc.type === 'string' ? doc.type : 'unknown',
  }
}

function scanTree(root: string, source: 'builtin' | 'community'): CatalogPreset[] {
  const dir = path.join(root, source)
  if (!fs.existsSync(dir)) return []
  const entries = fs.readdirSync(dir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
  return entries.map((filename) => {
    const yamlPath = path.join(dir, filename)
    const yaml = fs.readFileSync(yamlPath, 'utf8')
    const meta = parsePresetMeta(yaml)
    const stem = filename.replace(/\.ya?ml$/, '')
    return {
      id: `${source}/${stem}`,
      source,
      filename,
      name: meta.name,
      description: meta.description,
      type: meta.type,
      yamlPath,
    }
  })
}

function findDevicesRoot(extracted: string): string {
  const nested = path.join(extracted, 'devices')
  if (fs.existsSync(path.join(nested, 'builtin'))) return nested
  if (fs.existsSync(path.join(extracted, 'builtin'))) return extracted
  return extracted
}

export async function syncCatalog(): Promise<CatalogPreset[]> {
  await fsPromises.mkdir(catalogDir(), { recursive: true })
  const image = simbusImage()
  const tmpName = `simbus-catalog-sync-${Date.now()}`
  const extractTo = path.join(catalogDir(), '.extract')
  fs.rmSync(extractTo, { recursive: true, force: true })
  fs.mkdirSync(extractTo, { recursive: true })

  const container = await docker.createContainer({
    name: tmpName,
    Image: image,
    Labels: { 'simbus.catalog-sync': 'true' },
  })
  try {
    const archive = await container.getArchive({ path: '/app/devices' })
    await extractTar(archive as unknown as NodeJS.ReadableStream, extractTo)
  } finally {
    await container.remove({ force: true }).catch(() => {})
  }

  const devicesRoot = findDevicesRoot(extractTo)
  const dest = catalogDir()
  for (const source of ['builtin', 'community'] as const) {
    const from = path.join(devicesRoot, source)
    const to = path.join(dest, source)
    fs.rmSync(to, { recursive: true, force: true })
    if (fs.existsSync(from)) {
      fs.cpSync(from, to, { recursive: true })
    }
  }
  fs.rmSync(extractTo, { recursive: true, force: true })

  const presets = [...scanTree(dest, 'builtin'), ...scanTree(dest, 'community')]
  const manifest: Manifest = { image, syncedAt: Date.now(), presets }
  fs.writeFileSync(manifestPath(), JSON.stringify(manifest, null, 2))
  return presets
}

export async function checkYamlFile(
  hostOrVolumePath: string,
  deviceId?: string,
): Promise<{
  ok: boolean
  output: string
}> {
  const image = simbusImage()
  const tmpName = `simbus-check-${Date.now()}`
  const binds = deviceId
    ? yamlBind(deviceId, hostOrVolumePath).binds
    : [`${hostOrVolumePath}:/check/device.yaml:ro`]
  const yamlInContainer = deviceId
    ? yamlBind(deviceId, hostOrVolumePath).yamlPathInContainer
    : '/check/device.yaml'

  const container = await docker.createContainer({
    name: tmpName,
    Image: image,
    Cmd: ['check', yamlInContainer],
    HostConfig: {
      Binds: binds,
      AutoRemove: false,
    },
  })

  try {
    await container.start()
    const result = (await container.wait()) as { StatusCode: number }
    const output = await getContainerLogs(container.id, 100)
    return { ok: result.StatusCode === 0, output }
  } finally {
    await container.remove({ force: true }).catch(() => {})
  }
}
