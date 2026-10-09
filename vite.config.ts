import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  define: { 'process.env.NEXT_PUBLIC_CONTACT_API_URL': JSON.stringify(process.env.NEXT_PUBLIC_CONTACT_API_URL || '') },
  build: { sourcemap: false },
});
