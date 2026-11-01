import React, { useState } from 'react';
import {
  PlusCircle,
  Download,
  Trash2,
  Search,
  ArrowDownRight,
  ArrowUpRight,
  Edit2,
  X,
} from 'lucide-react';
import { usePortfolio } from '../../context/PortfolioContext';
import { formatBRL, formatDateBR } from '../../utils/formatters';
import { Transaction } from '../../types/fii';
import { EditTransactionModal } from '../modals/EditTransactionModal';
import { InfoTooltip, TabGuideBanner } from '../common/InfoTooltip';

interface TransactionsViewProps {
  onOpenTransactionModal: () => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  onOpenTransactionModal,
}) => {
  const { transactions, deleteTransaction, exportTransactionsCSV, preferences } = usePortfolio();

  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('TODOS');
  const [selectedTxToEdit, setSelectedTxToEdit] = useState<Transaction | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch =
      t.ticker.toLowerCase().includes(search.toLowerCase()) ||
      (t.notes && t.notes.toLowerCase().includes(search.toLowerCase()));

    const matchesType = selectedType === 'TODOS' || t.type === selectedType;

    return matchesSearch && matchesType;
  });

  const handleDownloadCSV = () => {
    const csvContent = exportTransactionsCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `edumods_fii_operacoes_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleConfirmDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteTransaction(id);
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-[#0F172A] border border-slate-800 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              Livro de Operações
            </span>
            <span className="text-xs text-slate-400">{transactions.length} registros salvos</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white">
            Histórico de Compras, Vendas & Subscrições
          </h1>
          <p className="text-xs text-slate-400">
            Registre suas ordens executadas na corretora. O sistema recalcula automaticamente seu Preço Médio e sua posição na carteira.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Exportar Planilha CSV</span>
          </button>
          <button
            onClick={onOpenTransactionModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Registrar Operação</span>
          </button>
        </div>
      </div>

      {/* Guia Explicativo da Aba */}
      <TabGuideBanner
        title="Como funcionam os tipos de operação?"
        subtitle="Entenda a diferença entre Compra, Venda, Subscrição e Amortização"
        items={[
          {
            term: 'COMPRA e SUBSCRIÇÃO',
            meaning:
              'Aumentam sua quantidade de cotas e atualizam seu Preço Médio Ponderado. A Subscrição ocorre quando o fundo emite cotas novas (geralmente mais baratas) para quem já é cotista.',
          },
          {
            term: 'VENDA (Lucro ou Prejuízo Realizado)',
            meaning:
              'Reduz sua quantidade de cotas mantendo o Preço Médio inalterado, e calcula se você teve lucro ou prejuízo sobre as cotas vendidas (em FIIs, vendas com lucro pagam 20% de IR via DARF).',
          },
          {
            term: 'AMORTIZAÇÃO',
            meaning:
              'Devolução parcial do patrimônio do fundo aos cotistas, reduzindo o custo de aquisição das cotas.',
          },
        ]}
      />

      {/* Barra de Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[#0F172A] border border-slate-800">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar por sigla (ex: HGLG11) ou anotação..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto">
          {['TODOS', 'COMPRA', 'VENDA', 'SUBSCRICAO', 'AMORTIZACAO'].map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedType === type
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {type === 'TODOS' ? 'Todas' : type}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela de Operações */}
      <div className="p-5 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-800 font-sans">
              <tr>
                <th className="py-2.5 px-3">Data</th>
                <th className="py-2.5 px-3">Tipo</th>
                <th className="py-2.5 px-3">Ticker</th>
                <th className="py-2.5 px-3 text-right">Qtd</th>
                <th className="py-2.5 px-3 text-right">Preço Unitário</th>
                <th className="py-2.5 px-3 text-right">Taxas</th>
                <th className="py-2.5 px-3 text-right">Total Financeiro</th>
                <th className="py-2.5 px-3 text-right">
                  <span className="inline-flex items-center gap-1">
                    Resultado Realizado
                    <InfoTooltip
                      title="Resultado Realizado"
                      description="Aparece apenas nas operações de VENDA. Mostra o lucro ou prejuízo líquido obtido ao vender as cotas em relação ao seu Preço Médio."
                      align="right"
                    />
                  </span>
                </th>
                <th className="py-2.5 px-3 font-sans">Observações</th>
                <th className="py-2.5 px-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500 italic font-sans">
                    Nenhuma operação encontrada com os filtros atuais.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const isProfit = (tx.realizedResult || 0) >= 0;

                  return (
                    <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 text-slate-300">{formatDateBR(tx.date)}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            tx.type === 'COMPRA'
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : tx.type === 'VENDA'
                              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                              : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                          }`}
                        >
                          {tx.type === 'COMPRA' && <ArrowDownRight className="w-3 h-3" />}
                          {tx.type === 'VENDA' && <ArrowUpRight className="w-3 h-3" />}
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold text-white">{tx.ticker}</td>
                      <td className="py-3 px-3 text-right text-slate-200 tabular-nums">{tx.quantity}</td>
                      <td className="py-3 px-3 text-right text-slate-300 tabular-nums">
                        {formatBRL(tx.price, preferences.hideValues)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-400 tabular-nums">
                        {formatBRL(tx.fees, preferences.hideValues)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-white tabular-nums">
                        {formatBRL(tx.total, preferences.hideValues)}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">
                        {tx.realizedResult !== undefined ? (
                          <span className={isProfit ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                            {formatBRL(tx.realizedResult, preferences.hideValues, true)}
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-sans text-slate-400 max-w-[200px] truncate">
                        {tx.notes || '-'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setSelectedTxToEdit(tx)}
                            className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors"
                            title="Editar operação"
                            aria-label={`Editar operação de ${tx.ticker}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {confirmDeleteId === tx.id ? (
                            <div className="inline-flex items-center gap-1 bg-rose-950/80 border border-rose-500/40 px-2 py-0.5 rounded-lg font-sans">
                              <button
                                type="button"
                                disabled={deletingId === tx.id}
                                onClick={() => handleConfirmDelete(tx.id)}
                                className="text-[10px] font-bold text-rose-200 hover:text-white"
                              >
                                {deletingId === tx.id ? '...' : 'Confirmar'}
                              </button>
                              <button
                                type="button"
                                disabled={deletingId === tx.id}
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-slate-400 hover:text-white"
                                aria-label="Cancelar exclusão"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(tx.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                              title="Excluir operação"
                              aria-label={`Excluir operação de ${tx.ticker}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedTxToEdit && (
        <EditTransactionModal
          transaction={selectedTxToEdit}
          isOpen={Boolean(selectedTxToEdit)}
          onClose={() => setSelectedTxToEdit(null)}
        />
      )}
    </div>
  );
};
