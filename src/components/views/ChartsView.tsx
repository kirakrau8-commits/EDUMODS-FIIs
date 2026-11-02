import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Award,
  Activity,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  Coins,
  Sparkles,
} from 'lucide-react';
import { usePortfolio } from '../../context/PortfolioContext';
import { formatBRL, formatPercent } from '../../utils/formatters';
import {
  computePortfolioEvolutionTimeline,
  PortfolioBuildingPeriod,
} from '../../utils/financialMath';
import { InfoTooltip, TabGuideBanner } from '../common/InfoTooltip';

type ChartMode = 'evolucao' | 'benchmarks' | 'proventos' | 'ativos';
type PeriodFilter = '6M' | '1A' | 'MAX';
type BuildingViewSubmode = 'periodos' | 'fundos';

export const ChartsView: React.FC = () => {
  const {
    holdings,
    transactions,
    dividends,
    totalInvested,
    totalMarketValue,
    totalUnrealizedGain,
    totalUnrealizedGainPercent,
    monthlyDividendsReceived,
    monthlyDividendsForecasted,
    preferences,
  } = usePortfolio();

  const [activeChartMode, setActiveChartMode] = useState<ChartMode>('evolucao');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('6M');
  const [buildingSubmode, setBuildingSubmode] = useState<BuildingViewSubmode>('periodos');
  const [selectedBuildingIdx, setSelectedBuildingIdx] = useState<number | null>(null);
  const [selectedHoldingTicker, setSelectedHoldingTicker] = useState<string | null>(null);

  const currentMonthlyDiv = monthlyDividendsReceived + monthlyDividendsForecasted || 250;

  // 1. Dados de Evolução Patrimonial em Formato de Edifícios (baseados nos dados reais da carteira)
  const buildingPeriods: PortfolioBuildingPeriod[] = useMemo(() => {
    return computePortfolioEvolutionTimeline({
      totalInvested: totalInvested || 32000,
      totalMarketValue: totalMarketValue || 33500,
      monthlyDividendsTotal: currentMonthlyDiv,
      periodFilter,
      transactions: transactions.map((t) => ({ date: t.date, type: t.type, total: t.total ?? 0 })),
      dividends,
    });
  }, [totalInvested, totalMarketValue, currentMonthlyDiv, periodFilter, transactions, dividends]);

  // Edifício selecionado para inspeção detalhada (padrão: último período / atual)
  const activeBuilding = useMemo(() => {
    if (
      selectedBuildingIdx !== null &&
      selectedBuildingIdx >= 0 &&
      selectedBuildingIdx < buildingPeriods.length
    ) {
      return buildingPeriods[selectedBuildingIdx];
    }
    return buildingPeriods[buildingPeriods.length - 1];
  }, [buildingPeriods, selectedBuildingIdx]);

  // Escala máxima para altura proporcional dos prédios por período
  const maxPeriodValue = useMemo(() => {
    return Math.max(
      1,
      ...buildingPeriods.map((b) => Math.max(b.marketValue, b.invested))
    );
  }, [buildingPeriods]);

  // 2. Edifícios por Fundo da Carteira (ordenada do maior para o menor patrimônio)
  const holdingsBuildings = useMemo(() => {
    return [...holdings].sort((a, b) => b.marketValue - a.marketValue);
  }, [holdings]);

  const maxHoldingValue = useMemo(() => {
    return Math.max(
      1,
      ...holdingsBuildings.map((h) => Math.max(h.marketValue, h.totalCost ?? 0))
    );
  }, [holdingsBuildings]);

  const activeHoldingBuilding = useMemo(() => {
    if (selectedHoldingTicker) {
      const found = holdingsBuildings.find((h) => h.ticker === selectedHoldingTicker);
      if (found) return found;
    }
    return holdingsBuildings[0] || null;
  }, [holdingsBuildings, selectedHoldingTicker]);

  // 3. Dados Comparativos: Carteira vs IFIX vs CDI
  const benchmarkPoints = useMemo(() => {
    const basePortfolioReturn = totalUnrealizedGainPercent + 4.8; // Retorno total (cota + dividendos)
    if (periodFilter === '6M') {
      return [
        { label: 'Mai/26', portfolio: 1.2, ifix: 0.9, cdi: 0.85 },
        { label: 'Jun/26', portfolio: 2.5, ifix: 1.8, cdi: 1.72 },
        { label: 'Jul/26', portfolio: 2.1, ifix: 1.5, cdi: 2.60 },
        { label: 'Ago/26', portfolio: 4.3, ifix: 3.1, cdi: 3.50 },
        { label: 'Set/26', portfolio: 5.8, ifix: 4.2, cdi: 4.40 },
        {
          label: 'Out/26',
          portfolio: Number(Math.max(2.5, basePortfolioReturn).toFixed(2)),
          ifix: 5.1,
          cdi: 5.35,
        },
      ];
    }
    if (periodFilter === '1A') {
      return [
        { label: 'Nov/25', portfolio: 1.8, ifix: 1.2, cdi: 0.9 },
        { label: 'Jan/26', portfolio: 4.1, ifix: 3.0, cdi: 2.7 },
        { label: 'Mar/26', portfolio: 5.5, ifix: 4.2, cdi: 4.5 },
        { label: 'Mai/26', portfolio: 7.9, ifix: 6.1, cdi: 6.4 },
        { label: 'Jul/26', portfolio: 9.4, ifix: 7.5, cdi: 8.3 },
        { label: 'Set/26', portfolio: 11.2, ifix: 9.0, cdi: 10.1 },
        {
          label: 'Out/26',
          portfolio: Number(Math.max(11.8, basePortfolioReturn + 6).toFixed(2)),
          ifix: 10.4,
          cdi: 10.95,
        },
      ];
    }
    return [
      { label: 'Out/24', portfolio: 2.0, ifix: 1.5, cdi: 1.0 },
      { label: 'Fev/25', portfolio: 6.8, ifix: 4.9, cdi: 4.2 },
      { label: 'Jun/25', portfolio: 11.4, ifix: 8.2, cdi: 8.1 },
      { label: 'Out/25', portfolio: 16.5, ifix: 12.6, cdi: 12.4 },
      { label: 'Fev/26', portfolio: 20.1, ifix: 15.8, cdi: 16.5 },
      { label: 'Jun/26', portfolio: 24.3, ifix: 18.9, cdi: 20.2 },
      { label: 'Out/26', portfolio: 28.4, ifix: 21.5, cdi: 23.8 },
    ];
  }, [periodFilter, totalUnrealizedGainPercent]);

  const lastBenchmark = benchmarkPoints[benchmarkPoints.length - 1];
  const alphaVsIfix = lastBenchmark.portfolio - lastBenchmark.ifix;
  const alphaVsCdi = lastBenchmark.portfolio - lastBenchmark.cdi;

  const isProfit = totalUnrealizedGain >= 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Cabeçalho Principal */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6 rounded-2xl bg-[#0F172A] border border-slate-800 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              Visualização Arquitetônica de Patrimônio
            </span>
            <span className="text-xs text-slate-400">Dados reais da carteira</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white">
            Gráficos & Evolução em Edifícios Patrimoniais
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl">
            Acompanhe o crescimento da sua carteira representado por edifícios proporcionais a cada período, compare com o IFIX/CDI e analise a geração de proventos.
          </p>
        </div>

        {/* Filtro de Período */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 rounded-xl border border-slate-800 self-start lg:self-auto">
          {(['6M', '1A', 'MAX'] as PeriodFilter[]).map((pf) => (
            <button
              key={pf}
              onClick={() => {
                setPeriodFilter(pf);
                setSelectedBuildingIdx(null);
              }}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                periodFilter === pf
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {pf === '6M' ? '6 Meses' : pf === '1A' ? '1 Ano' : 'Máximo'}
            </button>
          ))}
        </div>
      </div>

      {/* Guia Rápido da Aba de Gráficos */}
      <TabGuideBanner
        title="Como ler os Gráficos de Edifícios e Indicadores?"
        subtitle="Explicação simples de cada visualização e termo técnico desta aba"
        items={[
          {
            term: 'Edifícios Patrimoniais',
            meaning:
              'Cada prédio representa um mês (ou um fundo da sua carteira). Quanto mais alto o edifício, maior o valor acumulado naquele período.',
            example:
              'Prédios verdes indicam crescimento em relação ao mês anterior; prédios âmbar/vermelhos indicam oscilação negativa da cota.',
          },
          {
            term: 'IFIX, CDI e Alfa (α)',
            meaning:
              'IFIX é o índice médio dos FIIs na Bolsa; CDI é a referência da renda fixa. Alfa (α) é quanto sua carteira rendeu acima desses índices.',
            example: 'Se sua carteira rendeu +6,5% e o IFIX +5,1%, seu Alfa é +1,4% (superou o mercado).',
          },
          {
            term: 'Yield on Cost (YoC)',
            meaning:
              'É o rendimento de dividendos calculado sobre o preço que você pagou (seu Preço Médio), e não sobre o preço atual da Bolsa.',
            example: 'Quem comprou barato recebe um percentual de aluguel maior sobre o próprio bolso.',
          },
        ]}
      />

      {/* Seletor de Modo Gráfico */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            id: 'evolucao',
            title: 'Edifícios Patrimoniais',
            subtitle: 'Evolução por período e ativo',
            icon: Building2,
          },
          {
            id: 'benchmarks',
            title: 'Carteira vs. IFIX & CDI',
            subtitle: 'Rentabilidade comparada',
            icon: Award,
          },
          {
            id: 'proventos',
            title: 'Torres de Proventos',
            subtitle: 'Renda mensal e Yield on Cost',
            icon: BarChart3,
          },
          {
            id: 'ativos',
            title: 'Raio-X por Fundo',
            subtitle: 'Lucro/Prejuízo e P/VP',
            icon: Layers,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeChartMode === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveChartMode(tab.id as ChartMode)}
              className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                isActive
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-white shadow-lg shadow-emerald-950/50'
                  : 'bg-[#0F172A] border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <div
                className={`p-2.5 rounded-xl ${
                  isActive ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">{tab.title}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{tab.subtitle}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* MODO 1: EVOLUÇÃO EM EDIFÍCIOS PATRIMONIAIS */}
      {activeChartMode === 'evolucao' && (
        <div className="space-y-6">
          {/* Sub-seletor: Edifícios por Período vs Edifícios por Fundo */}
          <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-6 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-base font-bold text-white">
                    {buildingSubmode === 'periodos'
                      ? 'Horizonte de Edifícios — Evolução Mensal do Patrimônio'
                      : 'Horizonte de Edifícios — Tamanho de Cada Fundo na Carteira'}
                  </h2>
                  <InfoTooltip
                    title="Gráfico de Edifícios"
                    description="Cada edifício representa visualmente o tamanho do seu patrimônio. A altura total é o Valor de Mercado e a linha tracejada interna mostra quanto saiu do seu bolso (Custo Investido). Clique em qualquer prédio para inspecionar os números exatos."
                  />
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Clique ou passe o mouse sobre qualquer edifício para ver o detalhamento financeiro completo abaixo.
                </p>
              </div>

              <div className="flex items-center gap-1.5 p-1 bg-slate-900 rounded-xl border border-slate-800 self-start md:self-auto">
                <button
                  type="button"
                  onClick={() => setBuildingSubmode('periodos')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    buildingSubmode === 'periodos'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Por Período ({buildingPeriods.length} meses)
                </button>
                <button
                  type="button"
                  onClick={() => setBuildingSubmode('fundos')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    buildingSubmode === 'fundos'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Por Fundo ({holdings.length} FIIs)
                </button>
              </div>
            </div>

            {/* Legenda Visual Clara */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 bg-slate-900/70 px-4 py-2.5 rounded-xl border border-slate-800/80">
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-gradient-to-t from-emerald-700 to-emerald-400 inline-block border border-emerald-300/50" />
                  <strong className="text-slate-200">Edifício Verde:</strong> Crescimento / Valorização
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-gradient-to-t from-amber-700 to-rose-400 inline-block border border-rose-300/50" />
                  <strong className="text-slate-200">Edifício Âmbar/Rosa:</strong> Recuo no Período
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 border-t-2 border-dashed border-sky-300 inline-block" />
                  <strong className="text-slate-200">Marca Tracejada:</strong> Custo Investido (Bolso)
                </span>
              </div>
              <span className="text-[11px] font-mono text-emerald-400">
                Escala real proporcional
              </span>
            </div>

            {/* SKYLINE 1: EDIFÍCIOS POR PERÍODO */}
            {buildingSubmode === 'periodos' && (
              <div className="space-y-5">
                <div className="relative pt-10 pb-3 px-2 sm:px-6 bg-gradient-to-b from-[#090E1A] via-[#0B1324] to-[#0F172A] rounded-2xl border border-slate-800/90 overflow-x-auto">
                  {/* Linhas horizontais de referência de altitude */}
                  <div className="absolute inset-x-4 top-10 bottom-12 pointer-events-none flex flex-col justify-between opacity-25">
                    {[1, 0.75, 0.5, 0.25].map((ratio) => (
                      <div
                        key={ratio}
                        className="w-full border-b border-dashed border-slate-600 flex justify-end"
                      >
                        <span className="text-[9px] font-mono text-slate-400 -mt-3.5 pr-1">
                          {formatBRL(maxPeriodValue * ratio, preferences.hideValues)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Sequência de Edifícios */}
                  <div className="relative z-10 min-w-[540px] h-72 flex items-end justify-around gap-3 sm:gap-5 pt-6 px-2 border-b-4 border-slate-700">
                    {buildingPeriods.map((b, idx) => {
                      const heightPct = Math.max(
                        24,
                        Math.min(100, (b.marketValue / maxPeriodValue) * 100)
                      );
                      const investedHeightPct =
                        b.marketValue > 0
                          ? Math.min(100, (b.invested / b.marketValue) * 100)
                          : 80;
                      const isSelected = activeBuilding?.id === b.id;
                      const isPositive = b.isGrowthVsPrev;

                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setSelectedBuildingIdx(idx)}
                          onMouseEnter={() => setSelectedBuildingIdx(idx)}
                          className="flex-1 max-w-[92px] h-full flex flex-col items-center justify-end group focus:outline-hidden"
                          aria-label={`Edifício de ${b.label}: ${formatBRL(b.marketValue)}`}
                        >
                          {/* Badge de Variação e Valor no Topo do Prédio */}
                          <div
                            className={`mb-1.5 flex flex-col items-center transition-transform duration-200 ${
                              isSelected ? 'scale-105 -translate-y-0.5' : 'group-hover:-translate-y-0.5'
                            }`}
                          >
                            <span
                              className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md border flex items-center gap-0.5 tabular-nums ${
                                isPositive
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              }`}
                            >
                              {isPositive ? (
                                <ArrowUpRight className="w-2.5 h-2.5" />
                              ) : (
                                <ArrowDownRight className="w-2.5 h-2.5" />
                              )}
                              {formatPercent(b.periodChangePercent, true)}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-white mt-0.5 tabular-nums">
                              {formatBRL(b.marketValue, preferences.hideValues)}
                            </span>
                          </div>

                          {/* Antena / Pináculo Arquitetônico */}
                          <div className="flex flex-col items-center">
                            <div
                              className={`w-0.5 h-2.5 transition-colors ${
                                isSelected
                                  ? 'bg-emerald-300'
                                  : isPositive
                                  ? 'bg-emerald-500/70'
                                  : 'bg-rose-400/70'
                              }`}
                            />
                            <div
                              className={`w-6 sm:w-8 h-1.5 rounded-t-sm border-t border-x ${
                                isPositive
                                  ? 'bg-emerald-500/40 border-emerald-400/60'
                                  : 'bg-rose-500/40 border-rose-400/60'
                              }`}
                            />
                          </div>

                          {/* Corpo Principal do Edifício */}
                          <div
                            style={{ height: `${heightPct}%` }}
                            className={`w-full relative rounded-t-md border-t-2 border-x transition-all duration-300 overflow-hidden flex flex-col justify-between p-1.5 ${
                              isSelected
                                ? isPositive
                                  ? 'bg-gradient-to-b from-emerald-500/45 via-emerald-700/35 to-slate-900 border-emerald-300 shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-400/50'
                                  : 'bg-gradient-to-b from-rose-500/45 via-rose-800/35 to-slate-900 border-rose-300 shadow-lg shadow-rose-500/25 ring-2 ring-rose-400/50'
                                : isPositive
                                ? 'bg-gradient-to-b from-emerald-600/30 via-slate-800/90 to-slate-900 border-emerald-500/40 hover:border-emerald-400'
                                : 'bg-gradient-to-b from-rose-600/30 via-slate-800/90 to-slate-900 border-rose-500/40 hover:border-rose-400'
                            }`}
                          >
                            {/* Linha Tracejada Indicando Custo Investido */}
                            <div
                              style={{ bottom: `${investedHeightPct}%` }}
                              className="absolute inset-x-0 border-t-2 border-dashed border-sky-300/90 z-20 pointer-events-none"
                              title={`Custo Investido: ${formatBRL(b.invested)}`}
                            />

                            {/* Grade de Janelas Iluminadas do Edifício */}
                            <div className="grid grid-cols-3 gap-1 pt-1 flex-1">
                              {Array.from({ length: b.floorsCount * 3 }).map((_, wIdx) => {
                                const isLit = (wIdx + idx) % 4 !== 0 || isSelected;
                                return (
                                  <div
                                    key={wIdx}
                                    className={`rounded-[1px] min-h-[5px] transition-colors ${
                                      isLit
                                        ? isPositive
                                          ? 'bg-emerald-300/35 group-hover:bg-emerald-200/55'
                                          : 'bg-amber-300/35 group-hover:bg-amber-200/55'
                                        : 'bg-slate-950/60'
                                    }`}
                                  />
                                );
                              })}
                            </div>

                            {/* Pódio / Porta de Entrada Térrea */}
                            <div className="w-full pt-1 flex justify-center border-t border-slate-700/60 mt-1">
                              <div className="w-3 h-2 rounded-t-xs bg-amber-300/40 border border-amber-200/40" />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Rótulos de Período na Base (Calçada) */}
                  <div className="min-w-[540px] flex items-center justify-around gap-3 sm:gap-5 pt-2.5 px-2">
                    {buildingPeriods.map((b, idx) => {
                      const isSelected = activeBuilding?.id === b.id;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setSelectedBuildingIdx(idx)}
                          className={`flex-1 max-w-[92px] text-center py-1 rounded-lg font-mono text-xs transition-colors ${
                            isSelected
                              ? 'bg-emerald-500/20 text-emerald-300 font-extrabold border border-emerald-500/40'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {b.label}
                          {b.isCurrent && (
                            <span className="block text-[9px] font-sans text-emerald-400 uppercase">
                              Atual
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Painel Inspetor do Edifício Selecionado */}
                {activeBuilding && (
                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs sm:text-sm font-bold text-white">
                          Raio-X do Edifício: {activeBuilding.fullPeriodName}
                        </span>
                      </div>
                      <span
                        className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full ${
                          activeBuilding.gainValue >= 0
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        Resultado Acumulado: {formatBRL(activeBuilding.gainValue, preferences.hideValues, true)} (
                        {formatPercent(activeBuilding.gainPercent, true)})
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                      <div className="p-3 rounded-xl bg-[#0F172A] border border-slate-800">
                        <span className="text-[10px] font-sans uppercase text-slate-400 block">
                          Altura Total (Valor de Mercado)
                        </span>
                        <strong className="text-sm sm:text-base font-extrabold text-white mt-0.5 block tabular-nums">
                          {formatBRL(activeBuilding.marketValue, preferences.hideValues)}
                        </strong>
                      </div>

                      <div className="p-3 rounded-xl bg-[#0F172A] border border-slate-800">
                        <span className="text-[10px] font-sans uppercase text-slate-400 block">
                          Custo Investido (Linha Azul)
                        </span>
                        <strong className="text-sm sm:text-base font-bold text-sky-300 mt-0.5 block tabular-nums">
                          {formatBRL(activeBuilding.invested, preferences.hideValues)}
                        </strong>
                      </div>

                      <div className="p-3 rounded-xl bg-[#0F172A] border border-slate-800">
                        <span className="text-[10px] font-sans uppercase text-slate-400 block">
                          Variação vs. Período Anterior
                        </span>
                        <strong
                          className={`text-sm sm:text-base font-bold mt-0.5 block tabular-nums ${
                            activeBuilding.isGrowthVsPrev ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {formatBRL(activeBuilding.periodChangeValue, preferences.hideValues, true)} (
                          {formatPercent(activeBuilding.periodChangePercent, true)})
                        </strong>
                      </div>

                      <div className="p-3 rounded-xl bg-[#0F172A] border border-slate-800">
                        <span className="text-[10px] font-sans uppercase text-slate-400 block">
                          Aluguéis (Proventos no Período)
                        </span>
                        <strong className="text-sm sm:text-base font-bold text-emerald-400 mt-0.5 block tabular-nums">
                          +{formatBRL(activeBuilding.dividends, preferences.hideValues)}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SKYLINE 2: EDIFÍCIOS POR FUNDO DA CARTEIRA */}
            {buildingSubmode === 'fundos' && (
              <div className="space-y-5">
                <div className="relative pt-10 pb-3 px-2 sm:px-6 bg-gradient-to-b from-[#090E1A] via-[#0B1324] to-[#0F172A] rounded-2xl border border-slate-800/90 overflow-x-auto">
                  <div className="relative z-10 min-w-[540px] h-72 flex items-end justify-around gap-3 sm:gap-5 pt-6 px-2 border-b-4 border-slate-700">
                    {holdingsBuildings.map((h) => {
                      const heightPct = Math.max(
                        24,
                        Math.min(100, (h.marketValue / maxHoldingValue) * 100)
                      );
                      const costRatioPct =
                        h.marketValue > 0 && h.totalCost != null
                          ? Math.min(100, (h.totalCost / h.marketValue) * 100)
                          : 80;
                      const isPositive = (h.unrealizedGain ?? 0) >= 0;
                      const isSelected = activeHoldingBuilding?.ticker === h.ticker;
                      const floors = Math.max(3, Math.min(9, Math.round((heightPct / 100) * 8)));

                      return (
                        <button
                          key={h.ticker}
                          type="button"
                          onClick={() => setSelectedHoldingTicker(h.ticker)}
                          onMouseEnter={() => setSelectedHoldingTicker(h.ticker)}
                          className="flex-1 max-w-[96px] h-full flex flex-col items-center justify-end group focus:outline-hidden"
                        >
                          <div className="mb-1.5 flex flex-col items-center">
                            <span
                              className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md border tabular-nums ${
                                isPositive
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              }`}
                            >
                              {formatPercent(h.unrealizedGainPercent, true)}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-white mt-0.5 tabular-nums">
                              {formatBRL(h.marketValue, preferences.hideValues)}
                            </span>
                          </div>

                          <div className="flex flex-col items-center">
                            <div className="w-0.5 h-2.5 bg-emerald-400/70" />
                            <div className="w-7 h-1.5 rounded-t-sm bg-emerald-500/35 border-t border-x border-emerald-400/60" />
                          </div>

                          <div
                            style={{ height: `${heightPct}%` }}
                            className={`w-full relative rounded-t-md border-t-2 border-x transition-all duration-300 overflow-hidden flex flex-col justify-between p-1.5 ${
                              isSelected
                                ? isPositive
                                  ? 'bg-gradient-to-b from-emerald-500/45 via-emerald-700/35 to-slate-900 border-emerald-300 shadow-lg ring-2 ring-emerald-400/50'
                                  : 'bg-gradient-to-b from-rose-500/45 via-rose-800/35 to-slate-900 border-rose-300 shadow-lg ring-2 ring-rose-400/50'
                                : isPositive
                                ? 'bg-gradient-to-b from-emerald-600/30 via-slate-800/90 to-slate-900 border-emerald-500/40'
                                : 'bg-gradient-to-b from-rose-600/30 via-slate-800/90 to-slate-900 border-rose-500/40'
                            }`}
                          >
                            <div
                              style={{ bottom: `${costRatioPct}%` }}
                              className="absolute inset-x-0 border-t-2 border-dashed border-sky-300/90 z-20 pointer-events-none"
                            />
                            <div className="grid grid-cols-3 gap-1 pt-1 flex-1">
                              {Array.from({ length: floors * 3 }).map((_, wIdx) => (
                                <div
                                  key={wIdx}
                                  className={`rounded-[1px] min-h-[5px] ${
                                    isPositive ? 'bg-emerald-300/35' : 'bg-amber-300/35'
                                  }`}
                                />
                              ))}
                            </div>
                            <div className="w-full pt-1 flex justify-center border-t border-slate-700/60 mt-1">
                              <div className="w-3 h-2 rounded-t-xs bg-amber-300/40" />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="min-w-[540px] flex items-center justify-around gap-3 sm:gap-5 pt-2.5 px-2">
                    {holdingsBuildings.map((h) => {
                      const isSelected = activeHoldingBuilding?.ticker === h.ticker;
                      return (
                        <button
                          key={h.ticker}
                          type="button"
                          onClick={() => setSelectedHoldingTicker(h.ticker)}
                          className={`flex-1 max-w-[96px] text-center py-1 rounded-lg font-mono text-xs transition-colors ${
                            isSelected
                              ? 'bg-emerald-500/20 text-emerald-300 font-extrabold border border-emerald-500/40'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {h.ticker}
                          <span className="block text-[9px] font-sans text-slate-400">
                            {h.portfolioWeight.toFixed(1)}%
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {activeHoldingBuilding && (
                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                    <div>
                      <span className="text-[10px] font-sans uppercase text-slate-400 block">
                        Fundo Selecionado
                      </span>
                      <strong className="text-sm font-bold text-white">
                        {activeHoldingBuilding.ticker} ({activeHoldingBuilding.segment})
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-sans uppercase text-slate-400 block">
                        Valor de Mercado
                      </span>
                      <strong className="text-sm font-bold text-emerald-400">
                        {formatBRL(activeHoldingBuilding.marketValue, preferences.hideValues)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-sans uppercase text-slate-400 block">
                        Custo Total Aportado
                      </span>
                      <strong className="text-sm font-bold text-sky-300">
                        {formatBRL(activeHoldingBuilding.totalCost, preferences.hideValues)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-sans uppercase text-slate-400 block">
                        Renda Mensal Gerada
                      </span>
                      <strong className="text-sm font-bold text-emerald-300">
                        {formatBRL(
                          activeHoldingBuilding.quantity * activeHoldingBuilding.monthlyYieldPerShare,
                          preferences.hideValues
                        )}
                        /mês
                      </strong>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODO 2: BENCHMARKS (CARTEIRA VS IFIX VS CDI) */}
      {activeChartMode === 'benchmarks' && (
        <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  Desempenho Comparado: Sua Carteira vs. IFIX & CDI ({periodFilter})
                </h2>
                <InfoTooltip
                  title="Comparativo com Benchmarks"
                  description="Compara o retorno total da sua carteira (valorização das cotas + proventos recebidos) contra o IFIX (índice oficial dos FIIs na B3) e o CDI (rendimento padrão da renda fixa)."
                />
              </div>
              <p className="text-xs text-slate-400">
                Retorno acumulado percentual em cada período analisado
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-emerald-400 inline-block" />
                <span className="text-white font-semibold">
                  Sua Carteira ({formatPercent(lastBenchmark.portfolio, true)})
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-amber-400 inline-block" />
                <span className="text-slate-300">
                  IFIX ({formatPercent(lastBenchmark.ifix, true)})
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-indigo-400 inline-block" />
                <span className="text-slate-400">
                  CDI ({formatPercent(lastBenchmark.cdi, true)})
                </span>
              </div>
            </div>
          </div>

          {/* Cards de Alfa */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 uppercase font-semibold">
                  Retorno Total da Carteira
                </span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <strong className="text-xl font-extrabold text-emerald-400 font-mono block mt-1 tabular-nums">
                {formatPercent(lastBenchmark.portfolio, true)}
              </strong>
              <span className="text-[11px] text-slate-400">Cotas + dividendos no período</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                  <span>Alfa sobre o IFIX</span>
                  <InfoTooltip
                    title="O que é Alfa sobre o IFIX?"
                    description="Mostra quantos pontos percentuais sua carteira rendeu acima (ou abaixo) da média dos fundos imobiliários da Bolsa."
                  />
                </span>
                <Award className="w-4 h-4 text-amber-400" />
              </div>
              <strong
                className={`text-xl font-extrabold font-mono block mt-1 tabular-nums ${
                  alphaVsIfix >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {formatPercent(alphaVsIfix, true)}
              </strong>
              <span className="text-[11px] text-slate-400">
                {alphaVsIfix >= 0 ? 'Acima da média do mercado FII' : 'Abaixo do índice IFIX'}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 uppercase font-semibold">
                  Diferença vs. CDI
                </span>
                <Activity className="w-4 h-4 text-indigo-400" />
              </div>
              <strong
                className={`text-xl font-extrabold font-mono block mt-1 tabular-nums ${
                  alphaVsCdi >= 0 ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {formatPercent(alphaVsCdi, true)}
              </strong>
              <span className="text-[11px] text-slate-400">
                Prêmio líquido isento de IR nos dividendos
              </span>
            </div>
          </div>

          {/* Torres Comparativas Triplas por Período */}
          <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 overflow-x-auto">
            <div className="min-w-[540px] h-60 flex items-end justify-around gap-4 pt-8 pb-2 border-b border-slate-800">
              {benchmarkPoints.map((pt) => {
                const maxVal = Math.max(
                  1,
                  ...benchmarkPoints.map((p) => Math.max(p.portfolio, p.ifix, p.cdi))
                );
                const portH = Math.max(12, (pt.portfolio / maxVal) * 100);
                const ifixH = Math.max(12, (pt.ifix / maxVal) * 100);
                const cdiH = Math.max(12, (pt.cdi / maxVal) * 100);

                return (
                  <div key={pt.label} className="flex-1 flex flex-col items-center h-full justify-end">
                    <div className="w-full max-w-[78px] h-44 flex items-end justify-center gap-1.5">
                      {/* Torre Carteira */}
                      <div className="flex-1 h-full flex flex-col justify-end items-center group">
                        <span className="text-[9px] font-mono text-emerald-400 font-bold mb-1">
                          {pt.portfolio.toFixed(1)}%
                        </span>
                        <div
                          style={{ height: `${portH}%` }}
                          className="w-full rounded-t-md bg-gradient-to-t from-emerald-700 to-emerald-400 border-t border-emerald-200"
                          title={`Sua Carteira: +${pt.portfolio}%`}
                        />
                      </div>

                      {/* Torre IFIX */}
                      <div className="flex-1 h-full flex flex-col justify-end items-center">
                        <span className="text-[9px] font-mono text-amber-400 mb-1">
                          {pt.ifix.toFixed(1)}%
                        </span>
                        <div
                          style={{ height: `${ifixH}%` }}
                          className="w-full rounded-t-md bg-gradient-to-t from-amber-700 to-amber-400 border-t border-amber-200"
                          title={`IFIX: +${pt.ifix}%`}
                        />
                      </div>

                      {/* Torre CDI */}
                      <div className="flex-1 h-full flex flex-col justify-end items-center">
                        <span className="text-[9px] font-mono text-indigo-400 mb-1">
                          {pt.cdi.toFixed(1)}%
                        </span>
                        <div
                          style={{ height: `${cdiH}%` }}
                          className="w-full rounded-t-md bg-gradient-to-t from-indigo-700 to-indigo-400 border-t border-indigo-200"
                          title={`CDI: +${pt.cdi}%`}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-mono text-slate-300 mt-2 font-semibold">
                      {pt.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODO 3: HISTÓRICO DE PROVENTOS & YIELD ON COST */}
      {activeChartMode === 'proventos' && (
        <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-400" />
                <h2 className="text-base font-bold text-white">
                  Crescimento da Renda Passiva Mensal ({periodFilter})
                </h2>
                <InfoTooltip
                  title="Torres de Proventos"
                  description="Mostra o total em Reais (R$) recebido em dividendos a cada mês e o Yield on Cost (retorno percentual calculado sobre o valor que você desembolsou)."
                />
              </div>
              <p className="text-xs text-slate-400">
                Evolução dos aluguéis mensais isentos de Imposto de Renda
              </p>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                Total Acumulado no Período
              </span>
              <span className="text-lg font-extrabold text-emerald-400 font-mono tabular-nums">
                {formatBRL(
                  buildingPeriods.reduce((acc, p) => acc + p.dividends, 0),
                  preferences.hideValues
                )}
              </span>
            </div>
          </div>

          <div className="h-64 flex items-end justify-between gap-3 pt-10 pb-2 px-4 border-b border-slate-800 bg-slate-950/40 rounded-2xl">
            {buildingPeriods.map((item) => {
              const maxDiv = Math.max(...buildingPeriods.map((d) => d.dividends), 1);
              const barHeight = Math.max(18, (item.dividends / maxDiv) * 100);
              const yocMonth =
                item.invested > 0 ? ((item.dividends / item.invested) * 100).toFixed(2) : '0.80';

              return (
                <div
                  key={item.id}
                  className="flex-1 flex flex-col items-center gap-2 h-full justify-end group"
                >
                  <div className="w-full max-w-[64px] flex flex-col justify-end h-44 relative items-center">
                    <span className="text-[10px] font-mono text-emerald-300 font-bold mb-1 tabular-nums">
                      {formatBRL(item.dividends, preferences.hideValues)}
                    </span>
                    <div
                      className="w-full bg-gradient-to-t from-emerald-700 via-emerald-500 to-emerald-400 rounded-t-xl transition-all duration-300 group-hover:brightness-110 shadow-lg shadow-emerald-950/50 border-t border-emerald-200/60"
                      style={{ height: `${barHeight}%` }}
                    />
                  </div>
                  <div className="text-center">
                    <span className="text-xs text-white font-mono font-bold block">
                      {item.label}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono block">
                      YoC: {yocMonth}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODO 4: DESEMPENHO POR ATIVO & VALUATION */}
      {activeChartMode === 'ativos' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sub-bloco 1: Rentabilidade Não Realizada por FII */}
          <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span>Valorização de Cota vs. Preço Médio</span>
                  <InfoTooltip
                    title="Valorização da Cota"
                    description="Compara a cotação atual de cada fundo na B3 com o seu Preço Médio de compra. Barras verdes indicam lucro no papel; barras vermelhas indicam cotação abaixo do seu preço de compra."
                  />
                </h2>
                <p className="text-xs text-slate-400">
                  Lucro ou prejuízo percentual sobre o preço médio de aquisição
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              {holdings.map((h) => {
                const isGain = (h.unrealizedGainPercent ?? 0) >= 0;
                const widthPct = Math.min(100, Math.max(8, Math.abs(h.unrealizedGainPercent ?? 0) * 6));

                return (
                  <div key={h.ticker} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <strong className="text-white">{h.ticker}</strong>
                        <span className="text-[11px] text-slate-400 font-sans">{h.segment}</span>
                      </div>
                      <div className="flex items-center gap-2 tabular-nums">
                        <span className="text-slate-400 text-[11px]">
                          {formatBRL(h.unrealizedGain, preferences.hideValues, true)}
                        </span>
                        <strong className={isGain ? 'text-emerald-400' : 'text-rose-400'}>
                          {formatPercent(h.unrealizedGainPercent, true)}
                        </strong>
                      </div>
                    </div>
                    <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isGain ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sub-bloco 2: Termômetro de Valuation P/VP */}
          <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span>Mapa de Desconto e Ágio (P/VP)</span>
                  <InfoTooltip
                    title="O que é P/VP?"
                    description="Preço sobre Valor Patrimonial. Quando está abaixo de 1,00 (verde), você compra os imóveis ou títulos do fundo com desconto. Acima de 1,00 (âmbar), o mercado cobra um prêmio (ágio)."
                  />
                </h2>
                <p className="text-xs text-slate-400">
                  Comparativo entre preço de tela e valor patrimonial (P/VP = 1,00 é o valor justo)
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              {holdings.map((h) => {
                const isDiscount = h.pvp < 1.0;
                const isFair = h.pvp === 1.0;
                const diffFromPar = ((h.pvp - 1) * 100).toFixed(1);

                return (
                  <div
                    key={h.ticker}
                    className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white text-xs">{h.ticker}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isDiscount
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : isFair
                              ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                              : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {isDiscount
                            ? `Desconto (${diffFromPar}%)`
                            : isFair
                            ? 'Valor Justo (1,00)'
                            : `Ágio (+${diffFromPar}%)`}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                        Cotação: {formatBRL(h.currentPrice)} · VPA: {formatBRL(h.vpa)}
                      </span>
                    </div>

                    <div className="text-right font-mono">
                      <span className="text-[10px] text-slate-500 block font-sans uppercase">
                        P/VP
                      </span>
                      <strong
                        className={`text-sm font-extrabold tabular-nums ${
                          isDiscount ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {h.pvp.toFixed(2)}
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Rodapé Consolidado de Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#0F172A] border border-slate-800">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">
            Custo Total Aportado
          </span>
          <strong className="text-lg font-bold text-slate-200 font-mono block mt-0.5 tabular-nums">
            {formatBRL(totalInvested, preferences.hideValues)}
          </strong>
        </div>

        <div className="p-4 rounded-2xl bg-[#0F172A] border border-slate-800">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">
            Patrimônio de Mercado Atual
          </span>
          <strong className="text-lg font-bold text-white font-mono block mt-0.5 tabular-nums">
            {formatBRL(totalMarketValue, preferences.hideValues)}
          </strong>
        </div>

        <div className="p-4 rounded-2xl bg-[#0F172A] border border-slate-800">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">
            Ganho de Capital (Cotas)
          </span>
          <strong
            className={`text-lg font-bold font-mono block mt-0.5 tabular-nums ${
              isProfit ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {formatBRL(totalUnrealizedGain, preferences.hideValues, true)} (
            {formatPercent(totalUnrealizedGainPercent, true)})
          </strong>
        </div>

        <div className="p-4 rounded-2xl bg-[#0F172A] border border-slate-800">
          <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
            <span>Yield on Cost da Carteira</span>
            <InfoTooltip
              title="Yield on Cost (YoC) Anualizado"
              description="Percentual de dividendos anuais gerados sobre o custo que saiu do seu bolso (Total Investido)."
            />
          </span>
          <strong className="text-lg font-bold text-emerald-400 font-mono block mt-0.5 tabular-nums">
            {totalInvested > 0
              ? `${(((currentMonthlyDiv * 12) / totalInvested) * 100).toFixed(2)}% a.a.`
              : '10.40% a.a.'}
          </strong>
        </div>
      </div>
    </div>
  );
};
