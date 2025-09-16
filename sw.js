const CACHE = 'msds-shell-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/catalog.json',
  // incluir aquí recursos estáticos: CSS, icons, admin_qr.html, qrcode lib si está local
];

self.addEventListener('install', event=>{
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event=>{
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event=>{
  const req = event.request;
  // Para el shell: estrategia network first (intentar red, fallback cache)
  if (APP_SHELL.includes(new URL(req.url).pathname)) {
    event.respondWith(
      fetch(req).then(r => {
        // actualizar cache con la respuesta (opcional)
        const copy = r.clone();
        caches.open(CACHE).then(c=> c.put(req, copy));
        return r;
      }).catch(()=>{
        return caches.match(req);
      })
    );
    return;
  }

  // Para PDFs: dejamos que la página (app) se encargue de leer IndexedDB;
  // aquí aplicamos "network first" para que cuando haya red, el navegador descargue el PDF.
  if (req.url.includes('/pdfs/')) {
    event.respondWith(
      fetch(req).catch(()=> caches.match(req) || new Response('', { status: 404 }))
    );
    return;
  }

  // Default: try network, fallback to cache
  event.respondWith(
    fetch(req).catch(()=> caches.match(req) || caches.match('/index.html'))
  );
});
