const CACHE_PREFIX = "emcp-os-";
const CACHE = `${CACHE_PREFIX}v25`;
const SCOPE = self.registration.scope;
const scoped = (path) => new URL(path, SCOPE).href;
const CORE_PATHS = [
  "./",
  "index.html",
  "offline.html",
  "css/tokens.css",
  "css/styles.css",
  "css/components.css",
  "css/offline.css",
  "js/core.js",
  "js/i18n.js",
  "js/knowledge.js",
  "js/calculator-model.js",
  "js/dom.js",
  "js/accessibility.js",
  "js/virtual-list.js",
  "js/operations.js",
  "js/features.js",
  "js/ai-guard.js",
  "js/search-worker.js",
  "js/app.js",
  "js/handbook.js",
  "js/assistant.js",
  "js/calculators.js",
  "js/workspace.js",
  "js/pwa.js",
  "js/offline.js",
  "data/knowledge/index.json",
  "data/knowledge/search-index.json",
  "data/knowledge/relationships.json",
  "data/knowledge/details.json",
  "data/knowledge/en.json",
  "data/knowledge/capital-investment.json",
  "data/knowledge/finance.json",
  "data/knowledge/legal.json",
  "data/knowledge/property-development.json",
  "data/knowledge/planning.json",
  "data/knowledge/construction.json",
  "data/knowledge/compliance-corporate.json",
  "data/knowledge/commercial-documents.json",
  "content/handbooks/investor/handbook.json",
  "content/handbooks/investor/chapters.json",
  "content/checklists/investor-checklists.json",
  "content/case-studies/investor-case-studies.json",
  "content/document-guides/property-purchase-documents.json",
  "manifest.webmanifest",
  "config/runtime.json",
  "icon.svg",
];
const CORE_URLS = CORE_PATHS.map(scoped);
const INDEX_URL = scoped("index.html");
const OFFLINE_URL = scoped("offline.html");

const cacheable = (response) =>
  response &&
  response.ok &&
  ["basic", "default", "cors"].includes(response.type);
async function store(request, response) {
  if (cacheable(response)) {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  return store(request, await fetch(request));
}
async function networkFirst(request) {
  try {
    return await store(request, await fetch(request));
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  }
}
async function navigation(request) {
  try {
    return await store(request, await fetch(request));
  } catch {
    return (
      (await caches.match(request)) ||
      (await caches.match(INDEX_URL)) ||
      (await caches.match(OFFLINE_URL))
    );
  }
}

self.addEventListener("install", (event) =>
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE_URLS))),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
              .map((key) => caches.delete(key)),
          ),
        ),
      self.clients.claim(),
    ]),
  ),
);
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(navigation(request));
    return;
  }
  if (
    CORE_URLS.includes(url.href) ||
    ["script", "style", "image", "font", "manifest"].includes(
      request.destination,
    ) ||
    url.pathname.endsWith(".json")
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }
  event.respondWith(networkFirst(request));
});
