import React, { useState, useMemo, useId } from 'react';
import {
  Calculator,
  TrendingUp,
  Percent,
  Coins,
  Scale,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  AlertCircle,
  RefreshCw,
  Flame,
  Calendar,
  Clock,
  Plus,
  Minus,
} from 'lucide-react';
import {
  calculateBazinCeilingPrice,
  calculateGordonPrice,
  calculatePVP,
  calculateSardinhaProjection,
  calculateWeightedAveragePrice,
  calculateFIREProgress,
} from '../../utils/financialMath';
import { formatBRL, formatPercent } from '../../utils/formatters';
import { VERIFIED_FII_DATABASE } from '../../data/fiiDatabase';

type CalcType =
  | 'bazin'
  | 'gordon'
  | 'pvp'
  | 'sardinha'
  | 'preco_medio'
  | 'renda_passiva'
  | 'fire';

export const CalculatorsView: React.FC = () => {
  const [activeCalc, setActiveCalc] = useState<CalcType>('sardinha');
  const [showHowToUse, setShowHowToUse] = useState<boolean>(true);

  // Estados: Calculadora Bazin
  const [bazinAnnualDiv, setBazinAnnualDiv] = useState<string>('12.50');
  const [bazinRequiredYield, setBazinRequiredYield] = useState<string>('8.0');
  const [bazinCurrentPrice, setBazinCurrentPrice] = useState<string>('150.00');

  // Estados: Modelo de Gordon
  const [gordonNextDiv, setGordonNextDiv] = useState<string>('10.00');
  const [gordonDiscountRate, setGordonDiscountRate] = useState<string>('10.0');
  const [gordonGrowthRate, setGordonGrowthRate] = useState<string>('2.5');

  // Estados: P/VP e Ágio/Desconto
  const [pvpPrice, setPvpPrice] = useState<string>('95.00');
  const [pvpVPA, setPvpVPA] = useState<string>('105.00');

  // Estados: Calculadora Sardinha
  const [sardinhaInitial, setSardinhaInitial] = useState<string>('5000');
  const [sardinhaContribution, setSardinhaContribution] = useState<string>('1000');
  const [sardinhaAnnualRate, setSardinhaAnnualRate] = useState<string>('10.5');
  // Modo de tempo: 'ano_mes' (composto), 'anos', 'meses'
  const [sardinhaTimeMode, setSardinhaTimeMode] = useState<'ano_mes' | 'anos' | 'meses'>('ano_mes');
  const [sardinhaYears, setSardinhaYears] = useState<string>('3');
  const [sardinhaExtraMonths, setSardinhaExtraMonths] = useState<string>('0');
  const [sardinhaMonthsOnly, setSardinhaMonthsOnly] = useState<string>('36');
  const [sardinhaViewMode, setSardinhaViewMode] = useState<'yearly' | 'monthly'>('yearly');
  const [showSardinhaTable, setShowSardinhaTable] = useState<boolean>(true);

  // Cálculo reativo do total de meses
  const sardinhaTotalMonths = useMemo(() => {
    if (sardinhaTimeMode === 'anos') {
      const y = Math.max(0, parseFloat(sardinhaYears) || 0);
      return Math.max(1, Math.round(y * 12));
    }
    if (sardinhaTimeMode === 'meses') {
      const m = Math.max(1, parseInt(sardinhaMonthsOnly, 10) || 1);
      return m;
    }
    // 'ano_mes': Ano e Mês combinados
    const y = Math.max(0, parseInt(sardinhaYears, 10) || 0);
    const m = Math.max(0, parseInt(sardinhaExtraMonths, 10) || 0);
    const total = y * 12 + m;
    return Math.max(1, total);
  }, [sardinhaTimeMode, sardinhaYears, sardinhaExtraMonths, sardinhaMonthsOnly]);

  // Alterna o modo preservando o tempo total aproximado
  const handleTimeModeChange = (newMode: 'ano_mes' | 'anos' | 'meses') => {
    const currentTotal = sardinhaTotalMonths;
    if (newMode === 'anos') {
      const y = Math.max(1, Math.round(currentTotal / 12));
      setSardinhaYears(String(y));
    } else if (newMode === 'meses') {
      setSardinhaMonthsOnly(String(currentTotal));
    } else if (newMode === 'ano_mes') {
      const y = Math.floor(currentTotal / 12);
      const m = currentTotal % 12;
      setSardinhaYears(String(y));
      setSardinhaExtraMonths(String(m));
    }
    setSardinhaTimeMode(newMode);
  };

  // Estados: Preço Médio Ponderado
  const [pmCurrentQty, setPmCurrentQty] = useState<string>('100');
  const [pmCurrentAvg, setPmCurrentAvg] = useState<string>('100.00');
  const [pmNewQty, setPmNewQty] = useState<string>('50');
  const [pmNewPrice, setPmNewPrice] = useState<string>('115.00');
  const [pmFees, setPmFees] = useState<string>('5.00');

  // Estados: Renda Passiva
  const [targetIncome, setTargetIncome] = useState<string>('3000');
  const [expectedDY, setExpectedDY] = useState<string>('9.5');

  // Estados: FIRE
  const [fireExpenses, setFireExpenses] = useState<string>('5000');
  const [fireYield, setFireYield] = useState<string>('9.0');
  const [fireCurrentEquit, setFireCurrentEquit] = useState<string>('120000');

  // Cálculos Dinâmicos
  // 1. Bazin
  const bazinRes = (() => {
    try {
      const d = parseFloat(bazinAnnualDiv) || 0;
      const y = parseFloat(bazinRequiredYield) || 0;
      const cur = parseFloat(bazinCurrentPrice) || 0;
      if (d <= 0 || y <= 0) return null;
      const res = calculateBazinCeilingPrice(d, y);
      const safetyMargin = cur > 0 ? ((res.ceilingPrice - cur) / res.ceilingPrice) * 100 : 0;
      return { ...res, safetyMargin: Number(safetyMargin.toFixed(2)), currentPrice: cur };
    } catch {
      return null;
    }
  })();

  // 2. Gordon
  const gordonRes = (() => {
    try {
      const d = parseFloat(gordonNextDiv) || 0;
      const k = parseFloat(gordonDiscountRate) || 0;
      const g = parseFloat(gordonGrowthRate) || 0;
      return calculateGordonPrice(d, k, g);
    } catch {
      return null;
    }
  })();

  // 3. P/VP
  const pvpRes = (() => {
    const p = parseFloat(pvpPrice) || 0;
    const v = parseFloat(pvpVPA) || 0;
    return calculatePVP(p, v);
  })();

  // 4. Sardinha
  const sardinhaRes = (() => {
    const init = parseFloat(sardinhaInitial) || 0;
    const contrib = parseFloat(sardinhaContribution) || 0;
    const rate = parseFloat(sardinhaAnnualRate) || 0;
    return calculateSardinhaProjection(init, contrib, rate, sardinhaTotalMonths);
  })();

  // 5. Preço Médio
  const pmRes = (() => {
    try {
      const cQty = parseFloat(pmCurrentQty) || 0;
      const cAvg = parseFloat(pmCurrentAvg) || 0;
      const nQty = parseFloat(pmNewQty) || 0;
      const nPrice = parseFloat(pmNewPrice) || 0;
      const fees = parseFloat(pmFees) || 0;
      return calculateWeightedAveragePrice(cQty, cAvg, nQty, nPrice, fees);
    } catch {
      return null;
    }
  })();

  // 6. Renda Passiva
  const incomeRes = (() => {
    const target = parseFloat(targetIncome) || 0;
    const dy = parseFloat(expectedDY) || 0;
    if (target <= 0 || dy <= 0) return null;
    const annualTarget = target * 12;
    const requiredEquity = annualTarget / (dy / 100);
    return { requiredEquity, annualTarget };
  })();

  // 7. FIRE
  const fireRes = (() => {
    const exp = parseFloat(fireExpenses) || 0;
    const y = parseFloat(fireYield) || 0;
    const eq = parseFloat(fireCurrentEquit) || 0;
    return calculateFIREProgress(exp, y, eq, (eq * (y / 100)) / 12);
  })();

  const calcSelector = [
    { id: 'sardinha', label: 'Calculadora Sardinha (Bola de Neve)', icon: Coins },
    { id: 'bazin', label: 'Preço-Teto (Método Bazin)', icon: Calculator },
    { id: 'gordon', label: 'Modelo de Gordon (Crescimento)', icon: TrendingUp },
    { id: 'pvp', label: 'P/VP e Desconto / Ágio', icon: Percent },
    { id: 'preco_medio', label: 'Preço Médio Ponderado', icon: Scale },
    { id: 'renda_passiva', label: 'Projeção Renda Passiva', icon: Sparkles },
    { id: 'fire', label: 'Independência Financeira / FIRE', icon: Flame },
  ];

  const bazinAnnualDivId = useId();
  const bazinRequiredYieldId = useId();
  const bazinCurrentPriceId = useId();
  const gordonNextDivId = useId();
  const gordonDiscountRateId = useId();
  const gordonGrowthRateId = useId();
  const pvpPriceId = useId();
  const pvpVPAId = useId();
  const sardinhaInitialId = useId();
  const sardinhaContributionId = useId();
  const sardinhaAnnualRateId = useId();
  const sardinhaYearsId = useId();
  const sardinhaExtraMonthsId = useId();
  const sardinhaMonthsOnlyId = useId();
  const pmCurrentQtyId = useId();
  const pmCurrentAvgId = useId();
  const pmNewQtyId = useId();
  const pmNewPriceId = useId();
  const pmFeesId = useId();
  const targetIncomeId = useId();
  const expectedDYId = useId();
  const fireExpensesId = useId();
  const fireYieldId = useId();
  const fireCurrentEquitId = useId();

  return (
    <div className="space-y-6 pb-12">
      {/* Banner Principal */}
      <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 shadow-xl space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            Ferramentas Quantitativas
          </span>
          <span className="text-xs text-slate-400">7 modelos matemáticos testados</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-white">
          Calculadoras Financeiras para FIIs
        </h1>
        <p className="text-xs text-slate-400 max-w-2xl">
          Avalie valuation, projete a bola de neve dos juros compostos, determine preços-teto com margem de segurança e planeje o rebalanceamento sem depender de achismos.
        </p>
      </div>

      {/* Menu Superior de Seleção de Calculadora */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {calcSelector.map((item) => {
          const Icon = item.icon;
          const isActive = activeCalc === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveCalc(item.id as CalcType)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                  : 'bg-[#0F172A] text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Corpo da Calculadora Selecionada */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LADO ESQUERDO: Entradas de Dados (5 Colunas) */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-4 shadow-lg">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white">
              {calcSelector.find((c) => c.id === activeCalc)?.label}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Informe os parâmetros desejados para o cálculo em tempo real.
            </p>
          </div>

          {/* FORMULÁRIO 1: Calculadora Sardinha */}
          {activeCalc === 'sardinha' && (
            <div className="space-y-3 text-xs">
              <div>
                <label htmlFor={sardinhaInitialId} className="text-slate-300 font-medium block mb-1">Patrimônio Inicial (R$)</label>
                <input
                  id={sardinhaInitialId}
                  type="number"
                  min="0"
                  step="500"
                  value={sardinhaInitial}
                  onChange={(e) => setSardinhaInitial(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>

              <div>
                <label htmlFor={sardinhaContributionId} className="text-slate-300 font-medium block mb-1">Aporte Mensal (R$)</label>
                <input
                  id={sardinhaContributionId}
                  type="number"
                  min="0"
                  step="100"
                  value={sardinhaContribution}
                  onChange={(e) => setSardinhaContribution(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>

              <div>
                <label htmlFor={sardinhaAnnualRateId} className="text-slate-300 font-medium block mb-1">
                  Taxa de Rendimento Estimada (% a.a.)
                </label>
                <input
                  id={sardinhaAnnualRateId}
                  type="number"
                  min="1"
                  step="0.5"
                  value={sardinhaAnnualRate}
                  onChange={(e) => setSardinhaAnnualRate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>

              {/* Prazo da Projeção Flexível: Ano e Mês, Anos ou Meses */}
              <div className="space-y-2 pt-1 border-t border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-medium">Prazo da Projeção</span>
                  <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    Total: {sardinhaTotalMonths} {sardinhaTotalMonths === 1 ? 'mês' : 'meses'}
                  </span>
                </div>

                {/* Seletor de Unidade / Modo */}
                <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950/70 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleTimeModeChange('ano_mes')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                      sardinhaTimeMode === 'ano_mes'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Ano e Mês
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTimeModeChange('anos')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                      sardinhaTimeMode === 'anos'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Apenas Anos
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTimeModeChange('meses')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                      sardinhaTimeMode === 'meses'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Apenas Meses
                  </button>
                </div>

                {/* MODO 1: ANO E MÊS (Lado a lado, número colado na unidade) */}
                {sardinhaTimeMode === 'ano_mes' && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {/* Entrada Ano */}
                      <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between gap-1.5">
                        <div className="flex flex-col">
                          <label
                            htmlFor={sardinhaYearsId}
                            className="text-[10px] uppercase font-bold tracking-wider text-slate-400"
                          >
                            Anos
                          </label>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {(parseInt(sardinhaYears, 10) || 0) * 12}m
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setSardinhaYears(String(Math.max(0, (parseInt(sardinhaYears, 10) || 0) - 1)))
                            }
                            className="w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
                            aria-label="Diminuir ano"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <div className="flex items-center gap-1 px-1.5 py-1 bg-slate-950 border border-slate-700 rounded-lg">
                            <input
                              id={sardinhaYearsId}
                              type="number"
                              min="0"
                              max="60"
                              value={sardinhaYears}
                              onChange={(e) => setSardinhaYears(e.target.value)}
                              className="w-10 bg-transparent text-white font-mono text-center font-bold text-sm focus:outline-none"
                            />
                            <span className="text-[11px] font-bold text-emerald-400 select-none">
                              {parseInt(sardinhaYears, 10) === 1 ? 'Ano' : 'Anos'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setSardinhaYears(String((parseInt(sardinhaYears, 10) || 0) + 1))
                            }
                            className="w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
                            aria-label="Aumentar ano"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Entrada Mês */}
                      <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between gap-1.5">
                        <div className="flex flex-col">
                          <label
                            htmlFor={sardinhaExtraMonthsId}
                            className="text-[10px] uppercase font-bold tracking-wider text-slate-400"
                          >
                            Meses
                          </label>
                          <span className="text-[10px] text-slate-500 font-mono">0 a 11</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setSardinhaExtraMonths(
                                String(Math.max(0, (parseInt(sardinhaExtraMonths, 10) || 0) - 1))
                              )
                            }
                            className="w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
                            aria-label="Diminuir mês adicional"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <div className="flex items-center gap-1 px-1.5 py-1 bg-slate-950 border border-slate-700 rounded-lg">
                            <input
                              id={sardinhaExtraMonthsId}
                              type="number"
                              min="0"
                              max="11"
                              value={sardinhaExtraMonths}
                              onChange={(e) => setSardinhaExtraMonths(e.target.value)}
                              className="w-10 bg-transparent text-white font-mono text-center font-bold text-sm focus:outline-none"
                            />
                            <span className="text-[11px] font-bold text-emerald-400 select-none">
                              {parseInt(sardinhaExtraMonths, 10) === 1 ? 'Mês' : 'Meses'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setSardinhaExtraMonths(
                                String(Math.min(11, (parseInt(sardinhaExtraMonths, 10) || 0) + 1))
                              )
                            }
                            className="w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
                            aria-label="Aumentar mês adicional"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Resumo formatado */}
                    <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-emerald-300">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-[11px]">Prazo configurado:</span>
                      </div>
                      <span className="font-mono font-bold text-white text-xs">
                        {parseInt(sardinhaYears, 10) || 0}a{' '}
                        {parseInt(sardinhaExtraMonths, 10) || 0 > 0
                          ? `e ${parseInt(sardinhaExtraMonths, 10)}m `
                          : ''}
                        = {sardinhaTotalMonths} meses
                      </span>
                    </div>

                    {/* Atalhos Rápidos */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-medium">Atalhos rápidos:</span>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { y: '1', m: '0', label: '1 ano' },
                          { y: '1', m: '6', label: '1a 6m' },
                          { y: '2', m: '0', label: '2 anos' },
                          { y: '2', m: '6', label: '2a 6m' },
                          { y: '3', m: '0', label: '3 anos' },
                          { y: '5', m: '0', label: '5 anos' },
                          { y: '10', m: '0', label: '10 anos' },
                          { y: '20', m: '0', label: '20 anos' },
                        ].map((preset, idx) => {
                          const isSel =
                            sardinhaYears === preset.y && sardinhaExtraMonths === preset.m;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setSardinhaYears(preset.y);
                                setSardinhaExtraMonths(preset.m);
                              }}
                              className={`py-1 rounded-lg font-mono text-[11px] font-medium transition-colors ${
                                isSel
                                  ? 'bg-emerald-600 text-white font-bold'
                                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                              }`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* MODO 2: APENAS ANOS */}
                {sardinhaTimeMode === 'anos' && (
                  <div className="space-y-2">
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
                      <div className="flex flex-col">
                        <label
                          htmlFor={sardinhaYearsId}
                          className="text-xs font-semibold text-slate-300"
                        >
                          Quantidade de Anos
                        </label>
                        <span className="text-[11px] text-slate-500 font-mono">
                          Equivale a {sardinhaTotalMonths} meses
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setSardinhaYears(
                              String(Math.max(1, (parseInt(sardinhaYears, 10) || 1) - 1))
                            )
                          }
                          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors"
                          aria-label="Diminuir ano"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg">
                          <input
                            id={sardinhaYearsId}
                            type="number"
                            min="1"
                            max="60"
                            value={sardinhaYears}
                            onChange={(e) => setSardinhaYears(e.target.value)}
                            className="w-14 bg-transparent text-white font-mono text-center font-bold text-sm focus:outline-none"
                          />
                          <span className="text-xs font-bold text-emerald-400 select-none">
                            {parseInt(sardinhaYears, 10) === 1 ? 'Ano' : 'Anos'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setSardinhaYears(String((parseInt(sardinhaYears, 10) || 0) + 1))
                          }
                          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors"
                          aria-label="Aumentar ano"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Presets de Anos */}
                    <div className="grid grid-cols-4 gap-1.5">
                      {[1, 2, 3, 5, 10, 15, 20, 30].map((y) => {
                        const isSel = parseFloat(sardinhaYears) === y;
                        return (
                          <button
                            key={y}
                            type="button"
                            onClick={() => setSardinhaYears(String(y))}
                            className={`py-1 text-xs rounded-lg font-mono font-medium transition-colors ${
                              isSel
                                ? 'bg-emerald-600 text-white font-bold'
                                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                            }`}
                          >
                            {y} {y === 1 ? 'ano' : 'anos'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* MODO 3: APENAS MESES */}
                {sardinhaTimeMode === 'meses' && (
                  <div className="space-y-2">
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
                      <div className="flex flex-col">
                        <label
                          htmlFor={sardinhaMonthsOnlyId}
                          className="text-xs font-semibold text-slate-300"
                        >
                          Quantidade de Meses
                        </label>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {(sardinhaTotalMonths / 12).toFixed(1)} ano(s)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setSardinhaMonthsOnly(
                              String(Math.max(1, (parseInt(sardinhaMonthsOnly, 10) || 1) - 6))
                            )
                          }
                          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors"
                          aria-label="Diminuir meses"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg">
                          <input
                            id={sardinhaMonthsOnlyId}
                            type="number"
                            min="1"
                            max="720"
                            value={sardinhaMonthsOnly}
                            onChange={(e) => setSardinhaMonthsOnly(e.target.value)}
                            className="w-16 bg-transparent text-white font-mono text-center font-bold text-sm focus:outline-none"
                          />
                          <span className="text-xs font-bold text-emerald-400 select-none">
                            {parseInt(sardinhaMonthsOnly, 10) === 1 ? 'Mês' : 'Meses'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setSardinhaMonthsOnly(
                              String((parseInt(sardinhaMonthsOnly, 10) || 0) + 6))
                          }
                          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors"
                          aria-label="Aumentar meses"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Presets de Meses */}
                    <div className="grid grid-cols-4 gap-1.5">
                      {[6, 12, 24, 36, 48, 60, 120, 240].map((m) => {
                        const isSel = parseInt(sardinhaMonthsOnly, 10) === m;
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setSardinhaMonthsOnly(String(m))}
                            className={`py-1 text-xs rounded-lg font-mono font-medium transition-colors ${
                              isSel
                                ? 'bg-emerald-600 text-white font-bold'
                                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                            }`}
                          >
                            {m}m
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* FORMULÁRIO 2: Preço Teto Bazin */}
          {activeCalc === 'bazin' && (
            <div className="space-y-3 text-xs">
              <div>
                <label htmlFor={bazinAnnualDivId} className="text-slate-300 font-medium block mb-1">
                  Provento Anual Esperado por Cota (DPA em R$)
                </label>
                <input
                  id={bazinAnnualDivId}
                  type="number"
                  step="0.05"
                  value={bazinAnnualDiv}
                  onChange={(e) => setBazinAnnualDiv(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Ex: média de R$ 1,00/mês = R$ 12,00 por ano.
                </span>
              </div>

              <div>
                <label htmlFor={bazinRequiredYieldId} className="text-slate-300 font-medium block mb-1">
                  Taxa Mínima de Retorno Exigida (% a.a.)
                </label>
                <input
                  id={bazinRequiredYieldId}
                  type="number"
                  step="0.5"
                  value={bazinRequiredYield}
                  onChange={(e) => setBazinRequiredYield(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Bazin usava 6% a.a. para ações; no mercado de FIIs costuma-se usar entre 8% e 10% a.a.
                </span>
              </div>

              <div>
                <label htmlFor={bazinCurrentPriceId} className="text-slate-300 font-medium block mb-1">
                  Cotação Atual de Mercado (R$)
                </label>
                <input
                  id={bazinCurrentPriceId}
                  type="number"
                  step="0.10"
                  value={bazinCurrentPrice}
                  onChange={(e) => setBazinCurrentPrice(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>
            </div>
          )}

          {/* FORMULÁRIO 3: Modelo de Gordon */}
          {activeCalc === 'gordon' && (
            <div className="space-y-3 text-xs">
              <div>
                <label htmlFor={gordonNextDivId} className="text-slate-300 font-medium block mb-1">
                  Próximo Dividendo Anual Estimado (D1 em R$)
                </label>
                <input
                  id={gordonNextDivId}
                  type="number"
                  step="0.10"
                  value={gordonNextDiv}
                  onChange={(e) => setGordonNextDiv(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>

              <div>
                <label htmlFor={gordonDiscountRateId} className="text-slate-300 font-medium block mb-1">
                  Taxa de Retorno Exigida (k em % a.a.)
                </label>
                <input
                  id={gordonDiscountRateId}
                  type="number"
                  step="0.5"
                  value={gordonDiscountRate}
                  onChange={(e) => setGordonDiscountRate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>

              <div>
                <label htmlFor={gordonGrowthRateId} className="text-slate-300 font-medium block mb-1">
                  Taxa de Crescimento dos Proventos (g em % a.a.)
                </label>
                <input
                  id={gordonGrowthRateId}
                  type="number"
                  step="0.5"
                  value={gordonGrowthRate}
                  onChange={(e) => setGordonGrowthRate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>
            </div>
          )}

          {/* FORMULÁRIO 4: P/VP e Ágio/Desconto */}
          {activeCalc === 'pvp' && (
            <div className="space-y-3 text-xs">
              <div>
                <label htmlFor={pvpPriceId} className="text-slate-300 font-medium block mb-1">Cotação Atual de Mercado (R$)</label>
                <input
                  id={pvpPriceId}
                  type="number"
                  step="0.10"
                  value={pvpPrice}
                  onChange={(e) => setPvpPrice(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>
              <div>
                <label htmlFor={pvpVPAId} className="text-slate-300 font-medium block mb-1">
                  Valor Patrimonial por Cota (VPA em R$)
                </label>
                <input
                  id={pvpVPAId}
                  type="number"
                  step="0.10"
                  value={pvpVPA}
                  onChange={(e) => setPvpVPA(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>
            </div>
          )}

          {/* FORMULÁRIO 5: Preço Médio Ponderado */}
          {activeCalc === 'preco_medio' && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor={pmCurrentQtyId} className="text-slate-300 font-medium block mb-1">Cotas Atuais</label>
                  <input
                    id={pmCurrentQtyId}
                    type="number"
                    value={pmCurrentQty}
                    onChange={(e) => setPmCurrentQty(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label htmlFor={pmCurrentAvgId} className="text-slate-300 font-medium block mb-1">Preço Médio Atual (R$)</label>
                  <input
                    id={pmCurrentAvgId}
                    type="number"
                    value={pmCurrentAvg}
                    onChange={(e) => setPmCurrentAvg(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label htmlFor={pmNewQtyId} className="text-slate-300 font-medium block mb-1">Nova Compra (Qtd)</label>
                  <input
                    id={pmNewQtyId}
                    type="number"
                    value={pmNewQty}
                    onChange={(e) => setPmNewQty(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label htmlFor={pmNewPriceId} className="text-slate-300 font-medium block mb-1">Novo Preço (R$)</label>
                  <input
                    id={pmNewPriceId}
                    type="number"
                    value={pmNewPrice}
                    onChange={(e) => setPmNewPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label htmlFor={pmFeesId} className="text-slate-300 font-medium block mb-1">Taxas (R$)</label>
                  <input
                    id={pmFeesId}
                    type="number"
                    value={pmFees}
                    onChange={(e) => setPmFees(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* FORMULÁRIO 6: Renda Passiva */}
          {activeCalc === 'renda_passiva' && (
            <div className="space-y-3 text-xs">
              <div>
                <label htmlFor={targetIncomeId} className="text-slate-300 font-medium block mb-1">
                  Renda Mensal Desejada em Proventos (R$/mês)
                </label>
                <input
                  id={targetIncomeId}
                  type="number"
                  step="500"
                  value={targetIncome}
                  onChange={(e) => setTargetIncome(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>
              <div>
                <label htmlFor={expectedDYId} className="text-slate-300 font-medium block mb-1">
                  Dividend Yield Anual Esperado da Carteira (% a.a.)
                </label>
                <input
                  id={expectedDYId}
                  type="number"
                  step="0.5"
                  value={expectedDY}
                  onChange={(e) => setExpectedDY(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>
            </div>
          )}

          {/* FORMULÁRIO 7: FIRE */}
          {activeCalc === 'fire' && (
            <div className="space-y-3 text-xs">
              <div>
                <label htmlFor={fireExpensesId} className="text-slate-300 font-medium block mb-1">Custo de Vida Mensal (R$/mês)</label>
                <input
                  id={fireExpensesId}
                  type="number"
                  step="500"
                  value={fireExpenses}
                  onChange={(e) => setFireExpenses(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>
              <div>
                <label htmlFor={fireYieldId} className="text-slate-300 font-medium block mb-1">
                  DY Médio Sustentável de Retirada (% a.a.)
                </label>
                <input
                  id={fireYieldId}
                  type="number"
                  step="0.5"
                  value={fireYield}
                  onChange={(e) => setFireYield(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>
              <div>
                <label htmlFor={fireCurrentEquitId} className="text-slate-300 font-medium block mb-1">Patrimônio Atual (R$)</label>
                <input
                  id={fireCurrentEquitId}
                  type="number"
                  step="5000"
                  value={fireCurrentEquit}
                  onChange={(e) => setFireCurrentEquit(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* LADO DIREITO: Resultados Destacados & Projeções Visuais (7 Colunas) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-4 shadow-lg">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Resultado & Diagnóstico do Modelo
            </h3>

            {/* Resultado 1: Sardinha */}
            {activeCalc === 'sardinha' && (
              <div className="space-y-4">
                {/* Cabeçalho do Horizonte Selecionado */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-900/90 border border-slate-800 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-slate-300 font-medium">
                      Horizonte:{' '}
                      <strong className="text-white">
                        {Math.floor(sardinhaTotalMonths / 12)} {Math.floor(sardinhaTotalMonths / 12) === 1 ? 'ano' : 'anos'}
                        {sardinhaTotalMonths % 12 > 0
                          ? ` e ${sardinhaTotalMonths % 12} ${sardinhaTotalMonths % 12 === 1 ? 'mês' : 'meses'}`
                          : ''}
                      </strong>{' '}
                      <span className="text-slate-500 font-mono">({sardinhaTotalMonths} meses)</span>
                    </span>
                  </div>
                  <div className="text-xs text-emerald-400 font-mono font-semibold">
                    Renda mensal estimada no fim:{' '}
                    <span className="text-white font-bold">
                      {formatBRL(
                        sardinhaRes.timeline[sardinhaRes.timeline.length - 1]?.monthlyYield || 0
                      )}
                      /mês
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[11px] text-slate-400">Patrimônio Final</span>
                    <strong className="text-xl font-bold text-white font-mono block mt-1">
                      {formatBRL(sardinhaRes.finalPortfolio)}
                    </strong>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[11px] text-slate-400">Total Aportado do Bolso</span>
                    <strong className="text-xl font-bold text-slate-300 font-mono block mt-1">
                      {formatBRL(sardinhaRes.totalContributed)}
                    </strong>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[11px] text-slate-400">Juros e Proventos Gerados</span>
                    <strong className="text-xl font-bold text-emerald-400 font-mono block mt-1">
                      {formatBRL(sardinhaRes.totalYieldEarned)}
                    </strong>
                  </div>
                </div>

                {/* Composição Proporcional */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>
                      Aportes: {((sardinhaRes.totalContributed / sardinhaRes.finalPortfolio) * 100).toFixed(1)}%
                    </span>
                    <span>
                      Proventos Reinvestidos: {((sardinhaRes.totalYieldEarned / sardinhaRes.finalPortfolio) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex">
                    <div
                      className="bg-blue-500 h-full"
                      style={{
                        width: `${(sardinhaRes.totalContributed / sardinhaRes.finalPortfolio) * 100}%`,
                      }}
                      title="Total aportado do bolso"
                    />
                    <div
                      className="bg-emerald-500 h-full"
                      style={{
                        width: `${(sardinhaRes.totalYieldEarned / sardinhaRes.finalPortfolio) * 100}%`,
                      }}
                      title="Juros compostos reinvestidos"
                    />
                  </div>
                </div>

                {/* Tabela de Evolução da Bola de Neve (Marcos Anuais ou Mensais) */}
                <div className="pt-2">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-white">
                        Evolução da Bola de Neve
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setSardinhaViewMode('yearly')}
                          className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                            sardinhaViewMode === 'yearly'
                              ? 'bg-emerald-600 text-white'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Anual
                        </button>
                        <button
                          type="button"
                          onClick={() => setSardinhaViewMode('monthly')}
                          className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                            sardinhaViewMode === 'monthly'
                              ? 'bg-emerald-600 text-white'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Mensal
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowSardinhaTable(!showSardinhaTable)}
                        className="text-[11px] text-slate-400 hover:text-white underline ml-1"
                      >
                        {showSardinhaTable ? 'Ocultar' : 'Ver'}
                      </button>
                    </div>
                  </div>

                  {showSardinhaTable && (
                    <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-slate-800/80 scrollbar-thin">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-slate-900 text-[10px] uppercase font-semibold text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="py-2 px-3">Período</th>
                            <th className="py-2 px-3 text-right">Aportado</th>
                            <th className="py-2 px-3 text-right">Rend. Mês</th>
                            <th className="py-2 px-3 text-right">Patrimônio</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                          {sardinhaRes.timeline
                            .filter((row) => {
                              if (sardinhaViewMode === 'monthly') return true;
                              // Modo Anual: mostrar a cada 12 meses e o último mês
                              return row.month % 12 === 0 || row.month === sardinhaTotalMonths;
                            })
                            .map((row) => {
                              const isLast = row.month === sardinhaTotalMonths;
                              const isYearMark = row.month % 12 === 0;
                              return (
                                <tr
                                  key={row.month}
                                  className={`hover:bg-slate-800/40 transition-colors ${
                                    isLast ? 'bg-emerald-500/10 font-bold' : ''
                                  }`}
                                >
                                  <td className="py-1.5 px-3 text-slate-300">
                                    {isYearMark
                                      ? `Ano ${row.month / 12} (${row.month}m)`
                                      : `Mês ${row.month}`}
                                    {isLast && ' ★ Fim'}
                                  </td>
                                  <td className="py-1.5 px-3 text-right text-slate-400">
                                    {formatBRL(row.totalContributed)}
                                  </td>
                                  <td className="py-1.5 px-3 text-right text-emerald-400">
                                    +{formatBRL(row.monthlyYield)}
                                  </td>
                                  <td className="py-1.5 px-3 text-right text-white font-semibold">
                                    {formatBRL(row.totalPortfolio)}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Resultado 2: Bazin */}
            {activeCalc === 'bazin' && bazinRes && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/30">
                    <span className="text-[11px] text-slate-400 uppercase font-semibold">Preço-Teto Bazin</span>
                    <strong className="text-2xl font-bold text-emerald-400 font-mono block mt-1">
                      {formatBRL(bazinRes.ceilingPrice)}
                    </strong>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Valor máximo a pagar para garantir o yield de {bazinRequiredYield}% a.a.
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[11px] text-slate-400 uppercase font-semibold">Margem de Segurança</span>
                    <strong
                      className={`text-2xl font-bold font-mono block mt-1 ${
                        bazinRes.safetyMargin >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {formatPercent(bazinRes.safetyMargin, true)}
                    </strong>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      {bazinRes.safetyMargin >= 0
                        ? 'Cotação atual com desconto em relação ao preço-teto.'
                        : 'Cotação atual acima do teto estipulado.'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Resultado 3: Gordon */}
            {activeCalc === 'gordon' && gordonRes && (
              <div className="space-y-3">
                {gordonRes.isValid ? (
                  <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/30">
                    <span className="text-[11px] text-slate-400 uppercase font-semibold">
                      Valor Intrínseco Estimado (P0)
                    </span>
                    <strong className="text-2xl font-bold text-emerald-400 font-mono block mt-1">
                      {formatBRL(gordonRes.intrinsicValue)}
                    </strong>
                    <span className="text-xs text-slate-400 mt-1 block">
                      Fórmula: P0 = D1 / (k - g) = R$ {gordonNextDiv} / ({gordonDiscountRate}% - {gordonGrowthRate}%)
                    </span>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>{gordonRes.message}</span>
                  </div>
                )}
              </div>
            )}

            {/* Resultado 4: P/VP */}
            {activeCalc === 'pvp' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[11px] text-slate-400 uppercase font-semibold">Múltiplo P/VP</span>
                  <strong
                    className={`text-2xl font-bold font-mono block mt-1 ${
                      pvpRes.pvp <= 1.0 ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {pvpRes.pvp.toFixed(2)}
                  </strong>
                </div>
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[11px] text-slate-400 uppercase font-semibold">Condição de Mercado</span>
                  <strong
                    className={`text-2xl font-bold font-mono block mt-1 ${
                      pvpRes.discountOrPremiumPercent <= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {pvpRes.discountOrPremiumPercent <= 0
                      ? `${Math.abs(pvpRes.discountOrPremiumPercent)}% Desconto`
                      : `${pvpRes.discountOrPremiumPercent}% Ágio`}
                  </strong>
                </div>
              </div>
            )}

            {/* Resultado 5: Preço Médio */}
            {activeCalc === 'preco_medio' && pmRes && (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[11px] text-slate-400 uppercase font-semibold">Novo Preço Médio</span>
                  <strong className="text-2xl font-bold text-emerald-400 font-mono block mt-1">
                    {formatBRL(pmRes.newAveragePrice)}
                  </strong>
                </div>
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[11px] text-slate-400 uppercase font-semibold">Nova Quantidade Total</span>
                  <strong className="text-2xl font-bold text-white font-mono block mt-1">
                    {pmRes.newQuantity} cotas
                  </strong>
                </div>
              </div>
            )}

            {/* Resultado 6: Renda Passiva */}
            {activeCalc === 'renda_passiva' && incomeRes && (
              <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/30">
                <span className="text-[11px] text-slate-400 uppercase font-semibold">
                  Patrimônio Necessário para R$ {targetIncome}/mês
                </span>
                <strong className="text-2xl font-bold text-emerald-400 font-mono block mt-1">
                  {formatBRL(incomeRes.requiredEquity)}
                </strong>
                <span className="text-xs text-slate-400 mt-1 block">
                  Considerando uma rentabilidade em dividend yield líquido de {expectedDY}% a.a.
                </span>
              </div>
            )}

            {/* Resultado 7: FIRE */}
            {activeCalc === 'fire' && fireRes && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[11px] text-slate-400 uppercase font-semibold">Patrimônio Necessário (FIRE)</span>
                    <strong className="text-xl font-bold text-white font-mono block mt-1">
                      {formatBRL(fireRes.requiredEquity)}
                    </strong>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[11px] text-slate-400 uppercase font-semibold">Progresso Rumo ao FIRE</span>
                    <strong className="text-xl font-bold text-emerald-400 font-mono block mt-1">
                      {formatPercent(fireRes.equityProgressPercent, false)}
                    </strong>
                  </div>
                </div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all"
                    style={{ width: `${fireRes.equityProgressPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Painel Expansível: Como Usar Esta Calculadora */}
          <div className="p-4 rounded-xl bg-[#0F172A] border border-slate-800">
            <button
              onClick={() => setShowHowToUse(!showHowToUse)}
              className="w-full flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-white"
            >
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-emerald-400" />
                <span>Como usar esta calculadora, fórmulas e limitações</span>
              </div>
              {showHowToUse ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showHowToUse && (
              <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-400 space-y-2 leading-relaxed">
                <p>
                  <strong className="text-white">Interpretação:</strong> Nenhum modelo substitui uma análise detalhada dos relatórios gerenciais, vacância, qualidade dos imóveis e garantias de CRIs.
                </p>
                <p>
                  <strong className="text-white">Isenção de Garantia:</strong> Projeções financeiras são simulações matemáticas estritamente hipotéticas e não representam promessa ou garantia de rentabilidade futura.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
