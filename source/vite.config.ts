/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Writes dist/sw.js after the bundle is built. The service worker gets the
 * exact list of built files and a cache version derived from their names, so
 * every new deploy uses a fresh cache and old ones are deleted.
 */
function serviceWorker(): Plugin {
  return {
    name: 'monitortest-sw',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const version = createHash('sha256').update(files.sort().join('|')).digest('hex').slice(0, 12);
      const shell = ['./', './index.html', ...files.filter((f) => f !== 'index.html').map((f) => './' + f)];
      const source = `/* MonitorTest service worker (generated at build) */
const CACHE = 'monitortest-${version}';
const SHELL = ${JSON.stringify(shell)};
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('monitortest-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // Network first so updates arrive; fall back to the cached app shell offline.
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html', { ignoreSearch: true }).then((r) => r || caches.match('./')))
    );
    return;
  }
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      // Only cache real files; never store the fallback HTML page under a script or style address.
      const type = res.headers.get('content-type') || '';
      if (res.ok && !type.includes('text/html')) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }))
  );
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}


/**
 * Writes dist/_headers (used by Netlify for both Git and drag-and-drop deploys) with a strict
 * Content-Security-Policy. Inline scripts in index.html are allowed by their exact SHA-256 hash.
 */
function securityHeaders(): Plugin {
  let outDir = 'dist';
  return {
    name: 'monitortest-headers',
    apply: 'build',
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir);
    },
    closeBundle() {
      const html = readFileSync(resolve(outDir, 'index.html'), 'utf8');
      const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
        (m) => `'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`
      );
      const csp = [
        "default-src 'self'",
        `script-src 'self' ${hashes.join(' ')}`,
        "style-src 'self'",
        "img-src 'self' data:",
        "connect-src 'self'",
        "worker-src 'self'",
        "manifest-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'none'",
        "frame-ancestors 'none'",
      ].join('; ');
      const headers = `/*
  Content-Security-Policy: ${csp}
  Referrer-Policy: no-referrer
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Cross-Origin-Opener-Policy: same-origin

/sw.js
  Cache-Control: no-cache

/index.html
  Cache-Control: no-cache

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`;
      writeFileSync(resolve(outDir, '_headers'), headers);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), serviceWorker(), securityHeaders()],
  build: { target: 'es2020', sourcemap: false },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
});
