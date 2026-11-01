import React, { useState, useEffect } from 'react';
import { X, Edit3, Trash2, Calculator } from 'lucide-react';
import { usePortfolio } from '../../context/PortfolioContext';
import { DividendEvent, DividendStatus } from '../../types/fii';
import { formatBRL, parseFlexibleNumber } from '../../utils/formatters';

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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (dividend) {
      setDataCom(dividend.dataCom);
      setPaymentDate(dividend.paymentDate);
      setRatePerShare(String(dividend.ratePerShare).replace('.', ','));
      setQuantityEligible(String(dividend.quantityEligible));
      setStatus(dividend.status);
      setConfirmDelete(false);
    }
  }, [dividend]);

  if (!isOpen || !dividend) return null;

  const parsedQty = parseFlexibleNumber(quantityEligible);
  const parsedRate = parseFlexibleNumber(ratePerShare);
  const totalAmount =
    parsedQty > 0 && parsedRate > 0 ? Number((parsedQty * parsedRate).toFixed(2)) : 0;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseFlexibleNumber(ratePerShare);
    const qty = parseFlexibleNumber(quantityEligible);
    if (isNaN(rate) || isNaN(qty) || rate <= 0 || qty <= 0) return;

    setIsSaving(true);
    try {
      await updateDividend(dividend.id, {
        dataCom,
        paymentDate,
        ratePerShare: rate,
        quantityEligible: qty,
        status,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    setIsSaving(true);
    try {
      await deleteDividend(dividend.id);
      setConfirmDelete(false);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-[#0F172A] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#090D16]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">
                Editar Provento — <span className="font-mono text-emerald-400">{dividend.ticker}</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Ajuste a quantidade de cotas, o valor por cota ou as datas.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
          {/* 1. Fundo */}
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400 font-semibold">1. Fundo:</span>
            <strong className="text-sm font-mono font-extrabold text-emerald-400">
              {dividend.ticker}
            </strong>
          </div>

          {/* 2. Quantidade de cotas que têm direito ao pagamento */}
          <div className="space-y-1">
            <label className="text-sm font-bold text-white block">
              2. Quantidade de cotas que têm direito ao pagamento
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={quantityEligible}
              onChange={(e) => setQuantityEligible(e.target.value.replace(/[^\d.,]/g, ''))}
              required
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-base font-bold"
            />
          </div>

          {/* 3. Valor do provento POR COTA */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-white">
                3. Valor do provento <span className="text-emerald-400 underline">POR COTA</span>
              </label>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Valor de 1 cota
              </span>
            </div>
            <p className="text-[11px] text-slate-300 font-medium">
              Informe quanto o fundo paga por cada cota. O total será calculado automaticamente.
            </p>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-sm font-mono font-bold text-slate-400">
                R$
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={ratePerShare}
                onChange={(e) => setRatePerShare(e.target.value)}
                required
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-base font-bold"
              />
            </div>
          </div>

          {/* 4. Data-com e 5. Data de pagamento */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-bold block mb-1">4. Data-com</label>
              <input
                type="date"
                value={dataCom}
                onChange={(e) => setDataCom(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white"
              />
            </div>
            <div>
              <label className="text-slate-300 font-bold block mb-1">5. Data de pagamento</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white"
              />
            </div>
          </div>

          {/* 6. Valor total a receber calculado automaticamente */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-slate-900 via-emerald-950/35 to-slate-900 border border-emerald-500/30 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-emerald-400" />
                6. Valor total a receber (Automático)
              </span>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-xs text-slate-300 font-mono">
                {parsedQty > 0 && parsedRate > 0
                  ? `${parsedQty} × ${formatBRL(parsedRate)}`
                  : '-'}
              </span>
              <strong className="text-xl font-extrabold font-mono text-emerald-400">
                {formatBRL(totalAmount)}
              </strong>
            </div>
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">Situação do Pagamento</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as DividendStatus)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-semibold"
            >
              <option value="RECEBIDO">Já Recebido na Conta</option>
              <option value="PREVISTO">Previsto / Agendado</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
          </div>

          {confirmDelete ? (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 space-y-2">
              <p className="text-rose-200 font-semibold">
                Confirmar exclusão deste provento de <span className="font-mono">{dividend.ticker}</span>?
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
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
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
                className="text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Excluir Provento</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={onClose}
                  className="px-3.5 py-2 text-slate-400 hover:text-white font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl shadow-md cursor-pointer"
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
