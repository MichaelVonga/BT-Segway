'use strict';
// Keep VERSION identical to nb-offline-version in index.html.
const VERSION = 'web-11.4-offline-1';
const BASE = new URL('./', self.location.href);
const PAGE = new URL('index.html', BASE).href;
const PREFIX = 'nb-bt-offline:' + BASE.pathname + ':';
const CACHE = PREFIX + VERSION;
async function storeOfflinePage() {
  const response = await fetch(PAGE, {cache: 'reload', credentials: 'same-origin'});
  if (!response.ok || !((response.headers.get('content-type') || '').includes('text/html'))) {
    throw new Error('Offline HTML download failed');
  }
  const html = await response.clone().text();
  if (!html.includes('name="nb-offline-version" content="' + VERSION + '"')) {
    throw new Error('HTML and sw.js versions differ; retry after deployment');
  }
  const cache = await caches.open(CACHE);
  await cache.put(PAGE, response);
}
self.addEventListener('install', event => {
  event.waitUntil(storeOfflinePage());
  // No skipWaiting: never replace the controller of an open driving page.
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(PREFIX) && name !== CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || request.mode !== 'navigate' || url.origin !== BASE.origin) return;
  if (url.pathname !== BASE.pathname && url.pathname !== new URL(PAGE).pathname) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE), saved = await cache.match(PAGE);
    if (saved) return saved;
    // No synthetic success page. If the copy was removed, require a real download.
    return fetch(request);
  })());
});
self.addEventListener('message', event => {
  if (!event.data || !['NB_OFFLINE_STATUS','NB_OFFLINE_SAVE'].includes(event.data.type) || !event.ports[0]) return;
  const port = event.ports[0];
  event.waitUntil((async () => {
    let error = '';
    if (event.data.type === 'NB_OFFLINE_SAVE') {try {await storeOfflinePage();} catch (e) {error = e.message;}}
    const cache = await caches.open(CACHE), saved = await cache.match(PAGE);
    port.postMessage({type: 'NB_OFFLINE_STATUS', cached: !!saved, version: VERSION, error});
  })());
});
