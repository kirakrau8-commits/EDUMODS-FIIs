import React, { useState, useEffect } from 'react';
import { X, Edit3, Trash2 } from 'lucide-react';
import { usePortfolio } from '../../context/PortfolioContext';
import { DividendEvent, DividendStatus } from '../../types/fii';

interface EditDividendModalProps {
  dividend: DividendEvent | null;
  isOpen: boolean;
  onClose: () => void;
}

export const EditDividendModal: React.FC<EditDividendModalProps> = ({
  dividend,
  isOpen,
  onClose,
}) => {
  const { updateDividend, deleteDividend } = usePortfolio();

  const [dataCom, setDataCom] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [ratePerShare, setRatePerShare] = useState('');
  const [quantityEligible, setQuantityEligible] = useState('');
  const [status, setStatus] = useState<DividendStatus>('RECEBIDO');

  useEffect(() => {
    if (dividend) {
      setDataCom(dividend.dataCom);
      setPaymentDate(dividend.paymentDate);
      setRatePerShare(String(dividend.ratePerShare));
      setQuantityEligible(String(dividend.quantityEligible));
      setStatus(dividend.status);
    }
  }, [dividend]);

  if (!isOpen || !dividend) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseFloat(ratePerShare);
    const qty = parseFloat(quantityEligible);
    if (isNaN(rate) || isNaN(qty) || rate <= 0 || qty <= 0) return;

    updateDividend(dividend.id, {
      dataCom,
      paymentDate,
      ratePerShare: rate,
      quantityEligible: qty,
      status,
    });

    onClose();
  };

  const handleDelete = () => {
    if (window.confirm('Excluir este lançamento de provento?')) {
      deleteDividend(dividend.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="w-full max-w-md bg-[#0F172A] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#090D16]">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-emerald-400" />
            <h2 className="text-base font-bold text-white">
              Editar Provento — <span className="font-mono text-emerald-400">{dividend.ticker}</span>
            </h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Data-Com</label>
              <input
                type="date"
                value={dataCom}
                onChange={(e) => setDataCom(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white"
              />
            </div>
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Data de Pagamento</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Valor por Cota (R$)</label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={ratePerShare}
                onChange={(e) => setRatePerShare(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
              />
            </div>
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Cotas Elegíveis</label>
              <input
                type="number"
                min="1"
                value={quantityEligible}
                onChange={(e) => setQuantityEligible(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as DividendStatus)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-semibold"
            >
              <option value="RECEBIDO">RECEBIDO</option>
              <option value="PREVISTO">PREVISTO</option>
              <option value="CANCELADO">CANCELADO</option>
            </select>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={handleDelete}
              className="text-rose-400 hover:text-rose-300 flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Excluir</span>
            </button>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className="px-3 py-1.5 text-slate-400">
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md"
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
