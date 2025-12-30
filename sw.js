// ========================================
// SERVICE WORKER - AGENDA (100% OFFLINE)
// Adaptado desde tu versión funcional
// ========================================

const CACHE_VERSION = 'agenda-v1';
const CACHE_NAME = 'agenda-cache-' + CACHE_VERSION;
const INDEX_CACHE = 'agenda-index-cache';

// Archivos CRÍTICOS (siempre disponibles)
const CRITICAL_CACHE = [
  'index.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png'
];

// Archivos de tu app Agenda
const INITIAL_CACHE = [
  './',
  'agenda.html',
  'ajustes.html',
  'finanzas.html',
  'generador.html',
  'horario.html',
  'notas.html',
  'proyectos.html',
  'salud.html',
  'task.html',
  'style.css',
  'db.js',
  'installer.html'
];

// ========================================
// INSTALL - Cachear todo inmediatamente
// ========================================
self.addEventListener('install', event => {
  console.log('📦 [SW] Instalando Agenda...');

  event.waitUntil(
    Promise.all([
      // Cache crítico
      caches.open(INDEX_CACHE).then(cache => {
        console.log('🔴 Cacheando archivos críticos...');
        return Promise.allSettled(
          CRITICAL_CACHE.map(url =>
            cache.add(url).catch(err => {
              console.error('❌ Error cacheando crítico:', url, err);
            })
          )
        );
      }),

      // Cache general
      caches.open(CACHE_NAME).then(cache => {
        console.log('🟢 Cacheando archivos generales...');
        return Promise.allSettled(
          [...CRITICAL_CACHE, ...INITIAL_CACHE].map(url =>
            cache.add(url).catch(err => {
              console.warn('⚠️ No se pudo cachear:', url);
            })
          )
        );
      })
    ])
    .then(() => {
      console.log('✅ Agenda lista para funcionar sin internet');
      self.skipWaiting();
    })
  );
});

// ========================================
// ACTIVATE - Limpiar cachés antiguas
// ========================================
self.addEventListener('activate', event => {
  console.log('🔄 [SW] Activando Agenda...');

  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME && key !== INDEX_CACHE) {
            console.log('🗑️ Eliminando caché antigua:', key);
            return caches.delete(key);
          }
        })
      )
    ).then(() => {
      console.log('✅ SW activo');
      return self.clients.claim();
    })
  );
});

// ========================================
// FETCH - Estrategias inteligentes
// ========================================
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // No cachear POST/PUT/DELETE
  if (req.method !== 'GET') {
    event.respondWith(fetch(req));
    return;
  }

  // 1) index.html → CACHE FIRST
  if (url.pathname.endsWith('index.html') || url.pathname === '/' || url.pathname === '/agenda/') {
    event.respondWith(
      caches.match('index.html', { cacheName: INDEX_CACHE })
        .then(cached => cached || fetch(req))
        .catch(() => caches.match('index.html'))
    );
    return;
  }

  // 2) Otros archivos → NETWORK FIRST con fallback a caché
  event.respondWith(
    fetch(req)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        return res;
      })
      .catch(() => caches.match(req))
  );
});

// ========================================
// MENSAJES - Comunicación con la app
// ========================================
self.addEventListener('message', event => {
  const { type } = event.data || {};

  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      console.log('🗑️ Caché limpiada');
    });
  }

  if (type === 'GET_OFFLINE_STATUS') {
    event.ports[0].postMessage({
      offline: true,
      cacheVersion: CACHE_VERSION
    });
  }
});

console.log('✅ Service Worker de Agenda cargado');
