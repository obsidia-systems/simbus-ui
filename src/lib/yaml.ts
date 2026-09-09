import { createHash } from 'node:crypto'
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'

import { instancesDir, instanceYamlPath } from '@/lib/paths'

export function hashYaml(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

/** Set the document `name:` without re-serializing the whole YAML. */
export function applyDeviceName(yaml: string, name: string): string {
  const quoted = JSON.stringify(name)
  if (/^name:\s*/m.test(yaml)) {
    return yaml.replace(/^name:\s*.*$/m, `name: ${quoted}`)
  }
  return `name: ${quoted}\n${yaml}`
}

export async function writeInstanceYaml(deviceId: string, yaml: string): Promise<string> {
  await fsPromises.mkdir(instancesDir(), { recursive: true })
  const filePath = instanceYamlPath(deviceId)
  await fsPromises.writeFile(filePath, yaml, 'utf8')
  return filePath
}

export function readInstanceYaml(deviceId: string): string {
  return fs.readFileSync(instanceYamlPath(deviceId), 'utf8')
}
