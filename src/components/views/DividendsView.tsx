import React, { useState, useMemo } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Coins,
  CheckCircle2,
  Clock,
  Plus,
  ArrowRight,
  Info,
  Edit2,
} from 'lucide-react';
import { usePortfolio } from '../../context/PortfolioContext';
import { formatBRL, formatDateBR } from '../../utils/formatters';
import { DividendEvent } from '../../types/fii';
import { calculateSardinhaProjection } from '../../utils/financialMath';
import { EditDividendModal } from '../modals/EditDividendModal';
import { InfoTooltip, TabGuideBanner } from '../common/InfoTooltip';
import { VERIFIED_FII_DATABASE } from '../../data/fiiDatabase';

interface DividendsViewProps {
  onOpenAddDividendModal?: (ticker?: string, suggestedQty?: number) => void;
}

export const DividendsView: React.FC<DividendsViewProps> = ({
  onOpenAddDividendModal,
}) => {
  const {
    dividends,
    holdings,
    preferences,
    updateDividendStatus,
  } = usePortfolio();

  const [selectedDivToEdit, setSelectedDivToEdit] = useState<DividendEvent | null>(null);

  // Mês e ano selecionados para o calendário
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(9); // 0-indexed (9 = Outubro)
  const [selectedDay, setSelectedDay] = useState<number | null>(25);

  // Prazo da simulação de reinvestimento (em meses)
  const [reinvestMonths, setReinvestMonths] = useState<number>(12);
  const [newMonthlyContribution, setNewMonthlyContribution] = useState<string>('500');

  const [divSearch, setDivSearch] = useState<string>('');
  const [divStatusFilter, setDivStatusFilter] = useState<'TODOS' | 'RECEBIDO' | 'PREVISTO'>('TODOS');

  const filteredDividendsTable = useMemo(() => {
    const q = divSearch.trim().toUpperCase();
    return dividends.filter((d) => {
      const matchTicker = !q || d.ticker.toUpperCase().includes(q);
      const matchStatus = divStatusFilter === 'TODOS' || d.status === divStatusFilter;
      return matchTicker && matchStatus;
    });
  }, [dividends, divSearch, divStatusFilter]);

  const monthNames = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
    setSelectedDay(null);
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
    setSelectedDay(null);
  };

  // Mapeamento dos dias do mês
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth + 1, 0).getDate();
  }, [selectedYear, selectedMonth]);

  const firstDayOfWeek = useMemo(() => {
    return new Date(selectedYear, selectedMonth, 1).getDay(); // 0 = Domingo
  }, [selectedYear, selectedMonth]);

  // Eventos do mês selecionado
  const monthEvents = useMemo(() => {
    const monthStr = String(selectedMonth + 1).padStart(2, '0');
    const yearStr = String(selectedYear);

    return dividends.filter((d) => {
      const isPaymentThisMonth = d.paymentDate.startsWith(`${yearStr}-${monthStr}`);
      const isDataComThisMonth = d.dataCom.startsWith(`${yearStr}-${monthStr}`);
      return isPaymentThisMonth || isDataComThisMonth;
    });
  }, [dividends, selectedYear, selectedMonth]);

  // Mapa por dia do mês (eventos de pagamento e data-com)
  const eventsByDay = useMemo(() => {
    const map: Record<number, { payments: DividendEvent[]; dataComs: DividendEvent[] }> = {};
    for (let i = 1; i <= daysInMonth; i++) {
      map[i] = { payments: [], dataComs: [] };
    }

    const monthStr = String(selectedMonth + 1).padStart(2, '0');
    const yearStr = String(selectedYear);

    dividends.forEach((d) => {
      if (d.paymentDate.startsWith(`${yearStr}-${monthStr}`)) {
        const day = parseInt(d.paymentDate.split('-')[2], 10);
        if (map[day]) map[day].payments.push(d);
      }
      if (d.dataCom.startsWith(`${yearStr}-${monthStr}`)) {
        const day = parseInt(d.dataCom.split('-')[2], 10);
        if (map[day]) map[day].dataComs.push(d);
      }
    });

    return map;
  }, [dividends, selectedYear, selectedMonth, daysInMonth]);

  // Eventos do dia selecionado
  const selectedDayEvents = selectedDay && eventsByDay[selectedDay] ? eventsByDay[selectedDay] : null;

  // Totais do mês atual no calendário
  const currentMonthTotals = useMemo(() => {
    let received = 0;
    let forecasted = 0;
    let pendingCount = 0;

    monthEvents.forEach((d) => {
      if (d.status === 'RECEBIDO') {
        received += d.totalAmount;
      } else if (d.status === 'PREVISTO') {
        forecasted += d.totalAmount;
        pendingCount += 1;
      }
    });

    return { received, forecasted, pendingCount };
  }, [monthEvents]);

  // Histórico Mensal para o Gráfico de Barras
  const monthlyHistory = useMemo(() => {
    const months = [
      { label: 'Mai/26', received: 210, forecasted: 0 },
      { label: 'Jun/26', received: 228, forecasted: 0 },
      { label: 'Jul/26', received: 235, forecasted: 0 },
      { label: 'Ago/26', received: 242, forecasted: 0 },
      { label: 'Set/26', received: 246.95, forecasted: 0 },
      { label: 'Out/26', received: currentMonthTotals.received, forecasted: currentMonthTotals.forecasted },
    ];
    return months;
  }, [currentMonthTotals]);

  // Simulação de Reinvestimento
  const currentTotalEquity = holdings.reduce((acc, h) => acc + h.marketValue, 0);
  const contributionNum = parseFloat(newMonthlyContribution) || 0;

  const reinvestmentSimulation = useMemo(() => {
    return calculateSardinhaProjection(
      currentTotalEquity,
      contributionNum,
      10.5,
      reinvestMonths
    );
  }, [currentTotalEquity, contributionNum, reinvestMonths]);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-[#0F172A] border border-slate-800 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              Rendimentos & Proventos Isentos de IR
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white">
            Calendário de Pagamentos & Histórico de Aluguéis
          </h1>
          <p className="text-xs text-slate-400">
            Informe o provento por cota (ex.: 80 × R$ 0,084 = R$ 6,72) e acompanhe seus recebimentos mensais.
          </p>
        </div>

        <button
          onClick={() => onOpenAddDividendModal && onOpenAddDividendModal()}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/20 transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Provento / Dividendo</span>
        </button>
      </div>

      {/* Guia Explicativo da Aba */}
      <TabGuideBanner
        title="Entenda os termos dos Rendimentos (Proventos)"
        subtitle="O que significa Data-Com, Data de Pagamento, Valor por Cota e Cotas Elegíveis"
        items={[
          {
            term: 'Data-Com (Data Base / Corte)',
            meaning:
              'É o último dia para você ter as cotas na carteira e garantir o direito de receber o aluguel daquele mês. Comprando depois da Data-Com, você só recebe no mês seguinte.',
          },
          {
            term: 'Data de Pagamento',
            meaning:
              'É o dia exato em que o dinheiro cai livre de Imposto de Renda direto no saldo da sua corretora.',
          },
          {
            term: 'Valor por Cota × Cotas Elegíveis',
            meaning:
              'O fundo anuncia quanto vai pagar por 1 cota (ex: R$ 1,10). Multiplicando pelas cotas que você tinha na Data-Com (ex: 50 cotas), você recebe R$ 55,00.',
          },
        ]}
      />

      {/* Grid Principal: Área Esquerda (Calendário) e Área Direita (Gráficos & Simulação) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ÁREA ESQUERDA: Calendário Mensal (5 Colunas) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-4 shadow-lg">
            {/* Navegação entre Meses */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  {monthNames[selectedMonth]} {selectedYear}
                </h2>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrevMonth}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  aria-label="Mês anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextMonth}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  aria-label="Próximo mês"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Cabeçalho dos Dias da Semana */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              <span>Dom</span>
              <span>Seg</span>
              <span>Ter</span>
              <span>Qua</span>
              <span>Qui</span>
              <span>Sex</span>
              <span>Sáb</span>
            </div>

            {/* Grid dos Dias do Calendário */}
            <div className="grid grid-cols-7 gap-1">
              {/* Espaços vazios antes do dia 1 */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="h-10 rounded-lg bg-transparent" />
              ))}

              {/* Dias do mês */}
              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const day = idx + 1;
                const hasPayment = eventsByDay[day]?.payments.length > 0;
                const hasDataCom = eventsByDay[day]?.dataComs.length > 0;
                const isSelected = selectedDay === day;

                const hasReceived = eventsByDay[day]?.payments.some((p) => p.status === 'RECEBIDO');
                const hasPending = eventsByDay[day]?.payments.some((p) => p.status === 'PREVISTO');

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={`h-11 rounded-xl flex flex-col items-center justify-between p-1 text-xs font-mono transition-all relative ${
                      isSelected
                        ? 'bg-emerald-500/25 border-2 border-emerald-400 text-white font-bold shadow-md shadow-emerald-500/20'
                        : hasPayment
                        ? 'bg-slate-800/90 hover:bg-slate-800 text-white border border-slate-700'
                        : 'bg-slate-900/40 hover:bg-slate-800/50 text-slate-400'
                    }`}
                  >
                    <span className="text-[11px]">{day}</span>
                    <div className="flex items-center gap-0.5">
                      {hasReceived && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Provento Recebido" />
                      )}
                      {hasPending && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400" title="Provento Previsto" />
                      )}
                      {hasDataCom && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Data-Com" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Legenda de Eventos */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Recebido</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                <span>Previsto</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>Data-Com</span>
              </div>
            </div>

            {/* Detalhes do Dia Selecionado */}
            {selectedDay && (
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2 mt-3">
                <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-1.5">
                  <span className="font-semibold text-white">
                    Eventos de {selectedDay} de {monthNames[selectedMonth]}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {(selectedDayEvents?.payments.length || 0) + (selectedDayEvents?.dataComs.length || 0)} eventos
                  </span>
                </div>

                {selectedDayEvents &&
                selectedDayEvents.payments.length === 0 &&
                selectedDayEvents.dataComs.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">Nenhum evento registrado nesta data.</p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedDayEvents?.payments.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-800/80 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-white">{p.ticker}</span>
                            <span
                              className={`text-[10px] font-bold px-1.5 rounded ${
                                p.status === 'RECEBIDO'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-blue-500/20 text-blue-300'
                              }`}
                            >
                              {p.status}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {p.quantityEligible} cotas × {formatBRL(p.ratePerShare)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <span className="font-mono font-bold text-emerald-400 block">
                              {formatBRL(p.totalAmount, preferences.hideValues)}
                            </span>
                            {p.status === 'PREVISTO' && (
                              <button
                                onClick={() => updateDividendStatus(p.id, 'RECEBIDO')}
                                className="text-[10px] text-emerald-400 hover:underline"
                              >
                                Confirmar
                              </button>
                            )}
                          </div>
                          <button
                            onClick={() => setSelectedDivToEdit(p)}
                            className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-700/60 rounded-md transition-colors"
                            title={`Editar provento de ${p.ticker}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {selectedDayEvents?.dataComs.map((dc) => (
                      <div
                        key={`dc-${dc.id}`}
                        className="flex items-center justify-between p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-amber-200">{dc.ticker}</span>
                          <span className="text-[11px] text-amber-300">Data-Com (Direito ao Provento)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-[11px]">Pgto em {formatDateBR(dc.paymentDate)}</span>
                          <button
                            onClick={() => setSelectedDivToEdit(dc)}
                            className="p-1 text-amber-300 hover:text-amber-100 hover:bg-amber-500/20 rounded transition-colors"
                            title={`Editar Data-Com de ${dc.ticker}`}
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Resumo Inferior do Mês */}
          <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-[#0F172A] border border-slate-800">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Recebido no Mês</span>
              <span className="text-lg font-bold text-emerald-400 font-mono">
                {formatBRL(currentMonthTotals.received, preferences.hideValues)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Previsto a Cair</span>
              <span className="text-lg font-bold text-blue-400 font-mono">
                {formatBRL(currentMonthTotals.forecasted, preferences.hideValues)}
              </span>
            </div>
          </div>
        </div>

        {/* ÁREA DIREITA: Histórico de Proventos & Simulação (7 Colunas) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Gráfico Mensal de Proventos (Recebidos vs Previstos) */}
          <div className="p-5 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Evolução Mensal de Proventos
                </h2>
                <p className="text-xs text-slate-400">Comparativo dos últimos 6 meses</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Recebido
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-blue-500" /> Previsto
                </span>
              </div>
            </div>

            {/* Gráfico de Barras Customizado */}
            <div className="h-44 flex items-end justify-between gap-3 pt-6 pb-2 px-2 border-b border-slate-800">
              {monthlyHistory.map((item) => {
                const total = item.received + item.forecasted;
                const maxVal = 300; // Normalizador de escala
                const receivedHeight = Math.min(100, (item.received / maxVal) * 100);
                const forecastedHeight = Math.min(100, (item.forecasted / maxVal) * 100);

                return (
                  <div key={item.label} className="flex-1 flex flex-col items-center gap-2 group">
                    <div className="w-full max-w-[42px] flex flex-col justify-end h-32 relative">
                      {/* Tooltip com valor ao passar o mouse */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] text-white font-mono whitespace-nowrap z-10">
                        {formatBRL(total, preferences.hideValues)}
                      </div>

                      {item.forecasted > 0 && (
                        <div
                          className="w-full bg-blue-500 rounded-t-md transition-all duration-300"
                          style={{ height: `${forecastedHeight}%` }}
                        />
                      )}
                      <div
                        className={`w-full bg-emerald-500 transition-all duration-300 ${
                          item.forecasted > 0 ? '' : 'rounded-t-md'
                        }`}
                        style={{ height: `${receivedHeight}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Painel: Simulação de Reinvestimento de Proventos */}
          <div className="p-5 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-4 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" />
                  Efeito Bola de Neve (Reinvestimento)
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">
                  Projeção com Reinvestimento de Proventos
                </h3>
              </div>

              {/* Seletor de Prazo */}
              <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800">
                {[6, 12, 24, 36].map((m) => (
                  <button
                    key={m}
                    onClick={() => setReinvestMonths(m)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                      reinvestMonths === m
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div>
                <span className="text-[11px] text-slate-400">Patrimônio Projetado</span>
                <span className="text-lg font-bold text-white font-mono block mt-0.5">
                  {formatBRL(reinvestmentSimulation.finalPortfolio, preferences.hideValues)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400">Total Proventos Reinvestidos</span>
                <span className="text-lg font-bold text-emerald-400 font-mono block mt-0.5">
                  {formatBRL(reinvestmentSimulation.totalYieldEarned, preferences.hideValues)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400">Aportes Adicionais</span>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-xs text-slate-500 font-mono">R$</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={newMonthlyContribution}
                    onChange={(e) => setNewMonthlyContribution(e.target.value)}
                    className="w-24 px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs text-white font-mono"
                  />
                  <span className="text-[10px] text-slate-500">/mês</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabela de Detalhamento por Ativo com Busca e Filtro */}
          <div className="p-5 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Detalhamento de Proventos por Fundo ({filteredDividendsTable.length})
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={divSearch}
                  onChange={(e) => setDivSearch(e.target.value)}
                  placeholder="Filtrar sigla..."
                  aria-label="Filtrar proventos por sigla"
                  className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono uppercase w-28"
                />
                <div className="flex items-center gap-1 p-0.5 bg-slate-900 rounded-lg border border-slate-800">
                  {(['TODOS', 'RECEBIDO', 'PREVISTO'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setDivStatusFilter(st)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                        divStatusFilter === st
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-800 font-sans">
                  <tr>
                    <th className="py-2.5 px-3">Ticker</th>
                    <th className="py-2.5 px-3 text-right">Cotas Elegíveis</th>
                    <th className="py-2.5 px-3 text-right">R$ / Cota</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                    <th className="py-2.5 px-3">Data-Com</th>
                    <th className="py-2.5 px-3">Data Pgto</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredDividendsTable.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-slate-500 font-sans italic">
                        Nenhum provento encontrado para este filtro.
                      </td>
                    </tr>
                  ) : (
                    filteredDividendsTable.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-bold text-white">{d.ticker}</td>
                        <td className="py-2.5 px-3 text-right text-slate-300">{d.quantityEligible}</td>
                        <td className="py-2.5 px-3 text-right text-slate-300">{formatBRL(d.ratePerShare)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                          {formatBRL(d.totalAmount, preferences.hideValues)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">{formatDateBR(d.dataCom)}</td>
                        <td className="py-2.5 px-3 text-slate-300">{formatDateBR(d.paymentDate)}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              d.status === 'RECEBIDO'
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                            }`}
                          >
                            {d.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {d.status === 'PREVISTO' && (
                              <button
                                type="button"
                                onClick={() => updateDividendStatus(d.id, 'RECEBIDO')}
                                className="px-2 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[10px] font-sans font-bold transition-colors cursor-pointer"
                                title="Confirmar recebimento deste provento"
                              >
                                Confirmar
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedDivToEdit(d)}
                              className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                              title={`Editar provento de ${d.ticker}`}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {selectedDivToEdit && (
        <EditDividendModal
          dividend={selectedDivToEdit}
          isOpen={Boolean(selectedDivToEdit)}
          onClose={() => setSelectedDivToEdit(null)}
        />
      )}
    </div>
  );
};
