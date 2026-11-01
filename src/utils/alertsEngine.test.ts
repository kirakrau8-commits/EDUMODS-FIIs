import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateCustomAlerts,
  buildPlatformNotifications,
  getNotificationSystemDiagnostics,
} from './alertsEngine.ts';
import { CustomPriceAlert, FIIHolding, UserPreferences } from '../types/fii.ts';

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

test('evaluateCustomAlerts classifies ATINGIDO, ATIVO, PAUSADO, and ERRO accurately', () => {
  const alerts: CustomPriceAlert[] = [
    { id: '1', ticker: 'HGLG11', type: 'PRECO_TETO', thresholdValue: 152, isActive: true },
    { id: '2', ticker: 'HGLG11', type: 'PRECO_TETO', thresholdValue: 145, isActive: true },
    { id: '3', ticker: 'MXRF11', type: 'PVP_MAXIMO', thresholdValue: 1.02, isActive: true },
    { id: '4', ticker: 'HGLG11', type: 'PROVENTO_MINIMO', thresholdValue: 1.0, isActive: true },
    { id: '5', ticker: 'HGLG11', type: 'PROVENTO_MINIMO', thresholdValue: 1.0, isActive: false },
    { id: '6', ticker: 'ZZZZ11', type: 'PRECO_TETO', thresholdValue: 100, isActive: true },
    { id: '7', ticker: 'HGLG11', type: 'PRECO_TETO', thresholdValue: 0, isActive: true },
  ];

  const evaluated = evaluateCustomAlerts(alerts, MOCK_HOLDINGS);

  // HGLG11 currentPrice = 150 <= 152 -> ATINGIDO!
  assert.equal(evaluated[0].isTriggered, true);
  assert.equal(evaluated[0].alertState, 'ATINGIDO');
  assert.equal(evaluated[0].statusLabel, 'Preço-Teto Atingido');

  // HGLG11 currentPrice = 150 > 145 -> ATIVO (Monitorando)
  assert.equal(evaluated[1].isTriggered, false);
  assert.equal(evaluated[1].alertState, 'ATIVO');
  assert.equal(evaluated[1].statusLabel, 'Monitorando (Acima do Teto)');

  // MXRF11 pvp = 1.01 <= 1.02 -> ATINGIDO!
  assert.equal(evaluated[2].isTriggered, true);
  assert.equal(evaluated[2].alertState, 'ATINGIDO');

  // HGLG11 monthlyYieldPerShare = 1.1 >= 1.0 -> ATINGIDO!
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
});

test('buildPlatformNotifications categorizes important warnings, opportunities, and reminders', () => {
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
        id: 'div_1',
        ticker: 'HGLG11',
        dataCom: '2026-10-15',
        paymentDate: '2026-10-25',
        quantityEligible: 50,
        ratePerShare: 1.1,
        totalAmount: 55,
        status: 'PREVISTO',
      },
    ],
    preferences: prefs,
    readIds: ['div_pending_div_1'],
  });

  // Important warnings: HGLG11 concentration (35 > 25), MXRF11 concentration (65 > 25), MXRF11 yield (7.2 < 8.0)
  const importantOnes = result.all.filter((n) => n.category === 'importante');
  assert.equal(importantOnes.length, 3);

  // Opportunity: HGLG11 PRECO_TETO triggered
  const opportunities = result.all.filter((n) => n.category === 'oportunidade');
  assert.equal(opportunities.length, 1);

  // Reminder: div_1 is PREVISTO and marked as read
  const reminders = result.all.filter((n) => n.category === 'lembrete');
  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].isRead, true);

  assert.equal(result.read.length, 1);
  assert.equal(result.unread.length, 4);
});

test('getNotificationSystemDiagnostics returns structured diagnostic state safely in Node environment', () => {
  const diag = getNotificationSystemDiagnostics();
  assert.equal(diag.apiSupported, false);
  assert.equal(diag.permission, 'unsupported');
  assert.ok(diag.statusTitle.length > 0);
  assert.ok(Array.isArray(diag.instructions));
});
