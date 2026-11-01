import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Coins,
  Calendar,
  Target,
  ShieldCheck,
  PlusCircle,
  Clock,
  ArrowRight,
  Sparkles,
  PieChart as PieIcon,
  Calculator,
  ChevronRight,
  Flame,
  AlertTriangle,
  Edit2,
  Check,
} from 'lucide-react';
import { usePortfolio } from '../../context/PortfolioContext';
import { formatBRL, formatPercent, formatDateBR } from '../../utils/formatters';
import { AppModuleId } from '../layout/Sidebar';
import { FIIHolding } from '../../types/fii';
import { EditHoldingModal } from '../modals/EditHoldingModal';
import { InfoTooltip, TabGuideBanner } from '../common/InfoTooltip';

interface DashboardViewProps {
  onNavigate: (module: AppModuleId) => void;
  onOpenTransactionModal: () => void;
  onOpenAddDividendModal: (ticker?: string, suggestedQty?: number) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenTransactionModal,
  onOpenAddDividendModal,
}) => {
  const {
    holdings,
    totalInvested,
    totalMarketValue,
    totalUnrealizedGain,
    totalUnrealizedGainPercent,
    monthlyDividendsReceived,
    monthlyDividendsForecasted,
    averageMonthlyDividends,
    goals,
    updateGoals,
    dividends,
    preferences,
    lastQuoteUpdate,
  } = usePortfolio();

  const [selectedHoldingToEdit, setSelectedHoldingToEdit] = useState<FIIHolding | null>(null);
  const [isEditingIncomeGoal, setIsEditingIncomeGoal] = useState(false);
  const [tempIncomeGoal, setTempIncomeGoal] = useState(String(goals.monthlyIncomeGoal));
  const [isEditingEquityGoal, setIsEditingEquityGoal] = useState(false);
  const [tempEquityGoal, setTempEquityGoal] = useState(String(goals.totalEquityGoal));

  const isProfit = totalUnrealizedGain >= 0;

  // Próximos eventos de proventos
  const upcomingEvents = dividends
    .filter((d) => d.status === 'PREVISTO')
    .slice(0, 3);

  // Progresso das metas
  const incomeGoalProgress =
    goals.monthlyIncomeGoal > 0
      ? Math.min(100, ((monthlyDividendsReceived + monthlyDividendsForecasted) / goals.monthlyIncomeGoal) * 100)
      : 0;

  const equityGoalProgress =
    goals.totalEquityGoal > 0
      ? Math.min(100, (totalMarketValue / goals.totalEquityGoal) * 100)
      : 0;

  // Concentração dos 3 maiores ativos
  const sortedHoldings = [...holdings].sort((a, b) => b.marketValue - a.marketValue);
  const top3Concentration = sortedHoldings
    .slice(0, 3)
    .reduce((acc, h) => acc + h.portfolioWeight, 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner de Boas-Vindas & Ações Rápidas */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-[#0F172A] via-[#131E35] to-[#0F172A] border border-slate-800 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              Visão Geral Consolidada
            </span>
            <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              {lastQuoteUpdate}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Painel Estratégico de FIIs
          </h1>
          <p className="text-xs text-slate-400 max-w-xl">
            Adicione seus fundos imobiliários, registre dividendos por cota com cálculo automático e acompanhe sua renda mensal.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onOpenTransactionModal}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.01] cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Adicionar Fundo (FII)</span>
          </button>
          <button
            onClick={() => onOpenAddDividendModal()}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 hover:text-white font-extrabold text-xs border border-blue-500/40 transition-all cursor-pointer"
          >
            <Coins className="w-4 h-4 text-emerald-400" />
            <span>Registrar Provento</span>
          </button>
          <button
            onClick={() => onNavigate('calculadoras')}
            className="flex items-center gap-1.5 px-3.5 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white font-medium text-xs border border-slate-700 transition-colors cursor-pointer"
          >
            <Calculator className="w-4 h-4 text-emerald-400" />
            <span>Calculadoras</span>
          </button>
        </div>
      </div>

      {/* Guia Explicativo do Painel Principal */}
      <TabGuideBanner
        title="Bem-vindo ao seu Painel Geral de Fundos Imobiliários"
        subtitle="Entenda em 30 segundos o que cada bloco desta tela mostra"
        items={[
          {
            term: 'Patrimônio em FIIs vs. Total Investido',
            meaning:
              'Total Investido é quanto saiu do seu bolso. Patrimônio em FIIs é quanto suas cotas valem hoje na Bolsa. A diferença é seu lucro ou oscilação no papel.',
          },
          {
            term: 'Proventos Recebidos e Previstos',
            meaning:
              'Mostra os aluguéis mensais que já caíram na sua conta e os pagamentos já anunciados pelos fundos para os próximos dias.',
          },
          {
            term: 'Como Adicionar ou Editar um FII',
            meaning:
              'Clique em "+ Nova Operação" no topo para registrar uma compra/venda, ou clique no ícone de lápis em qualquer fundo da tabela abaixo para ajustar sua posição.',
          },
        ]}
      />

      {/* Grid Principal de Cards Financeiros */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Patrimônio Total em FIIs */}
        <div
          onClick={() => onNavigate('carteira')}
          className="p-5 rounded-2xl bg-[#0F172A] border border-slate-800 hover:border-emerald-500/40 transition-all cursor-pointer group shadow-lg"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <span>Patrimônio em FIIs</span>
              <InfoTooltip
                title="Patrimônio Atual"
                description="Soma do valor atual de mercado de todas as suas cotas (Quantidade × Cotação Atual na B3)."
                align="left"
              />
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl lg:text-3xl font-extrabold text-white font-mono tracking-tight block">
              {formatBRL(totalMarketValue, preferences.hideValues)}
            </span>
            <div className="flex items-center gap-2 mt-2">
              <span
                className={`text-xs font-bold font-mono px-2 py-0.5 rounded-md flex items-center gap-1 ${
                  isProfit
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                }`}
              >
                {isProfit ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {formatPercent(totalUnrealizedGainPercent, true)}
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {formatBRL(totalUnrealizedGain, preferences.hideValues, true)}
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Total Investido:</span>
            <strong className="text-slate-200 font-mono">
              {formatBRL(totalInvested, preferences.hideValues)}
            </strong>
          </div>
        </div>

        {/* Card 2: Proventos Recebidos no Mês */}
        <div
          onClick={() => onNavigate('rendimentos')}
          className="p-5 rounded-2xl bg-[#0F172A] border border-slate-800 hover:border-emerald-500/40 transition-all cursor-pointer group shadow-lg"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Proventos Recebidos</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl lg:text-3xl font-extrabold text-emerald-400 font-mono tracking-tight block">
              {formatBRL(monthlyDividendsReceived, preferences.hideValues)}
            </span>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-300">
              <span className="text-slate-400">Previsto a cair:</span>
              <strong className="font-mono text-emerald-300">
                {formatBRL(monthlyDividendsForecasted, preferences.hideValues)}
              </strong>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Total no Mês:</span>
            <strong className="text-white font-mono">
              {formatBRL(monthlyDividendsReceived + monthlyDividendsForecasted, preferences.hideValues)}
            </strong>
          </div>
        </div>

        {/* Card 3: Médias Mensais Históricas */}
        <div
          onClick={() => onNavigate('rendimentos')}
          className="p-5 rounded-2xl bg-[#0F172A] border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group shadow-lg"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Média de Rendimentos</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Últimos 3 meses:</span>
              <strong className="text-white font-mono">
                {formatBRL(averageMonthlyDividends.last3Months, preferences.hideValues)}
              </strong>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Últimos 6 meses:</span>
              <strong className="text-slate-300 font-mono">
                {formatBRL(averageMonthlyDividends.last6Months, preferences.hideValues)}
              </strong>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Últimos 12 meses:</span>
              <strong className="text-slate-400 font-mono">
                {formatBRL(averageMonthlyDividends.last12Months, preferences.hideValues)}
              </strong>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-emerald-400">
            <span>Renda regular estimada</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Card 4: Diversificação & Saúde */}
        <div
          onClick={() => onNavigate('distribuicao')}
          className="p-5 rounded-2xl bg-[#0F172A] border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group shadow-lg"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Diversificação</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <PieIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-white font-mono">
                {holdings.length}
              </span>
              <span className="text-xs text-slate-400">Fundos em carteira</span>
            </div>
            <div className="mt-2 text-xs text-slate-300">
              <span>Top 3 Ativos concentram: </span>
              <strong className={`font-mono ${top3Concentration > 60 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {top3Concentration.toFixed(1)}%
              </strong>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Risco de Concentração:</span>
            <span className={`font-semibold flex items-center gap-1 ${top3Concentration > 60 ? 'text-amber-400' : 'text-emerald-400'}`}>
              <ShieldCheck className="w-3 h-3" />
              {top3Concentration > 60 ? 'Atenção' : 'Equilibrado'}
            </span>
          </div>
        </div>
      </div>

      {/* Seção 2 Colunas: Metas & Próximas Datas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Painel de Metas Financeiras (2 colunas) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Acompanhamento de Metas
              </h2>
            </div>
            <button
              onClick={() => onNavigate('metas')}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
            >
              <span>Configurar Metas</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Meta 1: Renda Mensal de Proventos */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Meta de Renda Mensal</span>
                  <button
                    onClick={() => {
                      if (isEditingIncomeGoal) {
                        const val = parseFloat(tempIncomeGoal);
                        if (!isNaN(val) && val > 0) updateGoals({ monthlyIncomeGoal: val });
                        setIsEditingIncomeGoal(false);
                      } else {
                        setTempIncomeGoal(String(goals.monthlyIncomeGoal));
                        setIsEditingIncomeGoal(true);
                      }
                    }}
                    className="p-1 text-slate-500 hover:text-emerald-400 transition-colors"
                    title={isEditingIncomeGoal ? 'Salvar meta' : 'Editar meta'}
                    aria-label="Editar meta de renda mensal"
                  >
                    {isEditingIncomeGoal ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Edit2 className="w-3 h-3" />}
                  </button>
                </div>
                <span className="font-mono text-emerald-400 font-bold">
                  {formatPercent(incomeGoalProgress, false)}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-bold text-white font-mono">
                  {formatBRL(monthlyDividendsReceived + monthlyDividendsForecasted, preferences.hideValues)}
                </span>
                {isEditingIncomeGoal ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-500">/ R$</span>
                    <input
                      type="number"
                      value={tempIncomeGoal}
                      onChange={(e) => setTempIncomeGoal(e.target.value)}
                      className="w-24 px-1.5 py-0.5 bg-slate-800 border border-emerald-500 rounded text-xs text-white font-mono"
                      autoFocus
                    />
                  </div>
                ) : (
                  <span className="text-xs text-slate-500 font-mono">
                    / {formatBRL(goals.monthlyIncomeGoal, preferences.hideValues)}
                  </span>
                )}
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${incomeGoalProgress}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Faltam {formatBRL(Math.max(0, goals.monthlyIncomeGoal - (monthlyDividendsReceived + monthlyDividendsForecasted)), preferences.hideValues)} para atingir seu objetivo mensal.
              </p>
            </div>

            {/* Meta 2: Patrimônio Acumulado */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Meta de Patrimônio</span>
                  <button
                    onClick={() => {
                      if (isEditingEquityGoal) {
                        const val = parseFloat(tempEquityGoal);
                        if (!isNaN(val) && val > 0) updateGoals({ totalEquityGoal: val });
                        setIsEditingEquityGoal(false);
                      } else {
                        setTempEquityGoal(String(goals.totalEquityGoal));
                        setIsEditingEquityGoal(true);
                      }
                    }}
                    className="p-1 text-slate-500 hover:text-emerald-400 transition-colors"
                    title={isEditingEquityGoal ? 'Salvar meta' : 'Editar meta'}
                    aria-label="Editar meta de patrimônio"
                  >
                    {isEditingEquityGoal ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Edit2 className="w-3 h-3" />}
                  </button>
                </div>
                <span className="font-mono text-blue-400 font-bold">
                  {formatPercent(equityGoalProgress, false)}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-bold text-white font-mono">
                  {formatBRL(totalMarketValue, preferences.hideValues)}
                </span>
                {isEditingEquityGoal ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-500">/ R$</span>
                    <input
                      type="number"
                      value={tempEquityGoal}
                      onChange={(e) => setTempEquityGoal(e.target.value)}
                      className="w-28 px-1.5 py-0.5 bg-slate-800 border border-blue-500 rounded text-xs text-white font-mono"
                      autoFocus
                    />
                  </div>
                ) : (
                  <span className="text-xs text-slate-500 font-mono">
                    / {formatBRL(goals.totalEquityGoal, preferences.hideValues)}
                  </span>
                )}
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${equityGoalProgress}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Progresso constante com reinvestimento dos proventos e novos aportes.
              </p>
            </div>
          </div>
        </div>

        {/* Painel Próximas Datas-Com e Pagamentos (1 coluna) */}
        <div className="p-5 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Próximos Pagamentos
              </h2>
            </div>
            <button
              onClick={() => onNavigate('rendimentos')}
              className="text-xs text-slate-400 hover:text-white"
            >
              Calendário
            </button>
          </div>

          <div className="space-y-2.5">
            {upcomingEvents.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-4 text-center">
                Nenhum pagamento agendado para os próximos dias.
              </p>
            ) : (
              upcomingEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between"
                >
                  <div>
                    <span className="font-mono font-bold text-white text-xs block">
                      {evt.ticker}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Pgto: {formatDateBR(evt.paymentDate)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold font-mono text-emerald-400 block">
                      {formatBRL(evt.totalAmount, preferences.hideValues)}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {evt.quantityEligible} cotas
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Tabela Resumida dos Fundos em Carteira */}
      <div className="p-5 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Posições da Carteira
            </h2>
            <p className="text-xs text-slate-400">
              Resumo das participações e rentabilidades não realizadas.
            </p>
          </div>
          <button
            onClick={() => onNavigate('carteira')}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
          >
            <span>Ver Detalhamento Completo</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Fundo</th>
                <th className="py-2.5 px-3">Segmento</th>
                <th className="py-2.5 px-3 text-right">Qtd</th>
                <th className="py-2.5 px-3 text-right">Preço Médio</th>
                <th className="py-2.5 px-3 text-right">Cotação</th>
                <th className="py-2.5 px-3 text-right">Valor Mercado</th>
                <th className="py-2.5 px-3 text-right">Lucro/Prej.</th>
                <th className="py-2.5 px-3 text-right">P/VP</th>
                <th className="py-2.5 px-3 text-right">DY Anual</th>
                <th className="py-2.5 px-3 text-right">Peso</th>
                <th className="py-2.5 px-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {holdings.map((h) => {
                const isItemProfit = h.unrealizedGain >= 0;
                return (
                  <tr key={h.ticker} className="hover:bg-slate-800/40 transition-colors group">
                    <td className="py-3 px-3 font-bold text-white">
                      <span>{h.ticker}</span>
                    </td>
                    <td className="py-3 px-3 font-sans text-slate-300">
                      {h.segment}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-200">{h.quantity}</td>
                    <td className="py-3 px-3 text-right text-slate-300">
                      {formatBRL(h.averagePrice, preferences.hideValues)}
                    </td>
                    <td className="py-3 px-3 text-right text-white font-bold">
                      {formatBRL(h.currentPrice, preferences.hideValues)}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-100 font-bold">
                      {formatBRL(h.marketValue, preferences.hideValues)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className={isItemProfit ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {formatPercent(h.unrealizedGainPercent, true)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className={h.pvp <= 1.0 ? 'text-emerald-400' : 'text-amber-400'}>
                        {h.pvp.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-400 font-bold">
                      {formatPercent(h.annualDividendYield, false)}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-300">
                      {h.portfolioWeight.toFixed(1)}%
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => setSelectedHoldingToEdit(h)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors"
                        title={`Editar ${h.ticker}`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedHoldingToEdit && (
        <EditHoldingModal
          holding={selectedHoldingToEdit}
          isOpen={Boolean(selectedHoldingToEdit)}
          onClose={() => setSelectedHoldingToEdit(null)}
        />
      )}
    </div>
  );
};
