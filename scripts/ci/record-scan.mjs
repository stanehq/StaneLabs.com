import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

const root = '.ci/artifacts'
const info = JSON.parse(await readFile(`${root}/build-info.json`, 'utf8'))
const metadata = JSON.parse(await readFile('.ci/trivy/db/metadata.json', 'utf8'))
const database = await readFile('.ci/trivy/db/trivy.db')
const sbom = JSON.parse(await readFile(`${root}/image.sbom.spdx.json`, 'utf8'))
const webSbom = JSON.parse(await readFile(`${root}/web.sbom.spdx.json`, 'utf8'))
const sourceSbom = JSON.parse(await readFile(`${root}/source-dependencies.sbom.spdx.json`, 'utf8'))
if ([sbom, webSbom, sourceSbom].some(document => document.spdxVersion !== 'SPDX-2.3')) throw new Error('Expected SPDX 2.3 SBOMs for the signing policy')
const statements = JSON.parse(await readFile(`${root}/buildkit-statements.json`, 'utf8'))
if (!statements.some(statement => statement.predicateType?.startsWith('https://slsa.dev/provenance/'))) throw new Error('Missing BuildKit provenance')
info.securityScan = {
  severities: ['HIGH', 'CRITICAL'],
  trivyDatabase: { ...metadata, sha256: createHash('sha256').update(database).digest('hex') },
  runtimeSbom: 'image.sbom.spdx.json',
  staticAssetSbom: 'web.sbom.spdx.json',
  sourceDependencySbom: 'source-dependencies.sbom.spdx.json',
  note: 'The asset SBOM inventories exported files. The separate source SBOM inventories frontend/backend build inputs including development dependencies; it does not claim that every source package ships in the runtime.'
}
await writeFile(`${root}/trivy-db-metadata.json`, JSON.stringify(info.securityScan.trivyDatabase, null, 2) + '\n')
await writeFile(`${root}/build-info.json`, JSON.stringify(info, null, 2) + '\n')
