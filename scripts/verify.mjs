import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await readFile(path.join(root, 'project-config.json'), 'utf8'));
const dist = path.join(root, 'dist');
const origin = new URL(config.siteUrl).origin;
const read = (filename) => readFile(path.join(dist, filename), 'utf8');
const manifest = JSON.parse(await read('manifest.webmanifest'));
assert.equal(manifest.name, config.name);
assert.equal(manifest.start_url, '/');
assert.equal(manifest.theme_color, '#2597D0');
assert(manifest.icons.length > 0, 'Manifest requires at least one supplied logo icon.');
for (const icon of manifest.icons) {
  assert(icon.src.startsWith('/') && !icon.src.includes('..'), 'Manifest icons must use local absolute paths.');
  await access(path.join(dist, icon.src.slice(1)));
}

const robots = await read('robots.txt');
assert.match(robots, /^User-agent: \*$/m);
assert.match(robots, /^Allow: \/$/m);
assert(robots.includes(`Sitemap: ${origin}/sitemap.xml`));
const sitemap = await read('sitemap.xml');
const requiredRoutes = ['/', '/security', '/privacy', '/tos', '/purchase'];
for (const route of requiredRoutes) {
  assert(sitemap.includes(`<loc>${origin}${route}${route === '/' ? '' : '/'}</loc>`), `Sitemap missing ${route}.`);
  const filename = route === '/' ? 'index.html' : `${route.slice(1)}/index.html`;
  const html = await read(filename);
  assert.match(html, /<html[^>]*lang="es"/, `${route}: Spanish document language missing.`);
  assert(html.includes(`<link rel="canonical" href="${origin}${route}${route === '/' ? '' : '/'}"`), `${route}: canonical URL missing.`);
  assert(html.includes(`<meta name="robots" content="${config.sitePrivate !== false ? 'noindex, follow' : 'index, follow'}"`), `${route}: indexing directive mismatches configuration.`);
  if (!['/security', '/privacy', '/tos', '/purchase'].includes(route)) assert.match(html, /<meta name="description" content="[^"]{40,}"/, `${route}: description missing.`);
  const ldJson = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
  assert(ldJson.some((item) => item['@graph']?.some((entity) => entity['@type'] === 'Organization')), `${route}: Organization structured data missing.`);
  const mainText = (html.match(/<main\b[\s\S]*?<\/main>/)?.[0] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  if (route === '/') assert(mainText.length > 180, `${route}: content must be prerendered.`);
}

const security = await read('.well-known/security.txt');
assert(security.endsWith('\n'), 'security.txt requires a final line separator.');
const fields = security.split(/\r?\n/).filter((line) => line && !line.startsWith('#')).map((line) => {
  const divider = line.indexOf(':');
  assert(divider > 0, 'security.txt contains a malformed field.');
  return [line.slice(0, divider), line.slice(divider + 1).trim()];
});
const values = (field) => fields.filter(([key]) => key === field).map(([, value]) => value);
assert(values('Contact').includes(`${origin}/security`));
if (config.securityEmail) assert(values('Contact').includes(`mailto:${config.securityEmail}`));
assert.equal(values('Expires').length, 1);
const expiry = Date.parse(values('Expires')[0]);
assert(Number.isFinite(expiry) && expiry > Date.now(), 'security.txt expiry has passed: renew it before release.');
assert.equal(values('Canonical')[0], `${origin}/.well-known/security.txt`);
assert.equal(values('Policy')[0], `${origin}/security`);
assert.equal(values('Preferred-Languages')[0], 'es, en');
assert.equal(await read('security.txt'), security);
console.log(`Verified ${requiredRoutes.length} prerendered routes, SEO metadata, manifest icons and security.txt.`);
