/* Service Worker · PKG Guru 2026
 * Strategi:
 *  - Halaman (navigasi): network-first, jatuh ke cache saat offline
 *  - Aset statis lokal: stale-while-revalidate
 *  - Pustaka CDN (html2canvas, jsPDF): cache saat pertama dimuat, lalu bisa dipakai offline
 * Ubah CACHE_VERSION setiap kali Anda mengunggah versi aplikasi baru.
 */
const CACHE_VERSION = "v17-2";
const CACHE_NAME = "pkg-guru-" + CACHE_VERSION;

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
        keys.filter((k) => k.startsWith("pkg-guru-") && k !== CACHE_NAME).map((k) => caches.delete(k))
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

  // Navigasi halaman: network-first
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put("./index.html", copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((r) => r || caches.match("./index.html") || caches.match("./"))
        )
    );
    return;
  }

  // Aset lain: stale-while-revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === "opaque")) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
