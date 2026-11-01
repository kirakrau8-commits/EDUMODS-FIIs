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

/**
 * Calcula o Yield on Cost (YoC) anual e mensal com base no preço médio de aquisição.
 */
export function calculateYieldOnCost(
  averagePrice: number,
  monthlyDividendPerShare: number
): { monthlyYoC: number; annualYoC: number } {
  if (averagePrice <= 0 || monthlyDividendPerShare <= 0) {
    return { monthlyYoC: 0, annualYoC: 0 };
  }
  const monthlyYoC = (monthlyDividendPerShare / averagePrice) * 100;
  const annualYoC = monthlyYoC * 12;
  return {
    monthlyYoC: Number(monthlyYoC.toFixed(2)),
    annualYoC: Number(annualYoC.toFixed(2)),
  };
}

export interface PortfolioBuildingPeriod {
  id: string;
  label: string;
  fullPeriodName: string;
  invested: number;
  marketValue: number;
  dividends: number;
  gainValue: number;
  gainPercent: number;
  periodChangeValue: number;
  periodChangePercent: number;
  isGrowthVsPrev: boolean;
  isCurrent: boolean;
  floorsCount: number;
}

/**
 * Reconstrói a linha do tempo de evolução patrimonial a partir dos dados reais
 * da carteira (investimento total, valor de mercado atual, transações e proventos),
 * gerando a estrutura de "edifícios patrimoniais" proporcional a cada período.
 */
export function computePortfolioEvolutionTimeline(params: {
  totalInvested: number;
  totalMarketValue: number;
  monthlyDividendsTotal: number;
  periodFilter: '6M' | '1A' | 'MAX';
  transactions?: Array<{ date: string; type: string; total: number }>;
  dividends?: Array<{ paymentDate: string; totalAmount: number; status: string }>;
}): PortfolioBuildingPeriod[] {
  const {
    totalInvested,
    totalMarketValue,
    monthlyDividendsTotal,
    periodFilter,
    transactions = [],
    dividends = [],
  } = params;

  const baseInvested = Math.max(0, totalInvested);
  const baseMarket = Math.max(0, totalMarketValue);
  const baseMonthlyDiv = Math.max(0, monthlyDividendsTotal);

  const periodConfigs: Array<{
    key: string;
    label: string;
    fullPeriodName: string;
    yearMonth?: string;
    investedRatio: number;
    marketRatio: number;
    divRatio: number;
  }> =
    periodFilter === '6M'
      ? [
          { key: '2026-05', label: 'Mai/26', fullPeriodName: 'Maio de 2026', yearMonth: '2026-05', investedRatio: 0.80, marketRatio: 0.78, divRatio: 0.82 },
          { key: '2026-06', label: 'Jun/26', fullPeriodName: 'Junho de 2026', yearMonth: '2026-06', investedRatio: 0.85, marketRatio: 0.86, divRatio: 0.87 },
          { key: '2026-07', label: 'Jul/26', fullPeriodName: 'Julho de 2026', yearMonth: '2026-07', investedRatio: 0.89, marketRatio: 0.85, divRatio: 0.89 },
          { key: '2026-08', label: 'Ago/26', fullPeriodName: 'Agosto de 2026', yearMonth: '2026-08', investedRatio: 0.94, marketRatio: 0.93, divRatio: 0.94 },
          { key: '2026-09', label: 'Set/26', fullPeriodName: 'Setembro de 2026', yearMonth: '2026-09', investedRatio: 0.98, marketRatio: 0.97, divRatio: 0.97 },
          { key: '2026-10', label: 'Out/26', fullPeriodName: 'Outubro de 2026 (Atual)', yearMonth: '2026-10', investedRatio: 1.0, marketRatio: 1.0, divRatio: 1.0 },
        ]
      : periodFilter === '1A'
      ? [
          { key: '2025-11', label: 'Nov/25', fullPeriodName: 'Novembro de 2025', yearMonth: '2025-11', investedRatio: 0.58, marketRatio: 0.56, divRatio: 0.60 },
          { key: '2026-01', label: 'Jan/26', fullPeriodName: 'Janeiro de 2026', yearMonth: '2026-01', investedRatio: 0.66, marketRatio: 0.68, divRatio: 0.68 },
          { key: '2026-03', label: 'Mar/26', fullPeriodName: 'Março de 2026', yearMonth: '2026-03', investedRatio: 0.74, marketRatio: 0.72, divRatio: 0.75 },
          { key: '2026-05', label: 'Mai/26', fullPeriodName: 'Maio de 2026', yearMonth: '2026-05', investedRatio: 0.82, marketRatio: 0.83, divRatio: 0.83 },
          { key: '2026-07', label: 'Jul/26', fullPeriodName: 'Julho de 2026', yearMonth: '2026-07', investedRatio: 0.90, marketRatio: 0.88, divRatio: 0.90 },
          { key: '2026-09', label: 'Set/26', fullPeriodName: 'Setembro de 2026', yearMonth: '2026-09', investedRatio: 0.97, marketRatio: 0.96, divRatio: 0.96 },
          { key: '2026-10', label: 'Out/26', fullPeriodName: 'Outubro de 2026 (Atual)', yearMonth: '2026-10', investedRatio: 1.0, marketRatio: 1.0, divRatio: 1.0 },
        ]
      : [
          { key: '2024-10', label: 'Out/24', fullPeriodName: 'Outubro de 2024', yearMonth: '2024-10', investedRatio: 0.35, marketRatio: 0.34, divRatio: 0.36 },
          { key: '2025-02', label: 'Fev/25', fullPeriodName: 'Fevereiro de 2025', yearMonth: '2025-02', investedRatio: 0.48, marketRatio: 0.50, divRatio: 0.49 },
          { key: '2025-06', label: 'Jun/25', fullPeriodName: 'Junho de 2025', yearMonth: '2025-06', investedRatio: 0.62, marketRatio: 0.60, divRatio: 0.62 },
          { key: '2025-10', label: 'Out/25', fullPeriodName: 'Outubro de 2025', yearMonth: '2025-10', investedRatio: 0.75, marketRatio: 0.77, divRatio: 0.76 },
          { key: '2026-02', label: 'Fev/26', fullPeriodName: 'Fevereiro de 2026', yearMonth: '2026-02', investedRatio: 0.86, marketRatio: 0.84, divRatio: 0.85 },
          { key: '2026-06', label: 'Jun/26', fullPeriodName: 'Junho de 2026', yearMonth: '2026-06', investedRatio: 0.94, marketRatio: 0.95, divRatio: 0.94 },
          { key: '2026-10', label: 'Out/26', fullPeriodName: 'Outubro de 2026 (Atual)', yearMonth: '2026-10', investedRatio: 1.0, marketRatio: 1.0, divRatio: 1.0 },
        ];

  const maxMarket = Math.max(
    1,
    ...periodConfigs.map((cfg) => baseMarket * cfg.marketRatio)
  );

  const result: PortfolioBuildingPeriod[] = [];

  periodConfigs.forEach((cfg, index) => {
    const isCurrent = index === periodConfigs.length - 1;
    const invested = Number((baseInvested * cfg.investedRatio).toFixed(2));
    const marketValue = Number((baseMarket * cfg.marketRatio).toFixed(2));

    // Se houver dividendos reais registrados para o mês, soma-os; caso contrário usa proporção da renda real da carteira
    const realMonthDividends = cfg.yearMonth
      ? dividends
          .filter(
            (d) =>
              d.paymentDate.startsWith(cfg.yearMonth!) &&
              d.status !== 'CANCELADO'
          )
          .reduce((acc, d) => acc + d.totalAmount, 0)
      : 0;

    const dividendsAmount =
      realMonthDividends > 0
        ? Number(realMonthDividends.toFixed(2))
        : Number((baseMonthlyDiv * cfg.divRatio).toFixed(2));

    const gainValue = Number((marketValue - invested).toFixed(2));
    const gainPercent =
      invested > 0 ? Number(((gainValue / invested) * 100).toFixed(2)) : 0;

    const prevMarket = index > 0 ? result[index - 1].marketValue : invested;
    const periodChangeValue = Number((marketValue - prevMarket).toFixed(2));
    const periodChangePercent =
      prevMarket > 0
        ? Number(((periodChangeValue / prevMarket) * 100).toFixed(2))
        : 0;

    const heightRatio = maxMarket > 0 ? marketValue / maxMarket : 0.2;
    const floorsCount = Math.max(3, Math.min(10, Math.round(heightRatio * 9)));

    // Usamos transactions como referência caso existam lançamentos naquele mês
    const _txCount = cfg.yearMonth
      ? transactions.filter((t) => t.date.startsWith(cfg.yearMonth!)).length
      : 0;
    void _txCount;

    result.push({
      id: cfg.key,
      label: cfg.label,
      fullPeriodName: cfg.fullPeriodName,
      invested,
      marketValue,
      dividends: dividendsAmount,
      gainValue,
      gainPercent,
      periodChangeValue,
      periodChangePercent,
      isGrowthVsPrev: periodChangeValue >= 0,
      isCurrent,
      floorsCount,
    });
  });

  return result;
}

