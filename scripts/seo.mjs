import { readFile, writeFile, mkdir, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await readFile(path.join(root, 'project-config.json'), 'utf8'));
const productionUrl = new URL(config.siteUrl);
if (productionUrl.protocol !== 'https:' || productionUrl.username || productionUrl.password || productionUrl.search || productionUrl.hash || !['', '/'].includes(productionUrl.pathname)) {
  throw new Error('project-config.json: siteUrl must be a clean HTTPS origin.');
}
const origin = productionUrl.origin;
const name = config.name || 'Stane';
const privateBuild = config.sitePrivate !== false;
const output = path.join(root, process.argv.includes('--dist') ? 'dist' : 'public');
const distBuild = process.argv.includes('--dist');
const expiry = '2027-04-09T00:00:00Z';
const email = config.securityEmail;
if (email && (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || /[\r\n]/.test(email))) throw new Error('Invalid securityEmail.');

const exists = async (filename) => access(filename).then(() => true, () => false);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const escapeXml = escapeHtml;
const definitions = {
  '/': { title: `${name} — Ciberseguridad, OPSEC y protección de datos`, description: 'Protege lo que importa. Stane diseña estrategias de ciberseguridad, seguridad operacional y protección de información sensible.' },
  '/security': { title: `Divulgación de vulnerabilidades — ${name}`, description: 'Canal de seguridad, alcance y recomendaciones para comunicar de forma responsable una vulnerabilidad a Stane.' },
  '/privacy': { title: `Privacidad — ${name}`, description: 'Información sobre el tratamiento de datos, los servicios de terceros y el ejercicio de tus derechos en Stane.' },
  '/tos': { title: `Términos de servicio — ${name}`, description: '' },
  '/purchase': { title: `Compras — ${name}`, description: '' },
};

function metadata(route, hasSocialImage) {
  const page = definitions[route] || { title: `${name} — Ciberseguridad y OPSEC`, description: definitions['/'].description };
  const canonical = `${origin}${route === '/' ? '/' : route}`;
  const organization = { '@type': 'Organization', '@id': `${origin}/#organization`, name, url: `${origin}/` };
  if (email) organization.contactPoint = { '@type': 'ContactPoint', contactType: 'security', email, availableLanguage: ['es', 'en'] };
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [organization, { '@type': 'WebSite', '@id': `${origin}/#website`, name, url: `${origin}/`, inLanguage: 'es', publisher: { '@id': `${origin}/#organization` } }],
  };
  const socialImage = hasSocialImage ? `\n    <meta property="og:image" content="${origin}/brand/social-card.png">\n    <meta property="og:image:alt" content="${escapeHtml(name)} — Protect what matters">\n    <meta name="twitter:image" content="${origin}/brand/social-card.png">` : '';
  return `<!-- SEO:START -->
    <title>${escapeHtml(page.title)}</title>
    <meta name="description" content="${escapeHtml(page.description)}">
    <meta name="robots" content="${privateBuild ? 'noindex, follow' : 'index, follow'}">
    <link rel="canonical" href="${escapeHtml(canonical)}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${escapeHtml(name)}">
    <meta property="og:locale" content="es_ES">
    <meta property="og:url" content="${escapeHtml(canonical)}">
    <meta property="og:title" content="${escapeHtml(page.title)}">
    <meta property="og:description" content="${escapeHtml(page.description)}">
    <meta name="twitter:card" content="${hasSocialImage ? 'summary_large_image' : 'summary'}">
    <meta name="twitter:title" content="${escapeHtml(page.title)}">
    <meta name="twitter:description" content="${escapeHtml(page.description)}">${socialImage}
    <script type="application/ld+json">${JSON.stringify(structuredData).replace(/</g, '\\u003c')}</script>
    <!-- SEO:END -->`;
}

async function htmlFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory() && !['assets', 'node_modules'].includes(entry.name)) files.push(...await htmlFiles(filename));
    if (entry.isFile() && entry.name.endsWith('.html') && entry.name !== '404.html') files.push(filename);
  }
  return files;
}

if (distBuild && !(await exists(path.join(output, 'index.html')))) throw new Error('Build and prerender the site before running seo.mjs --dist.');
await mkdir(path.join(output, '.well-known'), { recursive: true });
const files = distBuild ? await htmlFiles(output) : [path.join(root, 'index.html')];
const routes = [];
const hasSocialImage = await exists(path.join(output, 'brand', 'social-card.png'));
for (const filename of files) {
  const relative = path.relative(distBuild ? output : root, filename).replaceAll('\\', '/');
  const route = relative === 'index.html' ? '/' : `/${relative.replace(/\/index\.html$/, '').replace(/\.html$/, '')}`;
  const html = await readFile(filename, 'utf8');
  if (/<!-- SEO:START -->[\s\S]*?<!-- SEO:END -->/.test(html)) {
    await writeFile(filename, html.replace(/<!-- SEO:START -->[\s\S]*?<!-- SEO:END -->/, metadata(route, hasSocialImage)), 'utf8');
  } else if (!distBuild || !html.includes('self.__next_f')) {
    throw new Error(`SEO markers missing in ${relative}.`);
  }
  if (definitions[route]) routes.push(route);
}

const icons = [];
for (const size of [192, 512]) {
  const filename = `brand/icon-${size}.png`;
  if (await exists(path.join(root, 'public', filename))) icons.push({ src: `/${filename}`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any' });
}
if (!icons.length && await exists(path.join(root, 'public', 'brand', 'favicon.svg'))) icons.push({ src: '/brand/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' });
const manifest = { id: '/', name, short_name: name, description: definitions['/'].description, lang: 'es', start_url: '/', scope: '/', display: 'standalone', background_color: '#FFFFFF', theme_color: '#2597D0', icons };
const contacts = email ? [`Contact: mailto:${email}`, `Contact: ${origin}/security`] : [`Contact: ${origin}/security`];
const securityTxt = [`# ${name} — responsible vulnerability disclosure`, ...contacts, `Expires: ${expiry}`, `Preferred-Languages: es, en`, `Canonical: ${origin}/.well-known/security.txt`, `Policy: ${origin}/security`, ''].join('\n');
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...new Set(routes)].sort().map((route) => `  <url><loc>${escapeXml(`${origin}${route}${route === '/' ? '' : '/'}`)}</loc></url>`).join('\n')}\n</urlset>\n`;

await writeFile(path.join(output, 'manifest.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
// Crawling remains allowed: a crawler must read HTML to observe the private build's noindex metadata.
await writeFile(path.join(output, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`, 'utf8');
await writeFile(path.join(output, 'sitemap.xml'), sitemap, 'utf8');
await writeFile(path.join(output, '.well-known', 'security.txt'), securityTxt, 'utf8');
// The root copy is a convenient compatibility path; /.well-known/security.txt is canonical.
await (async () => { if (await exists(path.join(output, 'security.txt'))) await (await import('node:fs/promises')).unlink(path.join(output, 'security.txt')); })();
console.log(`SEO prepared for ${origin}: ${routes.length} HTML page(s), manifest, robots, sitemap and security.txt (${privateBuild ? 'private / noindex' : 'public / index'}).`);
