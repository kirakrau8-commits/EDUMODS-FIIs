import React, { useState, useEffect } from 'react';
import { X, Edit3, Trash2, Check, ChevronDown, ChevronUp, Calculator } from 'lucide-react';
import { usePortfolio } from '../../context/PortfolioContext';
import { FIIHolding } from '../../types/fii';
import { formatBRL, parseFlexibleNumber } from '../../utils/formatters';

interface EditHoldingModalProps {
  holding: FIIHolding | null;
  isOpen: boolean;
  onClose: () => void;
}

export const EditHoldingModal: React.FC<EditHoldingModalProps> = ({
  holding,
  isOpen,
  onClose,
}) => {
  const { updateHolding, deleteHolding } = usePortfolio();

  const [quantity, setQuantity] = useState<string>('');
  const [averagePrice, setAveragePrice] = useState<string>('');
  const [currentPrice, setCurrentPrice] = useState<string>('');
  const [vpa, setVpa] = useState<string>('');
  const [monthlyYieldPerShare, setMonthlyYieldPerShare] = useState<string>('');
  const [targetWeight, setTargetWeight] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (holding) {
      setQuantity(String(holding.quantity));
      setAveragePrice(String(holding.averagePrice).replace('.', ','));
      setCurrentPrice(String(holding.currentPrice).replace('.', ','));
      setVpa(String(holding.vpa || holding.currentPrice).replace('.', ','));
      setMonthlyYieldPerShare(String(holding.monthlyYieldPerShare || 0.8).replace('.', ','));
      setTargetWeight(String(holding.targetWeight ?? 10).replace('.', ','));
      setNotes(holding.notes || '');
      setShowAdvanced(false);
      setFeedback(null);
      setConfirmDelete(false);
    }
  }, [holding]);

  if (!isOpen || !holding) return null;

  const parsedQty = parseFlexibleNumber(quantity);
  const parsedAvg = parseFlexibleNumber(averagePrice);
  const totalInvested = parsedQty > 0 && parsedAvg > 0 ? Number((parsedQty * parsedAvg).toFixed(2)) : 0;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = parseFlexibleNumber(quantity);
    const avg = parseFlexibleNumber(averagePrice);
    const cur = parseFlexibleNumber(currentPrice);
    const parsedVpa = parseFlexibleNumber(vpa);
    const parsedDiv = parseFlexibleNumber(monthlyYieldPerShare);
    const tw = parseFlexibleNumber(targetWeight);

    if (isNaN(q) || q < 0) {
      setFeedback('Informe uma quantidade de cotas válida.');
      return;
    }
    if (isNaN(avg) || avg < 0) {
      setFeedback('Informe um preço médio por cota válido.');
      return;
    }

    setIsSaving(true);
    try {
      await updateHolding(holding.ticker, {
        quantity: q,
        averagePrice: avg,
        currentPrice: cur > 0 ? cur : holding.currentPrice,
        vpa: parsedVpa > 0 ? parsedVpa : holding.vpa,
        monthlyYieldPerShare: parsedDiv >= 0 ? parsedDiv : holding.monthlyYieldPerShare,
        targetWeight: tw >= 0 ? tw : 10,
        notes: notes.trim(),
      });

      setFeedback('Posição atualizada com sucesso!');
      setTimeout(() => {
        setFeedback(null);
        onClose();
      }, 400);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    setIsSaving(true);
    try {
      await deleteHolding(holding.ticker);
      setConfirmDelete(false);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-[#0F172A] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#090D16] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">
                Editar Posição — <span className="font-mono text-emerald-400">{holding.ticker}</span>
              </h2>
              <p className="text-[11px] text-slate-400 truncate max-w-[280px]">{holding.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto text-xs flex-1">
          {feedback && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center gap-2 font-semibold">
              <Check className="w-4 h-4 shrink-0" />
              <span>{feedback}</span>
            </div>
          )}

          {/* Quantidade de cotas */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-white block">
              1. Quantidade de cotas
            </label>
            <p className="text-[11px] text-slate-400">
              Informe quantas cotas de {holding.ticker} você possui hoje no total.
            </p>
            <input
              type="text"
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value.replace(/[^\d.,]/g, ''))}
              required
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-base font-bold focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          {/* Preço médio de compra por cota */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-white block">
              2. Preço médio de compra por cota
            </label>
            <p className="text-[11px] text-slate-400">
              Informe o valor médio pago por cada 1 cota (não digite o valor total).
            </p>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-sm font-mono font-bold text-slate-400">
                R$
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={averagePrice}
                onChange={(e) => setAveragePrice(e.target.value)}
                required
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-base font-bold focus:outline-hidden focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Valor total investido calculado automaticamente */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-emerald-950/30 to-slate-900 border border-emerald-500/30 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-emerald-400" />
                3. Valor total investido (Calculado automaticamente)
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Automático
              </span>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-xs text-slate-400 font-mono">
                {parsedQty > 0 && parsedAvg > 0
                  ? `${parsedQty} cotas × ${formatBRL(parsedAvg)}`
                  : 'Preencha quantidade e preço médio'}
              </span>
              <strong className="text-xl font-extrabold font-mono text-emerald-400">
                {formatBRL(totalInvested)}
              </strong>
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-1">
            <label className="text-slate-300 font-semibold block">
              Anotações sobre este fundo (opcional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Fundo de contratos atípicos, segurar para renda..."
              className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          {/* Botão para opções avançadas */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-900/70 hover:bg-slate-900 border border-slate-800 text-xs text-slate-300 font-semibold transition-colors cursor-pointer"
            >
              <span>Ajustes avançados (Cotação manual, VPA, Último provento, Meta %)</span>
              {showAdvanced ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showAdvanced && (
              <div className="mt-2 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 grid grid-cols-2 gap-3 animate-in fade-in duration-150">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Cotação Atual (R$)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={currentPrice}
                    onChange={(e) => setCurrentPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Meta na Carteira (%)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={targetWeight}
                    onChange={(e) => setTargetWeight(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">VPA Patrimonial (R$)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={vpa}
                    onChange={(e) => setVpa(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Último Provento / Cota (R$)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={monthlyYieldPerShare}
                    onChange={(e) => setMonthlyYieldPerShare(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {confirmDelete ? (
            <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 space-y-2.5">
              <p className="text-rose-200 font-semibold">
                Confirmar exclusão de <span className="font-mono font-bold">{holding.ticker}</span> da sua carteira?
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleConfirmDelete}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
                >
                  {isSaving ? 'Excluindo...' : 'Confirmar Exclusão'}
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setConfirmDelete(true)}
                className="px-3 py-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer font-semibold"
              >
                <Trash2 className="w-4 h-4" />
                <span>Excluir Fundo</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={onClose}
                  className="px-3.5 py-2.5 text-xs text-slate-400 hover:text-white font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
