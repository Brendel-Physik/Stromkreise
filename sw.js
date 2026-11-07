// Offline-Betrieb: Das Netz hat Vorrang, damit Änderungen ankommen. Antwortet es nicht rechtzeitig,
// kommt die gespeicherte Fassung, und das Netz erneuert den Speicher im Hintergrund für das nächste Öffnen.
var CACHE = 'steckbrett-v1';
var START = 'Steckbrett_Kennlinien.html';
var FILES = [START, 'manifest.webmanifest', 'icon-180.png', 'icon-512.png'];
var WARTEN_MS = 2500;

self.addEventListener('install', function (e) {
  // Einzeln speichern: Eine abgebrochene Datei darf bei schlechtem Netz nicht alles verhindern
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(FILES.map(function (f) {
      return fetch(f).then(function (r) { if (r.ok && !r.redirected) return c.put(f, r); }).catch(function () { });
    }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function fromCache(req) {
  return caches.match(req, { ignoreSearch: true }).then(function (r) {
    return r || (req.mode === 'navigate' ? caches.match(START) : undefined);
  });
}

// Gilt erst als da, wenn die Antwort vollständig gespeichert ist: Eine abreißende Verbindung bleibt so folgenlos.
// Umleitungen (WLAN-Anmeldeseiten) und Fehlerseiten überschreiben den Speicher nicht.
function fromNet(req) {
  return fetch(req).then(function (r) {
    if (!r.ok || r.redirected) return fromCache(req).then(function (c) { return c || r; });
    var copy = r.clone();
    return caches.open(CACHE).then(function (c) { return c.put(req, copy); }).catch(function () { }).then(function () { return r; });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  var net = fromNet(req);
  e.waitUntil(net.catch(function () { }));
  e.respondWith(new Promise(function (resolve) {
    var done = false;
    function answer(r) { if (r && !done) { done = true; clearTimeout(timer); resolve(r); } }
    var timer = setTimeout(function () { fromCache(req).then(answer); }, WARTEN_MS);
    net.then(answer, function () {
      clearTimeout(timer);
      fromCache(req).then(function (r) { answer(r || Response.error()); });
    });
  }));
});
