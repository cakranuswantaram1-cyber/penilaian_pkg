/* Service Worker · PKG Guru 2026 (update otomatis)
 * Strategi:
 *  - File milik aplikasi (halaman, ikon, manifest): INTERNET DULU, jatuh ke cache saat offline
 *  - Pustaka CDN (html2canvas, jsPDF): CACHE DULU, lalu bisa dipakai offline
 * Naikkan CACHE_VERSION HANYA bila menambah/mengganti file di PRECACHE.
 * Mengubah isi index.html cukup di-upload ulang, tanpa menaikkan versi.
 */
const CACHE_VERSION = "v18";
const CACHE_PREFIX = "pkg-guru-";
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;

const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png"
];

const CDN_HOSTS = ["cdnjs.cloudflare.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Satu file gagal (mis. ikon belum diunggah) tidak menggagalkan seluruh instalasi
      Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => null)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isCdn = CDN_HOSTS.includes(url.hostname);
  if (!sameOrigin && !isCdn) return;

  // File milik aplikasi: internet dulu supaya update otomatis terambil
  if (sameOrigin) {
    event.respondWith(
      fetch(req, { cache: "no-cache" })
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then((r) => r || (req.mode === "navigate" ? caches.match("./index.html") : undefined))
        )
    );
    return;
  }

  // Pustaka CDN: cache dulu (versinya tetap), simpan saat pertama dimuat
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req)
      .then((res) => {
        if (res && (res.ok || res.type === "opaque")) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => cached))
  );
});
