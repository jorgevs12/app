// ========================================
// SERVICE WORKER - AGENDA (CORREGIDO)
// ========================================

const CACHE_VERSION = 'agenda-v2'; // Incrementé la versión para forzar actualización
const CACHE_NAME = 'agenda-cache-' + CACHE_VERSION;

// Lista unificada de archivos. 
// IMPORTANTE: Asegúrate de que estas rutas sean exactas.
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './agenda.html',
  './ajustes.html',
  './finanzas.html',
  './generador.html',
  './horario.html',
  './notas.html',
  './proyectos.html',
  './salud.html',
  './task.html',
  './comida.html',
  './style.css',
  './db.js',
  './instalador.html',
  './icon-192.png',
  './icon-512.png' 
];

// ========================================
// INSTALL - Asegurar que todo se guarde
// ========================================
self.addEventListener('install', event => {
  console.log('📦 [SW] Instalando versión:', CACHE_VERSION);
  self.skipWaiting(); // Forzar activación inmediata

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('⬇️ Descargando archivos...');
      // Usamos Promise.all (no Settled) para saber si algo falla.
      // Si un archivo no existe, la instalación fallará (y verás el error en consola),
      // lo cual es bueno para debugging.
      return cache.addAll(APP_SHELL).catch(err => {
         console.error("❌ Error crítico cacheando archivos. Verifica las rutas:", err);
      });
    })
  );
});

// ========================================
// ACTIVATE - Limpiar versiones viejas
// ========================================
self.addEventListener('activate', event => {
  console.log('🔄 [SW] Activando...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('🗑️ Borrando caché vieja:', key);
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// ========================================
// FETCH - ESTRATEGIA: CACHE FIRST, FALLBACK NETWORK
// ========================================
self.addEventListener('fetch', event => {
  // Solo interceptamos peticiones GET
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Estrategia: "Cache First" (Primero caché, luego red)
  // Esto hace que la app sea instantánea y funcione offline sí o sí.
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // 1. Si está en caché, lo devolvemos INMEDIATAMENTE
      if (cachedResponse) {
        return cachedResponse;
      }

      // 2. Si no está en caché, intentamos descargarlo (Red)
      return fetch(event.request)
        .then(networkResponse => {
          // Verificamos que la respuesta sea válida
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }

          // 3. Si la red responde bien, guardamos una copia para la próxima
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        })
        .catch(() => {
          // 4. Si falló la red y no estaba en caché (Modo Offline total para algo nuevo)
          
          // Si la petición era para una página HTML, podemos devolver el index o una página offline
          if (event.request.headers.get('accept').includes('text/html')) {
             return caches.match('./index.html');
          }
        });
    })
  );
});