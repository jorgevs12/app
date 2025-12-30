const CACHE = "agenda-v1";

const FILES = [
  "./",
  "./index.html",
  "./agenda.html",
  "./ajustes.html",
  "./finanzas.html",
  "./generador.html",
  "./horario.html",
  "./notas.html",
  "./proyectos.html",
  "./salud.html",
  "./task.html",
  "./style.css",
  "./db.js",
  "./manifest.json"
];

// INSTALACIÓN → cachea todos los archivos
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(FILES))
  );
  self.skipWaiting();
});

// ACTIVACIÓN → limpia versiones antiguas
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

// FETCH → sirve desde cache primero
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(resp => {
      return resp || fetch(event.request);
    })
  );
});
