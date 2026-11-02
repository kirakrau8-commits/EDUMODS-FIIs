import React, { useState, useMemo, useId } from 'react';
import {
  Coins,
  TrendingUp,
  Sparkles,
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ShieldAlert,
  ArrowRight,
  Flame,
  CheckCircle2,
  Sliders,
  DollarSign,
  PiggyBank,
} from 'lucide-react';
import { calculateSardinhaProjection } from '../../utils/financialMath';
import { formatBRL, formatPercent, parseFlexibleNumber } from '../../utils/formatters';
import { usePortfolio } from '../../context/PortfolioContext';

export const CalculatorsView: React.FC = () => {
  const { totalMarketValue, holdings, preferences } = usePortfolio();

  const [initialCapital, setInitialCapital] = useState<string>(() =>
    totalMarketValue > 0 ? String(Math.round(totalMarketValue)) : '10000'
  );
  const [monthlyContribution, setMonthlyContribution] = useState<string>('1500');
  const [rateType, setRateType] = useState<'ANUAL' | 'MENSAL'>('ANUAL');
  const [rateValue, setRateValue] = useState<string>('11,5');
  const [timeMode, setTimeMode] = useState<'ANOS' | 'MESES'>('ANOS');
  const [years, setYears] = useState<string>('10');
  const [months, setMonths] = useState<string>('0');
  const [showFullTimeline, setShowFullTimeline] = useState<boolean>(false);
  const [timelineGrouping, setTimelineGrouping] = useState<'ANUAL' | 'MENSAL'>('ANUAL');
  const [feedback, setFeedback] = useState<string | null>(null);

  const initialCapitalId = useId();
  const monthlyContributionId = useId();
  const rateValueId = useId();
  const yearsId = useId();
  const monthsId = useId();

  // Converte a taxa informada para % anual equivalente
  const annualRatePercent = useMemo(() => {
    const parsed = parseFlexibleNumber(rateValue);
    if (parsed <= 0) return 0;
    if (rateType === 'ANUAL') {
      return parsed;
    }
    // Mensal -> Anual: (1 + i_m)^12 - 1
    const monthlyDecimal = parsed / 100;
    const annualEq = (Math.pow(1 + monthlyDecimal, 12) - 1) * 100;
    return Number(annualEq.toFixed(2));
  }, [rateValue, rateType]);

  // Taxa mensal equivalente para cálculo da renda futura
  const monthlyRatePercent = useMemo(() => {
    if (rateType === 'MENSAL') {
      return parseFlexibleNumber(rateValue);
    }
    if (annualRatePercent <= 0) return 0;
    // Anual -> Mensal: (1 + i_a)^(1/12) - 1
    const m = (Math.pow(1 + annualRatePercent / 100, 1 / 12) - 1) * 100;
    return Number(m.toFixed(4));
  }, [rateValue, rateType, annualRatePercent]);

  // Período total em meses
  const totalMonths = useMemo(() => {
    if (timeMode === 'MESES') {
      return Math.max(1, Math.min(600, Math.floor(parseFlexibleNumber(months) || 12)));
    }
    const y = Math.floor(parseFlexibleNumber(years) || 1);
    const extraM = Math.floor(parseFlexibleNumber(months) || 0);
    return Math.max(1, Math.min(600, y * 12 + extraM));
  }, [timeMode, years, months]);

  // Projeção Cenário Base
  const baseProjection = useMemo(() => {
    const init = Math.max(0, parseFlexibleNumber(initialCapital));
    const contrib = Math.max(0, parseFlexibleNumber(monthlyContribution));
    return calculateSardinhaProjection(init, contrib, annualRatePercent, totalMonths);
  }, [initialCapital, monthlyContribution, annualRatePercent, totalMonths]);

  // Projeção Cenário Conservador (-2% a.a.)
  const conservativeProjection = useMemo(() => {
    const init = Math.max(0, parseFlexibleNumber(initialCapital));
    const contrib = Math.max(0, parseFlexibleNumber(monthlyContribution));
    const rate = Math.max(1, annualRatePercent - 2);
    return calculateSardinhaProjection(init, contrib, rate, totalMonths);
  }, [initialCapital, monthlyContribution, annualRatePercent, totalMonths]);

  // Projeção Cenário Otimista (+2% a.a.)
  const optimisticProjection = useMemo(() => {
    const init = Math.max(0, parseFlexibleNumber(initialCapital));
    const contrib = Math.max(0, parseFlexibleNumber(monthlyContribution));
    const rate = annualRatePercent + 2;
    return calculateSardinhaProjection(init, contrib, rate, totalMonths);
  }, [initialCapital, monthlyContribution, annualRatePercent, totalMonths]);

  // Mês em que ocorre o "Efeito Bola de Neve" (quando o dividendo mensal supera o aporte)
  const snowballMonth = useMemo(() => {
    const contrib = parseFlexibleNumber(monthlyContribution);
    if (contrib <= 0) return null;
    return baseProjection.timeline.find((t) => t.monthlyYield >= contrib) || null;
  }, [baseProjection, monthlyContribution]);

  // Renda mensal estimada no fim do período (com base na taxa mensal de proventos)
  const estimatedFutureMonthlyIncome = useMemo(() => {
    const monthlyDecimal = monthlyRatePercent / 100;
    return Number((baseProjection.finalPortfolio * monthlyDecimal).toFixed(2));
  }, [baseProjection.finalPortfolio, monthlyRatePercent]);

  // Agrupamento anual da tabela de evolução
  const yearlyTimeline = useMemo(() => {
    const items = [];
    for (let m = 12; m <= totalMonths; m += 12) {
      const snap = baseProjection.timeline[m - 1];
      if (snap) {
        items.push({
          year: m / 12,
          month: m,
          totalContributed: snap.totalContributed,
          totalYieldAccumulated: snap.totalYieldAccumulated,
          totalPortfolio: snap.totalPortfolio,
          monthlyYield: snap.monthlyYield,
        });
      }
    }
    // Garante que o último mês apareça se o prazo não for múltiplo exato de 12
    if (totalMonths % 12 !== 0 && baseProjection.timeline.length > 0) {
      const lastSnap = baseProjection.timeline[baseProjection.timeline.length - 1];
      items.push({
        year: Number((totalMonths / 12).toFixed(1)),
        month: totalMonths,
        totalContributed: lastSnap.totalContributed,
        totalYieldAccumulated: lastSnap.totalYieldAccumulated,
        totalPortfolio: lastSnap.totalPortfolio,
        monthlyYield: lastSnap.monthlyYield,
      });
    }
    return items;
  }, [baseProjection.timeline, totalMonths]);

  const handleUseCurrentPortfolio = () => {
    const curEquity = Math.round(totalMarketValue);
    setInitialCapital(String(curEquity));
    setFeedback(`Patrimônio de ${formatBRL(curEquity)} carregado no capital inicial!`);
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Cabeçalho do Módulo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-800 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Coins className="w-5 h-5" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              Simulador de Juros Compostos & Bola de Neve
            </h1>
          </div>
          <p className="text-xs md:text-sm text-slate-400 max-w-2xl">
            Projeção determinística de acumulação com reinvestimento integral de proventos e aportes regulares.
          </p>
        </div>

        {totalMarketValue > 0 && (
          <button
            type="button"
            onClick={handleUseCurrentPortfolio}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs md:text-sm font-bold shadow-lg shadow-emerald-900/30 transition-all cursor-pointer self-start md:self-auto shrink-0"
          >
            <PiggyBank className="w-4 h-4" />
            <span>Usar Carteira ({formatBRL(totalMarketValue, preferences.hideValues)})</span>
          </button>
        )}
      </div>

      {feedback && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Painel Principal: Parâmetros (Esquerda) e Resultados (Direita) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna de Entradas / Parâmetros */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <span>Parâmetros da Simulação</span>
            </h2>

            {/* Capital Inicial */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor={initialCapitalId} className="text-xs font-bold text-slate-300">
                  Capital Inicial
                </label>
                {totalMarketValue > 0 && (
                  <button
                    type="button"
                    onClick={handleUseCurrentPortfolio}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 cursor-pointer underline"
                  >
                    Usar carteira atual
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono font-bold">
                  R$
                </span>
                <input
                  id={initialCapitalId}
                  type="text"
                  inputMode="decimal"
                  value={initialCapital}
                  onChange={(e) => setInitialCapital(e.target.value)}
                  placeholder="0,00"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm font-bold focus:outline-hidden focus:border-emerald-500"
                />
              </div>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {[0, 5000, 10000, 25000, 50000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setInitialCapital(String(preset))}
                    className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-300 transition-colors cursor-pointer"
                  >
                    {formatBRL(preset)}
                  </button>
                ))}
              </div>
            </div>

            {/* Aporte Mensal */}
            <div className="space-y-1.5">
              <label htmlFor={monthlyContributionId} className="text-xs font-bold text-slate-300 block">
                Aporte Mensal Recorrente
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono font-bold">
                  R$
                </span>
                <input
                  id={monthlyContributionId}
                  type="text"
                  inputMode="decimal"
                  value={monthlyContribution}
                  onChange={(e) => setMonthlyContribution(e.target.value)}
                  placeholder="1000,00"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm font-bold focus:outline-hidden focus:border-emerald-500"
                />
              </div>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {[500, 1000, 1500, 2500, 5000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setMonthlyContribution(String(preset))}
                    className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-300 transition-colors cursor-pointer"
                  >
                    {formatBRL(preset)}
                  </button>
                ))}
              </div>
            </div>

            {/* Taxa de Rentabilidade & Alternador (Anual / Mensal) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor={rateValueId} className="text-xs font-bold text-slate-300">
                  Rentabilidade Estimada dos FIIs
                </label>
                <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setRateType('ANUAL')}
                    className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                      rateType === 'ANUAL'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    % ao ano
                  </button>
                  <button
                    type="button"
                    onClick={() => setRateType('MENSAL')}
                    className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                      rateType === 'MENSAL'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    % ao mês
                  </button>
                </div>
              </div>

              <div className="relative">
                <input
                  id={rateValueId}
                  type="text"
                  inputMode="decimal"
                  value={rateValue}
                  onChange={(e) => setRateValue(e.target.value)}
                  placeholder="11,5"
                  className="w-full pl-3.5 pr-12 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm font-bold focus:outline-hidden focus:border-emerald-500"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono font-bold">
                  {rateType === 'ANUAL' ? '% a.a.' : '% a.m.'}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  Equivalente:{' '}
                  <strong className="text-emerald-400 font-mono">
                    {rateType === 'ANUAL'
                      ? `${monthlyRatePercent.toFixed(2)}% ao mês`
                      : `${annualRatePercent.toFixed(2)}% ao ano`}
                  </strong>
                </span>
                <span className="text-slate-500">Média FIIs B3: ~10% a 12% a.a.</span>
              </div>
            </div>

            {/* Prazo de Acumulação */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor={yearsId} className="text-xs font-bold text-slate-300">
                  Prazo de Investimento
                </label>
                <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setTimeMode('ANOS')}
                    className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                      timeMode === 'ANOS'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Em Anos
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimeMode('MESES')}
                    className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                      timeMode === 'MESES'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Em Meses
                  </button>
                </div>
              </div>

              {timeMode === 'ANOS' ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <input
                      id={yearsId}
                      type="number"
                      min="1"
                      max="50"
                      value={years}
                      onChange={(e) => setYears(e.target.value)}
                      placeholder="10"
                      className="w-full pl-3.5 pr-14 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm font-bold focus:outline-hidden focus:border-emerald-500"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono">
                      anos
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      id={monthsId}
                      type="number"
                      min="0"
                      max="11"
                      value={months}
                      onChange={(e) => setMonths(e.target.value)}
                      placeholder="0"
                      className="w-full pl-3.5 pr-14 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm font-bold focus:outline-hidden focus:border-emerald-500"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono">
                      meses
                    </span>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <input
                    id={monthsId}
                    type="number"
                    min="1"
                    max="600"
                    value={months}
                    onChange={(e) => setMonths(e.target.value)}
                    placeholder="120"
                    className="w-full pl-3.5 pr-16 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm font-bold focus:outline-hidden focus:border-emerald-500"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono">
                    meses
                  </span>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {[3, 5, 10, 15, 20, 30].map((presetYear) => (
                  <button
                    key={presetYear}
                    type="button"
                    onClick={() => {
                      setTimeMode('ANOS');
                      setYears(String(presetYear));
                      setMonths('0');
                    }}
                    className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-300 transition-colors cursor-pointer"
                  >
                    {presetYear} anos
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Dica do Efeito Bola de Neve */}
          {snowballMonth && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 to-teal-950/30 border border-emerald-500/30 text-xs space-y-1">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <Flame className="w-4 h-4 text-amber-400" />
                <span>Ponto de Virada da Bola de Neve!</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                No <strong className="text-white">mês {snowballMonth.month}</strong> (cerca de{' '}
                {(snowballMonth.month / 12).toFixed(1)} anos), os proventos mensais gerados pela carteira (
                <strong className="text-emerald-400">{formatBRL(snowballMonth.monthlyYield)}</strong>
                ) ultrapassam o valor do seu aporte mensal (
                <strong className="text-white">{formatBRL(parseFlexibleNumber(monthlyContribution))}</strong>
                ). A partir daí, a carteira investe mais por conta própria do que o seu próprio bolso!
              </p>
            </div>
          )}
        </div>

        {/* Coluna de Resultados / Métricas */}
        <div className="lg:col-span-7 space-y-5">
          {/* Card Principal: Patrimônio Acumulado & Renda Mensal Futura */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-900 border-2 border-emerald-500/40 shadow-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-400">
                <span>Patrimônio Final Projetado</span>
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="text-2xl sm:text-3xl font-mono font-black text-white">
                {formatBRL(baseProjection.finalPortfolio)}
              </div>
              <div className="text-[11px] text-slate-300 flex items-center justify-between pt-1 border-t border-slate-800">
                <span>Multiplicador do Capital:</span>
                <strong className="text-emerald-300 font-mono">
                  {baseProjection.totalContributed > 0
                    ? `${(baseProjection.finalPortfolio / baseProjection.totalContributed).toFixed(2)}x`
                    : '1.0x'}
                </strong>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-gradient-to-br from-teal-950/60 via-slate-900 to-slate-900 border border-teal-500/30 shadow-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-teal-400">
                <span>Renda Mensal Futura Estimada</span>
                <Coins className="w-4 h-4" />
              </div>
              <div className="text-2xl sm:text-3xl font-mono font-black text-teal-300">
                {formatBRL(estimatedFutureMonthlyIncome)}
                <span className="text-xs text-slate-400 font-sans font-normal ml-1">/mês</span>
              </div>
              <div className="text-[11px] text-slate-300 flex items-center justify-between pt-1 border-t border-slate-800">
                <span>Com base na taxa mensal de:</span>
                <strong className="text-teal-300 font-mono">{monthlyRatePercent.toFixed(2)}% a.m.</strong>
              </div>
            </div>
          </div>

          {/* Cards Secundários: Custo do Bolso vs Juros/Proventos Reinvestidos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1">
              <span className="text-slate-400 block">Total Aportado do Bolso</span>
              <div className="text-lg font-mono font-bold text-slate-100">
                {formatBRL(baseProjection.totalContributed)}
              </div>
              <p className="text-[10px] text-slate-500">
                {formatBRL(parseFlexibleNumber(initialCapital))} inicial +{' '}
                {totalMonths} aportes mensais de {formatBRL(parseFlexibleNumber(monthlyContribution))}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1">
              <span className="text-slate-400 block">Proventos & Juros Reinvestidos</span>
              <div className="text-lg font-mono font-bold text-emerald-400">
                +{formatBRL(baseProjection.totalYieldEarned)}
              </div>
              <p className="text-[10px] text-slate-500">
                Rendimento acumulado que trabalhou a seu favor no período
              </p>
            </div>
          </div>

          {/* Barra de Composição: Capital Aportado vs Proventos Reinvestidos */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">Composição do Patrimônio Final</span>
              <span className="text-slate-400 font-mono text-[11px]">
                {baseProjection.finalPortfolio > 0
                  ? `${(
                      (baseProjection.totalYieldEarned / baseProjection.finalPortfolio) *
                      100
                    ).toFixed(0)}% vêm dos juros reinvestidos!`
                  : '0%'}
              </span>
            </div>

            <div className="h-4 w-full bg-slate-800 rounded-full overflow-hidden flex">
              <div
                style={{
                  width: `${
                    baseProjection.finalPortfolio > 0
                      ? (baseProjection.totalContributed / baseProjection.finalPortfolio) * 100
                      : 100
                  }%`,
                }}
                className="bg-blue-600 transition-all duration-500"
                title={`Aportado: ${formatBRL(baseProjection.totalContributed)}`}
              />
              <div
                style={{
                  width: `${
                    baseProjection.finalPortfolio > 0
                      ? (baseProjection.totalYieldEarned / baseProjection.finalPortfolio) * 100
                      : 0
                  }%`,
                }}
                className="bg-emerald-500 transition-all duration-500"
                title={`Proventos: ${formatBRL(baseProjection.totalYieldEarned)}`}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                <span>Capital Investido ({formatBRL(baseProjection.totalContributed)})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                <span>Proventos Reinvestidos ({formatBRL(baseProjection.totalYieldEarned)})</span>
              </div>
            </div>
          </div>

          {/* Comparativo de 3 Cenários */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>Comparativo de Cenários em {totalMonths} meses</span>
              </h3>
              <span className="text-[10px] text-slate-500">Sensibilidade de taxa ±2% a.a.</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {/* Conservador */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Conservador</div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {(annualRatePercent - 2).toFixed(1)}% a.a.
                </div>
                <div className="text-sm font-bold font-mono text-slate-200">
                  {formatBRL(conservativeProjection.finalPortfolio)}
                </div>
                <div className="text-[10px] text-teal-400 font-mono pt-1 border-t border-slate-800/80">
                  Renda:{' '}
                  {formatBRL(
                    (conservativeProjection.finalPortfolio *
                      (Math.pow(1 + Math.max(1, annualRatePercent - 2) / 100, 1 / 12) - 1))
                  )}
                  /mês
                </div>
              </div>

              {/* Base */}
              <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 space-y-1 relative">
                <span className="absolute -top-2 right-2 px-1.5 py-0.2 bg-emerald-600 text-white text-[9px] font-bold rounded-full">
                  Base
                </span>
                <div className="text-[10px] font-bold text-emerald-300 uppercase">Cenário Base</div>
                <div className="text-[11px] text-emerald-400/80 font-mono">
                  {annualRatePercent.toFixed(1)}% a.a.
                </div>
                <div className="text-sm font-bold font-mono text-white">
                  {formatBRL(baseProjection.finalPortfolio)}
                </div>
                <div className="text-[10px] text-teal-300 font-mono pt-1 border-t border-emerald-500/20">
                  Renda: {formatBRL(estimatedFutureMonthlyIncome)}/mês
                </div>
              </div>

              {/* Otimista */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                <div className="text-[10px] font-bold text-emerald-400 uppercase">Otimista</div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {(annualRatePercent + 2).toFixed(1)}% a.a.
                </div>
                <div className="text-sm font-bold font-mono text-emerald-300">
                  {formatBRL(optimisticProjection.finalPortfolio)}
                </div>
                <div className="text-[10px] text-teal-400 font-mono pt-1 border-t border-slate-800/80">
                  Renda:{' '}
                  {formatBRL(
                    (optimisticProjection.finalPortfolio *
                      (Math.pow(1 + (annualRatePercent + 2) / 100, 1 / 12) - 1))
                  )}
                  /mês
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Linha do Tempo e Tabela de Evolução */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>Evolução Patrimonial & Curva dos Juros Compostos</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Acompanhe a explosão exponencial da renda conforme o tempo avança.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
              <button
                type="button"
                onClick={() => setTimelineGrouping('ANUAL')}
                className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                  timelineGrouping === 'ANUAL'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Ano a Ano
              </button>
              <button
                type="button"
                onClick={() => setTimelineGrouping('MENSAL')}
                className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                  timelineGrouping === 'MENSAL'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Mês a Mês
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowFullTimeline(!showFullTimeline)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all cursor-pointer"
            >
              <span>{showFullTimeline ? 'Recolher Tabela' : 'Ver Tabela Completa'}</span>
              {showFullTimeline ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Tabela de Evolução */}
        {showFullTimeline && (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950 text-slate-400 uppercase font-mono sticky top-0 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">
                    {timelineGrouping === 'ANUAL' ? 'Ano' : 'Mês'}
                  </th>
                  <th className="py-2.5 px-3 text-right">Capital Investido</th>
                  <th className="py-2.5 px-3 text-right">Provento Mensal</th>
                  <th className="py-2.5 px-3 text-right">Total em Proventos</th>
                  <th className="py-2.5 px-3 text-right font-bold text-white">Patrimônio Acumulado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {timelineGrouping === 'ANUAL'
                  ? yearlyTimeline.map((item) => (
                      <tr key={item.month} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2 px-3 font-bold text-white">
                          Ano {item.year} <span className="text-[10px] text-slate-500 font-normal">({item.month}m)</span>
                        </td>
                        <td className="py-2 px-3 text-right text-slate-300">
                          {formatBRL(item.totalContributed)}
                        </td>
                        <td className="py-2 px-3 text-right text-teal-400 font-bold">
                          {formatBRL(item.monthlyYield)}/mês
                        </td>
                        <td className="py-2 px-3 text-right text-emerald-400">
                          +{formatBRL(item.totalYieldAccumulated)}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-white">
                          {formatBRL(item.totalPortfolio)}
                        </td>
                      </tr>
                    ))
                  : baseProjection.timeline.map((item) => (
                      <tr key={item.month} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2 px-3 font-bold text-white">Mês {item.month}</td>
                        <td className="py-2 px-3 text-right text-slate-300">
                          {formatBRL(item.totalContributed)}
                        </td>
                        <td className="py-2 px-3 text-right text-teal-400 font-bold">
                          {formatBRL(item.monthlyYield)}/mês
                        </td>
                        <td className="py-2 px-3 text-right text-emerald-400">
                          +{formatBRL(item.totalYieldAccumulated)}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-white">
                          {formatBRL(item.totalPortfolio)}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Disclaimers & Avisos Legais */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-400 space-y-1.5 flex items-start gap-3">
        <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <strong className="text-slate-300 block font-semibold">
            Avisos Legais & Limitações da Simulação:
          </strong>
          <p className="leading-relaxed">
            Esta calculadora é uma ferramenta matemática de simulação educativa. Ela assume reinvestimento
            integral de proventos e rentabilidade linear constante ao longo de todo o prazo. Na prática da B3,
            Fundos Imobiliários sofrem variações periódicas de cotação de mercado, inadimplência e vacância,
            além de renegociação de aluguéis e taxas de juros (Selic/IPCA). Rentabilidade passada não é garantia
            de rentabilidade futura.
          </p>
        </div>
      </div>
    </div>
  );
};
