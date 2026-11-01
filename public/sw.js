// =============================================================================
// EDUMODS FIIs — Service Worker Oficial (Web Push em Segundo Plano + Android Nativo)
// Versão: 2.0.0
// =============================================================================

const SW_VERSION = '2.0.0';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * Constrói as opções nativas para a Central de Notificações do Android / Desktop
 */
function buildNativeNotificationOptions(payload) {
  const safePayload = payload || {};
  const tag = safePayload.tag || `edumods_push_${Date.now()}`;
  return {
    body: safePayload.body || 'Um alerta monitorado na sua carteira EDUMODS FIIs foi acionado.',
    icon: safePayload.icon || '/pwa-192x192.png',
    badge: safePayload.badge || '/pwa-192x192.png',
    tag,
    renotify: safePayload.renotify !== undefined ? Boolean(safePayload.renotify) : true,
    requireInteraction: Boolean(safePayload.requireInteraction),
    vibrate: [200, 100, 200],
    timestamp: safePayload.timestamp ? Date.parse(safePayload.timestamp) || Date.now() : Date.now(),
    data: {
      url: safePayload.url || '/',
      category: safePayload.category || 'oportunidade',
      ticker: safePayload.ticker || null,
      notificationId: safePayload.notificationId || tag,
      title: safePayload.title || 'EDUMODS FIIs',
      body: safePayload.body || '',
      receivedAt: new Date().toISOString(),
    },
  };
}

/**
 * Notifica todas as abas abertas (se houver) que um Push ou Notificação Nativa foi entregue
 */
async function notifyOpenClients(messageType, payload) {
  try {
    const clientList = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });
    for (const client of clientList) {
      client.postMessage({
        type: messageType,
        payload,
        swVersion: SW_VERSION,
        timestamp: new Date().toISOString(),
      });
    }
  } catch {
    // Ignora erro caso não haja clientes abertos
  }
}

/**
 * EVENTO PUSH EM SEGUNDO PLANO (Recebe Web Push criptografado VAPID mesmo com o site fechado)
 */
self.addEventListener('push', (event) => {
  let payload = {
    title: 'EDUMODS FIIs — Alerta Atingido',
    body: 'Uma condição configurada na sua carteira de FIIs foi atingida.',
    tag: `edumods_bg_${Date.now()}`,
    category: 'oportunidade',
    url: '/',
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      if (parsed && typeof parsed === 'object') {
        payload = {
          ...payload,
          ...parsed,
        };
      }
    } catch {
      try {
        const rawText = event.data.text();
        if (rawText) {
          payload.body = rawText;
        }
      } catch {
        // Mantém payload padrão
      }
    }
  }

  const title = payload.title || 'EDUMODS FIIs — Alerta';
  const options = buildNativeNotificationOptions(payload);

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
      await notifyOpenClients('PUSH_DELIVERED', {
        notificationId: options.data.notificationId,
        title,
        message: options.body,
        category: options.data.category,
        ticker: options.data.ticker,
        channel: 'web_push_background',
        timestamp: options.data.receivedAt,
      });
    })()
  );
});

/**
 * RENOVAÇÃO AUTOMÁTICA DE INSCRIÇÃO PUSH EXPIRADA
 */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const options = event.oldSubscription ? event.oldSubscription.options : undefined;
        if (!options || !self.registration.pushManager) return;
        const newSubscription = await self.registration.pushManager.subscribe(options);
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: newSubscription.toJSON(),
            oldEndpoint: event.oldSubscription ? event.oldSubscription.endpoint : undefined,
            userAgent: self.navigator ? self.navigator.userAgent : 'ServiceWorkerRenewal',
          }),
        });
      } catch {
        // Falha silenciosa na renovação em background
      }
    })()
  );
});

/**
 * CLIQUE NA NOTIFICAÇÃO NATIVA DO ANDROID / DESKTOP
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            payload: event.notification.data || {},
          });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

/**
 * COMUNICAÇÃO DIRETA COM A PÁGINA (Disparo Nativo Verificado + Diagnóstico do Service Worker)
 */
self.addEventListener('message', (event) => {
  const data = event.data || {};
  const replyPort = event.ports && event.ports[0];

  if (data.type === 'PING_SW') {
    if (replyPort) {
      replyPort.postMessage({
        ok: true,
        swVersion: SW_VERSION,
        pushManagerSupported: Boolean(self.registration && self.registration.pushManager),
        showNotificationSupported: Boolean(
          self.registration && typeof self.registration.showNotification === 'function'
        ),
      });
    }
    return;
  }

  if (data.type === 'SHOW_NOTIFICATION') {
    const payload = data.payload || {};
    const title = payload.title || 'EDUMODS FIIs';
    const options = buildNativeNotificationOptions(payload);

    event.waitUntil(
      (async () => {
        try {
          if (!self.registration || typeof self.registration.showNotification !== 'function') {
            throw new Error(
              'ServiceWorkerRegistration.showNotification não está disponível neste navegador.'
            );
          }
          await self.registration.showNotification(title, options);
          if (replyPort) {
            replyPort.postMessage({
              ok: true,
              tag: options.tag,
              timestamp: new Date().toISOString(),
            });
          }
        } catch (err) {
          if (replyPort) {
            replyPort.postMessage({
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      })()
    );
  }
});
