import React, { useState, useId } from 'react';
import { X, ArrowDownRight, ArrowUpRight, Calculator, AlertCircle, Check } from 'lucide-react';
import { usePortfolio } from '../../context/PortfolioContext';
import { OperationType } from '../../types/fii';
import { VERIFIED_FII_DATABASE } from '../../data/fiiDatabase';
import { calculateWeightedAveragePrice, calculateSaleResult } from '../../utils/financialMath';
import { formatBRL } from '../../utils/formatters';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTicker?: string;
  defaultType?: OperationType;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  defaultTicker = '',
  defaultType = 'COMPRA',
}) => {
  const { holdings, addTransaction } = usePortfolio();

  const [type, setType] = useState<OperationType>(defaultType);
  const [ticker, setTicker] = useState<string>(defaultTicker);
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [quantity, setQuantity] = useState<string>('10');
  const [price, setPrice] = useState<string>('100.00');
  const [fees, setFees] = useState<string>('0.00');
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const numQty = parseFloat(quantity) || 0;
  const numPrice = parseFloat(price) || 0;
  const numFees = parseFloat(fees) || 0;

  const currentHolding = holdings.find((h) => h.ticker.toUpperCase() === ticker.toUpperCase().trim());

  // Auto-preencher preço caso ticker seja selecionado e preço seja default
  const handleSelectTicker = (selectedTicker: string) => {
    setTicker(selectedTicker);
    const dbItem = VERIFIED_FII_DATABASE[selectedTicker];
    if (dbItem) {
      setPrice(dbItem.currentPrice.toFixed(2));
    }
  };

  // Simulação dinâmica
  let simulationInfo: React.ReactNode = null;
  if (numQty > 0 && numPrice > 0) {
    if (type === 'COMPRA' || type === 'SUBSCRICAO') {
      const prevQty = currentHolding?.quantity || 0;
      const prevAvg = currentHolding?.averagePrice || 0;
      try {
        const res = calculateWeightedAveragePrice(prevQty, prevAvg, numQty, numPrice, numFees);
        simulationInfo = (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1">
            <div className="flex justify-between text-slate-300">
              <span>Novo Saldo:</span>
              <strong className="text-white">{res.newQuantity} cotas</strong>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Novo Preço Médio:</span>
              <strong className="text-emerald-400 font-mono">{formatBRL(res.newAveragePrice)}</strong>
            </div>
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>Custo Total do Aporte:</span>
              <span>{formatBRL(numQty * numPrice + numFees)}</span>
            </div>
          </div>
        );
      } catch {
        // ignora
      }
    } else if (type === 'VENDA') {
      const currentQty = currentHolding?.quantity || 0;
      const currentAvg = currentHolding?.averagePrice || 0;
      if (numQty > currentQty) {
        simulationInfo = (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Quantidade de venda superior ao saldo em carteira ({currentQty} cotas).</span>
          </div>
        );
      } else {
        try {
          const res = calculateSaleResult(currentQty, currentAvg, numQty, numPrice, numFees);
          const isProfit = res.realizedResult >= 0;
          simulationInfo = (
            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs space-y-1">
              <div className="flex justify-between text-slate-300">
                <span>Saldo Restante:</span>
                <strong className="text-white">{res.remainingQuantity} cotas</strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Resultado Realizado:</span>
                <strong className={isProfit ? 'text-emerald-400 font-mono' : 'text-rose-400 font-mono'}>
                  {formatBRL(res.realizedResult, false, true)}
                </strong>
              </div>
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Preço Médio Restante (mantido):</span>
                <span>{formatBRL(res.averagePrice)}</span>
              </div>
            </div>
          );
        } catch {
          // ignora
        }
      }
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanTicker = ticker.toUpperCase().trim();
    if (!cleanTicker) {
      setErrorMsg('Informe o código do fundo (ex: HGLG11).');
      return;
    }
    if (numQty <= 0) {
      setErrorMsg('A quantidade deve ser maior que zero.');
      return;
    }
    if (numPrice <= 0) {
      setErrorMsg('O preço unitário deve ser maior que zero.');
      return;
    }

    const res = addTransaction({
      ticker: cleanTicker,
      type,
      date,
      quantity: numQty,
      price: numPrice,
      fees: numFees,
      notes,
    });

    if (!res.success) {
      setErrorMsg(res.error || 'Erro ao registrar operação.');
      return;
    }

    setSuccessMsg('Operação registrada com sucesso!');
    setTimeout(() => {
      setSuccessMsg(null);
      onClose();
    }, 1200);
  };

  const tickerListId = useId();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-[#0F172A] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#090D16]">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">Registrar Operação</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Fechar modal de operação"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Tipo de Operação */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Tipo de Movimentação</label>
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-900 rounded-xl border border-slate-800">
              {(['COMPRA', 'VENDA', 'SUBSCRICAO', 'AMORTIZACAO'] as OperationType[]).map((op) => {
                const isActive = type === op;
                return (
                  <button
                    key={op}
                    type="button"
                    onClick={() => setType(op)}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1 ${
                      isActive
                        ? op === 'VENDA'
                          ? 'bg-rose-500 text-white shadow-sm'
                          : 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {op === 'COMPRA' && <ArrowDownRight className="w-3.5 h-3.5" />}
                    {op === 'VENDA' && <ArrowUpRight className="w-3.5 h-3.5" />}
                    <span>{op === 'SUBSCRICAO' ? 'Subscr.' : op === 'AMORTIZACAO' ? 'Amort.' : op}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ticker & Data */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="ticker-input" className="text-xs font-medium text-slate-300">Ticker do Fundo</label>
              <input
                id="ticker-input"
                type="text"
                value={ticker}
                onChange={(e) => handleSelectTicker(e.target.value.toUpperCase())}
                placeholder="Ex: HGLG11"
                list={tickerListId}
                required
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-sm uppercase focus:outline-hidden focus:border-emerald-500"
              />
              <datalist id={tickerListId}>
                {Object.keys(VERIFIED_FII_DATABASE).map((tick) => (
                  <option key={tick} value={tick} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1">
              <label htmlFor="date-input" className="text-xs font-medium text-slate-300">Data da Operação</label>
              <input
                id="date-input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Quantidade e Preço Unitário */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label htmlFor="quantity-input" className="text-xs font-medium text-slate-300">Quantidade</label>
              <input
                id="quantity-input"
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="price-input" className="text-xs font-medium text-slate-300">Preço Unitário (R$)</label>
              <input
                id="price-input"
                type="number"
                min="0.01"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="fees-input" className="text-xs font-medium text-slate-300">Taxas (R$)</label>
              <input
                id="fees-input"
                type="number"
                min="0"
                step="0.01"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-hidden focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Notas Pessoais */}
          <div className="space-y-1">
            <label htmlFor="notes-input" className="text-xs font-medium text-slate-300">Observações / Motivo</label>
            <input
              id="notes-input"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Aporte mensal planejado ou Rebalanceamento"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          {/* Simulação em Tempo Real */}
          {simulationInfo}

          {/* Botões de Ação */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`px-5 py-2 text-xs font-bold rounded-xl text-white shadow-lg transition-colors ${
                type === 'VENDA'
                  ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
              }`}
            >
              Confirmar Operação
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
