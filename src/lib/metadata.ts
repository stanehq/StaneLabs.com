import type { Metadata } from 'next';
import config from '../../project-config.json';
const pages: Record<string, [string, string]> = {
  '/': ['StaneLabs — Ciberseguridad, OPSEC y protección de datos', 'Seguridad con criterio. StaneLabs: ciberseguridad, seguridad operativa y protección de información sensible. Menos exposición. Más control.'],
  '/security': ['Divulgación responsable — StaneLabs', 'Canal de seguridad y pautas para comunicar responsablemente posibles vulnerabilidades en StaneLabs.'],
  '/privacy': ['Privacidad — StaneLabs', 'Información sobre el funcionamiento del contacto, los recursos externos y la privacidad del sitio de StaneLabs.'],
  '/legal': ['Información legal — StaneLabs', 'Información del sitio de StaneLabs, alcance del contenido y condiciones de la versión privada de revisión.'],
};
export function pageMetadata(route: string): Metadata {
  const [title, description] = pages[route] || pages['/'];
  return {
    title, description, metadataBase: new URL(config.siteUrl),
    alternates: { canonical: route },
    robots: { index: !config.sitePrivate, follow: true },
    openGraph: { type: 'website', siteName: config.name, locale: 'es_ES', title, description, url: route, images: [{ url: '/brand/social-card.png', width: 1200, height: 630, alt: 'StaneLabs — Ciberseguridad. OPSEC. Privacidad.' }] },
    twitter: { card: 'summary_large_image', title, description, images: ['/brand/social-card.png'] },
  };
}
