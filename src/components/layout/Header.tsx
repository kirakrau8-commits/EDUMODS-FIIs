import React, { useState, useEffect, useMemo } from 'react';
import {
  Eye,
  EyeOff,
  Bell,
  RefreshCw,
  Building2,
  ShieldCheck,
  CheckCircle,
  Menu,
  Database,
  ChevronDown,
  Sparkles,
  AlertTriangle,
  X,
} from 'lucide-react';
import { usePortfolio } from '../../context/PortfolioContext';
import {
  buildPlatformNotifications,
  loadReadNotificationIds,
  dispatchBrowserNotificationsForTriggeredAlerts,
  registerNotificationServiceWorker,
  subscribeDeviceToWebPush,
  syncPortfolioWithServerMonitor,
  canUseBrowserNotifications,
  NotificationToastPayload,
} from '../../utils/alertsEngine';

interface HeaderProps {
  activeModuleTitle: string;
  onOpenMobileMenu: () => void;
  onOpenUserModal: () => void;
  onOpenNotifications: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeModuleTitle,
  onOpenMobileMenu,
  onOpenUserModal,
  onOpenNotifications,
}) => {
  const {
    currentUser,
    preferences,
    goals,
    toggleHideValues,
    refreshQuotes,
    isRefreshingQuotes,
    lastQuoteUpdate,
    dividends,
    holdings,
    isSyncing,
  } = usePortfolio();

  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<string[]>(() => loadReadNotificationIds());
  const [liveToast, setLiveToast] = useState<NotificationToastPayload | null>(null);

  useEffect(() => {
    void registerNotificationServiceWorker().then(() => {
      if (canUseBrowserNotifications() && window.Notification.permission === 'granted') {
        void subscribeDeviceToWebPush({
          userId: currentUser.id,
          holdings,
          dividends,
          preferences,
          goals,
        });
      }
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void syncPortfolioWithServerMonitor({
        userId: currentUser.id,
        holdings,
        dividends,
        preferences,
        goals,
        runMonitorNow: false,
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [currentUser.id, holdings, dividends, preferences, goals]);

  useEffect(() => {
    const handleSyncRead = () => {
      setReadIds(loadReadNotificationIds());
    };
    const handleLiveToast = (event: Event) => {
      const customEv = event as CustomEvent<NotificationToastPayload>;
      if (customEv.detail) {
        setLiveToast(customEv.detail);
      }
    };
    window.addEventListener('edumods-notifications-updated', handleSyncRead);
    window.addEventListener('edumods-toast-notification', handleLiveToast);
    return () => {
      window.removeEventListener('edumods-notifications-updated', handleSyncRead);
      window.removeEventListener('edumods-toast-notification', handleLiveToast);
    };
  }, []);

  useEffect(() => {
    if (!liveToast) return;
    const timer = setTimeout(() => {
      setLiveToast(null);
    }, 6500);
    return () => clearTimeout(timer);
  }, [liveToast]);

  const notificationSummary = useMemo(() => {
    return buildPlatformNotifications({
      holdings,
      dividends,
      preferences,
      goals,
      readIds,
    });
  }, [holdings, dividends, preferences, goals, readIds]);

  useEffect(() => {
    if (notificationSummary.unread.length > 0) {
      dispatchBrowserNotificationsForTriggeredAlerts(notificationSummary.unread);
    }
  }, [notificationSummary.unread]);

  const unreadCount = notificationSummary.unread.length;
  const hasImportantOrOpportunity = notificationSummary.unread.some(
    (n) => n.category === 'importante' || n.category === 'oportunidade'
  );

  const handleRefresh = async () => {
    try {
      await refreshQuotes();
      setSyncFeedback('Cotações sincronizadas!');
      setTimeout(() => setSyncFeedback(null), 3000);
    } catch {
      setSyncFeedback('Falha na sincronização.');
      setTimeout(() => setSyncFeedback(null), 3000);
    }
  };

  return (
    <div className="sticky top-0 z-30">
      <header className="h-16 bg-[#090D16] border-b border-[#1E293B] px-3 sm:px-4 md:px-6 flex items-center justify-between gap-2">
        {/* Zona 1: Logo e Menu Mobile */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onOpenMobileMenu}
            className="lg:hidden p-1.5 sm:p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 transition-colors shrink-0"
            aria-label="Abrir menu de navegação"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-bold shrink-0">
              <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-extrabold tracking-tight text-white text-sm sm:text-base md:text-lg flex items-center gap-1 whitespace-nowrap">
                EDUMODS <span className="text-emerald-400 font-bold">FIIs</span>
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center ml-4 pl-4 border-l border-slate-800 text-slate-400 text-sm font-medium">
            <span className="text-white font-semibold">{activeModuleTitle}</span>
          </div>
        </div>

        {/* Zona 2: Ações Globais */}
        <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 shrink-0">
          {/* Status de Persistência Automática */}
          {isSyncing ? (
            <span className="hidden lg:inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-lg">
              <RefreshCw className="w-3 h-3 text-blue-400 animate-spin" />
              <span>Salvando dados...</span>
            </span>
          ) : (
            <span
              className="hidden lg:inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg"
              title="Persistência automática ativa (Armazenamento Local + Banco Supabase)"
            >
              <Database className="w-3 h-3 text-emerald-400" />
              <span>Dados Salvos Automaticamente</span>
            </span>
          )}

          {syncFeedback && (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs text-emerald-400 font-medium px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 animate-fade-in">
              <CheckCircle className="w-3.5 h-3.5" />
              {syncFeedback}
            </span>
          )}

          {/* Botão Atualizar Cotações */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshingQuotes}
            className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition-colors cursor-pointer"
            title={`Última atualização: ${lastQuoteUpdate}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isRefreshingQuotes ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isRefreshingQuotes ? 'Atualizando...' : 'Atualizar Cotações'}</span>
          </button>

          {/* Toggle Ocultar Valores */}
          <button
            onClick={() => toggleHideValues()}
            className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              preferences.hideValues
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/60 text-slate-300 hover:text-white'
            }`}
            title={preferences.hideValues ? 'Mostrar valores financeiros' : 'Ocultar valores financeiros'}
            aria-label={preferences.hideValues ? 'Mostrar valores' : 'Ocultar valores'}
          >
            {preferences.hideValues ? (
              <>
                <EyeOff className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Valores Ocultos</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Ocultar Valores</span>
              </>
            )}
          </button>

          {/* Central de Notificações */}
          <button
            onClick={onOpenNotifications}
            className="relative flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 text-slate-300 hover:text-white rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition-colors cursor-pointer"
            aria-label="Central de notificações e alertas"
            title={
              unreadCount > 0
                ? `${unreadCount} alerta(s) pendente(s) de leitura`
                : 'Central de Notificações (tudo em dia)'
            }
          >
            <Bell className={`w-4 h-4 ${hasImportantOrOpportunity ? 'text-amber-400' : 'text-emerald-400'}`} />
            {unreadCount > 0 && (
              <span
                className={`text-[10px] font-bold font-mono px-1.5 py-0.2 rounded-md ${
                  hasImportantOrOpportunity
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-emerald-500 text-slate-950'
                }`}
              >
                {unreadCount}
              </span>
            )}
          </button>

          {/* Perfil Pessoal & Sincronização */}
          <button
            onClick={onOpenUserModal}
            className="flex items-center gap-1.5 sm:gap-2 p-1 sm:pl-2 sm:pr-2.5 sm:py-1 rounded-xl bg-[#0F172A] border border-slate-700/80 hover:border-slate-600 transition-colors text-left cursor-pointer"
            aria-label="Configurações de carteira e armazenamento"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-emerald-600 to-slate-700 flex items-center justify-center text-white text-xs font-bold border border-emerald-500/30">
              {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'E'}
            </div>
            <div className="hidden md:flex flex-col">
              <span className="text-xs font-semibold text-white leading-tight truncate max-w-[120px]">
                {currentUser.name}
              </span>
              <span className="text-[10px] text-emerald-400 font-medium leading-none flex items-center gap-1">
                <ShieldCheck className="w-2.5 h-2.5" />
                Uso Pessoal
              </span>
            </div>
            <ChevronDown className="hidden sm:block w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </header>

      {/* Banner Toast de Notificação em Tempo Real no Topo Direito */}
      {liveToast && (
        <div
          role="alert"
          className="fixed top-20 right-4 z-50 max-w-sm w-full p-4 rounded-2xl bg-[#0F172A] border border-emerald-500/50 shadow-2xl shadow-black/80 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
            {liveToast.category === 'importante' ? (
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            ) : (
              <Sparkles className="w-4 h-4 text-emerald-400" />
            )}
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                Notificação em Tempo Real
              </span>
              <button
                type="button"
                onClick={() => setLiveToast(null)}
                className="text-slate-400 hover:text-white"
                aria-label="Fechar notificação"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <h4 className="text-xs font-bold text-white truncate">{liveToast.title}</h4>
            <p className="text-[11px] text-slate-300 leading-relaxed">{liveToast.message}</p>
          </div>
        </div>
      )}
    </div>
  );
};
