import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const json = async filename => JSON.parse(await readFile(filename, 'utf8'))
const lock = await json('package-lock.json')
for (const manifest of ['package.json', 'backend/package.json']) {
  const metadata = await json(manifest)
  for (const group of ['dependencies', 'devDependencies']) {
    for (const [name, version] of Object.entries(metadata[group] ?? {})) {
      if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) throw new Error(`Unpinned dependency: ${name}`)
      const resolved = lock.packages[`${manifest === 'package.json' ? '' : 'backend/'}node_modules/${name}`] ?? lock.packages[`node_modules/${name}`]
      if (resolved?.version !== version) throw new Error(`Manifest/lock mismatch: ${name}`)
    }
  }
}
for (const [name, entry] of Object.entries(lock.packages)) {
  if (entry.resolved && !entry.link && !/^sha(?:256|384|512)-[A-Za-z0-9+/=]+$/.test(entry.integrity ?? '')) throw new Error(`Missing strong package integrity: ${name}`)
}
const actions = await json('scripts/ci/actions.lock.json')
for (const file of await readdir('.github/workflows')) {
  if (!/\.ya?ml$/.test(file)) continue
  const source = await readFile(path.join('.github/workflows', file), 'utf8')
  for (const match of source.matchAll(/^\s*uses:\s*(\S+)/gm)) {
    const reference = match[1]
    const pinned = /^([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)@([0-9a-f]{40})$/.exec(reference)
    if (!pinned || actions[pinned[1]]?.commit !== pinned[2]) throw new Error(`Workflow action differs from its verified pin: ${reference}`)
  }
}
const images = await json('scripts/ci/images.lock.json')
for (const key of ['node', 'dockerfile', 'buildkit', 'semgrep']) {
  if (!/^[A-Za-z0-9./_-]+:[A-Za-z0-9._-]+@sha256:[0-9a-f]{64}$/.test(images[key] ?? '')) throw new Error(`Unpinned image: ${key}`)
}
for (const file of ['Dockerfile', 'backend/Dockerfile']) {
  const source = await readFile(file, 'utf8')
  if (!source.startsWith(`# syntax=${images.dockerfile}\n`)) throw new Error(`Docker frontend differs from lock: ${file}`)
  for (const match of source.matchAll(/^FROM\s+(\S+)/gm)) if (match[1] !== images.node) throw new Error(`Base differs from lock: ${file}`)
}
console.log('Verified exact dependency versions, lock integrities, action SHAs and image digests.')
