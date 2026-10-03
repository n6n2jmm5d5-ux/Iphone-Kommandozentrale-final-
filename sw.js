const CACHE='kommandozentrale-v2';
const FILES=['./','./index.html','./styles.css','./app.js','./agent-layer.js','./manifest.webmanifest'];
const ASSETS=new Set(FILES.map(file=>new URL(file,self.location.href).href));
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await cache.addAll(FILES.map(file=>new Request(file,{cache:'reload'})));
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith('kommandozentrale-')&&key!==CACHE).map(key=>caches.delete(key)));
  await self.clients.claim();
})()));
// Prefer current files online; fall back to known frontend assets offline.
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||!ASSETS.has(event.request.url))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try{
      const response=await fetch(event.request,{cache:'no-store'});
      if(response.ok)await cache.put(event.request,response.clone());
      return response;
    }catch(error){
      const cached=await cache.match(event.request);
      if(cached)return cached;
      throw error;
    }
  })());
});
