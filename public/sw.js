// Service worker mínimo da Fanlira: torna o site instalável (PWA) sem cachear
// conteúdo — tudo é sempre buscado na rede, então nada fica desatualizado e
// nenhuma mídia paga fica guardada no dispositivo.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request));
});
