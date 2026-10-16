/* Offline copy of the workout app.
   Online: always loads the newest version from GitHub and refreshes the saved copy.
   No signal (or very slow): opens the saved copy instead, after 4 seconds at most.
   Your workout data is not stored here — it stays in the app's own storage. */
var CACHE = "workout-app-v1";
var FILES = ["./", "./index.html", "./apple-touch-icon.png"];

self.addEventListener("install", function(ev){
  ev.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(FILES); }).catch(function(){}));
  self.skipWaiting();
});

self.addEventListener("activate", function(ev){
  ev.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

self.addEventListener("fetch", function(ev){
  var req = ev.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  ev.respondWith(new Promise(function(resolve){
    var settled = false;
    function fromCache(){
      return caches.match(req, {ignoreSearch:true}).then(function(hit){
        if (hit || req.mode !== "navigate") return hit || null;
        return caches.match("./index.html").then(function(h){ return h || caches.match("./"); });
      });
    }
    /* slow gym signal: after 4 s, use the saved copy if there is one */
    var timer = setTimeout(function(){
      fromCache().then(function(hit){ if (hit && !settled){ settled = true; resolve(hit); } });
    }, 4000);
    fetch(req).then(function(res){
      clearTimeout(timer);
      if (res && res.ok){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put(req, copy); });
      }
      if (!settled){ settled = true; resolve(res); }
    }).catch(function(){
      clearTimeout(timer);
      fromCache().then(function(hit){
        if (!settled){ settled = true; resolve(hit || new Response("Offline and no saved copy yet — open the app once with signal.", {status:503, headers:{"Content-Type":"text/plain"}})); }
      });
    });
  }));
});
