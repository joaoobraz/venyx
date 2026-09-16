// Service worker mínimo da Fanlira: existe só para o site ser instalável (PWA).
// Sem cache e sem interceptar requisições — nada de mídia paga fica no
// dispositivo e vídeos/streaming (Range) não passam por aqui.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
