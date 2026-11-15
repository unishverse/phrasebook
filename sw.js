/* The Teacher's Phrasebook service worker (same approach as Wordrobe). Never touches the Apps Script API
   (cross-origin POSTs are not intercepted).
   - the app shell (page, css, js incl. all content) is stored at install, so the app opens and reads offline
   - page, css and js: network first (3 s), cached copy as fallback, so a deploy reaches users at once
   - img/*: cache first (bump VERSION when an image changes)
   - Google Fonts: stale while revalidate */
var VERSION = 'pb-sw-2';
var SHELL = VERSION + '-shell', FILES = VERSION + '-files';
var SHELL_URLS = ['./', 'index.html', 'css/app.css', 'js/config.js', 'js/content.js', 'js/app.js', 'js/account.js', 'manifest.webmanifest',
  'img/icon-192.png', 'img/icon-512.png', 'img/favicon-48.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(SHELL).then(function (c) { return c.addAll(SHELL_URLS); }).catch(function () { /* filled on use */ }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== SHELL && k !== FILES; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function networkFirst(req) {
  return new Promise(function (resolve) {
    var settled = false;
    var fallback = function () {
      return caches.match(req, { cacheName: SHELL, ignoreSearch: true }).then(function (hit) {
        return hit || (req.mode === 'navigate' ? caches.match('index.html', { cacheName: SHELL }) : undefined);
      });
    };
    var timer = setTimeout(function () {
      fallback().then(function (hit) { if (hit && !settled) { settled = true; resolve(hit); } });
    }, 3000);
    fetch(req).then(function (res) {
      clearTimeout(timer);
      if (res && res.ok) { var copy = res.clone(); caches.open(SHELL).then(function (c) { c.put(req, copy); }); }
      if (!settled) { settled = true; resolve(res); }
    }, function () {
      clearTimeout(timer);
      fallback().then(function (hit) { if (!settled) { settled = true; resolve(hit || Response.error()); } });
    });
  });
}
function cacheFirst(req) {
  return caches.match(req).then(function (hit) {
    if (hit) return hit;
    return fetch(req).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(FILES).then(function (c) { c.put(req, copy); }); }
      return res;
    });
  });
}
function staleWhileRevalidate(req) {
  return caches.open(FILES).then(function (c) {
    return c.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }, function () { return hit; });
      return hit || net;
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== self.location.origin && !fonts) return;
  if (fonts) { e.respondWith(staleWhileRevalidate(req)); return; }
  if (/\/img\//.test(url.pathname)) { e.respondWith(cacheFirst(req)); return; }
  e.respondWith(networkFirst(req));
});
