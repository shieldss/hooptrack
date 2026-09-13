const CACHE='hooptrack-v2.3.2';
const ASSETS=['./','./index.html','./styles.css','./app.js?v=2.3.2','./graphic-renderer.js?v=2.3.2','./cloud-sync.js?v=2.3.2','./firebase-config.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./images/bg.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k.startsWith('hooptrack-')).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==location.origin)return;event.respondWith(fetch(event.request).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return res}).catch(()=>caches.match(event.request).then(r=>r||caches.match('./index.html'))))});
