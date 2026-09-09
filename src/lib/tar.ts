import fs from 'node:fs'
import path from 'node:path'

/** Extract a POSIX ustar stream (Docker getArchive) into dest. */
export async function extractTar(stream: NodeJS.ReadableStream, dest: string): Promise<void> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const buf = Buffer.concat(chunks)
  let offset = 0
  while (offset + 512 <= buf.length) {
    const header = buf.subarray(offset, offset + 512)
    if (header.every((b) => b === 0)) break

    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '')
    const sizeOct = header.subarray(124, 136).toString('utf8').replace(/\0.*$/, '').trim()
    const size = Number.parseInt(sizeOct, 8) || 0
    const typeFlag = String.fromCharCode(header[156] ?? 0)
    const prefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/, '')
    const fullName = prefix ? path.posix.join(prefix, name) : name

    offset += 512
    const data = buf.subarray(offset, offset + size)
    offset += Math.ceil(size / 512) * 512
    if (!fullName) continue

    const out = path.join(dest, fullName)
    if (typeFlag === '5' || fullName.endsWith('/')) {
      fs.mkdirSync(out, { recursive: true })
    } else {
      fs.mkdirSync(path.dirname(out), { recursive: true })
      fs.writeFileSync(out, data)
    }
  }
}
