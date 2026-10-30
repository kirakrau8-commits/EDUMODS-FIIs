import React, { useState, useEffect } from 'react';
import { X, Edit3, Trash2, Check, AlertCircle } from 'lucide-react';
import { usePortfolio } from '../../context/PortfolioContext';
import { FIIHolding } from '../../types/fii';
import { formatBRL } from '../../utils/formatters';

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
  const [targetWeight, setTargetWeight] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (holding) {
      setQuantity(String(holding.quantity));
      setAveragePrice(String(holding.averagePrice));
      setCurrentPrice(String(holding.currentPrice));
      setTargetWeight(String(holding.targetWeight || 10));
      setNotes(holding.notes || '');
      setFeedback(null);
    }
  }, [holding]);

  if (!isOpen || !holding) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const q = parseFloat(quantity);
    const avg = parseFloat(averagePrice);
    const cur = parseFloat(currentPrice);
    const tw = parseFloat(targetWeight);

    if (isNaN(q) || q < 0) {
      setFeedback('Quantidade inválida.');
      return;
    }
    if (isNaN(avg) || avg < 0) {
      setFeedback('Preço médio inválido.');
      return;
    }
    if (isNaN(cur) || cur < 0) {
      setFeedback('Cotação atual inválida.');
      return;
    }

    updateHolding(holding.ticker, {
      quantity: q,
      averagePrice: avg,
      currentPrice: cur,
      targetWeight: isNaN(tw) ? 10 : tw,
      notes: notes.trim(),
    });

    setFeedback('Posição atualizada com sucesso!');
    setTimeout(() => {
      setFeedback(null);
      onClose();
    }, 600);
  };

  const handleDelete = () => {
    if (window.confirm(`Tem certeza que deseja remover o fundo ${holding.ticker} da carteira?`)) {
      deleteHolding(holding.ticker);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="w-full max-w-md bg-[#0F172A] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#090D16]">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-emerald-400" />
            <h2 className="text-base font-bold text-white">
              Editar Posição — <span className="font-mono text-emerald-400">{holding.ticker}</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
          {feedback && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{feedback}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Quantidade de Cotas</label>
              <input
                type="number"
                min="0"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">Preço Médio (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={averagePrice}
                onChange={(e) => setAveragePrice(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-hidden focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Cotação Atual (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={currentPrice}
                onChange={(e) => setCurrentPrice(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">Alocação Alvo (% Ideal)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={targetWeight}
                onChange={(e) => setTargetWeight(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-hidden focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">Observações Pessoais</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Tese de logística, inquilino Mercado Livre..."
              className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={handleDelete}
              className="px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Excluir Posição</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md transition-colors"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
