const CACHE_NAME = 'msds-shell-v1';
const APP_SHELL = [
  'index.html',
  'style.css',
  'app.js',
  'manifest.json',
  'catalog.json'
];

self.addEventListener('install', evt=>{
  evt.waitUntil(caches.open(CACHE_NAME).then(c=> c.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', evt=> evt.waitUntil(self.clients.claim()));

self.addEventListener('fetch', evt=>{
  const req = evt.request;
  // Strategy: try network, fallback cache (so updates propagate when online)
  evt.respondWith(
    fetch(req).then(res=>{
      // update cache copy
      const resClone = res.clone();
      caches.open(CACHE_NAME).then(c=> c.put(req, resClone)).catch(()=>{});
      return res;
    }).catch(()=> caches.match(req).then(cRes => cRes || caches.match('index.html')))
  );
});
