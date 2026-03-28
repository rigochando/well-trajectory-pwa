// =============================================================================
// SERVICE WORKER — Well Trajectory Calculator PWA
// =============================================================================
// COMO ACTUALIZAR LA APP:
// 1. Haz tus cambios en index.html (o cualquier archivo)
// 2. Cambia APP_VERSION abajo (ej: '2.1' -> '2.2')
// 3. Haz push a GitHub
// 4. Los usuarios recibiran la actualizacion automaticamente
// =============================================================================

const APP_VERSION = '2.2';
const CACHE_NAME = 'well-traj-v' + APP_VERSION;

// Archivos locales de la app (rutas relativas para GitHub Pages)
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Recursos externos (se cachean en segundo plano)
const EXTERNAL = [
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=DM+Sans:wght@400;500;600;700&display=swap',
  'https://cdn.plot.ly/plotly-2.27.0.min.js'
];

// =============================================================================
// INSTALL: Cachear todo al instalar nueva version
// =============================================================================
self.addEventListener('install', event => {
  console.log('[SW] Instalando version', APP_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cachear app shell (obligatorio)
      return cache.addAll(APP_SHELL).then(() => {
        // Cachear externos (no bloquea si falla)
        return Promise.allSettled(
          EXTERNAL.map(url => cache.add(url).catch(() => {}))
        );
      });
    })
    // skipWaiting() forza que el nuevo SW tome control inmediatamente
    // sin esperar a que el usuario cierre todas las pestanas
    .then(() => self.skipWaiting())
  );
});

// =============================================================================
// ACTIVATE: Borrar caches viejos y tomar control
// =============================================================================
self.addEventListener('activate', event => {
  console.log('[SW] Activando version', APP_VERSION);
  event.waitUntil(
    caches.keys().then(keys => {
      // Borrar TODOS los caches que no sean la version actual
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Borrando cache viejo:', key);
            return caches.delete(key);
          })
      );
    })
    // clients.claim() hace que el nuevo SW controle las pestanas abiertas
    // sin necesidad de recargar manualmente
    .then(() => self.clients.claim())
    // Notificar a la app que hay una nueva version disponible
    .then(() => {
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_UPDATED',
            version: APP_VERSION
          });
        });
      });
    })
  );
});

// =============================================================================
// FETCH: Estrategia Network-First para HTML, Cache-First para assets
// =============================================================================
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Para navegacion (HTML) -> Network First
  // Esto asegura que siempre se sirva la version mas reciente
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Actualizar cache con la version fresca
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          // Sin internet -> servir desde cache
          return caches.match('./index.html');
        })
    );
    return;
  }

  // Para assets (JS, CSS, fonts, imagenes) -> Cache First
  // Son archivos que no cambian frecuentemente
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => null);
    })
  );
});
