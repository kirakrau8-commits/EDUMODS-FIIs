import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import {
  evaluateCustomAlerts,
  buildPlatformNotifications,
  getNotificationSystemDiagnostics,
  deliverNativeNotificationWithDiagnostics,
  sendRealTestNotification,
  appendNotificationHistory,
  loadNotificationHistory,
  clearNotificationHistory,
  urlBase64ToUint8Array,
} from './alertsEngine.ts';
import {
  getOrInitVapidConfig,
  savePushSubscriptionOnServer,
  dispatchPushToSubscribedDevices,
  runAutomaticFinancialMonitor,
} from '../server/pushAndMonitorService.ts';
import { CustomPriceAlert, FIIHolding, UserPreferences } from '../types/fii.ts';

// Minimal localStorage polyfill for Node test environment to verify client history persistence & deduplication
const memoryStorage = new Map<string, string>();
if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => memoryStorage.get(key) ?? null,
      setItem: (key: string, val: string) => memoryStorage.set(key, String(val)),
      removeItem: (key: string) => memoryStorage.delete(key),
      clear: () => memoryStorage.clear(),
    },
    configurable: true,
  });
}

const MOCK_HOLDINGS: FIIHolding[] = [
  {
    ticker: 'HGLG11',
    name: 'CSHG Logística',
    category: 'Tijolo',
    segment: 'Logística',
    quantity: 50,
    averagePrice: 155,
    currentPrice: 150,
    totalCost: 7750,
    marketValue: 7500,
    unrealizedGain: -250,
    unrealizedGainPercent: -3.22,
    monthlyYieldPerShare: 1.1,
    monthlyDividendYield: 0.73,
    annualDividendYield: 8.8,
    vpa: 155,
    pvp: 0.97,
    portfolioWeight: 35,
    targetWeight: 20,
  },
  {
    ticker: 'MXRF11',
    name: 'Maxi Renda',
    category: 'Papel',
    segment: 'Recebíveis Imobiliários',
    quantity: 1000,
    averagePrice: 10,
    currentPrice: 9.8,
    totalCost: 10000,
    marketValue: 9800,
    unrealizedGain: -200,
    unrealizedGainPercent: -2,
    monthlyYieldPerShare: 0.1,
    monthlyDividendYield: 1.02,
    annualDividendYield: 7.2,
    vpa: 9.7,
    pvp: 1.01,
    portfolioWeight: 65,
    targetWeight: 20,
  },
];

test('1. evaluateCustomAlerts evaluates PRECO_TETO, PVP_MAXIMO, PROVENTO_MINIMO, PRECO_COMPRA, PAUSADO and ERRO', () => {
  const alerts: CustomPriceAlert[] = [
    { id: '1', ticker: 'HGLG11', type: 'PRECO_TETO', thresholdValue: 152, isActive: true },
    { id: '2', ticker: 'HGLG11', type: 'PRECO_TETO', thresholdValue: 145, isActive: true },
    { id: '3', ticker: 'MXRF11', type: 'PVP_MAXIMO', thresholdValue: 1.02, isActive: true },
    { id: '4', ticker: 'HGLG11', type: 'PROVENTO_MINIMO', thresholdValue: 1.0, isActive: true },
    { id: '5', ticker: 'HGLG11', type: 'PROVENTO_MINIMO', thresholdValue: 1.0, isActive: false },
    { id: '6', ticker: 'ZZZZ11', type: 'PRECO_TETO', thresholdValue: 100, isActive: true },
    { id: '7', ticker: 'HGLG11', type: 'PRECO_TETO', thresholdValue: 0, isActive: true },
    { id: '8', ticker: 'MXRF11', type: 'PRECO_COMPRA', thresholdValue: 9.9, isActive: true },
  ];

  const evaluated = evaluateCustomAlerts(alerts, MOCK_HOLDINGS);

  // Alerta de preço-teto disparando: HGLG11 currentPrice = 150 <= 152 -> ATINGIDO!
  assert.equal(evaluated[0].isTriggered, true);
  assert.equal(evaluated[0].alertState, 'ATINGIDO');
  assert.equal(evaluated[0].statusLabel, 'Preço-Teto Atingido');

  // HGLG11 currentPrice = 150 > 145 -> ATIVO (Monitorando)
  assert.equal(evaluated[1].isTriggered, false);
  assert.equal(evaluated[1].alertState, 'ATIVO');
  assert.equal(evaluated[1].statusLabel, 'Monitorando (Acima do Teto)');

  // Alerta de P/VP máximo disparando: MXRF11 pvp = 1.01 <= 1.02 -> ATINGIDO!
  assert.equal(evaluated[2].isTriggered, true);
  assert.equal(evaluated[2].alertState, 'ATINGIDO');

  // Alerta de provento mínimo disparando: HGLG11 monthlyYieldPerShare = 1.1 >= 1.0 -> ATINGIDO!
  assert.equal(evaluated[3].isTriggered, true);
  assert.equal(evaluated[3].alertState, 'ATINGIDO');

  // Alert 5 is paused (isActive = false) -> PAUSADO
  assert.equal(evaluated[4].isTriggered, false);
  assert.equal(evaluated[4].alertState, 'PAUSADO');
  assert.equal(evaluated[4].statusLabel, 'Pausado');

  // Alert 6 has unknown ticker ZZZZ11 without quote -> ERRO
  assert.equal(evaluated[5].isError, true);
  assert.equal(evaluated[5].alertState, 'ERRO');
  assert.equal(evaluated[5].statusLabel, 'Com Erro');

  // Alert 7 has thresholdValue <= 0 -> ERRO
  assert.equal(evaluated[6].isError, true);
  assert.equal(evaluated[6].alertState, 'ERRO');

  // Preço de compra: MXRF11 currentPrice = 9.8 <= 9.9 -> ATINGIDO!
  assert.equal(evaluated[7].isTriggered, true);
  assert.equal(evaluated[7].alertState, 'ATINGIDO');
  assert.equal(evaluated[7].statusLabel, 'Preço de Compra Atingido');
});

test('2. buildPlatformNotifications triggers payment reminders, data-com alerts, new dividends, goals, concentration and yield rules', () => {
  const referenceDateISO = '2026-10-20';
  const prefs: UserPreferences = {
    hideValues: false,
    currency: 'BRL',
    autoRefreshQuotes: true,
    maxConcentrationAlertPercent: 25,
    minYieldAlertPercent: 8.0,
    customAlerts: [
      { id: 'a1', ticker: 'HGLG11', type: 'PRECO_TETO', thresholdValue: 155, isActive: true },
    ],
  };

  const result = buildPlatformNotifications({
    holdings: MOCK_HOLDINGS,
    dividends: [
      {
        id: 'div_today',
        ticker: 'HGLG11',
        dataCom: '2026-10-15',
        paymentDate: '2026-10-20', // Hoje!
        quantityEligible: 50,
        ratePerShare: 1.1,
        totalAmount: 55,
        status: 'PREVISTO',
      },
      {
        id: 'div_soon',
        ticker: 'MXRF11',
        dataCom: '2026-10-22', // Data-Com em 2 dias!
        paymentDate: '2026-10-23', // Pagamento em 3 dias!
        quantityEligible: 1000,
        ratePerShare: 0.1,
        totalAmount: 100,
        status: 'PREVISTO',
      },
    ],
    goals: {
      totalEquityGoal: 15000, // Carteira tem 7500 + 9800 = 17300 >= 15000 (Atingida!)
      monthlyIncomeGoal: 100, // Carteira gera 55 + 100 = 155 >= 100 (Atingida!)
      currentLivingExpenses: 4000,
      fireSafeYieldPercent: 9.0,
    },
    announcedDividends: [
      {
        ticker: 'HGLG11',
        ratePerShare: 1.15,
        paymentDate: '2026-11-14',
        dataCom: '2026-10-31',
      },
    ],
    preferences: prefs,
    readIds: ['div_pending_div_today'],
    referenceDateISO,
  });

  // Important warnings: HGLG11 concentration (35 > 25), MXRF11 concentration (65 > 25), MXRF11 yield (7.2 < 8.0)
  const importantOnes = result.all.filter((n) => n.category === 'importante');
  assert.equal(importantOnes.length, 3);

  // Opportunities: HGLG11 PRECO_TETO + 2 goals META_ATINGIDA
  const opportunities = result.all.filter((n) => n.category === 'oportunidade');
  assert.equal(opportunities.length, 3);
  assert.ok(opportunities.some((o) => o.alertSubType === 'PRECO_TETO'));
  assert.ok(opportunities.some((o) => o.alertSubType === 'META_ATINGIDA'));

  // Reminders: div_today (PAGAMENTO_HOJE), div_soon (LEMBRETE_PAGAMENTO + DATA_COM_PROXIMA), announced (NOVO_PROVENTO)
  const reminders = result.all.filter((n) => n.category === 'lembrete');
  assert.equal(reminders.length, 4);
  assert.ok(reminders.some((r) => r.alertSubType === 'PAGAMENTO_HOJE' && r.isRead === true));
  assert.ok(reminders.some((r) => r.alertSubType === 'LEMBRETE_PAGAMENTO'));
  assert.ok(reminders.some((r) => r.alertSubType === 'DATA_COM_PROXIMA'));
  assert.ok(reminders.some((r) => r.alertSubType === 'NOVO_PROVENTO'));
});

test('3. getNotificationSystemDiagnostics and sendRealTestNotification never report fake success when native notification fails', async () => {
  const diag = getNotificationSystemDiagnostics();
  assert.equal(diag.apiSupported, false);
  assert.equal(diag.permission, 'unsupported');
  assert.ok(diag.statusTitle.length > 0);
  assert.ok(Array.isArray(diag.instructions));

  const delivery = await deliverNativeNotificationWithDiagnostics(
    'Teste',
    'Corpo',
    'tag_test_1'
  );
  assert.equal(delivery.delivered, false);
  assert.ok(delivery.error);

  const testResult = await sendRealTestNotification({
    activeCount: 2,
    triggeredCount: 1,
    sampleTicker: 'HGLG11',
  });
  assert.equal(testResult.deliveredNative, false);
  assert.equal(testResult.deliveredServerPush, false);
  assert.ok(testResult.message.includes('Falha ao entregar notificação nativa'));
});

test('4. History persistence and deduplication prevent duplicate notifications', () => {
  clearNotificationHistory();
  assert.equal(loadNotificationHistory().length, 0);

  appendNotificationHistory({
    notificationId: 'dedup_alert_1',
    title: 'HGLG11: Preço-Teto Atingido',
    message: 'Cotação R$ 150,00',
    category: 'oportunidade',
    channel: 'web_push_background',
  });

  // Attempting to append the exact same notificationId again must deduplicate and keep length at 1
  const afterDuplicate = appendNotificationHistory({
    notificationId: 'dedup_alert_1',
    title: 'HGLG11: Preço-Teto Atingido',
    message: 'Cotação R$ 150,00',
    category: 'oportunidade',
    channel: 'web_push_background',
  });

  assert.equal(afterDuplicate.length, 1);
  assert.equal(afterDuplicate[0].notificationId, 'dedup_alert_1');
  assert.equal(afterDuplicate[0].channel, 'web_push_background');
});

test('5. Web Push VAPID key conversion, subscription persistence, encrypted background push delivery, and automatic server monitoring', async () => {
  const vapid = getOrInitVapidConfig();
  assert.ok(vapid.publicKey.length > 40);
  assert.ok(vapid.privateKey.length > 20);

  const uint8 = urlBase64ToUint8Array(vapid.publicKey);
  assert.equal(uint8.length, 65); // Uncompressed P-256 public key is 65 bytes

  // Start a local HTTP server acting as a Web Push Service endpoint to prove real RFC 8291 encrypted push delivery
  let receivedPushRequests = 0;
  let receivedHeaders: http.IncomingHttpHeaders = {};
  let receivedEncryptedBytes = 0;

  const pushServer = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      receivedPushRequests += 1;
      receivedHeaders = req.headers;
      receivedEncryptedBytes = Buffer.concat(chunks).length;
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ delivered: true }));
    });
  });

  await new Promise<void>((resolve) => pushServer.listen(0, '127.0.0.1', resolve));
  const address = pushServer.address() as { port: number };
  const mockEndpoint = `http://127.0.0.1:${address.port}/wpush/test-device-1`;

  try {
    // Generate real ECDH P-256 client keys for Web Push encryption
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.generateKeys();
    const p256dh = ecdh.getPublicKey().toString('base64url');
    const auth = crypto.randomBytes(16).toString('base64url');

    const saved = await savePushSubscriptionOnServer({
      subscription: {
        endpoint: mockEndpoint,
        keys: { p256dh, auth },
      },
      userAgent: 'Android 14; Chrome Mobile',
    });
    assert.equal(saved.success, true);
    assert.ok(saved.activeSubscriptionsCount >= 1);

    // Dispatch background push
    const pushRes = await dispatchPushToSubscribedDevices({
      title: 'EDUMODS FIIs — Teste Push Criptografado',
      body: 'Notificação enviada pelo servidor com VAPID.',
      tag: 'unit-test-push-1',
    });

    assert.equal(pushRes.success, true);
    assert.ok(pushRes.deliveredCount >= 1);
    assert.equal(receivedPushRequests, 1);
    assert.ok(receivedEncryptedBytes > 0);
    assert.ok(
      String(receivedHeaders['authorization'] || '').startsWith('vapid ') ||
        String(receivedHeaders['crypto-key'] || '').length > 0
    );

    // Run automatic server financial monitoring with a fresh alert ID
    const uniqueAlertId = `srv_alert_${Date.now()}`;
    const snapshot = {
      holdings: MOCK_HOLDINGS,
      dividends: [
        {
          id: `div_srv_${Date.now()}`,
          ticker: 'HGLG11',
          dataCom: '2026-10-15',
          paymentDate: new Date().toISOString().slice(0, 10),
          quantityEligible: 50,
          ratePerShare: 1.1,
          totalAmount: 55,
          status: 'PREVISTO' as const,
        },
      ],
      preferences: {
        hideValues: false,
        currency: 'BRL' as const,
        autoRefreshQuotes: true,
        maxConcentrationAlertPercent: 25,
        minYieldAlertPercent: 8.0,
        customAlerts: [
          {
            id: uniqueAlertId,
            ticker: 'HGLG11',
            type: 'PRECO_TETO' as const,
            thresholdValue: 185,
            isActive: true,
          },
        ],
      },
    };

    const monitorFirstRun = await runAutomaticFinancialMonitor(snapshot);
    assert.equal(monitorFirstRun.success, true);
    assert.ok(monitorFirstRun.monitoringState.triggeredCount >= 1);
    assert.ok(monitorFirstRun.monitoringState.pushedCount >= 1);

    // Running monitor a second time immediately with the same snapshot must deduplicate and send 0 duplicate pushes
    const monitorSecondRun = await runAutomaticFinancialMonitor(snapshot);
    assert.equal(monitorSecondRun.success, true);
    assert.equal(monitorSecondRun.monitoringState.pushedCount, 0);
  } finally {
    await new Promise<void>((resolve) => pushServer.close(() => resolve()));
    const fs = await import('node:fs');
    const path = await import('node:path');
    fs.rmSync(path.resolve(process.cwd(), '.push-server-state.json'), { force: true });
  }
});
