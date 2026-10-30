/**
 * Motor Financeiro de Cálculos para FIIs — EDUMODS FIIs
 * Fórmulas determinísticas testadas com rigor matemático para posições,
 * preço médio ponderado, resultados realizados/não realizados,
 * indicadores de valuation (Bazin, Gordon, P/VP), projeções e rebalanceamento.
 */

export interface BuyCalculationResult {
  newQuantity: number;
  newAveragePrice: number;
  totalCost: number;
}

export interface SaleCalculationResult {
  remainingQuantity: number;
  averagePrice: number;
  realizedResult: number; // Lucro (+) ou Prejuízo (-)
  totalCostRemaining: number;
}

/**
 * Calcula o Preço Médio Ponderado após nova compra, incluindo taxas operacionais.
 */
export function calculateWeightedAveragePrice(
  currentQty: number,
  currentAvgPrice: number,
  boughtQty: number,
  boughtPrice: number,
  fees: number = 0
): BuyCalculationResult {
  if (boughtQty <= 0 || boughtPrice <= 0) {
    throw new Error('Quantidade e preço de compra devem ser maiores que zero.');
  }

  const existingCost = Math.max(0, currentQty) * Math.max(0, currentAvgPrice);
  const acquisitionCost = boughtQty * boughtPrice + Math.max(0, fees);
  const newQuantity = Math.max(0, currentQty) + boughtQty;
  const totalCost = existingCost + acquisitionCost;
  const newAveragePrice = newQuantity > 0 ? totalCost / newQuantity : 0;

  return {
    newQuantity,
    newAveragePrice: Number(newAveragePrice.toFixed(4)),
    totalCost: Number(totalCost.toFixed(2)),
  };
}

/**
 * Calcula o resultado realizado de uma venda (parcial ou total) e o saldo restante.
 * Na regra brasileira, a venda reduz a quantidade mantendo o preço médio inalterado.
 */
export function calculateSaleResult(
  currentQty: number,
  avgPrice: number,
  soldQty: number,
  salePrice: number,
  fees: number = 0
): SaleCalculationResult {
  if (soldQty <= 0 || salePrice <= 0) {
    throw new Error('Quantidade e preço de venda devem ser maiores que zero.');
  }
  if (soldQty > currentQty) {
    throw new Error(
      `Quantidade de venda (${soldQty}) não pode ser maior que o saldo em carteira (${currentQty}).`
    );
  }

  const costOfSoldShares = soldQty * avgPrice;
  const netSaleRevenue = soldQty * salePrice - Math.max(0, fees);
  const realizedResult = netSaleRevenue - costOfSoldShares;
  const remainingQuantity = currentQty - soldQty;
  const totalCostRemaining = remainingQuantity * avgPrice;

  return {
    remainingQuantity,
    averagePrice: avgPrice,
    realizedResult: Number(realizedResult.toFixed(2)),
    totalCostRemaining: Number(totalCostRemaining.toFixed(2)),
  };
}

/**
 * Calcula o resultado não realizado (lucro/prejuízo no papel) e rentabilidade %.
 */
export function calculateUnrealizedGain(
  quantity: number,
  avgPrice: number,
  currentPrice: number
) {
  const totalCost = quantity * avgPrice;
  const marketValue = quantity * currentPrice;
  const unrealizedGain = marketValue - totalCost;
  const unrealizedGainPercent =
    totalCost > 0 ? (unrealizedGain / totalCost) * 100 : 0;

  return {
    totalCost: Number(totalCost.toFixed(2)),
    marketValue: Number(marketValue.toFixed(2)),
    unrealizedGain: Number(unrealizedGain.toFixed(2)),
    unrealizedGainPercent: Number(unrealizedGainPercent.toFixed(2)),
  };
}

/**
 * Preço-Teto pelo Método Bazin.
 * Preço-Teto = Provento Anual / Taxa Mínima Requerida
 */
export function calculateBazinCeilingPrice(
  annualDividendPerShare: number,
  requiredReturnPercent: number
): { ceilingPrice: number; marginOfSafetyPercent: number } {
  if (requiredReturnPercent <= 0) {
    throw new Error('A taxa mínima requerida deve ser maior que zero.');
  }
  const decimalRate = requiredReturnPercent / 100;
  const ceilingPrice = annualDividendPerShare / decimalRate;

  return {
    ceilingPrice: Number(ceilingPrice.toFixed(2)),
    marginOfSafetyPercent: 0,
  };
}

/**
 * Modelo de Crescimento de Gordon:
 * P0 = D1 / (k - g)
 * Onde:
 * D1 = Próximo dividendo estimado
 * k = Taxa de retorno exigida
 * g = Taxa de crescimento sustentável dos dividendos
 */
export function calculateGordonPrice(
  nextDividend: number,
  requiredReturnPercent: number,
  growthRatePercent: number
): { intrinsicValue: number; isValid: boolean; message?: string } {
  const k = requiredReturnPercent / 100;
  const g = growthRatePercent / 100;

  if (k <= g) {
    return {
      intrinsicValue: 0,
      isValid: false,
      message:
        'A taxa de retorno exigida (k) deve ser estritamente maior que a taxa de crescimento (g).',
    };
  }

  const intrinsicValue = nextDividend / (k - g);
  return {
    intrinsicValue: Number(intrinsicValue.toFixed(2)),
    isValid: true,
  };
}

/**
 * Calcula o P/VP e o percentual de ágio (+) ou deságio (-).
 */
export function calculatePVP(
  currentPrice: number,
  vpa: number
): { pvp: number; discountOrPremiumPercent: number } {
  if (vpa <= 0) {
    return { pvp: 1, discountOrPremiumPercent: 0 };
  }
  const pvp = currentPrice / vpa;
  const discountOrPremiumPercent = (pvp - 1) * 100;

  return {
    pvp: Number(pvp.toFixed(2)),
    discountOrPremiumPercent: Number(discountOrPremiumPercent.toFixed(2)),
  };
}

/**
 * Simulação de Reinvestimento / Calculadora Sardinha
 * Discrimina:
 * 1. Capital total aportado
 * 2. Rendimentos recebidos e reinvestidos
 * 3. Patrimônio acumulado no período
 */
export interface SardinhaSimulationMonth {
  month: number;
  totalContributed: number;
  monthlyYield: number;
  totalYieldAccumulated: number;
  totalPortfolio: number;
}

export function calculateSardinhaProjection(
  initialCapital: number,
  monthlyContribution: number,
  annualRatePercent: number,
  totalMonths: number
): {
  finalPortfolio: number;
  totalContributed: number;
  totalYieldEarned: number;
  timeline: SardinhaSimulationMonth[];
} {
  // Taxa equivalente mensal: (1 + i_ano)^(1/12) - 1
  const monthlyRate = Math.pow(1 + annualRatePercent / 100, 1 / 12) - 1;

  let currentPortfolio = initialCapital;
  let totalContributed = initialCapital;
  let totalYieldEarned = 0;
  const timeline: SardinhaSimulationMonth[] = [];

  for (let m = 1; m <= totalMonths; m++) {
    const yieldThisMonth = currentPortfolio * monthlyRate;
    totalYieldEarned += yieldThisMonth;
    currentPortfolio += yieldThisMonth + monthlyContribution;
    totalContributed += monthlyContribution;

    timeline.push({
      month: m,
      totalContributed: Number(totalContributed.toFixed(2)),
      monthlyYield: Number(yieldThisMonth.toFixed(2)),
      totalYieldAccumulated: Number(totalYieldEarned.toFixed(2)),
      totalPortfolio: Number(currentPortfolio.toFixed(2)),
    });
  }

  return {
    finalPortfolio: Number(currentPortfolio.toFixed(2)),
    totalContributed: Number(totalContributed.toFixed(2)),
    totalYieldEarned: Number(totalYieldEarned.toFixed(2)),
    timeline,
  };
}

/**
 * Algoritmo de Rebalanceamento Inteligente por Aporte.
 * Aloca o novo aporte financeiro prioritariamente nos ativos mais distantes (abaixo)
 * da sua alocação desejada (targetWeight), sem forçar vendas precipitadas.
 */
export interface HoldingForRebalance {
  ticker: string;
  currentPrice: number;
  currentMarketValue: number;
  targetWeightPercent: number; // Ex: 20%
}

export interface RebalanceSuggestion {
  ticker: string;
  currentWeightPercent: number;
  targetWeightPercent: number;
  currentMarketValue: number;
  targetMarketValue: number;
  differenceValue: number;
  suggestedContribution: number;
  suggestedShares: number;
}

export function calculateRebalanceByContribution(
  holdings: HoldingForRebalance[],
  newContribution: number
): {
  suggestions: RebalanceSuggestion[];
  totalAllocated: number;
  remainingCash: number;
} {
  const currentTotalEquity = holdings.reduce(
    (acc, h) => acc + h.currentMarketValue,
    0
  );
  const futureTotalEquity = currentTotalEquity + Math.max(0, newContribution);

  if (futureTotalEquity <= 0) {
    return { suggestions: [], totalAllocated: 0, remainingCash: newContribution };
  }

  // Normaliza os pesos alvo se a soma diferir de 100
  const totalTargetPercent = holdings.reduce(
    (acc, h) => acc + h.targetWeightPercent,
    0
  );
  const normalizedFactor =
    totalTargetPercent > 0 ? 100 / totalTargetPercent : 1;

  // Calcula o déficit de cada ativo em relação ao valor alvo no patrimônio futuro
  const items = holdings.map((h) => {
    const currentWeight =
      currentTotalEquity > 0
        ? (h.currentMarketValue / currentTotalEquity) * 100
        : 0;
    const effectiveTargetWeight = h.targetWeightPercent * normalizedFactor;
    const targetMarketValue = (futureTotalEquity * effectiveTargetWeight) / 100;
    const deficit = Math.max(0, targetMarketValue - h.currentMarketValue);

    return {
      ticker: h.ticker,
      currentPrice: h.currentPrice,
      currentMarketValue: h.currentMarketValue,
      currentWeightPercent: Number(currentWeight.toFixed(2)),
      targetWeightPercent: Number(effectiveTargetWeight.toFixed(2)),
      targetMarketValue: Number(targetMarketValue.toFixed(2)),
      deficit,
      suggestedContribution: 0,
      suggestedShares: 0,
    };
  });

  const totalDeficit = items.reduce((acc, item) => acc + item.deficit, 0);
  let remainingCash = newContribution;
  let totalAllocated = 0;

  if (totalDeficit > 0 && newContribution > 0) {
    items.forEach((item) => {
      // Proporção do aporte atribuída ao déficit deste fundo
      const idealContribution = (item.deficit / totalDeficit) * newContribution;
      const shares =
        item.currentPrice > 0
          ? Math.floor(idealContribution / item.currentPrice)
          : 0;
      const actualMoneyAllocated = shares * item.currentPrice;

      item.suggestedShares = shares;
      item.suggestedContribution = Number(actualMoneyAllocated.toFixed(2));
      totalAllocated += actualMoneyAllocated;
    });

    remainingCash = Number((newContribution - totalAllocated).toFixed(2));
  }

  const suggestions: RebalanceSuggestion[] = items.map((it) => ({
    ticker: it.ticker,
    currentWeightPercent: it.currentWeightPercent,
    targetWeightPercent: it.targetWeightPercent,
    currentMarketValue: it.currentMarketValue,
    targetMarketValue: it.targetMarketValue,
    differenceValue: Number((it.targetMarketValue - it.currentMarketValue).toFixed(2)),
    suggestedContribution: it.suggestedContribution,
    suggestedShares: it.suggestedShares,
  }));

  return {
    suggestions,
    totalAllocated: Number(totalAllocated.toFixed(2)),
    remainingCash: Math.max(0, remainingCash),
  };
}

/**
 * Planejamento de Independência Financeira (FIRE com FIIs)
 */
export function calculateFIREProgress(
  monthlyExpenses: number,
  expectedAnnualYieldPercent: number,
  currentPortfolioValue: number,
  currentMonthlyDividend: number
) {
  if (expectedAnnualYieldPercent <= 0) {
    return {
      requiredEquity: 0,
      equityProgressPercent: 0,
      incomeProgressPercent: 0,
      monthlyShortfall: monthlyExpenses,
    };
  }

  // Patrimônio necessário para gerar o custo de vida anual com base no DY esperado
  const annualExpenses = monthlyExpenses * 12;
  const requiredEquity = annualExpenses / (expectedAnnualYieldPercent / 100);

  const equityProgressPercent =
    requiredEquity > 0
      ? Math.min(100, (currentPortfolioValue / requiredEquity) * 100)
      : 0;

  const incomeProgressPercent =
    monthlyExpenses > 0
      ? Math.min(100, (currentMonthlyDividend / monthlyExpenses) * 100)
      : 0;

  const monthlyShortfall = Math.max(0, monthlyExpenses - currentMonthlyDividend);

  return {
    requiredEquity: Number(requiredEquity.toFixed(2)),
    equityProgressPercent: Number(equityProgressPercent.toFixed(2)),
    incomeProgressPercent: Number(incomeProgressPercent.toFixed(2)),
    monthlyShortfall: Number(monthlyShortfall.toFixed(2)),
  };
}
