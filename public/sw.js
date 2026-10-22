/**
 * Service Worker — Cacheador offline para el POS
 *
 * REGLA CLAVE: La PC de caja la comparten varias personas y Cache Storage
 * no distingue usuario. Por eso NUNCA cacheamos /api (podría servir datos
 * de un usuario anterior a otro). Solo cacheamos estáticos + HTML shell.
 *
 * Qué SÍ cacheamos:
 * - _next/static/* (JS/CSS/assets con hash) → cache-first (nunca cambian)
 * - /manifest.webmanifest, iconos → cache-first
 * - HTML de navegación → network-first (respaldo si cae la red)
 *
 * Qué NO cacheamos:
 * - /api/* (NUNCA, aunque sea GET) — cada usuario necesita sus propios datos
 * - POST/PATCH/DELETE (mutaciones)
 *
 * Invalidación: buildId se inyecta vía mensaje; el deploy nuevo genera
 * cacheName distinto, y los viejos se descartan en activate.
 */

const SW_VERSION = '1.0.0';

let buildId = 'unknown';

const CACHE_NAMES = {
  get htmlCache() {
    return `pos-html-v${SW_VERSION}-${buildId}`;
  },
  get staticCache() {
    return `pos-static-v${SW_VERSION}-${buildId}`;
  },
  get publicCache() {
    return `pos-public-v${SW_VERSION}-${buildId}`;
  },
};

/**
 * Escucha el mensaje del cliente (SwRegisterer.tsx) con el buildId.
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_BUILD_ID') {
    buildId = event.data.buildId;
    console.debug(`[SW] buildId seteado a: ${buildId}`);
  }
});

/**
 * Instalación del SW.
 */
self.addEventListener('install', (event) => {
  console.debug(`[SW] Instalando Service Worker v${SW_VERSION}`);
  self.skipWaiting();
});

/**
 * Activación: limpiar caches viejos (si el buildId cambió).
 */
self.addEventListener('activate', (event) => {
  console.debug(`[SW] Activando Service Worker`);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Si no coincide con el patrón actual (buildId), eliminar
          if (!Object.values(CACHE_NAMES).includes(cacheName)) {
            console.debug(`[SW] Eliminando caché vieja: ${cacheName}`);
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );
  self.clients.claim();
});

/**
 * Intercepción de requests.
 * /api NUNCA se cachea (por privacidad multi-usuario).
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // No cachear navegación entre orígenes, WebSockets, etc.
  if (!url.origin.includes(self.location.origin) || request.method !== 'GET') {
    return;
  }

  // /api NUNCA se cachea (multi-usuario, datos sensibles)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Estrategia por ruta
  if (url.pathname.startsWith('/_next/static/')) {
    // CSS/JS/assets: cache-first (están hasheados)
    event.respondWith(cacheFirst(request, CACHE_NAMES.staticCache));
  } else if (
    url.pathname === '/manifest.webmanifest' ||
    url.pathname.match(/\.(webp|jpeg|jpg|png|svg)$/)
  ) {
    // Manifest + iconos: cache-first
    event.respondWith(cacheFirst(request, CACHE_NAMES.publicCache));
  } else if (url.pathname.startsWith('/private/') || url.pathname.startsWith('/customer/')) {
    // Rutas autenticadas: network-first (respaldo sin red)
    event.respondWith(networkFirst(request, CACHE_NAMES.htmlCache));
  } else if (url.pathname === '/') {
    // Raíz: network-first
    event.respondWith(networkFirst(request, CACHE_NAMES.htmlCache));
  }
});

/**
 * network-first: intenta la red primero, cachea como fallback.
 */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.debug(`[SW] Red falló para ${request.url}, intentando caché`);
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return new Response('Sin conexión y no hay versión cacheada', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

/**
 * cache-first: usa caché si está disponible, senó fetch de la red.
 */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.debug(`[SW] Caché miss y red falló para ${request.url}`);
    return new Response('No disponible', { status: 503 });
  }
}
