import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateWeightedAveragePrice,
  calculateSaleResult,
  calculateUnrealizedGain,
  calculateBazinCeilingPrice,
  calculateGordonPrice,
  calculatePVP,
  calculateSardinhaProjection,
  calculateRebalanceByContribution,
  calculateFIREProgress,
  calculateYieldOnCost,
  computePortfolioEvolutionTimeline,
} from './financialMath.ts';

test('calculateWeightedAveragePrice updates average price and quantity with fees', () => {
  // Compra inicial: 100 cotas a R$ 100,00 = R$ 10.000,00
  // Segunda compra: 50 cotas a R$ 110,00 com taxa de R$ 5,00 = R$ 5.505,00
  // Total: 150 cotas, custo total R$ 15.505,00 -> Preço Médio R$ 103,3667
  const res = calculateWeightedAveragePrice(100, 100, 50, 110, 5);
  assert.equal(res.newQuantity, 150);
  assert.equal(res.totalCost, 15505);
  assert.equal(res.newAveragePrice, 103.3667);
});

test('calculateSaleResult preserves average price and computes realized gain/loss', () => {
  // Posição: 100 cotas a PM R$ 100,00
  // Vende 40 cotas a R$ 120,00 com R$ 10 de taxas
  // Receita líquida: 40 * 120 - 10 = R$ 4.790,00
  // Custo das cotas vendidas: 40 * 100 = R$ 4.000,00
  // Lucro realizado: R$ 790,00
  // Restam: 60 cotas a PM R$ 100,00
  const res = calculateSaleResult(100, 100, 40, 120, 10);
  assert.equal(res.remainingQuantity, 60);
  assert.equal(res.averagePrice, 100);
  assert.equal(res.realizedResult, 790);
  assert.equal(res.totalCostRemaining, 6000);
});

test('calculateSaleResult throws error when selling more than available', () => {
  assert.throws(() => {
    calculateSaleResult(50, 100, 51, 105, 0);
  }, /não pode ser maior que o saldo/);
});

test('calculateUnrealizedGain computes gain and percentage correctly', () => {
  // 100 cotas, PM R$ 100, cotação atual R$ 115
  // Custo: R$ 10.000, Mercado: R$ 11.500, Ganho: R$ 1.500 (+15%)
  const res = calculateUnrealizedGain(100, 100, 115);
  assert.equal(res.totalCost, 10000);
  assert.equal(res.marketValue, 11500);
  assert.equal(res.unrealizedGain, 1500);
  assert.equal(res.unrealizedGainPercent, 15);
});

test('calculateBazinCeilingPrice returns correct ceiling price', () => {
  // Provento anual R$ 12,00 por cota. Taxa mínima 8%
  // Preço teto = 12 / 0.08 = R$ 150,00
  const res = calculateBazinCeilingPrice(12, 8);
  assert.equal(res.ceilingPrice, 150);
});

test('calculateGordonPrice computes intrinsic value when return rate exceeds growth rate', () => {
  // D1 = R$ 10,00, retorno k = 10%, crescimento g = 2%
  // k - g = 8% = 0.08. P0 = 10 / 0.08 = R$ 125,00
  const validRes = calculateGordonPrice(10, 10, 2);
  assert.equal(validRes.isValid, true);
  assert.equal(validRes.intrinsicValue, 125);

  // Quando k <= g deve invalidar
  const invalidRes = calculateGordonPrice(10, 5, 6);
  assert.equal(invalidRes.isValid, false);
});

test('calculatePVP calculates ratio and premium/discount', () => {
  // Preço R$ 90, VPA R$ 100 -> P/VP = 0.90 (-10% desconto)
  const discountRes = calculatePVP(90, 100);
  assert.equal(discountRes.pvp, 0.9);
  assert.equal(discountRes.discountOrPremiumPercent, -10);

  // Preço R$ 108, VPA R$ 100 -> P/VP = 1.08 (+8% ágio)
  const premiumRes = calculatePVP(108, 100);
  assert.equal(premiumRes.pvp, 1.08);
  assert.equal(premiumRes.discountOrPremiumPercent, 8);
});

test('calculateSardinhaProjection tracks capital, reinvested dividends, and compound growth', () => {
  // R$ 1.000 inicial, R$ 500 aporte/mês, 12% a.a., por 12 meses
  const res = calculateSardinhaProjection(1000, 500, 12, 12);
  assert.equal(res.timeline.length, 12);
  assert.ok(res.finalPortfolio > res.totalContributed);
  assert.ok(res.totalYieldEarned > 0);
  assert.equal(res.totalContributed, 1000 + 500 * 12); // 7.000
});

test('calculateRebalanceByContribution suggests allocating new funds to underweighted assets', () => {
  const holdings = [
    { ticker: 'HGLG11', currentPrice: 150, currentMarketValue: 6000, targetWeightPercent: 50 },
    { ticker: 'MXRF11', currentPrice: 10, currentMarketValue: 2000, targetWeightPercent: 50 },
  ];
  // Total equity: 8000. Novo aporte: 2000. Futuro: 10000.
  // Alvos: HGLG11 = 5000 (já tem 6000, déficit 0), MXRF11 = 5000 (tem 2000, déficit 3000)
  // O aporte de 2000 deve ser sugerido para o MXRF11!
  const res = calculateRebalanceByContribution(holdings, 2000);
  const mxrf = res.suggestions.find((s) => s.ticker === 'MXRF11');
  const hglg = res.suggestions.find((s) => s.ticker === 'HGLG11');

  assert.ok(mxrf && mxrf.suggestedShares > 0);
  assert.equal(hglg?.suggestedShares, 0);
});

test('calculateFIREProgress calculates equity required and coverage percentage', () => {
  // Custo de vida R$ 5.000/mês (R$ 60.000/ano). DY esperado: 10% a.a.
  // Patrimônio necessário: 60.000 / 0.10 = R$ 600.000
  // Carteira atual: R$ 300.000 (50% progresso). Provento atual: R$ 2.500/mês (50%)
  const res = calculateFIREProgress(5000, 10, 300000, 2500);
  assert.equal(res.requiredEquity, 600000);
  assert.equal(res.equityProgressPercent, 50);
  assert.equal(res.incomeProgressPercent, 50);
  assert.equal(res.monthlyShortfall, 2500);
});

test('calculateYieldOnCost computes monthly and annual YoC based on average price', () => {
  const res = calculateYieldOnCost(100, 1.0);
  assert.equal(res.monthlyYoC, 1.0);
  assert.equal(res.annualYoC, 12.0);
});

test('computePortfolioEvolutionTimeline builds proportional building periods for 6M, 1A, and MAX', () => {
  const periods6M = computePortfolioEvolutionTimeline({
    totalInvested: 30000,
    totalMarketValue: 32500,
    monthlyDividendsTotal: 280,
    periodFilter: '6M',
  });
  assert.equal(periods6M.length, 6);
  const lastBuilding = periods6M[periods6M.length - 1];
  assert.equal(lastBuilding.isCurrent, true);
  assert.equal(lastBuilding.marketValue, 32500);
  assert.equal(lastBuilding.invested, 30000);
  assert.equal(lastBuilding.gainValue, 2500);
  assert.ok(lastBuilding.floorsCount >= 3);
});

