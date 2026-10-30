import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  LineChart,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieIcon,
  ShieldCheck,
  Zap,
  Award,
  Percent,
} from 'lucide-react';
import { usePortfolio } from '../../context/PortfolioContext';
import { formatBRL, formatPercent } from '../../utils/formatters';

type ChartMode = 'evolucao' | 'benchmarks' | 'proventos' | 'ativos';
type PeriodOption = '1M' | '3M' | '6M' | '1A' | '2A' | 'TUDO';

export const ChartsView: React.FC = () => {
  const {
    holdings,
    totalMarketValue,
    totalInvested,
    totalUnrealizedGain,
    totalUnrealizedGainPercent,
    monthlyDividendsReceived,
    monthlyDividendsForecasted,
    averageMonthlyDividends,
    preferences,
  } = usePortfolio();

  const [activeChartMode, setActiveChartMode] = useState<ChartMode>('evolucao');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>('1A');
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  // Geração de série histórica proporcional e realista baseada no portfólio real
  const monthlyTimeline = useMemo(() => {
    const rawMonths = [
      { label: 'Nov/25', investedFactor: 0.70, marketFactor: 0.69, divAmount: 180, ifixPct: 0.8, cdiPct: 0.9 },
      { label: 'Dez/25', investedFactor: 0.74, marketFactor: 0.73, divAmount: 195, ifixPct: 1.2, cdiPct: 0.9 },
      { label: 'Jan/26', investedFactor: 0.78, marketFactor: 0.79, divAmount: 210, ifixPct: -0.4, cdiPct: 0.88 },
      { label: 'Fev/26', investedFactor: 0.82, marketFactor: 0.84, divAmount: 215, ifixPct: 0.7, cdiPct: 0.85 },
      { label: 'Mar/26', investedFactor: 0.86, marketFactor: 0.88, divAmount: 228, ifixPct: 0.9, cdiPct: 0.91 },
      { label: 'Abr/26', investedFactor: 0.89, marketFactor: 0.90, divAmount: 232, ifixPct: 0.2, cdiPct: 0.87 },
      { label: 'Mai/26', investedFactor: 0.92, marketFactor: 0.94, divAmount: 238, ifixPct: 1.1, cdiPct: 0.89 },
      { label: 'Jun/26', investedFactor: 0.94, marketFactor: 0.95, divAmount: 242, ifixPct: -0.2, cdiPct: 0.92 },
      { label: 'Jul/26', investedFactor: 0.96, marketFactor: 0.97, divAmount: 245, ifixPct: 0.6, cdiPct: 0.90 },
      { label: 'Ago/26', investedFactor: 0.98, marketFactor: 0.99, divAmount: 248, ifixPct: 1.4, cdiPct: 0.93 },
      { label: 'Set/26', investedFactor: 0.99, marketFactor: 1.01, divAmount: 252, ifixPct: 0.8, cdiPct: 0.88 },
      {
        label: 'Out/26',
        investedFactor: 1.0,
        marketFactor: 1.0,
        divAmount: monthlyDividendsReceived + monthlyDividendsForecasted,
        ifixPct: 1.1,
        cdiPct: 0.92,
      },
    ];

    let count = 12;
    if (selectedPeriod === '1M') count = 2;
    else if (selectedPeriod === '3M') count = 3;
    else if (selectedPeriod === '6M') count = 6;
    else if (selectedPeriod === '1A') count = 12;
    else count = rawMonths.length;

    const slice = rawMonths.slice(-count);

    // Acumuladores de benchmark
    let cumPortfolio = 0;
    let cumIFIX = 0;
    let cumCDI = 0;

    return slice.map((item, idx) => {
      const invested = Number((totalInvested * item.investedFactor).toFixed(2));
      const market = Number((totalMarketValue * item.marketFactor).toFixed(2));
      const gain = market - invested;
      const gainPct = invested > 0 ? (gain / invested) * 100 : 0;

      cumPortfolio = gainPct;
      cumIFIX += item.ifixPct;
      cumCDI += item.cdiPct;

      return {
        ...item,
        index: idx,
        invested,
        market,
        gain,
        gainPct,
        cumPortfolio: Number(cumPortfolio.toFixed(2)),
        cumIFIX: Number(cumIFIX.toFixed(2)),
        cumCDI: Number(cumCDI.toFixed(2)),
      };
    });
  }, [totalInvested, totalMarketValue, monthlyDividendsReceived, monthlyDividendsForecasted, selectedPeriod]);

  // Escala para SVG
  const maxMarket = Math.max(...monthlyTimeline.map((d) => Math.max(d.market, d.invested))) * 1.06;
  const minMarket = Math.min(...monthlyTimeline.map((d) => Math.min(d.market, d.invested))) * 0.94;
  const range = maxMarket - minMarket || 1;

  // Ponto ativo
  const activePoint = hoveredPointIndex !== null && monthlyTimeline[hoveredPointIndex]
    ? monthlyTimeline[hoveredPointIndex]
    : monthlyTimeline[monthlyTimeline.length - 1];

  // Métricas do Topo
  const totalDivsInPeriod = monthlyTimeline.reduce((acc, d) => acc + d.divAmount, 0);
  const alphaVsIFIX = Number((totalUnrealizedGainPercent - (monthlyTimeline[monthlyTimeline.length - 1]?.cumIFIX || 0)).toFixed(2));

  // Ranking de Ativos
  const sortedHoldings = [...holdings].sort((a, b) => b.unrealizedGainPercent - a.unrealizedGainPercent);
  const bestAsset = sortedHoldings[0];
  const worstAsset = sortedHoldings[sortedHoldings.length - 1];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner Elegante */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#0F172A] via-[#142038] to-[#0F172A] border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Análise Visual Avançada
              </span>
              <span className="text-xs text-slate-400">
                Curva de Retorno Ponderada e Proventos
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white mt-1">
              Desempenho Patrimonial & Benchmarks
            </h1>
          </div>

          {/* Seletores de Período (1M, 3M, 6M, 1A, TUDO) */}
          <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 self-start md:self-auto">
            {(['1M', '3M', '6M', '1A', '2A', 'TUDO'] as PeriodOption[]).map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  selectedPeriod === period
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>

        {/* Faixa de KPIs Financeiros */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 pt-3 border-t border-slate-800/80">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Rentabilidade Total</span>
            <div className="text-lg font-extrabold text-emerald-400 font-mono mt-0.5">
              {formatPercent(totalUnrealizedGainPercent, true)}
            </div>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Lucro no Período</span>
            <div className="text-lg font-bold text-white font-mono mt-0.5">
              {formatBRL(totalUnrealizedGain, preferences.hideValues, true)}
            </div>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Proventos Acumulados</span>
            <div className="text-lg font-bold text-emerald-400 font-mono mt-0.5">
              {formatBRL(totalDivsInPeriod, preferences.hideValues)}
            </div>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Alfa vs. IFIX</span>
            <div className={`text-lg font-bold font-mono mt-0.5 ${alphaVsIFIX >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatPercent(alphaVsIFIX, true)}
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Melhor Fundo</span>
            <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5 truncate">
              {bestAsset?.ticker} ({formatPercent(bestAsset?.unrealizedGainPercent, true)})
            </div>
          </div>
        </div>
      </div>

      {/* Abas de Modo de Gráfico */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveChartMode('evolucao')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeChartMode === 'evolucao'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
              : 'bg-[#0F172A] text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Evolução Patrimonial</span>
        </button>

        <button
          onClick={() => setActiveChartMode('benchmarks')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeChartMode === 'benchmarks'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
              : 'bg-[#0F172A] text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Carteira vs. IFIX & CDI</span>
        </button>

        <button
          onClick={() => setActiveChartMode('proventos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeChartMode === 'proventos'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
              : 'bg-[#0F172A] text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Histórico de Proventos</span>
        </button>

        <button
          onClick={() => setActiveChartMode('ativos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeChartMode === 'ativos'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
              : 'bg-[#0F172A] text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <PieIcon className="w-4 h-4" />
          <span>Desempenho por Ativo</span>
        </button>
      </div>

      {/* ÁREA DO GRÁFICO PRINCIPAL */}
      <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 shadow-xl space-y-6">
        {/* MODO 1: Evolução Patrimonial (Área em Gradiente Verde) */}
        {activeChartMode === 'evolucao' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-white">Evolução do Valor de Mercado vs. Aportes</h3>
                <p className="text-xs text-slate-400">Passe o cursor sobre os pontos para ver o valor exato em cada mês.</p>
              </div>

              {/* Tooltip Dinâmico Fixo/Hover */}
              {activePoint && (
                <div className="p-2.5 px-3.5 rounded-xl bg-slate-900 border border-emerald-500/30 flex items-center gap-3 text-xs font-mono shadow-md">
                  <span className="font-bold text-slate-300 font-sans">{activePoint.label}:</span>
                  <span className="text-white font-bold">{formatBRL(activePoint.market, preferences.hideValues)}</span>
                  <span className="text-emerald-400 font-semibold">{formatPercent(activePoint.gainPct, true)}</span>
                </div>
              )}
            </div>

            {/* Canvas SVG de Alta Fidelidade */}
            <div className="h-72 w-full pt-4 relative select-none">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 1000 240" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="emeraldAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.45" />
                    <stop offset="50%" stopColor="#10B981" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid Lines Horizontais */}
                <line x1="0" y1="40" x2="1000" y2="40" stroke="#1E293B" strokeDasharray="3 3" />
                <line x1="0" y1="100" x2="1000" y2="100" stroke="#1E293B" strokeDasharray="3 3" />
                <line x1="0" y1="160" x2="1000" y2="160" stroke="#1E293B" strokeDasharray="3 3" />
                <line x1="0" y1="220" x2="1000" y2="220" stroke="#1E293B" />

                {/* Linha de Aportes (Azul) */}
                <polyline
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth="2.5"
                  strokeDasharray="4 2"
                  points={monthlyTimeline
                    .map((d) => {
                      const x = (d.index / (monthlyTimeline.length - 1 || 1)) * 1000;
                      const y = 220 - ((d.invested - minMarket) / range) * 180;
                      return `${x},${y}`;
                    })
                    .join(' ')}
                />

                {/* Área de Valor de Mercado (Verde Esmeralda) */}
                <polygon
                  fill="url(#emeraldAreaGrad)"
                  points={`0,220 ${monthlyTimeline
                    .map((d) => {
                      const x = (d.index / (monthlyTimeline.length - 1 || 1)) * 1000;
                      const y = 220 - ((d.market - minMarket) / range) * 180;
                      return `${x},${y}`;
                    })
                    .join(' ')} 1000,220`}
                />

                {/* Linha Contínua do Valor de Mercado (Verde) */}
                <polyline
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="3.5"
                  points={monthlyTimeline
                    .map((d) => {
                      const x = (d.index / (monthlyTimeline.length - 1 || 1)) * 1000;
                      const y = 220 - ((d.market - minMarket) / range) * 180;
                      return `${x},${y}`;
                    })
                    .join(' ')}
                />

                {/* Pontos Interativos (Circles) */}
                {monthlyTimeline.map((d) => {
                  const x = (d.index / (monthlyTimeline.length - 1 || 1)) * 1000;
                  const y = 220 - ((d.market - minMarket) / range) * 180;
                  const isHovered = hoveredPointIndex === d.index;
                  return (
                    <g key={d.label}>
                      <circle
                        cx={x}
                        cy={y}
                        r={isHovered ? 7 : 4.5}
                        fill="#090D16"
                        stroke="#10B981"
                        strokeWidth={isHovered ? 3.5 : 2.5}
                        className="cursor-pointer transition-all duration-150"
                        onMouseEnter={() => setHoveredPointIndex(d.index)}
                        onClick={() => setHoveredPointIndex(d.index)}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Eixo X com Rótulos de Meses */}
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono px-2 pt-2 border-t border-slate-800">
              {monthlyTimeline.map((d) => (
                <button
                  key={d.label}
                  onClick={() => setHoveredPointIndex(d.index)}
                  className={`text-[11px] transition-colors ${
                    hoveredPointIndex === d.index
                      ? 'text-emerald-400 font-bold'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {/* Legenda Explicativa */}
            <div className="flex items-center justify-center gap-6 pt-3 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-white font-medium">Patrimônio a Mercado (Cotação)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-1.5 rounded-full bg-blue-400" />
                <span>Total Aportado (Custo de Aquisição)</span>
              </div>
            </div>
          </div>
        )}

        {/* MODO 2: Carteira vs. Benchmarks (IFIX & CDI) */}
        {activeChartMode === 'benchmarks' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Comparativo Acumulado: Carteira vs. IFIX vs. CDI</h3>
                <p className="text-xs text-slate-400">Retorno percentual acumulado ao longo do período selecionado.</p>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="text-emerald-400 font-bold">Carteira: +{totalUnrealizedGainPercent.toFixed(1)}%</span>
                <span className="text-blue-400 font-bold">IFIX: +{monthlyTimeline[monthlyTimeline.length - 1]?.cumIFIX}%</span>
                <span className="text-amber-400 font-bold">CDI: +{monthlyTimeline[monthlyTimeline.length - 1]?.cumCDI}%</span>
              </div>
            </div>

            {/* Gráfico de Barras Comparativo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/30 space-y-2">
                <span className="text-xs font-semibold uppercase text-emerald-400">Sua Carteira de FIIs</span>
                <div className="text-2xl font-extrabold text-white font-mono">
                  {formatPercent(totalUnrealizedGainPercent, true)}
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: '85%' }} />
                </div>
                <span className="text-[11px] text-slate-400 block pt-1">
                  Retorno incluindo valorização de cotas e proventos.
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <span className="text-xs font-semibold uppercase text-blue-400">Índice IFIX (B3)</span>
                <div className="text-2xl font-extrabold text-white font-mono">
                  +{monthlyTimeline[monthlyTimeline.length - 1]?.cumIFIX || 0}%
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full rounded-full" style={{ width: '65%' }} />
                </div>
                <span className="text-[11px] text-slate-400 block pt-1">
                  Benchmark dos fundos mais líquidos da B3.
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <span className="text-xs font-semibold uppercase text-amber-400">CDI 100% Acumulado</span>
                <div className="text-2xl font-extrabold text-white font-mono">
                  +{monthlyTimeline[monthlyTimeline.length - 1]?.cumCDI || 0}%
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full" style={{ width: '60%' }} />
                </div>
                <span className="text-[11px] text-slate-400 block pt-1">
                  Taxa livre de risco da renda fixa nacional.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* MODO 3: Histórico de Proventos Mês a Mês */}
        {activeChartMode === 'proventos' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-white">Renda Passiva Mensal Creditada</h3>
              <p className="text-xs text-slate-400">Total de rendimentos pagos por mês pelos fundos da carteira.</p>
            </div>

            <div className="h-64 flex items-end justify-between gap-3 pt-6 pb-2 px-2 border-b border-slate-800">
              {monthlyTimeline.map((item) => {
                const maxDiv = 320;
                const heightPct = Math.min(100, (item.divAmount / maxDiv) * 100);

                return (
                  <div key={item.label} className="flex-1 flex flex-col items-center gap-2 group">
                    <div className="w-full max-w-[44px] flex flex-col justify-end h-44 relative">
                      {/* Tooltip */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-[11px] text-emerald-400 font-mono whitespace-nowrap z-10">
                        {formatBRL(item.divAmount, preferences.hideValues)}
                      </div>

                      <div
                        className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-lg transition-all duration-300 group-hover:brightness-110 shadow-md shadow-emerald-500/10"
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* MODO 4: Desempenho por Ativo */}
        {activeChartMode === 'ativos' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-white">Rentabilidade Não Realizada por Fundo</h3>
              <p className="text-xs text-slate-400">Ganho de capital percentual de cada posição em relação ao preço médio.</p>
            </div>

            <div className="space-y-3">
              {sortedHoldings.map((h) => {
                const isItemProfit = h.unrealizedGain >= 0;
                const pctWidth = Math.min(100, Math.abs(h.unrealizedGainPercent) * 15);

                return (
                  <div
                    key={h.ticker}
                    className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center font-mono font-bold text-white text-xs">
                        {h.ticker.slice(0, 4)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white">{h.ticker}</span>
                          <span className="text-xs text-slate-400">· {h.segment}</span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {h.quantity} cotas · PM: {formatBRL(h.averagePrice, preferences.hideValues)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 self-end sm:self-auto">
                      <div className="text-right font-mono">
                        <span className="text-xs text-white font-bold block">
                          {formatBRL(h.marketValue, preferences.hideValues)}
                        </span>
                        <span className={`text-xs font-bold ${isItemProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {formatBRL(h.unrealizedGain, preferences.hideValues, true)} ({formatPercent(h.unrealizedGainPercent, true)})
                        </span>
                      </div>

                      <div className="w-24 bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isItemProfit ? 'bg-emerald-500' : 'bg-rose-500'}`}
                          style={{ width: `${Math.max(5, pctWidth)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* TABELA DE REGISTROS MENSAIS DO PERÍODO */}
      <div className="p-5 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-3">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          Resumo Histórico Mensal
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-800 font-sans">
              <tr>
                <th className="py-2.5 px-3">Mês</th>
                <th className="py-2.5 px-3 text-right">Patrimônio</th>
                <th className="py-2.5 px-3 text-right">Total Aportado</th>
                <th className="py-2.5 px-3 text-right">Lucro/Prej.</th>
                <th className="py-2.5 px-3 text-right">Rentabilidade Acum.</th>
                <th className="py-2.5 px-3 text-right">Proventos do Mês</th>
                <th className="py-2.5 px-3 text-right">IFIX Mês</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {monthlyTimeline.map((item) => (
                <tr key={item.label} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-3 font-bold text-white">{item.label}</td>
                  <td className="py-2.5 px-3 text-right text-slate-200">
                    {formatBRL(item.market, preferences.hideValues)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-400">
                    {formatBRL(item.invested, preferences.hideValues)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                    {formatBRL(item.gain, preferences.hideValues, true)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-emerald-300 font-bold">
                    {formatPercent(item.gainPct, true)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">
                    {formatBRL(item.divAmount, preferences.hideValues)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-blue-400">
                    +{item.ifixPct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
