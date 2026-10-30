import React, { useState } from 'react';
import { Clock, Calendar, CheckCircle2, AlertCircle, Edit2 } from 'lucide-react';
import { usePortfolio } from '../../context/PortfolioContext';
import { formatBRL, formatDateBR } from '../../utils/formatters';
import { DividendEvent } from '../../types/fii';
import { EditDividendModal } from '../modals/EditDividendModal';

export const ScheduleView: React.FC = () => {
  const { dividends, preferences } = usePortfolio();
  const [selectedDivToEdit, setSelectedDivToEdit] = useState<DividendEvent | null>(null);

  return (
    <div className="space-y-6 pb-12">
      <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 shadow-xl space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            Agenda do Investidor
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-white">
          Cronograma de Datas-Com & Pagamentos
        </h1>
        <p className="text-xs text-slate-400 max-w-2xl">
          Fique por dentro das datas de corte para ter direito aos dividendos e os dias exatos em que o dinheiro cai na sua conta.
        </p>
      </div>

      <div className="space-y-3">
        {dividends.map((item) => (
          <div
            key={item.id}
            className="p-4 rounded-2xl bg-[#0F172A] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-slate-700 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center font-mono font-bold text-white text-sm">
                {item.ticker.slice(0, 4)}
              </div>
              <div>
                <span className="text-base font-bold text-white font-mono">{item.ticker}</span>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                  <span>Data-Com: <strong className="text-amber-300 font-mono">{formatDateBR(item.dataCom)}</strong></span>
                  <span aria-hidden="true">·</span>
                  <span>Data de Pagamento: <strong className="text-emerald-300 font-mono">{formatDateBR(item.paymentDate)}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-4">
              <div className="text-left sm:text-right">
                <span className="text-sm font-bold font-mono text-emerald-400 block">
                  {formatBRL(item.totalAmount, preferences.hideValues)}
                </span>
                <span className="text-xs text-slate-400">
                  {item.quantityEligible} cotas × {formatBRL(item.ratePerShare)}
                </span>
              </div>
              <button
                onClick={() => setSelectedDivToEdit(item)}
                className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-colors"
                title={`Editar evento de ${item.ticker}`}
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
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
