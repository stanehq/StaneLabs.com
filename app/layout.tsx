import type { ReactNode } from 'react';
import type { Viewport } from 'next';
import config from '../project-config.json';
import '../src/styles.css';
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#2597D0' };
const structuredData = {
  '@context': 'https://schema.org', '@graph': [
    { '@type': 'Organization', '@id': `${config.siteUrl}/#organization`, name: config.name, url: `${config.siteUrl}/`, logo: `${config.siteUrl}/brand/icon-512.png`, contactPoint: { '@type': 'ContactPoint', contactType: 'security', email: config.securityEmail, availableLanguage: ['es', 'en'] } },
    { '@type': 'WebSite', '@id': `${config.siteUrl}/#website`, name: config.name, url: `${config.siteUrl}/`, inLanguage: 'es', publisher: {'@id': `${config.siteUrl}/#organization`} },
  ],
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="es"><head>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
    <link rel="stylesheet" href={'https://fonts.googleapis.com/css2?family=TikTok+Sans:wght@400;500;600&display=swap'} />
    <link rel="stylesheet" href={'https://fonts.googleapis.com/css2?family=Geist:wght@400;500&display=swap'} />
    <link rel="icon" type="image/svg+xml" href="/brand/favicon.svg" />
    <link rel="apple-touch-icon" href="/brand/icon-192.png" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(structuredData).replace(/</g, '\\u003c')}} />
  </head><body>{children}</body></html>;
}
