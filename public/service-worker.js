"use strict";
/// <reference lib="webworker" />
const sw = self;
// 📌 Versionado de cache
const CACHE_VERSION = "v8"; // súbelo al siguiente número
const STATIC_CACHE = `preventa-static-${CACHE_VERSION}`;
const IMAGE_CACHE = `preventa-images-${CACHE_VERSION}`;
const API_CACHE = `preventa-api-${CACHE_VERSION}`;
// Assets a precachear
const ASSETS_TO_CACHE = [
    "/",
    "/login",
    "/products",
    "/manifest.json",
    "/icon-192.png",
    "/icon-512.png",
    "/offline.html",
];
// Endpoints críticos
const CRITICAL_APIS = ["/api/catalogos", "/api/clientes", "/api/productos"];
// 📌 Instalación → cachear assets
sw.addEventListener("install", (event) => {
    event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(ASSETS_TO_CACHE)));
});
// 📌 Activación → limpiar caches viejos
sw.addEventListener("activate", (event) => {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys
        .filter((k) => ![STATIC_CACHE, IMAGE_CACHE, API_CACHE].includes(k))
        .map((k) => caches.delete(k)))));
});
// 📌 Estrategias de fetch
sw.addEventListener("fetch", (event) => {
    const req = event.request;
    // ⛔ No cachear POST ni auth
    if (req.method !== "GET" || req.url.includes("/auth/")) {
        return;
    }
    // Imágenes (incluye fotos.codimisa.com)
    if (req.destination === "image" || req.url.includes("fotos.codimisa.com")) {
        event.respondWith(cacheFirstUpdateImages(req));
        return;
    }
    // APIs críticos (productos, clientes, catálogos)
    if (CRITICAL_APIS.some((api) => req.url.includes(api))) {
        event.respondWith(networkFirstAPI(req));
        return;
    }
    // Otros assets → stale-while-revalidate
    event.respondWith(staleWhileRevalidate(req));
});
// 🔹 Estrategia: imágenes cache-first + actualización en background
async function cacheFirstUpdateImages(request) {
    const cache = await caches.open(IMAGE_CACHE);
    const cached = await cache.match(request);
    if (cached) {
        fetch(request).then((res) => {
            if (res.ok)
                cache.put(request, res.clone());
        });
        return cached;
    }
    try {
        const res = await fetch(request);
        if (res.ok)
            cache.put(request, res.clone());
        return res;
    }
    catch {
        return new Response("Imagen no disponible", { status: 503 });
    }
}
// 🔹 Estrategia: stale-while-revalidate
async function staleWhileRevalidate(request) {
    const cache = await caches.open(STATIC_CACHE);
    const cachedResponse = await cache.match(request);
    try {
        const fetchResponse = await fetch(request);
        if (fetchResponse.ok)
            cache.put(request, fetchResponse.clone());
        return fetchResponse;
    }
    catch {
        if (cachedResponse)
            return cachedResponse;
        return new Response("Offline", { status: 503 });
    }
}
function isCacheableRequest(request) {
    return (request.url.startsWith("http://") ||
        request.url.startsWith("https://"));
}
// 🔹 Estrategia: network-first para APIs
async function networkFirstAPI(request) {
    const cache = await caches.open(API_CACHE);
    try {
        const response = await fetch(request);
        if (response.ok && isCacheableRequest(request)) {
            cache.put(request, response.clone());
        }
        return response;
    }
    catch {
        const cached = await cache.match(request);
        return cached || new Response("Offline data not available", { status: 503 });
    }
}
// 📌 Cola de pedidos offline con Background Sync
sw.addEventListener("sync", (event) => {
    if (event.tag === "sync-pedidos") {
        event.waitUntil(syncPedidos());
    }
});
async function syncPedidos() {
    // ⚠️ Aquí debes conectar con IndexedDB (Dexie)
    // Ejemplo: obtener pedidos pendientes
    try {
        // @ts-ignore → deberás exponer Dexie al worker o usar postMessage
        const db = self.dexieDB;
        const pedidosPendientes = await db.pedidos
            .where("status")
            .equals("pending")
            .toArray();
        for (const pedido of pedidosPendientes) {
            try {
                const resp = await fetch("/api/pedidos", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(pedido),
                });
                if (resp.ok) {
                    await db.pedidos.update(pedido.id, { status: "sent" });
                }
                else {
                    await db.pedidos.update(pedido.id, { status: "failed" });
                }
            }
            catch {
                // se reintenta en la próxima conexión
            }
        }
    }
    catch (err) {
        console.error("Error en syncPedidos", err);
    }
}
