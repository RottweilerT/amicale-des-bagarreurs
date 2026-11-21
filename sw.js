// Mode hors ligne : la page et ses ressources sont gardées sur l'appareil.
// La page est toujours redemandée au réseau d'abord (pour avoir la dernière version),
// et la copie locale ne sert que sans connexion. Les données Firebase ne passent pas par ici.
const CACHE = 'adb-v18';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './logo.png', './favicon.png', './config.js?v=1', './app.css?v=16', './app.js?v=16', './onglets.js?v=16', './ergonomie.js?v=16', './splash.jpg', './icon-maskable-512.png', './apple-touch-icon.png'];
// Moteur Firebase : mis en cache dès l'installation, pour que l'appli démarre sans réseau même juste après une mise à jour.
const SDK = ['https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js', 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore-compat.js', 'https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js', 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app-check-compat.js'];
const EXTERNAL = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  // Le moteur Firebase est rangé à part : s'il ne se télécharge pas, l'installation continue quand même.
  const sdk = c => Promise.all(SDK.map(u => fetch(u, { mode: 'cors', cache: 'reload' }).then(r => r.ok && c.put(u, r)).catch(() => {})));
  e.waitUntil(caches.open(CACHE).then(c => Promise.all([c.addAll(CORE), sdk(c)])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); }
      return res;
    }).catch(() => caches.match('./index.html').then(r => r || caches.match('./'))));
    return;
  }
  const static_ = url.origin === location.origin || EXTERNAL.includes(url.hostname)
    || (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/'));
  if (!static_) return;
  // Historique des notifications et rapports : toujours la version du serveur.
  if (url.origin === location.origin && /\/(notifications|tickets)\//.test(url.pathname)) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const cached = await c.match(req);
    const fresh = fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }).catch(() => cached);
    return cached || fresh;
  }));
});

// Notifications (envoyées par la GitHub Action « Notifications » via Firebase Cloud Messaging).
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { data: { body: e.data ? e.data.text() : '' } }; }
  const x = Object.assign({}, d.notification || {}, d.data || {});
  e.waitUntil(self.registration.showNotification(x.title || 'Amicale des Bagarreurs', {
    body: x.body || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: x.tag || undefined, renotify: !!x.tag,
    data: { url: x.url || './' }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    for (const w of ws) if (w.url.startsWith(self.registration.scope)) { w.focus(); return w.navigate ? w.navigate(url).catch(() => {}) : null; }
    return clients.openWindow(url);
  }));
});
