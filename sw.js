// Service worker minimalista: cachea el "app shell" (HTML/CSS/JS propios +
// íconos) para que la app siga abriendo aunque no haya internet o el
// hosting esté caído momentáneamente. Las librerías de CDN (xlsx, jsbarcode,
// etc.) se dejan pasar directo a la red — no las tocamos para no complicar
// el manejo de CORS entre orígenes.

const CACHE_NAME = 'etiquetas-shell-v1';
const ARCHIVOS_PROPIOS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARCHIVOS_PROPIOS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(
        nombres
          .filter((nombre) => nombre !== CACHE_NAME)
          .map((nombre) => caches.delete(nombre))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Solo interceptamos peticiones a nuestro propio origen (GET).
  // Todo lo demás (CDNs externos) se deja pasar normal a la red.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cacheado) => {
      const redFetch = fetch(event.request)
        .then((respuesta) => {
          if (respuesta && respuesta.ok) {
            const copia = respuesta.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
          }
          return respuesta;
        })
        .catch(() => cacheado);

      // Cache-first para que abra instantáneo; si no hay nada cacheado,
      // esperamos la red.
      return cacheado || redFetch;
    })
  );
});
