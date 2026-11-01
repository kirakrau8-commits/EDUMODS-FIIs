import React, { useState } from 'react';
import {
  X,
  User,
  Trash2,
  ShieldCheck,
  Database,
  RotateCcw,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { usePortfolio } from '../../context/PortfolioContext';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose }) => {
  const {
    currentUser,
    resetPortfolioToDemo,
    clearPortfolioData,
    reloadFromSupabase,
    isSyncing,
    lastSyncedAt,
  } = usePortfolio();

  const [confirmAction, setConfirmAction] = useState<'demo' | 'clear' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    setIsProcessing(true);
    try {
      if (confirmAction === 'demo') {
        await resetPortfolioToDemo();
      } else if (confirmAction === 'clear') {
        await clearPortfolioData();
      }
      setConfirmAction(null);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="w-full max-w-md bg-[#0F172A] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#090D16]">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">Carteira Pessoal & Armazenamento</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Fechar modal de configurações"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Status de Uso Pessoal Liberado */}
          <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Modo Uso Pessoal Exclusivo
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                100% Liberado
              </span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{currentUser.name}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Acesso direto sem necessidade de login. Todas as ferramentas, calculadoras, gráficos e APIs estão desbloqueadas.
              </p>
            </div>
          </div>

          {/* Status de Persistência de Dados */}
          <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                Persistência Permanente
              </span>
              <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Ativa
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Seus dados permanecem salvos automaticamente no navegador e sincronizados com o banco de dados Supabase mesmo ao fechar a janela ou atualizar a página.
            </p>
            {lastSyncedAt && (
              <p className="text-[11px] text-slate-400">
                Última gravação:{' '}
                <span className="font-mono text-slate-300">
                  {lastSyncedAt.toLocaleTimeString('pt-BR')}
                </span>
              </p>
            )}
            <button
              type="button"
              onClick={() => reloadFromSupabase()}
              disabled={isSyncing}
              className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center justify-center gap-1.5 border border-slate-700 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Sincronizando dados...' : 'Sincronizar com Banco Agora'}</span>
            </button>
          </div>

          {/* Ações de Dados da Carteira */}
          <div className="pt-3 border-t border-slate-800 space-y-3">
            {confirmAction === null ? (
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setConfirmAction('demo')}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Restaurar Carteira Demo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmAction('clear')}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Zerar Dados da Carteira</span>
                </button>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-900 border border-amber-500/40 space-y-2.5 text-xs">
                <p className="text-slate-200 font-medium">
                  {confirmAction === 'demo'
                    ? 'Deseja substituir os dados atuais pela carteira demonstrativa?'
                    : 'Atenção: deseja excluir todas as posições, operações, proventos e notas da sua carteira?'}
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => setConfirmAction(null)}
                    className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleConfirmAction}
                    className={`px-3 py-1.5 rounded-lg font-bold text-white ${
                      confirmAction === 'clear'
                        ? 'bg-rose-600 hover:bg-rose-500'
                        : 'bg-emerald-600 hover:bg-emerald-500'
                    }`}
                  >
                    {isProcessing ? 'Processando...' : 'Confirmar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
