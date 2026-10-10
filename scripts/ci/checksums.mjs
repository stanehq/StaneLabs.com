import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(process.argv[2] ?? '.ci/artifacts')
const names = (await readdir(root, { withFileTypes: true }))
  .filter(entry => entry.isFile() && !/^SHA(?:256|512)SUMS$/.test(entry.name))
  .map(entry => entry.name).sort()
if (!names.includes('image.oci.tar') || !names.includes('stanelabs-web.tar')) throw new Error('Missing release artifacts')
for (const algorithm of ['sha256', 'sha512']) {
  const lines = await Promise.all(names.map(async name => {
    if (!/^[a-zA-Z0-9._-]+$/.test(name)) throw new Error('Unsafe artifact filename')
    const checksum = createHash(algorithm).update(await readFile(path.join(root, name))).digest('hex')
    return `${checksum}  ${name}`
  }))
  await writeFile(path.join(root, `${algorithm.toUpperCase()}SUMS`), lines.join('\n') + '\n')
}
