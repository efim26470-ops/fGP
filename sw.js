const CACHE = 'q3-retro-rally-html-v4';
const FILES = [
  './', './index.html', './styles.css', './game.js', './manifest.webmanifest', './icon.svg',
  './assets/hud/gauge.png', './assets/hud/needle.png', './assets/hud/arrow.png', './assets/hud/minimap_frame.png',
  './assets/cars/alpine.png', './assets/cars/mini.png', './assets/cars/roadster.png', './assets/cars/camaro.png', './assets/cars/viper.png', './assets/cars/sidepipe.png', './assets/cars/raptor.png', './assets/cars/slingshot.png',
  './assets/levelshots/country.jpg', './assets/levelshots/downtown.jpg', './assets/levelshots/nightcity.jpg', './assets/levelshots/lavafalls.jpg', './assets/levelshots/valley.jpg',
  './assets/audio/go.ogg', './assets/audio/checkpoint.ogg', './assets/audio/skid.ogg', './assets/audio/scrape.ogg'
];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
