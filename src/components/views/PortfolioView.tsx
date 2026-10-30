import React, { useState } from 'react';
import {
  PlusCircle,
  Search,
  Filter,
  Star,
  Edit2,
  TrendingUp,
  TrendingDown,
  ArrowDownRight,
  ArrowUpRight,
  HelpCircle,
  Check,
  Building,
  ExternalLink,
  FileDown,
} from 'lucide-react';
import { usePortfolio } from '../../context/PortfolioContext';
import { formatBRL, formatPercent } from '../../utils/formatters';
import { FIICategory, FIIHolding, OperationType } from '../../types/fii';
import { AppModuleId } from '../layout/Sidebar';
import { EditHoldingModal } from '../modals/EditHoldingModal';
import { generatePortfolioPDFReport } from '../../utils/pdfExport';
import { useAuth } from '../../context/AuthContext';

interface PortfolioViewProps {
  onOpenTransactionModal: (ticker?: string, type?: OperationType) => void;
  onNavigate: (module: AppModuleId) => void;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  onOpenTransactionModal,
  onNavigate,
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
    preferences,
    updateHoldingNotes,
    updateHoldingTargetWeight,
    toggleFavorite,
    dividends,
  } = usePortfolio();
  const { user } = useAuth();

  const handleExportPDF = () => {
    generatePortfolioPDFReport({
      user: { email: user?.email || 'investidor@edumods.com' },
      holdings,
      dividends,
      goals,
      summary: {
        totalInvested,
        currentPortfolioValue: totalMarketValue,
        totalProfitLoss: totalUnrealizedGain,
        totalProfitLossPercentage: totalUnrealizedGainPercent,
        monthlyDividendYieldRate: 0.85,
        estimatedMonthlyDividends: monthlyDividendsReceived + monthlyDividendsForecasted,
      },
    });
  };

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('TODOS');
  const [editingNotesTicker, setEditingNotesTicker] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState('');

  const [editingTargetTicker, setEditingTargetTicker] = useState<string | null>(null);
  const [tempTarget, setTempTarget] = useState<string>('');
  const [selectedHoldingToEdit, setSelectedHoldingToEdit] = useState<FIIHolding | null>(null);

  // Filtros
  const filteredHoldings = holdings.filter((h) => {
    const matchesSearch =
      h.ticker.toLowerCase().includes(search.toLowerCase()) ||
      h.name.toLowerCase().includes(search.toLowerCase()) ||
      h.segment.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      categoryFilter === 'TODOS' || h.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const categories: string[] = ['TODOS', 'Tijolo', 'Papel', 'Fundo de Fundos', 'Híbrido'];

  const handleStartEditNotes = (h: FIIHolding) => {
    setEditingNotesTicker(h.ticker);
    setTempNotes(h.notes || '');
  };

  const handleSaveNotes = (ticker: string) => {
    updateHoldingNotes(ticker, tempNotes);
    setEditingNotesTicker(null);
  };

  const handleStartEditTarget = (h: FIIHolding) => {
    setEditingTargetTicker(h.ticker);
    setTempTarget(String(h.targetWeight || 10));
  };

  const handleSaveTarget = (ticker: string) => {
    const num = parseFloat(tempTarget);
    if (!isNaN(num) && num >= 0) {
      updateHoldingTargetWeight(ticker, num);
    }
    setEditingTargetTicker(null);
  };

  const isProfit = totalUnrealizedGain >= 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Topo / Visão Geral da Carteira */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#0F172A] via-[#141F36] to-[#0F172A] border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Minha Carteira
              </span>
              <span className="text-xs text-slate-400">
                {holdings.length} fundos ativos
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white mt-1">
              Visão Geral e Detalhamento de Posições
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onOpenTransactionModal('', 'COMPRA')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.02]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Comprar / Nova Operação</span>
            </button>
            <button
              onClick={() => onNavigate('distribuicao')}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
            >
              Alocação Ideal
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 text-xs font-semibold border border-slate-700 transition-colors"
              title="Gerar e imprimir relatório executivo em PDF"
            >
              <FileDown className="w-4 h-4" />
              <span>Exportar PDF</span>
            </button>
          </div>
        </div>

        {/* Métricas Principais em Faixa */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-3 border-t border-slate-800/80">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Patrimônio Atual</span>
            <div className="text-base sm:text-lg font-extrabold text-white font-mono mt-0.5">
              {formatBRL(totalMarketValue, preferences.hideValues)}
            </div>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Total Investido</span>
            <div className="text-base sm:text-lg font-bold text-slate-300 font-mono mt-0.5">
              {formatBRL(totalInvested, preferences.hideValues)}
            </div>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Lucro / Prejuízo</span>
            <div className={`text-base sm:text-lg font-extrabold font-mono mt-0.5 ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatBRL(totalUnrealizedGain, preferences.hideValues, true)}
            </div>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Rentabilidade</span>
            <div className={`text-base sm:text-lg font-extrabold font-mono mt-0.5 ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatPercent(totalUnrealizedGainPercent, true)}
            </div>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Proventos do Mês</span>
            <div className="text-base sm:text-lg font-bold text-emerald-400 font-mono mt-0.5">
              {formatBRL(monthlyDividendsReceived + monthlyDividendsForecasted, preferences.hideValues)}
            </div>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Média Mensal (3m)</span>
            <div className="text-base sm:text-lg font-bold text-blue-400 font-mono mt-0.5">
              {formatBRL(averageMonthlyDividends.last3Months, preferences.hideValues)}
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-[#0F172A] border border-slate-800">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por código, nome ou segmento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Abas de Categorias */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                categoryFilter === cat
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Ativos / Cards e Tabela */}
      <div className="space-y-3">
        {filteredHoldings.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-[#0F172A] border border-slate-800 text-slate-400 space-y-3">
            <Building className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-white">Nenhum fundo encontrado</h3>
            <p className="text-xs max-w-md mx-auto">
              Nenhum ativo corresponde aos filtros selecionados ou sua carteira ainda não possui registros.
            </p>
            <button
              onClick={() => onOpenTransactionModal('', 'COMPRA')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg"
            >
              Adicionar Primeiro Fundo
            </button>
          </div>
        ) : (
          filteredHoldings.map((h) => {
            const isItemProfit = h.unrealizedGain >= 0;
            const isEditingNotes = editingNotesTicker === h.ticker;
            const isEditingTarget = editingTargetTicker === h.ticker;

            return (
              <div
                key={h.ticker}
                className="p-5 rounded-2xl bg-[#0F172A] border border-slate-800 hover:border-slate-700 transition-all shadow-md space-y-4"
              >
                {/* Linha 1: Ticker, Nome, Tags, Favorito e Ações Rápidas */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-3">
                    <button
                      onClick={() => toggleFavorite(h.ticker)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        h.isFavorite
                          ? 'text-amber-400 bg-amber-400/10'
                          : 'text-slate-600 hover:text-slate-400'
                      }`}
                      title={h.isFavorite ? 'Remover dos favoritos' : 'Favoritar ativo'}
                      aria-label={h.isFavorite ? `Remover ${h.ticker} dos favoritos` : `Favoritar ${h.ticker}`}
                    >
                      <Star className="w-4 h-4 fill-current" />
                    </button>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-extrabold text-white font-mono">
                          {h.ticker}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">
                          {h.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span className="text-slate-300 font-semibold">{h.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{h.segment}</span>
                        {h.manager && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>Gestão: {h.manager}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Botões Operacionais com Lápis de Edição */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      onClick={() => setSelectedHoldingToEdit(h)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition-all"
                      title={`Editar dados da posição ${h.ticker}`}
                      aria-label={`Editar ${h.ticker}`}
                    >
                      <Edit2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Editar</span>
                    </button>
                    <button
                      onClick={() => onOpenTransactionModal(h.ticker, 'COMPRA')}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-bold transition-all"
                    >
                      <ArrowDownRight className="w-3.5 h-3.5" />
                      <span>Comprar</span>
                    </button>
                    <button
                      onClick={() => onOpenTransactionModal(h.ticker, 'VENDA')}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold transition-all"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>Vender</span>
                    </button>
                  </div>
                </div>

                {/* Linha 2: Grade de Indicadores Financeiros */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-500 font-sans uppercase block">Quantidade</span>
                    <strong className="text-white text-sm">{h.quantity} cotas</strong>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 font-sans uppercase block">Preço Médio</span>
                    <strong className="text-slate-300">{formatBRL(h.averagePrice, preferences.hideValues)}</strong>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 font-sans uppercase block">Cotação Atual</span>
                    <strong className="text-white font-bold">{formatBRL(h.currentPrice, preferences.hideValues)}</strong>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 font-sans uppercase block">Valor Mercado</span>
                    <strong className="text-slate-200">{formatBRL(h.marketValue, preferences.hideValues)}</strong>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 font-sans uppercase block">Lucro / Prejuízo</span>
                    <strong className={isItemProfit ? 'text-emerald-400' : 'text-rose-400'}>
                      {formatBRL(h.unrealizedGain, preferences.hideValues, true)} ({formatPercent(h.unrealizedGainPercent, true)})
                    </strong>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 font-sans uppercase block">P/VP</span>
                    <strong className={h.pvp <= 1.0 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                      {h.pvp.toFixed(2)}
                    </strong>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 font-sans uppercase block">DY Anual</span>
                    <strong className="text-emerald-400 font-bold">{formatPercent(h.annualDividendYield, false)}</strong>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 font-sans uppercase block">Peso na Carteira</span>
                    <strong className="text-slate-300">{h.portfolioWeight.toFixed(1)}%</strong>
                  </div>
                </div>

                {/* Linha 3: Alocação Alvo & Observações com Edição Lápis */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-slate-400 pt-1">
                  {/* Peso Alvo */}
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-medium">Meta de Alocação:</span>
                    {isEditingTarget ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={tempTarget}
                          onChange={(e) => setTempTarget(e.target.value)}
                          className="w-16 px-2 py-0.5 bg-slate-900 border border-emerald-500 rounded text-white text-xs font-mono"
                        />
                        <button
                          onClick={() => handleSaveTarget(h.ticker)}
                          className="p-1 text-emerald-400 hover:text-white"
                          title="Salvar meta"
                          aria-label={`Salvar meta de alocação para ${h.ticker}`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <strong className="text-white font-mono">{h.targetWeight || 0}%</strong>
                        <button
                          onClick={() => handleStartEditTarget(h)}
                          className="p-1 text-slate-500 hover:text-emerald-400 transition-colors"
                          title="Editar percentual alvo"
                          aria-label={`Editar meta de alocação para ${h.ticker}`}
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Observações com Lápis */}
                  <div className="flex-1 flex items-center gap-2 max-w-xl">
                    <span className="text-slate-500 font-medium shrink-0">Observação:</span>
                    {isEditingNotes ? (
                      <div className="flex items-center gap-1.5 w-full">
                        <input
                          type="text"
                          value={tempNotes}
                          onChange={(e) => setTempNotes(e.target.value)}
                          placeholder="Adicionar nota estratégica..."
                          className="w-full px-2.5 py-1 bg-slate-900 border border-emerald-500 rounded-lg text-white text-xs focus:outline-hidden"
                        />
                        <button
                          onClick={() => handleSaveNotes(h.ticker)}
                          className="p-1 text-emerald-400 hover:text-white"
                          title="Salvar nota"
                          aria-label={`Salvar nota para ${h.ticker}`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full">
                        <span className="text-slate-300 italic truncate">
                          {h.notes || 'Nenhuma anotação.'}
                        </span>
                        <button
                          onClick={() => handleStartEditNotes(h)}
                          className="p-1 text-slate-500 hover:text-emerald-400 transition-colors shrink-0 ml-2"
                          title="Editar anotação"
                          aria-label={`Editar observação para ${h.ticker}`}
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal de Edição de Posição com Lápis */}
      <EditHoldingModal
        holding={selectedHoldingToEdit}
        isOpen={Boolean(selectedHoldingToEdit)}
        onClose={() => setSelectedHoldingToEdit(null)}
      />
    </div>
  );
};
