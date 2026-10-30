import React from 'react';
import { X, Bell, Calendar, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { usePortfolio } from '../../context/PortfolioContext';
import { formatBRL, formatDateBR } from '../../utils/formatters';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({ isOpen, onClose }) => {
  const { dividends, holdings, preferences, updateDividendStatus } = usePortfolio();

  if (!isOpen) return null;

  // Filtrar eventos de proventos previstos
  const pendingDividends = dividends.filter((d) => d.status === 'PREVISTO');
  const receivedDividends = dividends.filter((d) => d.status === 'RECEBIDO').slice(0, 4);

  // Alertas de concentração
  const concentratedHoldings = holdings.filter(
    (h) => h.portfolioWeight > preferences.maxConcentrationAlertPercent
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-[#0F172A] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#090D16]">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">Notificações & Avisos</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Fechar modal de notificações"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Alertas de Risco / Concentração */}
          {concentratedHoldings.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Alerta de Concentração Patrimonial
              </span>
              <div className="space-y-1.5">
                {concentratedHoldings.map((h) => (
                  <div
                    key={h.ticker}
                    className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200 flex items-center justify-between"
                  >
                    <div>
                      <strong className="text-white font-mono">{h.ticker}</strong> representa{' '}
                      <strong className="text-amber-300">{h.portfolioWeight}%</strong> da sua carteira.
                      <p className="text-[11px] text-amber-400/80">
                        Limite sugerido configurado: {preferences.maxConcentrationAlertPercent}%.
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Proventos Agendados para Cair */}
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              Proventos Previstos a Receber ({pendingDividends.length})
            </span>
            {pendingDividends.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-3 bg-slate-900 rounded-xl">
                Nenhum provento pendente para os próximos dias.
              </p>
            ) : (
              <div className="space-y-2">
                {pendingDividends.map((d) => (
                  <div
                    key={d.id}
                    className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white font-mono">{d.ticker}</span>
                        <span className="text-slate-400">· Data Pgto: {formatDateBR(d.paymentDate)}</span>
                      </div>
                      <div className="text-slate-400 text-[11px] mt-0.5">
                        {d.quantityEligible} cotas × {formatBRL(d.ratePerShare)} ={' '}
                        <strong className="text-emerald-400">{formatBRL(d.totalAmount)}</strong>
                      </div>
                    </div>
                    <button
                      onClick={() => updateDividendStatus(d.id, 'RECEBIDO')}
                      className="px-2.5 py-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-lg transition-colors"
                    >
                      Marcar Recebido
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Últimos Proventos Confirmados */}
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Últimos Proventos Creditados
            </span>
            <div className="space-y-1.5">
              {receivedDividends.map((d) => (
                <div
                  key={d.id}
                  className="p-2.5 bg-slate-900/50 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-200">{d.ticker}</span>
                    <span className="text-slate-500 text-[11px]">Pago em {formatDateBR(d.paymentDate)}</span>
                  </div>
                  <span className="font-mono text-emerald-400 font-semibold">{formatBRL(d.totalAmount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
