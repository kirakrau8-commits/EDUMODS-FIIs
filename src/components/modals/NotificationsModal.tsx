import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Bell,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Check,
  RotateCcw,
  BellRing,
  Info,
  Send,
  History,
  ShieldCheck,
  Smartphone,
  Wifi,
  RefreshCw,
} from 'lucide-react';
import { usePortfolio } from '../../context/PortfolioContext';
import {
  buildPlatformNotifications,
  loadReadNotificationIds,
  saveReadNotificationIds,
  getNotificationSystemDiagnostics,
  activateNotificationsWithFeedback,
  sendRealTestNotification,
  loadNotificationHistory,
  clearNotificationHistory,
  syncPortfolioWithServerMonitor,
  NotificationCategory,
  BrowserNotificationDiagnostics,
  NotificationHistoryEntry,
} from '../../utils/alertsEngine';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({ isOpen, onClose }) => {
  const {
    currentUser,
    dividends,
    holdings,
    goals,
    preferences,
    updateDividendStatus,
    lastQuoteUpdate,
  } = usePortfolio();

  const [readIds, setReadIds] = useState<string[]>(() => loadReadNotificationIds());
  const [activeTab, setActiveTab] = useState<
    'pendentes' | 'visualizados' | 'todos' | 'historico'
  >('pendentes');
  const [categoryFilter, setCategoryFilter] = useState<'TODOS' | NotificationCategory>('TODOS');
  const [diagnostics, setDiagnostics] = useState<BrowserNotificationDiagnostics>(() =>
    getNotificationSystemDiagnostics()
  );
  const [historyList, setHistoryList] = useState<NotificationHistoryEntry[]>(() =>
    loadNotificationHistory()
  );
  const [isTesting, setIsTesting] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    tone: 'emerald' | 'amber' | 'rose' | 'blue';
    title: string;
    message: string;
    instructions?: string[];
  } | null>(null);

  const refreshDiagnostics = useCallback(() => {
    setDiagnostics(getNotificationSystemDiagnostics());
    setHistoryList(loadNotificationHistory());
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setReadIds(loadReadNotificationIds());
    refreshDiagnostics();
    void syncPortfolioWithServerMonitor({
      userId: currentUser.id,
      holdings,
      dividends,
      preferences,
      goals,
      runMonitorNow: false,
    }).then(() => {
      refreshDiagnostics();
    });
  }, [isOpen, currentUser.id, holdings, dividends, preferences, goals, refreshDiagnostics]);

  useEffect(() => {
    window.addEventListener('edumods-notifications-updated', refreshDiagnostics);
    return () => window.removeEventListener('edumods-notifications-updated', refreshDiagnostics);
  }, [refreshDiagnostics]);

  const { all, unread, read, evaluatedCustomAlerts } = useMemo(() => {
    return buildPlatformNotifications({
      holdings,
      dividends,
      goals,
      preferences,
      readIds,
    });
  }, [holdings, dividends, goals, preferences, readIds]);

  if (!isOpen) return null;

  const baseList =
    activeTab === 'pendentes' ? unread : activeTab === 'visualizados' ? read : all;

  const filteredList = baseList.filter((item) =>
    categoryFilter === 'TODOS' ? true : item.category === categoryFilter
  );

  const handleToggleRead = (id: string, currentlyRead: boolean) => {
    const next = currentlyRead
      ? readIds.filter((item) => item !== id)
      : [...readIds, id];
    setReadIds(next);
    saveReadNotificationIds(next);
  };

  const handleMarkAllAsRead = () => {
    const allIds = all.map((n) => n.id);
    const merged = Array.from(new Set([...readIds, ...allIds]));
    setReadIds(merged);
    saveReadNotificationIds(merged);
  };

  const handleResetRead = () => {
    setReadIds([]);
    saveReadNotificationIds([]);
  };

  const handleEnableBrowserNotifications = async () => {
    setIsTesting(true);
    try {
      const res = await activateNotificationsWithFeedback({
        userId: currentUser.id,
        holdings,
        dividends,
        preferences,
        goals,
      });
      setDiagnostics(res);
      setHistoryList(loadNotificationHistory());

      if (res.statusCode === 'granted') {
        setFeedbackBanner({
          tone: 'emerald',
          title: res.push.isSubscribed
            ? 'Notificações Nativas & Web Push em 2º Plano Ativados!'
            : 'Permissão Nativa do Android Concedida!',
          message: res.statusDescription,
        });
      } else if (res.statusCode === 'denied') {
        setFeedbackBanner({
          tone: 'rose',
          title: 'Permissão Bloqueada no Navegador — Notificação Nativa Não Pôde Ser Ativada',
          message: res.statusDescription,
          instructions: res.instructions,
        });
      } else {
        setFeedbackBanner({
          tone: 'amber',
          title: res.statusTitle,
          message: res.statusDescription,
          instructions: res.instructions,
        });
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestRealNotification = async () => {
    setIsTesting(true);
    try {
      const activeCount = evaluatedCustomAlerts.filter((e) => e.alert.isActive).length;
      const triggeredCount = evaluatedCustomAlerts.filter(
        (e) => e.alert.isActive && e.isTriggered
      ).length;
      const res = await sendRealTestNotification({
        activeCount,
        triggeredCount,
        sampleTicker: holdings[0]?.ticker || 'HGLG11',
        portfolioState: {
          userId: currentUser.id,
          holdings,
          dividends,
          preferences,
          goals,
        },
      });
      setDiagnostics(res.diagnostics);
      setHistoryList(loadNotificationHistory());

      if (res.deliveredNative) {
        setFeedbackBanner({
          tone: 'emerald',
          title: res.deliveredServerPush
            ? 'Notificação Nativa & Web Push Entregues com Sucesso!'
            : 'Notificação Nativa Entregue na Central do Sistema!',
          message: res.message,
        });
      } else {
        setFeedbackBanner({
          tone: 'rose',
          title: 'Falha na Entrega da Notificação Nativa',
          message: res.message,
          instructions: res.diagnostics.instructions,
        });
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handleRunServerMonitorNow = async () => {
    setIsMonitoring(true);
    try {
      const monitorState = await syncPortfolioWithServerMonitor({
        userId: currentUser.id,
        holdings,
        dividends,
        preferences,
        goals,
        runMonitorNow: true,
      });
      refreshDiagnostics();
      if (monitorState) {
        setFeedbackBanner({
          tone: monitorState.isFallbackData ? 'amber' : 'emerald',
          title: 'Monitoramento no Servidor Concluído!',
          message: `Varredura concluída (${monitorState.quoteSource}): ${monitorState.evaluatedCount} regra(s) verificada(s), ${monitorState.triggeredCount} condição(ões) atingida(s) e ${monitorState.pushedCount} push(es) enviado(s).`,
        });
      } else {
        setFeedbackBanner({
          tone: 'rose',
          title: 'Erro no Monitoramento do Servidor',
          message: 'Não foi possível contatar /api/cron/monitor no momento.',
        });
      }
    } finally {
      setIsMonitoring(false);
    }
  };

  const getCategoryBadge = (cat: NotificationCategory) => {
    if (cat === 'importante') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-amber-500/15 text-amber-300 border border-amber-500/30">
          <AlertTriangle className="w-3 h-3" />
          Aviso Importante
        </span>
      );
    }
    if (cat === 'oportunidade') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          <Sparkles className="w-3 h-3" />
          Oportunidade / Alerta
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-blue-500/15 text-blue-300 border border-blue-500/30">
        <Calendar className="w-3 h-3" />
        Lembrete
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="w-full max-w-3xl bg-[#0F172A] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Cabeçalho */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#090D16]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Central de Notificações & Diagnóstico Push</h2>
              <p className="text-[11px] text-slate-400">
                {unread.length} pendente(s) · {read.length} visualizada(s) · {historyList.length} no histórico
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Fechar central de notificações"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Painel Compacto de Diagnóstico Real */}
        <div className="px-6 py-2.5 bg-slate-950/90 border-b border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
          <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800">
            <span className="text-[10px] text-slate-400 font-semibold uppercase flex items-center gap-1">
              <Smartphone className="w-3 h-3 text-emerald-400" /> Permissão Android
            </span>
            <p className="font-bold text-white truncate mt-0.5">
              {diagnostics.permission === 'granted'
                ? 'Concedida (Nativa)'
                : diagnostics.permission === 'denied'
                ? 'Bloqueada'
                : diagnostics.permission === 'default'
                ? 'Pendente'
                : 'Indisponível'}
            </p>
          </div>

          <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800">
            <span className="text-[10px] text-slate-400 font-semibold uppercase flex items-center gap-1">
              <Wifi className="w-3 h-3 text-blue-400" /> Inscrição Push
            </span>
            <p className="font-bold text-white truncate mt-0.5">
              {diagnostics.push.isSubscribed
                ? 'Ativa em 2º Plano'
                : diagnostics.push.serviceWorkerActive
                ? 'SW Ativo (Sem Push)'
                : 'Aguardando SW'}
            </p>
          </div>

          <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800">
            <span className="text-[10px] text-slate-400 font-semibold uppercase flex items-center gap-1">
              <RefreshCw className="w-3 h-3 text-amber-400" /> Último Monitoramento
            </span>
            <p className="font-bold text-white truncate mt-0.5">
              {diagnostics.monitoring.lastMonitorRunAt
                ? new Date(diagnostics.monitoring.lastMonitorRunAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })
                : 'Pronto p/ checar'}
            </p>
          </div>

          <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800">
            <span className="text-[10px] text-slate-400 font-semibold uppercase flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" /> Última Cotação
            </span>
            <p
              className="font-bold text-white truncate mt-0.5"
              title={diagnostics.monitoring.quoteSource}
            >
              {diagnostics.monitoring.lastQuoteUpdateAt
                ? new Date(diagnostics.monitoring.lastQuoteUpdateAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : lastQuoteUpdate || 'Local'}
            </p>
          </div>
        </div>

        {/* Barra de Abas: Pendentes vs Visualizadas vs Histórico + Ações */}
        <div className="px-6 pt-3 pb-2 border-b border-slate-800/80 bg-[#0B111E] space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('pendentes')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'pendentes'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Pendentes ({unread.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('visualizados')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'visualizados'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Visualizadas ({read.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('todos')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'todos'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Todas ({all.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('historico')}
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'historico'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <History className="w-3 h-3" />
                <span>Histórico ({historyList.length})</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {unread.length > 0 && activeTab !== 'historico' && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  <Check className="w-3 h-3" />
                  <span>Marcar todas como lidas</span>
                </button>
              )}
              {read.length > 0 && activeTab === 'visualizados' && (
                <button
                  type="button"
                  onClick={handleResetRead}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restaurar para pendentes</span>
                </button>
              )}
              {activeTab === 'historico' && historyList.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    clearNotificationHistory();
                    setHistoryList([]);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-colors cursor-pointer"
                >
                  <span>Limpar Histórico</span>
                </button>
              )}
            </div>
          </div>

          {/* Filtro por Tipo de Notificação */}
          {activeTab !== 'historico' && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <span className="text-[10px] font-semibold uppercase text-slate-500 mr-1">
                Categoria:
              </span>
              {[
                { id: 'TODOS', label: 'Todas' },
                { id: 'oportunidade', label: 'Oportunidades & Alertas' },
                { id: 'importante', label: 'Avisos Importantes' },
                { id: 'lembrete', label: 'Lembretes de Proventos' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setCategoryFilter(f.id as 'TODOS' | NotificationCategory)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    categoryFilter === f.id
                      ? 'bg-slate-800 text-white border border-slate-700'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Banner de Feedback ao Clicar em Ativar ou Testar Notificações */}
        {feedbackBanner && (
          <div
            className={`mx-6 mt-4 p-3.5 rounded-xl border text-xs space-y-1.5 ${
              feedbackBanner.tone === 'emerald'
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                : feedbackBanner.tone === 'rose'
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-200'
                : feedbackBanner.tone === 'amber'
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                : 'bg-blue-500/15 border-blue-500/40 text-blue-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <strong className="text-white font-bold">{feedbackBanner.title}</strong>
              <button
                type="button"
                onClick={() => setFeedbackBanner(null)}
                className="text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p>{feedbackBanner.message}</p>
            {feedbackBanner.instructions && feedbackBanner.instructions.length > 0 && (
              <ul className="list-disc list-inside text-[11px] text-slate-200 space-y-0.5 pt-1">
                {feedbackBanner.instructions.map((inst, idx) => (
                  <li key={idx}>{inst}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Lista de Notificações ou Histórico */}
        <div className="p-6 space-y-3 overflow-y-auto flex-1">
          {activeTab === 'historico' ? (
            historyList.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                <History className="w-8 h-8 text-slate-400 mx-auto" />
                <h3 className="text-sm font-bold text-white">Nenhum disparo no histórico</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Clique em "Testar Notificação" ou "Monitorar Agora" no rodapé para registrar e verificar um envio real.
                </p>
              </div>
            ) : (
              historyList.map((entry) => (
                <div
                  key={entry.id}
                  className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          entry.channel === 'web_push_background'
                            ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                            : entry.channel === 'service_worker_nativo' ||
                              entry.channel === 'navegador_nativo'
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {entry.channel === 'web_push_background'
                          ? 'Web Push (2º Plano)'
                          : entry.channel === 'service_worker_nativo'
                          ? 'Service Worker Nativo'
                          : entry.channel === 'navegador_nativo'
                          ? 'Navegador Nativo'
                          : 'Painel'}
                      </span>
                      <strong className="text-white">{entry.title}</strong>
                    </div>
                    <p className="text-slate-300">{entry.message}</p>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                    {new Date(entry.timestamp).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))
            )
          ) : filteredList.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <h3 className="text-sm font-bold text-white">
                {activeTab === 'pendentes'
                  ? 'Nenhuma notificação pendente neste filtro'
                  : 'Nenhum registro nesta visualização'}
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Seus alertas programados de preço-teto, P/VP máximo, provento mínimo, preço de compra, concentração e datas de dividendos são monitorados continuamente.
              </p>
            </div>
          ) : (
            filteredList.map((n) => (
              <div
                key={n.id}
                className={`p-4 rounded-xl border transition-all space-y-2 ${
                  n.isRead
                    ? 'bg-slate-900/40 border-slate-800/80 opacity-80'
                    : n.category === 'importante'
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : n.category === 'oportunidade'
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {getCategoryBadge(n.category)}
                      <h4 className="text-xs sm:text-sm font-bold text-white">{n.title}</h4>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">{n.message}</p>
                    <p className="text-[11px] text-slate-400">{n.detail}</p>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleRead(n.id, n.isRead)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                        n.isRead
                          ? 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                          : 'bg-slate-900/90 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                      }`}
                    >
                      {n.isRead ? 'Voltar p/ Pendente' : 'Marcar Visualizada'}
                    </button>

                    {n.dividendId && (
                      <button
                        type="button"
                        onClick={() => {
                          updateDividendStatus(n.dividendId!, 'RECEBIDO');
                          handleToggleRead(n.id, false);
                        }}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
                      >
                        Confirmar Crédito
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Rodapé: Notificações do Navegador & Funcionamento */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-[#090D16] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2 text-[11px] text-slate-400">
            <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="flex items-center gap-1.5 text-slate-200 font-semibold">
                <span>{diagnostics.statusTitle}</span>
                {diagnostics.isSecureContext && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-400">
                    <ShieldCheck className="w-3 h-3" /> HTTPS
                  </span>
                )}
              </span>
              <span className="block text-slate-400">
                {diagnostics.push.endpointMasked
                  ? `Endpoint Push registrado: ${diagnostics.push.endpointMasked}`
                  : 'Ative o Push para receber alertas mesmo com o navegador fechado.'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isMonitoring}
              onClick={handleRunServerMonitorNow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isMonitoring ? 'animate-spin' : ''}`} />
              <span>{isMonitoring ? 'Checando...' : 'Monitorar Agora'}</span>
            </button>

            <button
              type="button"
              disabled={isTesting}
              onClick={handleTestRealNotification}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isTesting ? 'Testando...' : 'Testar Notificação'}</span>
            </button>

            <button
              type="button"
              disabled={isTesting}
              onClick={handleEnableBrowserNotifications}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer ${
                diagnostics.permission === 'granted' && diagnostics.push.isSubscribed
                  ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
              }`}
            >
              <BellRing className="w-3.5 h-3.5" />
              <span>
                {diagnostics.permission === 'granted' && diagnostics.push.isSubscribed
                  ? 'Push Ativo'
                  : 'Ativar notificações'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
