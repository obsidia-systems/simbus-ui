import fs from 'node:fs'
import path from 'node:path'

const DB_PATH = process.env.DATABASE_URL ?? './data/simbus.db'

export function dataDir(): string {
  return path.resolve(path.dirname(DB_PATH))
}

export function instancesDir(): string {
  return path.join(dataDir(), 'instances')
}

export function catalogDir(): string {
  return path.join(dataDir(), 'catalog')
}

export function instanceYamlPath(deviceId: string): string {
  return path.join(instancesDir(), `${deviceId}.yaml`)
}

export function ensureDataDirs(): void {
  fs.mkdirSync(instancesDir(), { recursive: true })
  fs.mkdirSync(catalogDir(), { recursive: true })
}
