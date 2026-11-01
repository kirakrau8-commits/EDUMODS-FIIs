import React, { useState, useMemo, useEffect, useId } from 'react';
import {
  Bell,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  BellRing,
  Sliders,
  Info,
  Edit2,
  Check,
  X,
  ShieldCheck,
  Send,
  History,
  XCircle,
  PauseCircle,
  PlayCircle,
  ExternalLink,
} from 'lucide-react';
import { usePortfolio } from '../../context/PortfolioContext';
import { CustomPriceAlert } from '../../types/fii';
import { formatBRL } from '../../utils/formatters';
import { VERIFIED_FII_DATABASE } from '../../data/fiiDatabase';
import {
  evaluateCustomAlerts,
  getNotificationSystemDiagnostics,
  activateNotificationsWithFeedback,
  sendRealTestNotification,
  loadNotificationHistory,
  clearNotificationHistory,
  BrowserNotificationDiagnostics,
  NotificationHistoryEntry,
  CustomAlertState,
} from '../../utils/alertsEngine';
import { InfoTooltip, TabGuideBanner } from '../common/InfoTooltip';

export const AlertsView: React.FC = () => {
  const { preferences, updatePreferences, holdings } = usePortfolio();

  const [newTicker, setNewTicker] = useState<string>('HGLG11');
  const [newType, setNewType] = useState<CustomPriceAlert['type']>('PRECO_TETO');
  const [newValue, setNewValue] = useState<string>('158.00');
  const [formFeedback, setFormFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Estado de edição completa de um alerta existente
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempEditTicker, setTempEditTicker] = useState<string>('');
  const [tempEditType, setTempEditType] = useState<CustomPriceAlert['type']>('PRECO_TETO');
  const [tempEditValue, setTempEditValue] = useState<string>('');

  // Filtro da lista de alertas programados
  const [statusFilter, setStatusFilter] = useState<'TODOS' | CustomAlertState>('TODOS');

  // Diagnóstico de notificações e histórico persistente
  const [diagnostics, setDiagnostics] = useState<BrowserNotificationDiagnostics>(() =>
    getNotificationSystemDiagnostics()
  );
  const [historyList, setHistoryList] = useState<NotificationHistoryEntry[]>(() =>
    loadNotificationHistory()
  );
  const [actionBanner, setActionBanner] = useState<{
    tone: 'emerald' | 'amber' | 'rose' | 'blue';
    title: string;
    message: string;
    instructions?: string[];
  } | null>(null);
  const [isActivating, setIsActivating] = useState<boolean>(false);

  const customAlerts = preferences.customAlerts || [];

  useEffect(() => {
    const syncState = () => {
      setDiagnostics(getNotificationSystemDiagnostics());
      setHistoryList(loadNotificationHistory());
    };
    window.addEventListener('edumods-notifications-updated', syncState);
    return () => window.removeEventListener('edumods-notifications-updated', syncState);
  }, []);

  const evaluatedAlerts = useMemo(() => {
    return evaluateCustomAlerts(customAlerts, holdings);
  }, [customAlerts, holdings]);

  const counts = useMemo(() => {
    const triggered = evaluatedAlerts.filter((e) => e.alertState === 'ATINGIDO').length;
    const monitoring = evaluatedAlerts.filter((e) => e.alertState === 'ATIVO').length;
    const paused = evaluatedAlerts.filter((e) => e.alertState === 'PAUSADO').length;
    const errors = evaluatedAlerts.filter((e) => e.alertState === 'ERRO').length;
    const totalActive = triggered + monitoring;
    return { triggered, monitoring, paused, errors, totalActive };
  }, [evaluatedAlerts]);

  const filteredEvaluatedAlerts = useMemo(() => {
    if (statusFilter === 'TODOS') return evaluatedAlerts;
    return evaluatedAlerts.filter((item) => item.alertState === statusFilter);
  }, [evaluatedAlerts, statusFilter]);

  // Dados de referência em tempo real do ticker selecionado no formulário
  const selectedTickerReference = useMemo(() => {
    const clean = newTicker.toUpperCase().trim();
    const h = holdings.find((item) => item.ticker.toUpperCase() === clean);
    const db = VERIFIED_FII_DATABASE[clean];
    const known = Boolean(h || db);
    return {
      known,
      price: h?.currentPrice ?? db?.currentPrice ?? 0,
      pvp: h?.pvp ?? db?.pvp ?? 1.0,
      lastDiv: h?.monthlyYieldPerShare ?? db?.lastDividend ?? 0,
      name: h?.name ?? db?.name ?? (clean ? 'Ticker não localizado na base B3' : 'Fundo Imobiliário'),
    };
  }, [newTicker, holdings]);

  const handleSelectTickerAndSuggest = (tickerVal: string) => {
    const clean = tickerVal.toUpperCase();
    setNewTicker(clean);
    const h = holdings.find((item) => item.ticker.toUpperCase() === clean);
    const db = VERIFIED_FII_DATABASE[clean];
    const price = h?.currentPrice ?? db?.currentPrice ?? 0;
    const pvp = h?.pvp ?? db?.pvp ?? 1.0;
    const div = h?.monthlyYieldPerShare ?? db?.lastDividend ?? 0;

    if (newType === 'PRECO_TETO' && price > 0) {
      setNewValue(price.toFixed(2));
    } else if (newType === 'PVP_MAXIMO' && pvp > 0) {
      setNewValue(pvp.toFixed(2));
    } else if (newType === 'PROVENTO_MINIMO' && div > 0) {
      setNewValue(div.toFixed(2));
    }
  };

  const handleSelectTypeAndSuggest = (typeVal: CustomPriceAlert['type']) => {
    setNewType(typeVal);
    if (typeVal === 'PRECO_TETO' && selectedTickerReference.price > 0) {
      setNewValue(selectedTickerReference.price.toFixed(2));
    } else if (typeVal === 'PVP_MAXIMO' && selectedTickerReference.pvp > 0) {
      setNewValue(selectedTickerReference.pvp.toFixed(2));
    } else if (typeVal === 'PROVENTO_MINIMO' && selectedTickerReference.lastDiv > 0) {
      setNewValue(selectedTickerReference.lastDiv.toFixed(2));
    }
  };

  const handleAddAlert = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTicker = newTicker.toUpperCase().trim();
    const val = parseFloat(newValue);

    if (!cleanTicker || cleanTicker.length < 4) {
      setFormFeedback({
        type: 'error',
        text: 'Informe uma sigla válida de Fundo Imobiliário (ex: HGLG11, MXRF11).',
      });
      return;
    }

    if (isNaN(val) || val <= 0) {
      setFormFeedback({
        type: 'error',
        text: 'O valor da condição deve ser um número maior que zero.',
      });
      return;
    }

    // Evita cadastrar alerta duplicado idêntico
    const duplicate = customAlerts.find(
      (a) =>
        a.ticker.toUpperCase() === cleanTicker &&
        a.type === newType &&
        Math.abs(a.thresholdValue - val) < 0.001
    );
    if (duplicate) {
      setFormFeedback({
        type: 'error',
        text: `Já existe um alerta idêntico cadastrado para ${cleanTicker}.`,
      });
      return;
    }

    const newItem: CustomPriceAlert = {
      id: `alt_${Date.now()}`,
      ticker: cleanTicker,
      type: newType,
      thresholdValue: val,
      isActive: true,
    };

    updatePreferences({
      customAlerts: [newItem, ...customAlerts],
    });

    setFormFeedback({
      type: 'success',
      text: `Alerta para ${cleanTicker} cadastrado e em monitoramento ativo!`,
    });
    setTimeout(() => setFormFeedback(null), 4000);
  };

  const handleToggleAlert = (id: string) => {
    updatePreferences({
      customAlerts: customAlerts.map((a) =>
        a.id === id ? { ...a, isActive: !a.isActive } : a
      ),
    });
  };

  const handleStartEdit = (alert: CustomPriceAlert) => {
    setEditingId(alert.id);
    setTempEditTicker(alert.ticker);
    setTempEditType(alert.type);
    setTempEditValue(String(alert.thresholdValue));
  };

  const handleSaveEditedAlert = (id: string) => {
    const val = parseFloat(tempEditValue);
    const cleanTicker = tempEditTicker.toUpperCase().trim();
    if (!cleanTicker || isNaN(val) || val <= 0) return;

    updatePreferences({
      customAlerts: customAlerts.map((a) =>
        a.id === id
          ? {
              ...a,
              ticker: cleanTicker,
              type: tempEditType,
              thresholdValue: val,
            }
          : a
      ),
    });
    setEditingId(null);
  };

  const handleDeleteAlert = (id: string) => {
    updatePreferences({
      customAlerts: customAlerts.filter((a) => a.id !== id),
    });
  };

  const handleEnableBrowserNotifications = async () => {
    setIsActivating(true);
    try {
      const result = await activateNotificationsWithFeedback();
      setDiagnostics(result);
      setHistoryList(loadNotificationHistory());

      if (result.statusCode === 'granted') {
        setActionBanner({
          tone: 'emerald',
          title: 'Notificações Ativadas com Sucesso!',
          message:
            'Permissão concedida pelo navegador! Enviamos uma notificação de confirmação agora mesmo e salvamos sua preferência para quando você reabrir o site.',
          instructions: result.instructions,
        });
      } else if (result.statusCode === 'denied') {
        setActionBanner({
          tone: 'amber',
          title: 'Permissão Nativa Bloqueada no Navegador — Alertas Internos Ativados',
          message:
            'Os alertas visuais dentro do EDUMODS FIIs foram ativados! Porém, o seu navegador está configurado para bloquear pop-ups deste endereço. Veja abaixo como liberar:',
          instructions: result.instructions,
        });
      } else if (result.statusCode === 'iframe_restricted') {
        setActionBanner({
          tone: 'blue',
          title: 'Alertas em Tempo Real Ativados no Painel!',
          message:
            'Sua preferência foi salva e os avisos instantâneos na tela estão ativos! Como você está visualizando dentro de uma janela incorporada (iframe), navegadores bloqueiam pop-ups externos do sistema operacional a menos que você abra o site diretamente em uma nova guia.',
          instructions: result.instructions,
        });
      } else if (result.statusCode === 'insecure_context') {
        setActionBanner({
          tone: 'rose',
          title: 'Conexão HTTPS Necessária para Pop-ups do Navegador',
          message: result.statusDescription,
          instructions: result.instructions,
        });
      } else if (result.statusCode === 'unsupported') {
        setActionBanner({
          tone: 'amber',
          title: 'Navegador sem Suporte à API Nativa — Alertas no Painel Ativos',
          message: result.statusDescription,
          instructions: result.instructions,
        });
      } else {
        setActionBanner({
          tone: 'emerald',
          title: 'Monitoramento e Alertas Instantâneos Ativados!',
          message: result.statusDescription,
          instructions: result.instructions,
        });
      }
    } finally {
      setIsActivating(false);
    }
  };

  const handleTestRealNotification = async () => {
    const firstTriggered = evaluatedAlerts.find((e) => e.alertState === 'ATINGIDO');
    const res = await sendRealTestNotification({
      activeCount: counts.totalActive,
      triggeredCount: counts.triggered,
      sampleTicker: firstTriggered?.alert.ticker || holdings[0]?.ticker || 'HGLG11',
    });
    setDiagnostics(res.diagnostics);
    setHistoryList(loadNotificationHistory());
    setActionBanner({
      tone: 'emerald',
      title: 'Teste de Notificação Real Executado!',
      message: res.message,
    });
  };

  const handleClearHistory = () => {
    clearNotificationHistory();
    setHistoryList([]);
  };

  const tickerListId = useId();
  const maxConcId = useId();
  const minYieldId = useId();

  const isNotificationsActive =
    diagnostics.permission === 'granted' || diagnostics.inAppAlertsEnabled;

  return (
    <div className="space-y-6 pb-12">
      {/* Cabeçalho da Aba */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6 rounded-2xl bg-[#0F172A] border border-slate-800 shadow-xl">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              Monitoramento Ativo em Tempo Real
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {counts.triggered} atingido(s) · {counts.monitoring} monitorando · {counts.paused} pausado(s)
              {counts.errors > 0 ? ` · ${counts.errors} com erro` : ''}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white">
            Alertas Inteligentes de Preço, P/VP & Risco
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl">
            Programe gatilhos para comprar fundos descontados, acompanhar dividendos mínimos por cota e receber notificações reais sempre que uma condição for atingida.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleTestRealNotification}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5 text-emerald-400" />
            <span>Testar Notificação Real</span>
          </button>

          <button
            type="button"
            onClick={handleEnableBrowserNotifications}
            disabled={isActivating}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              diagnostics.permission === 'granted'
                ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                : diagnostics.permission === 'denied'
                ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20'
            }`}
          >
            <BellRing className="w-4 h-4" />
            <span>
              {isActivating
                ? 'Solicitando permissão...'
                : diagnostics.permission === 'granted'
                ? 'Notificações Ativadas (Reenviar Teste)'
                : 'Ativar notificações'}
            </span>
          </button>
        </div>
      </div>

      {/* Banner de Resposta Imediata ao clicar em "Ativar notificações" ou "Testar Notificação Real" */}
      {actionBanner && (
        <div
          role="status"
          aria-live="polite"
          className={`p-4 rounded-2xl border text-xs space-y-2 transition-all ${
            actionBanner.tone === 'emerald'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
              : actionBanner.tone === 'amber'
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
              : actionBanner.tone === 'rose'
              ? 'bg-rose-500/15 border-rose-500/40 text-rose-200'
              : 'bg-blue-500/15 border-blue-500/40 text-blue-200'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              {actionBanner.tone === 'emerald' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <strong className="text-sm font-bold text-white">{actionBanner.title}</strong>
            </div>
            <button
              type="button"
              onClick={() => setActionBanner(null)}
              className="p-1 text-slate-300 hover:text-white rounded-lg"
              aria-label="Fechar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="leading-relaxed text-slate-200">{actionBanner.message}</p>
          {actionBanner.instructions && actionBanner.instructions.length > 0 && (
            <ul className="list-disc list-inside space-y-1 pt-1 text-slate-300">
              {actionBanner.instructions.map((inst, idx) => (
                <li key={idx}>{inst}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Painel Permanente de Diagnóstico de Permissão, HTTPS e Status do Navegador */}
      <div className="p-4 rounded-2xl bg-[#0F172A] border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              diagnostics.permission === 'granted'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                : diagnostics.permission === 'denied'
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                : isNotificationsActive
                ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <BellRing className="w-5 h-5" />
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <strong className="text-white font-bold text-sm">{diagnostics.statusTitle}</strong>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                  diagnostics.isSecureContext
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                }`}
              >
                <ShieldCheck className="w-3 h-3" />
                {diagnostics.isSecureContext ? 'HTTPS / Contexto Seguro OK' : 'Requer HTTPS'}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                Permissão Nativa:{' '}
                {diagnostics.permission === 'granted'
                  ? 'CONCEDIDA'
                  : diagnostics.permission === 'denied'
                  ? 'NEGADA'
                  : diagnostics.permission === 'unsupported'
                  ? 'SEM SUPORTE'
                  : 'PENDENTE'}
              </span>
            </div>
            <p className="text-slate-400 leading-relaxed">{diagnostics.statusDescription}</p>
            {diagnostics.permission === 'denied' && (
              <div className="p-2.5 mt-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 space-y-1">
                <strong className="block text-[11px] uppercase tracking-wider text-amber-300">
                  Como habilitar nas configurações do navegador:
                </strong>
                <ol className="list-decimal list-inside space-y-0.5 text-[11px]">
                  {diagnostics.instructions.map((step, i) => (
                    <li key={i}>{step.replace(/^\d+\.\s*/, '')}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {diagnostics.isEmbeddedIframe && (
            <a
              href={typeof window !== 'undefined' ? window.location.href : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
              <span>Abrir em Nova Guia Direta</span>
            </a>
          )}
        </div>
      </div>

      {/* Guia Explicativo da Aba */}
      <TabGuideBanner
        title="Como funcionam os Alertas e Notificações?"
        subtitle="Entenda cada tipo de alerta programável e os 4 estados de monitoramento"
        items={[
          {
            term: 'Preço-Teto (Compra)',
            meaning:
              'É o valor máximo que você aceita pagar por uma cota. Quando a cotação atual cai para esse valor ou menos, o alerta muda para ATINGIDO e dispara uma notificação.',
            example: 'Ex: Preço-teto HGLG11 em R$ 158,00. Se a cota estiver R$ 156,50, o alerta dispara.',
          },
          {
            term: 'P/VP Máximo (Desconto)',
            meaning:
              'Compara o preço da cota com o valor patrimonial dos imóveis (VPA). Um alerta em 1,00 avisa quando o fundo está negociando sem ágio ou com desconto.',
            example: 'Ex: P/VP <= 0,98 avisa quando o fundo está com pelo menos 2% de desconto.',
          },
          {
            term: 'Estados: Ativo, Atingido, Pausado e Com Erro',
            meaning:
              'Cada regra exibe claramente se está Monitorando (Ativo), se a condição já foi alcançada (Atingido), se foi temporariamente desativada (Pausado) ou se precisa de revisão (Com Erro).',
            example: 'Ex: Se um ticker digitado não existir na base, o cartão mostrará "Com Erro" para você corrigir.',
          },
        ]}
      />

      {/* Resumo Rápido de Status (4 Indicadores Claros) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#0F172A] border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase text-slate-400">
              Condições Atingidas
            </span>
            <strong className="text-2xl font-extrabold text-emerald-400 font-mono block mt-0.5 tabular-nums">
              {counts.triggered}
            </strong>
            <span className="text-[11px] text-slate-400">Oportunidades acionadas</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0F172A] border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase text-slate-400">
              Ativos Monitorando
            </span>
            <strong className="text-2xl font-extrabold text-white font-mono block mt-0.5 tabular-nums">
              {counts.totalActive}
            </strong>
            <span className="text-[11px] text-slate-400">
              {counts.monitoring} aguardando gatilho
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Bell className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0F172A] border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase text-slate-400">
              Pausados / Com Erro
            </span>
            <strong className="text-2xl font-extrabold text-slate-200 font-mono block mt-0.5 tabular-nums">
              {counts.paused} /{' '}
              <span className={counts.errors > 0 ? 'text-rose-400' : 'text-slate-400'}>
                {counts.errors}
              </span>
            </strong>
            <span className="text-[11px] text-slate-400">
              {counts.errors > 0 ? 'Revise alertas com erro' : 'Zero erros de configuração'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
            <PauseCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0F172A] border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase text-slate-400">
              Teto de Concentração
            </span>
            <strong className="text-2xl font-extrabold text-amber-400 font-mono block mt-0.5 tabular-nums">
              {preferences.maxConcentrationAlertPercent}%
            </strong>
            <span className="text-[11px] text-slate-400">
              DY mínimo: {preferences.minYieldAlertPercent}% a.a.
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Sliders className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna Esquerda (5 cols): Novo Alerta + Regras Automáticas de Risco */}
        <div className="lg:col-span-5 space-y-6">
          {/* Formulário: Criar Novo Alerta */}
          <div className="p-5 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                Cadastrar Novo Alerta
              </h2>
              <InfoTooltip
                title="Cadastro de Alerta"
                description="Escolha a sigla do FII (ex: HGLG11), o tipo de condição e o valor desejado. O sistema preenche automaticamente o valor atual de mercado para facilitar sua referência."
              />
            </div>

            <form onSubmit={handleAddAlert} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-semibold flex items-center gap-1.5 mb-1">
                  <span>Ticker (Sigla do Fundo)</span>
                  <InfoTooltip
                    title="O que é o Ticker?"
                    description="É o código de 4 letras seguidas do número 11 que identifica o Fundo Imobiliário na Bolsa (B3)."
                    example="HGLG11 (CSHG Logística), MXRF11 (Maxi Renda), KNIP11 (Kinea Índices)."
                  />
                </label>
                <input
                  type="text"
                  list={tickerListId}
                  value={newTicker}
                  onChange={(e) => handleSelectTickerAndSuggest(e.target.value)}
                  placeholder="Ex: HGLG11, MXRF11, XPLG11"
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono uppercase focus:outline-hidden focus:border-emerald-500"
                />
                <datalist id={tickerListId}>
                  {Object.keys(VERIFIED_FII_DATABASE).map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>

                {/* Referência imediata do ativo */}
                <div
                  className={`mt-1.5 px-2.5 py-1.5 rounded-lg border flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono ${
                    selectedTickerReference.known
                      ? 'bg-slate-900/90 border-slate-800 text-slate-400'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  }`}
                >
                  <span className="font-sans text-slate-300 font-medium truncate max-w-[160px]">
                    {selectedTickerReference.name}
                  </span>
                  {selectedTickerReference.known ? (
                    <div className="flex items-center gap-2">
                      <span>
                        Cot:{' '}
                        <strong className="text-white">
                          {formatBRL(selectedTickerReference.price)}
                        </strong>
                      </span>
                      <span>
                        P/VP:{' '}
                        <strong className="text-emerald-400">
                          {selectedTickerReference.pvp.toFixed(2)}
                        </strong>
                      </span>
                    </div>
                  ) : (
                    <span className="font-sans text-[10px] text-amber-300">
                      Ativo sem cotação na base — adicione-o primeiro na carteira
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Condição que Dispara o Alerta
                </label>
                <select
                  value={newType}
                  onChange={(e) =>
                    handleSelectTypeAndSuggest(e.target.value as CustomPriceAlert['type'])
                  }
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white"
                >
                  <option value="PRECO_TETO">
                    Preço-Teto de Compra (Avisar se cotação &lt;= valor)
                  </option>
                  <option value="PVP_MAXIMO">
                    P/VP Máximo (Avisar se P/VP &lt;= múltiplo)
                  </option>
                  <option value="PROVENTO_MINIMO">
                    Provento Mínimo (Avisar se R$/cota &gt;= valor)
                  </option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  {newType === 'PRECO_TETO'
                    ? 'Preço-Teto Desejado (R$)'
                    : newType === 'PVP_MAXIMO'
                    ? 'Múltiplo P/VP Máximo (ex: 1.00)'
                    : 'Provento Mínimo por Cota (R$)'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>

              {formFeedback && (
                <div
                  className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                    formFeedback.type === 'success'
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {formFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  )}
                  <span>{formFeedback.text}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-colors cursor-pointer"
              >
                Salvar e Monitorar Alerta
              </button>
            </form>
          </div>

          {/* Configurações Globais de Risco da Carteira */}
          <div className="p-5 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                Limites Automáticos de Segurança
              </h2>
              <InfoTooltip
                title="Limites Automáticos da Carteira"
                description="Estes parâmetros vigiam todos os fundos da sua carteira simultaneamente e geram Avisos Importantes na Central de Notificações caso algum limite seja ultrapassado."
              />
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label htmlFor={maxConcId} className="text-slate-300 font-semibold block mb-1">
                  Alerta de Concentração Máxima por Fundo (%)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id={maxConcId}
                    type="number"
                    min="5"
                    max="100"
                    step="1"
                    value={preferences.maxConcentrationAlertPercent}
                    onChange={(e) =>
                      updatePreferences({
                        maxConcentrationAlertPercent: Math.max(
                          5,
                          parseFloat(e.target.value) || 25
                        ),
                      })
                    }
                    className="w-24 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                  />
                  <span className="text-slate-400 text-[11px]">
                    Avisa se qualquer ativo ultrapassar este peso na carteira.
                  </span>
                </div>
              </div>

              <div>
                <label htmlFor={minYieldId} className="text-slate-300 font-semibold block mb-1">
                  Alerta de Dividend Yield Anual Mínimo (% a.a.)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id={minYieldId}
                    type="number"
                    min="1"
                    max="25"
                    step="0.5"
                    value={preferences.minYieldAlertPercent}
                    onChange={(e) =>
                      updatePreferences({
                        minYieldAlertPercent: Math.max(1, parseFloat(e.target.value) || 8),
                      })
                    }
                    className="w-24 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                  />
                  <span className="text-slate-400 text-[11px]">
                    Avisa se o rendimento anual de um FII cair abaixo deste piso.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Coluna Direita (7 cols): Lista de Alertas Programados + Histórico de Disparos */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-5 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-4 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Meus Alertas Programados ({evaluatedAlerts.length})
                </h2>
                <p className="text-xs text-slate-400">
                  Comparação em tempo real com indicação clara de Ativos, Atingidos, Pausados e Com Erro
                </p>
              </div>

              {/* Abas de Filtro por Estado */}
              <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800">
                {[
                  { id: 'TODOS', label: `Todos (${evaluatedAlerts.length})` },
                  { id: 'ATINGIDO', label: `Atingidos (${counts.triggered})` },
                  { id: 'ATIVO', label: `Monitorando (${counts.monitoring})` },
                  { id: 'PAUSADO', label: `Pausados (${counts.paused})` },
                  ...(counts.errors > 0
                    ? [{ id: 'ERRO', label: `Com Erro (${counts.errors})` }]
                    : []),
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id as 'TODOS' | CustomAlertState)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                      statusFilter === tab.id
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredEvaluatedAlerts.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs bg-slate-900/50 rounded-xl border border-slate-800 space-y-2">
                <Bell className="w-6 h-6 text-slate-500 mx-auto" />
                <p>
                  {evaluatedAlerts.length === 0
                    ? 'Nenhum alerta personalizado configurado. Utilize o formulário ao lado para criar seu primeiro alerta.'
                    : 'Nenhum alerta encontrado neste filtro de status.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredEvaluatedAlerts.map((item) => {
                  const {
                    alert,
                    alertState,
                    statusLabel,
                    differenceSummary,
                    currentReferenceValue,
                  } = item;
                  const isEditingThis = editingId === alert.id;

                  return (
                    <div
                      key={alert.id}
                      className={`p-4 rounded-xl border transition-all space-y-2.5 ${
                        alertState === 'PAUSADO'
                          ? 'bg-slate-900/40 border-slate-800/60 opacity-75'
                          : alertState === 'ERRO'
                          ? 'bg-rose-500/10 border-rose-500/40'
                          : alertState === 'ATINGIDO'
                          ? 'bg-emerald-500/10 border-emerald-500/40 shadow-md shadow-emerald-950/30'
                          : 'bg-slate-900 border-slate-800'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleAlert(alert.id)}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                              alert.isActive
                                ? 'bg-slate-800 text-emerald-400 border-slate-700 hover:bg-slate-700'
                                : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:text-white'
                            }`}
                            title={alert.isActive ? 'Pausar este alerta' : 'Reativar este alerta'}
                          >
                            {alert.isActive ? (
                              <>
                                <PlayCircle className="w-3.5 h-3.5" />
                                <span>Ativo</span>
                              </>
                            ) : (
                              <>
                                <PauseCircle className="w-3.5 h-3.5" />
                                <span>Pausado</span>
                              </>
                            )}
                          </button>

                          <span className="font-mono font-extrabold text-white text-sm">
                            {alert.ticker}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                            {alert.type === 'PRECO_TETO'
                              ? 'Preço-Teto'
                              : alert.type === 'PVP_MAXIMO'
                              ? 'P/VP Máximo'
                              : 'Provento Mínimo'}
                          </span>

                          {/* Badge de Status Explicito: ATINGIDO / MONITORANDO / PAUSADO / COM ERRO */}
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                              alertState === 'PAUSADO'
                                ? 'bg-slate-800 text-slate-400 border border-slate-700'
                                : alertState === 'ERRO'
                                ? 'bg-rose-500 text-white'
                                : alertState === 'ATINGIDO'
                                ? 'bg-emerald-500 text-slate-950'
                                : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                            }`}
                          >
                            {alertState === 'ATINGIDO' ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : alertState === 'ERRO' ? (
                              <XCircle className="w-3 h-3" />
                            ) : alertState === 'PAUSADO' ? (
                              <PauseCircle className="w-3 h-3" />
                            ) : (
                              <Bell className="w-3 h-3" />
                            )}
                            {statusLabel}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {!isEditingThis && (
                            <button
                              type="button"
                              onClick={() => handleStartEdit(alert)}
                              className="p-1.5 text-slate-400 hover:text-emerald-400 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Editar parâmetros do alerta"
                              aria-label={`Editar alerta de ${alert.ticker}`}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteAlert(alert.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Excluir alerta"
                            aria-label={`Excluir alerta de ${alert.ticker}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Painel de Edição Completa (Ticker, Condição e Valor) */}
                      {isEditingThis && (
                        <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/40 grid grid-cols-1 sm:grid-cols-4 gap-2 items-end text-xs">
                          <div>
                            <label className="text-[10px] uppercase text-slate-400 block mb-1">
                              Ticker
                            </label>
                            <input
                              type="text"
                              value={tempEditTicker}
                              onChange={(e) => setTempEditTicker(e.target.value.toUpperCase())}
                              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono uppercase"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase text-slate-400 block mb-1">
                              Regra
                            </label>
                            <select
                              value={tempEditType}
                              onChange={(e) =>
                                setTempEditType(e.target.value as CustomPriceAlert['type'])
                              }
                              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white"
                            >
                              <option value="PRECO_TETO">Preço-Teto</option>
                              <option value="PVP_MAXIMO">P/VP Máximo</option>
                              <option value="PROVENTO_MINIMO">Provento Mín.</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] uppercase text-slate-400 block mb-1">
                              Valor Limite
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={tempEditValue}
                              onChange={(e) => setTempEditValue(e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                            />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSaveEditedAlert(alert.id)}
                              className="flex-1 py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Salvar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                              title="Cancelar edição"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Comparativo Meta vs Valor Atual */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs font-mono">
                        <div>
                          <span className="text-[10px] font-sans uppercase text-slate-500 block">
                            Sua Meta Programada
                          </span>
                          <strong className="text-white">
                            {alert.type === 'PVP_MAXIMO'
                              ? `<= ${alert.thresholdValue.toFixed(2)}`
                              : alert.type === 'PRECO_TETO'
                              ? `<= ${formatBRL(alert.thresholdValue)}`
                              : `>= ${formatBRL(alert.thresholdValue)}`}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[10px] font-sans uppercase text-slate-500 block">
                            Valor Atual ({alert.ticker})
                          </span>
                          <strong
                            className={
                              alertState === 'ATINGIDO'
                                ? 'text-emerald-400'
                                : alertState === 'ERRO'
                                ? 'text-rose-400'
                                : 'text-slate-200'
                            }
                          >
                            {alertState === 'ERRO' && currentReferenceValue <= 0
                              ? 'Indisponível'
                              : alert.type === 'PVP_MAXIMO'
                              ? currentReferenceValue.toFixed(2)
                              : formatBRL(currentReferenceValue)}
                          </strong>
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <span className="text-[10px] font-sans uppercase text-slate-500 block">
                            Na Sua Carteira?
                          </span>
                          <span className="font-sans text-xs font-semibold text-slate-300">
                            {item.inPortfolio ? 'Sim (Em Carteira)' : 'Apenas Monitorando'}
                          </span>
                        </div>
                      </div>

                      <p
                        className={`text-xs leading-relaxed ${
                          alertState === 'ERRO' ? 'text-rose-300 font-medium' : 'text-slate-300'
                        }`}
                      >
                        {differenceSummary}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Histórico de Notificações Disparadas (Sem Duplicidade) */}
          <div className="p-5 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-4 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-400" />
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Histórico de Notificações Disparadas ({historyList.length})
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Registro auditável de todos os alertas acionados e testes enviados (com bloqueio automático contra duplicidade)
                  </p>
                </div>
              </div>

              {historyList.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  Limpar Histórico
                </button>
              )}
            </div>

            {historyList.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-900/50 rounded-xl border border-slate-800">
                Nenhum disparo registrado ainda. Clique em <strong>"Testar Notificação Real"</strong> ou <strong>"Ativar notificações"</strong> no topo para testar o envio agora mesmo.
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {historyList.map((entry) => {
                  const dateFormatted = new Date(entry.timestamp).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });

                  return (
                    <div
                      key={entry.id}
                      className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              entry.category === 'teste'
                                ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                                : entry.category === 'importante'
                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            }`}
                          >
                            {entry.category === 'teste'
                              ? 'Teste Real'
                              : entry.category === 'importante'
                              ? 'Risco / Importante'
                              : 'Oportunidade'}
                          </span>
                          <strong className="text-white">{entry.title}</strong>
                        </div>
                        <p className="text-slate-300 text-[11px]">{entry.message}</p>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 shrink-0 text-[10px] font-mono text-slate-400">
                        <span>{dateFormatted}</span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                          {entry.channel === 'navegador_nativo'
                            ? 'Navegador + Painel'
                            : 'Painel em Tempo Real'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Nota Técnica Transparente sobre Notificações com Site Fechado */}
          <div className="p-4 rounded-2xl bg-[#0B1221] border border-slate-800/90 flex items-start gap-3 text-xs text-slate-400">
            <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1 leading-relaxed">
              <strong className="text-white block">
                Importante sobre avisos com o navegador fechado:
              </strong>
              <p>
                Por segurança dos navegadores modernos, aplicações web pessoais avaliam cotações continuamente enquanto a aba está aberta (enviando notificações via Service Worker e pop-ups da área de trabalho quando autorizadas) e executam uma varredura completa instantânea assim que você abre o EDUMODS FIIs. Nenhum alerta cadastrado é perdido: todos permanecem salvos no seu banco de dados e registrados no histórico acima.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
