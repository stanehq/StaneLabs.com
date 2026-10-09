import React from 'react';
import { renderToString } from 'react-dom/server';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import App from '../src/App';
const shell = readFileSync('dist/index.html', 'utf8');
for (const route of ['/', '/security', '/privacy', '/legal']) {
  const markup = renderToString(<React.StrictMode><App path={route} /></React.StrictMode>);
  const html = shell.replace('<div id="root"></div>', `<div id="root">${markup}</div>`);
  const folder = route === '/' ? 'dist' : path.join('dist', route.slice(1));
  mkdirSync(folder, { recursive: true });
  writeFileSync(path.join(folder, 'index.html'), html);
}
console.log('Prerendered /, /security, /privacy and /legal.');
