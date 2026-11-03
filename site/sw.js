'use strict';
const CACHE='leyisheng-cloud-v2-login-memory';
const FILES=['./','./index.html','./config.js','./core.js','./cloud-store.js','./views.js','./app.js','./login-memory.js','./vendor/supabase.js','./logo.png','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('leyisheng-')&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  // Auth requests and financial data are never stored in the service-worker cache.
  if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  if(!FILES.some(path=>new URL(path,self.registration.scope).href===url.href))return;
  event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;}).catch(()=>caches.match(event.request)));
});
