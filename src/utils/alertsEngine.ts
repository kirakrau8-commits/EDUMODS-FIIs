import {
  CustomPriceAlert,
  DividendEvent,
  FIIHolding,
  UserPreferences,
} from '../types/fii';
import { VERIFIED_FII_DATABASE } from '../data/fiiDatabase';
import { formatBRL, formatDateBR } from './formatters';

export type NotificationCategory = 'importante' | 'oportunidade' | 'lembrete';
export type CustomAlertState = 'ATINGIDO' | 'ATIVO' | 'PAUSADO' | 'ERRO';

export interface EvaluatedCustomAlert {
  alert: CustomPriceAlert;
  fundName: string;
  currentPrice: number;
  currentPvp: number;
  currentMonthlyDividend: number;
  currentReferenceValue: number;
  isTriggered: boolean;
  isError: boolean;
  errorReason?: string;
  alertState: CustomAlertState;
  statusLabel: string;
  differenceSummary: string;
  inPortfolio: boolean;
}

export interface PlatformNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  message: string;
  detail: string;
  ticker?: string;
  dividendId?: string;
  isRead: boolean;
  priority: number; // 1 = highest (importante), 2 = oportunidade, 3 = lembrete
}

export interface NotificationHistoryEntry {
  id: string;
  notificationId: string;
  timestamp: string;
  title: string;
  message: string;
  category: NotificationCategory | 'teste';
  ticker?: string;
  channel: 'navegador_nativo' | 'sistema_painel';
}

export interface BrowserNotificationDiagnostics {
  apiSupported: boolean;
  isSecureContext: boolean;
  isEmbeddedIframe: boolean;
  permission: NotificationPermission | 'unsupported';
  inAppAlertsEnabled: boolean;
  activatedAt: string | null;
  statusCode: 'granted' | 'denied' | 'iframe_restricted' | 'insecure_context' | 'unsupported' | 'default';
  statusTitle: string;
  statusDescription: string;
  instructions: string[];
}

export interface NotificationToastPayload {
  id: string;
  title: string;
  message: string;
  category: NotificationCategory | 'teste';
  timestamp: string;
}

const READ_NOTIFICATIONS_STORAGE_KEY = 'edumods_fii_personal_v1_read_notifications';
const NOTIFIED_BROWSER_IDS_STORAGE_KEY = 'edumods_fii_personal_v1_browser_notified';
const NOTIFICATION_HISTORY_STORAGE_KEY = 'edumods_fii_personal_v1_notification_history';
const NOTIFICATION_PREFS_STORAGE_KEY = 'edumods_fii_personal_v1_notification_settings';

interface PersistedNotificationSettings {
  inAppAlertsEnabled: boolean;
  lastKnownPermission: NotificationPermission | 'unsupported';
  activatedAt: string | null;
}

export function loadPersistedNotificationSettings(): PersistedNotificationSettings {
  const defaultPerm = canUseBrowserNotifications() ? window.Notification.permission : 'unsupported';
  try {
    const raw =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem(NOTIFICATION_PREFS_STORAGE_KEY)
        : null;
    if (!raw) {
      return {
        inAppAlertsEnabled: defaultPerm === 'granted',
        lastKnownPermission: defaultPerm,
        activatedAt: defaultPerm === 'granted' ? new Date().toISOString() : null,
      };
    }
    const parsed = JSON.parse(raw);
    return {
      inAppAlertsEnabled:
        typeof parsed.inAppAlertsEnabled === 'boolean'
          ? parsed.inAppAlertsEnabled
          : defaultPerm === 'granted',
      lastKnownPermission: defaultPerm,
      activatedAt: parsed.activatedAt || null,
    };
  } catch {
    return {
      inAppAlertsEnabled: defaultPerm === 'granted',
      lastKnownPermission: defaultPerm,
      activatedAt: null,
    };
  }
}

export function savePersistedNotificationSettings(
  partial: Partial<PersistedNotificationSettings>
): PersistedNotificationSettings {
  const current = loadPersistedNotificationSettings();
  const next: PersistedNotificationSettings = {
    ...current,
    ...partial,
    lastKnownPermission: canUseBrowserNotifications()
      ? window.Notification.permission
      : 'unsupported',
  };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(NOTIFICATION_PREFS_STORAGE_KEY, JSON.stringify(next));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('edumods-notifications-updated'));
    }
  } catch {
    // ignore storage errors
  }
  return next;
}

export function loadNotificationHistory(): NotificationHistoryEntry[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(NOTIFICATION_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendNotificationHistory(
  entry: Omit<NotificationHistoryEntry, 'id' | 'timestamp'> & { timestamp?: string }
): NotificationHistoryEntry[] {
  const current = loadNotificationHistory();
  const newItem: NotificationHistoryEntry = {
    id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    notificationId: entry.notificationId,
    timestamp: entry.timestamp || new Date().toISOString(),
    title: entry.title,
    message: entry.message,
    category: entry.category,
    ticker: entry.ticker,
    channel: entry.channel,
  };
  const next = [newItem, ...current].slice(0, 60);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(NOTIFICATION_HISTORY_STORAGE_KEY, JSON.stringify(next));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('edumods-notifications-updated'));
    }
  } catch {
    // ignore
  }
  return next;
}

export function clearNotificationHistory(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(NOTIFICATION_HISTORY_STORAGE_KEY);
      localStorage.removeItem(NOTIFIED_BROWSER_IDS_STORAGE_KEY);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('edumods-notifications-updated'));
    }
  } catch {
    // ignore
  }
}

export function emitInAppToast(payload: Omit<NotificationToastPayload, 'id' | 'timestamp'>): void {
  if (typeof window === 'undefined') return;
  const fullPayload: NotificationToastPayload = {
    ...payload,
    id: `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
  };
  window.dispatchEvent(new CustomEvent('edumods-toast-notification', { detail: fullPayload }));
}

export async function registerNotificationServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const existing = await navigator.serviceWorker.getRegistration('/sw.js');
    if (existing) return existing;
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

async function deliverNativeNotification(
  title: string,
  body: string,
  tag: string
): Promise<boolean> {
  if (!canUseBrowserNotifications() || window.Notification.permission !== 'granted') {
    return false;
  }

  // 1. Tenta via Service Worker (compatível com desktop e mobile Chrome/Android)
  try {
    const reg = await registerNotificationServiceWorker();
    if (reg && typeof reg.showNotification === 'function') {
      await reg.showNotification(title, {
        body,
        tag,
      });
      return true;
    }
  } catch {
    // fallback para construtor Notification abaixo
  }

  // 2. Fallback direto via construtor window.Notification
  try {
    new window.Notification(title, {
      body,
      tag,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Avalia cada alerta customizado cadastrado pelo usuário contra os dados reais da carteira
 * e da base verificada da B3, classificando explicitamente em ATINGIDO, ATIVO, PAUSADO ou ERRO.
 */
export function evaluateCustomAlerts(
  customAlerts: CustomPriceAlert[] = [],
  holdings: FIIHolding[] = []
): EvaluatedCustomAlert[] {
  return customAlerts.map((alert) => {
    const cleanTicker = (alert.ticker || '').toUpperCase().trim();
    const holding = holdings.find((h) => h.ticker.toUpperCase() === cleanTicker);
    const dbItem = VERIFIED_FII_DATABASE[cleanTicker];

    const fundName = holding?.name || dbItem?.name || cleanTicker || 'Ativo Desconhecido';
    const currentPrice = holding?.currentPrice ?? dbItem?.currentPrice ?? 0;
    const currentPvp = holding?.pvp ?? dbItem?.pvp ?? 0;
    const currentMonthlyDividend =
      holding?.monthlyYieldPerShare ?? dbItem?.lastDividend ?? 0;

    let currentReferenceValue = currentPrice;
    let isTriggered = false;
    let isError = false;
    let errorReason: string | undefined;
    let alertState: CustomAlertState = 'ATIVO';
    let statusLabel = 'Monitorando';
    let differenceSummary = '';

    // Validação de integridade e detecção de erro na regra cadastrada
    if (!cleanTicker || cleanTicker.length < 4) {
      isError = true;
      errorReason = 'Sigla (Ticker) inválida. Informe um código válido da B3 (ex: HGLG11).';
    } else if (
      typeof alert.thresholdValue !== 'number' ||
      isNaN(alert.thresholdValue) ||
      alert.thresholdValue <= 0
    ) {
      isError = true;
      errorReason = 'O valor-limite configurado deve ser maior que zero.';
    } else if (currentPrice <= 0 && !holding && !dbItem) {
      isError = true;
      errorReason = `O ticker ${cleanTicker} não possui cotação disponível na carteira nem na base da B3. Adicione o ativo na carteira ou revise a sigla.`;
    } else if (alert.type === 'PVP_MAXIMO' && (alert.thresholdValue < 0.1 || alert.thresholdValue > 5)) {
      isError = true;
      errorReason = `Múltiplo P/VP (${alert.thresholdValue.toFixed(2)}) fora da faixa válida (entre 0,10 e 5,00).`;
    }

    if (isError) {
      alertState = 'ERRO';
      statusLabel = 'Com Erro';
      differenceSummary = errorReason || 'Configuração inválida neste alerta.';
      if (alert.type === 'PVP_MAXIMO') currentReferenceValue = currentPvp;
      else if (alert.type === 'PROVENTO_MINIMO') currentReferenceValue = currentMonthlyDividend;
      else currentReferenceValue = currentPrice;
    } else if (alert.type === 'PRECO_TETO') {
      currentReferenceValue = currentPrice;
      if (currentPrice > 0 && currentPrice <= alert.thresholdValue) {
        isTriggered = true;
        const diff = alert.thresholdValue - currentPrice;
        statusLabel = 'Preço-Teto Atingido';
        differenceSummary = `Cotação atual (${formatBRL(currentPrice)}) está ${formatBRL(diff)} abaixo do seu teto (${formatBRL(alert.thresholdValue)}).`;
      } else {
        const pctAbove = ((currentPrice - alert.thresholdValue) / alert.thresholdValue) * 100;
        statusLabel = 'Monitorando (Acima do Teto)';
        differenceSummary = `Cotação (${formatBRL(currentPrice)}) está ${pctAbove.toFixed(1)}% acima do teto desejado (${formatBRL(alert.thresholdValue)}).`;
      }
    } else if (alert.type === 'PVP_MAXIMO') {
      currentReferenceValue = currentPvp;
      if (currentPvp > 0 && currentPvp <= alert.thresholdValue) {
        isTriggered = true;
        statusLabel = 'Desconto P/VP Atingido';
        differenceSummary = `P/VP atual (${currentPvp.toFixed(2)}) está dentro ou abaixo do limite de ${alert.thresholdValue.toFixed(2)}.`;
      } else {
        statusLabel = 'Monitorando (Acima do P/VP)';
        differenceSummary = `P/VP atual (${currentPvp.toFixed(2)}) acima do limite configurado de ${alert.thresholdValue.toFixed(2)}.`;
      }
    } else if (alert.type === 'PROVENTO_MINIMO') {
      currentReferenceValue = currentMonthlyDividend;
      if (currentMonthlyDividend >= alert.thresholdValue && alert.thresholdValue > 0) {
        isTriggered = true;
        statusLabel = 'Provento Alvo Atingido';
        differenceSummary = `Último provento (${formatBRL(currentMonthlyDividend)}/cota) atingiu ou superou o mínimo de ${formatBRL(alert.thresholdValue)}/cota.`;
      } else {
        statusLabel = 'Monitorando (Abaixo do Mínimo)';
        differenceSummary = `Último provento (${formatBRL(currentMonthlyDividend)}/cota) abaixo da meta de ${formatBRL(alert.thresholdValue)}/cota.`;
      }
    }

    if (!alert.isActive) {
      isTriggered = false;
      alertState = 'PAUSADO';
      statusLabel = 'Pausado';
    } else if (isError) {
      alertState = 'ERRO';
    } else if (isTriggered) {
      alertState = 'ATINGIDO';
    } else {
      alertState = 'ATIVO';
    }

    return {
      alert,
      fundName,
      currentPrice,
      currentPvp,
      currentMonthlyDividend,
      currentReferenceValue,
      isTriggered,
      isError,
      errorReason,
      alertState,
      statusLabel,
      differenceSummary,
      inPortfolio: Boolean(holding),
    };
  });
}

/**
 * Constrói a lista consolidada de notificações da plataforma:
 * - Avisos importantes (concentração acima do limite, dividend yield abaixo do mínimo, ou alertas com erro)
 * - Oportunidades (alertas de preço-teto, P/VP máximo e provento mínimo atingidos)
 * - Lembretes (proventos previstos a cair na conta, datas-com próximas)
 */
export function buildPlatformNotifications(params: {
  holdings: FIIHolding[];
  dividends: DividendEvent[];
  preferences: UserPreferences;
  readIds?: string[];
}): {
  all: PlatformNotification[];
  unread: PlatformNotification[];
  read: PlatformNotification[];
  evaluatedCustomAlerts: EvaluatedCustomAlert[];
} {
  const { holdings, dividends, preferences, readIds = [] } = params;
  const readSet = new Set(readIds);
  const notifications: PlatformNotification[] = [];

  // 1. Alertas Customizados Disparados ou Com Erro
  const evaluatedCustomAlerts = evaluateCustomAlerts(
    preferences.customAlerts || [],
    holdings
  );

  evaluatedCustomAlerts.forEach((ev) => {
    if (!ev.alert.isActive) return;

    if (ev.isError) {
      const errId = `custom_alert_err_${ev.alert.id}`;
      notifications.push({
        id: errId,
        category: 'importante',
        title: `Erro no Alerta de ${ev.alert.ticker || 'FII'}`,
        message: ev.errorReason || 'Revise os parâmetros cadastrados para este alerta.',
        detail: 'Acesse a aba Alertas para corrigir ou remover a regra com erro.',
        ticker: ev.alert.ticker,
        isRead: readSet.has(errId),
        priority: 1,
      });
      return;
    }

    if (!ev.isTriggered) return;

    const id = `custom_alert_${ev.alert.id}_${ev.alert.thresholdValue}`;
    const typeLabel =
      ev.alert.type === 'PRECO_TETO'
        ? 'Preço-Teto de Compra'
        : ev.alert.type === 'PVP_MAXIMO'
        ? 'Múltiplo P/VP Alvo'
        : 'Provento Mínimo por Cota';

    notifications.push({
      id,
      category: 'oportunidade',
      title: `${ev.alert.ticker}: ${ev.statusLabel}`,
      message: ev.differenceSummary,
      detail: `Regra ativa: ${typeLabel} (${
        ev.alert.type === 'PVP_MAXIMO'
          ? ev.alert.thresholdValue.toFixed(2)
          : formatBRL(ev.alert.thresholdValue)
      })`,
      ticker: ev.alert.ticker,
      isRead: readSet.has(id),
      priority: 2,
    });
  });

  // 2. Alertas Importantes de Risco: Concentração Patrimonial (Categoria: 'importante')
  const maxConc = preferences.maxConcentrationAlertPercent || 25;
  holdings.forEach((h) => {
    if (h.portfolioWeight > maxConc) {
      const id = `risk_conc_${h.ticker}_${maxConc}`;
      notifications.push({
        id,
        category: 'importante',
        title: `Concentração Elevada em ${h.ticker}`,
        message: `${h.ticker} representa ${h.portfolioWeight.toFixed(1)}% da carteira, acima do limite configurado de ${maxConc}%.`,
        detail: 'Direcione os próximos aportes para outros ativos para diluir o risco específico.',
        ticker: h.ticker,
        isRead: readSet.has(id),
        priority: 1,
      });
    }
  });

  // 3. Alertas Importantes de Rendimento: DY Anual abaixo do mínimo (Categoria: 'importante')
  const minYield = preferences.minYieldAlertPercent || 8.0;
  holdings.forEach((h) => {
    if (h.annualDividendYield > 0 && h.annualDividendYield < minYield) {
      const id = `risk_yield_${h.ticker}_${minYield}`;
      notifications.push({
        id,
        category: 'importante',
        title: `DY Abaixo da Meta em ${h.ticker}`,
        message: `O Dividend Yield anual de ${h.ticker} (${h.annualDividendYield.toFixed(2)}% a.a.) está abaixo do piso configurado de ${minYield.toFixed(1)}% a.a.`,
        detail: 'Avalie nos relatórios gerenciais se houve vacância pontual ou redução estrutural nos aluguéis.',
        ticker: h.ticker,
        isRead: readSet.has(id),
        priority: 1,
      });
    }
  });

  // 4. Lembretes de Proventos Previstos (Categoria: 'lembrete')
  dividends
    .filter((d) => d.status === 'PREVISTO')
    .forEach((d) => {
      const id = `div_pending_${d.id}`;
      notifications.push({
        id,
        category: 'lembrete',
        title: `Provento Agendado: ${d.ticker}`,
        message: `Recebimento previsto de ${formatBRL(d.totalAmount)} em ${formatDateBR(d.paymentDate)}.`,
        detail: `${d.quantityEligible} cotas elegíveis × ${formatBRL(d.ratePerShare)}/cota (Data-Com: ${formatDateBR(d.dataCom)}).`,
        ticker: d.ticker,
        dividendId: d.id,
        isRead: readSet.has(id),
        priority: 3,
      });
    });

  notifications.sort((a, b) => a.priority - b.priority);

  return {
    all: notifications,
    unread: notifications.filter((n) => !n.isRead),
    read: notifications.filter((n) => n.isRead),
    evaluatedCustomAlerts,
  };
}

export function loadReadNotificationIds(): string[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(READ_NOTIFICATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveReadNotificationIds(ids: string[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(READ_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(Array.from(new Set(ids))));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('edumods-notifications-updated'));
    }
  } catch {
    // ignore storage errors
  }
}

export function canUseBrowserNotifications(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function isRunningInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function isHttpsOrSecureContext(): boolean {
  if (typeof window === 'undefined') return true;
  if (typeof window.isSecureContext === 'boolean') {
    return window.isSecureContext;
  }
  const proto = window.location?.protocol || '';
  const host = window.location?.hostname || '';
  return proto === 'https:' || host === 'localhost' || host === '127.0.0.1';
}

export function getBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!canUseBrowserNotifications()) return 'unsupported';
  return window.Notification.permission;
}

/**
 * Diagnóstico completo e em tempo real do estado de notificações do navegador e do sistema.
 */
export function getNotificationSystemDiagnostics(): BrowserNotificationDiagnostics {
  const apiSupported = canUseBrowserNotifications();
  const isSecure = isHttpsOrSecureContext();
  const inIframe = isRunningInIframe();
  const permission = getBrowserNotificationPermission();
  const persisted = loadPersistedNotificationSettings();

  if (!isSecure) {
    return {
      apiSupported,
      isSecureContext: false,
      isEmbeddedIframe: inIframe,
      permission,
      inAppAlertsEnabled: persisted.inAppAlertsEnabled,
      activatedAt: persisted.activatedAt,
      statusCode: 'insecure_context',
      statusTitle: 'Conexão HTTP Não Segura Detectada (Requer HTTPS)',
      statusDescription:
        'Os navegadores exigem conexão criptografada (HTTPS ou localhost) para liberar notificações nativas da área de trabalho. Os alertas visuais dentro do sistema continuam funcionando.',
      instructions: [
        'Acesse o sistema utilizando o endereço com https:// (ex: https://edumods-fiis.vercel.app).',
        'Enquanto estiver em HTTP, todos os alertas aparecem no banner ao vivo do topo e na Central de Notificações.',
      ],
    };
  }

  if (!apiSupported) {
    return {
      apiSupported: false,
      isSecureContext: isSecure,
      isEmbeddedIframe: inIframe,
      permission: 'unsupported',
      inAppAlertsEnabled: persisted.inAppAlertsEnabled,
      activatedAt: persisted.activatedAt,
      statusCode: 'unsupported',
      statusTitle: 'Navegador sem Suporte à API Nativa de Notificações',
      statusDescription:
        'Seu navegador atual não possui suporte à Web Notifications API, mas os alertas em tempo real dentro da plataforma estão ativos.',
      instructions: [
        'Para receber avisos na área de trabalho, utilize Google Chrome, Microsoft Edge, Brave ou Firefox atualizados.',
        'No iPhone/iPad (iOS), adicione o site à Tela de Início para habilitar notificações Web Push.',
      ],
    };
  }

  if (permission === 'granted') {
    return {
      apiSupported: true,
      isSecureContext: true,
      isEmbeddedIframe: inIframe,
      permission: 'granted',
      inAppAlertsEnabled: true,
      activatedAt: persisted.activatedAt,
      statusCode: 'granted',
      statusTitle: 'Notificações Ativadas e Funcionando (Navegador + Painel)',
      statusDescription:
        'Permissão concedida! Você receberá avisos nativos do navegador e banners instantâneos sempre que uma condição programada for atingida.',
      instructions: [
        'Use o botão "Testar Envio de Notificação Real" para disparar um alerta de teste agora mesmo.',
      ],
    };
  }

  if (permission === 'denied') {
    return {
      apiSupported: true,
      isSecureContext: true,
      isEmbeddedIframe: inIframe,
      permission: 'denied',
      inAppAlertsEnabled: persisted.inAppAlertsEnabled,
      activatedAt: persisted.activatedAt,
      statusCode: 'denied',
      statusTitle: 'Permissão Bloqueada nas Configurações do Navegador',
      statusDescription:
        'O navegador bloqueou o envio de pop-ups nativos para este site, mas os alertas internos em tempo real da plataforma já foram ativados para você não perder nenhum gatilho.',
      instructions: [
        '1. Clique no ícone de cadeado ou controles do site ao lado da barra de endereço (URL) do seu navegador.',
        '2. Localize a opção "Notificações" e altere de "Bloquear" para "Permitir".',
        '3. Recarregue a página e clique novamente em "Ativar notificações".',
      ],
    };
  }

  if (inIframe && persisted.inAppAlertsEnabled) {
    return {
      apiSupported: true,
      isSecureContext: true,
      isEmbeddedIframe: true,
      permission: 'default',
      inAppAlertsEnabled: true,
      activatedAt: persisted.activatedAt,
      statusCode: 'iframe_restricted',
      statusTitle: 'Alertas Instantâneos Ativados (Janela Incorporada Detectada)',
      statusDescription:
        'Os alertas em tempo real da plataforma estão ATIVOS! Como o site está aberto dentro de um quadro incorporado (iframe), o navegador restringe pop-ups externos até que você abra o endereço diretamente em uma nova guia.',
      instructions: [
        'Os avisos sonoros/visuais no topo da tela e no sino de notificações já estão funcionando normalmente.',
        'Para autorizar também os pop-ups da área de trabalho do sistema operacional, abra o aplicativo em uma guia direta do navegador.',
      ],
    };
  }

  return {
    apiSupported: true,
    isSecureContext: true,
    isEmbeddedIframe: inIframe,
    permission: 'default',
    inAppAlertsEnabled: persisted.inAppAlertsEnabled,
    activatedAt: persisted.activatedAt,
    statusCode: 'default',
    statusTitle: persisted.inAppAlertsEnabled
      ? 'Alertas Internos Ativos · Permissão do Navegador Pendente'
      : 'Notificações do Navegador Desativadas (Aguardando Permissão)',
    statusDescription:
      'Clique em "Ativar notificações" para autorizar o envio de alertas no seu navegador e ativar os avisos instantâneos na tela.',
    instructions: [
      'Ao clicar em "Ativar notificações", confirme em "Permitir" na janela solicitada pelo seu navegador.',
    ],
  };
}

/**
 * Solicita a permissão real do navegador (compatível com Promise e callback legado),
 * ativa o sistema de alertas instantâneos, persiste a preferência e envia uma notificação real de confirmação.
 */
export async function requestBrowserNotificationPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  if (!canUseBrowserNotifications()) {
    savePersistedNotificationSettings({
      inAppAlertsEnabled: true,
      activatedAt: new Date().toISOString(),
    });
    return 'unsupported';
  }

  try {
    let result: NotificationPermission = window.Notification.permission;

    if (typeof window.Notification.requestPermission === 'function') {
      const maybePromise = window.Notification.requestPermission((cbPerm) => {
        if (cbPerm) result = cbPerm;
      });
      if (maybePromise && typeof maybePromise.then === 'function') {
        result = await maybePromise;
      }
    }

    savePersistedNotificationSettings({
      inAppAlertsEnabled: true,
      lastKnownPermission: result,
      activatedAt: new Date().toISOString(),
    });

    if (result === 'granted') {
      await registerNotificationServiceWorker();
    }

    return result;
  } catch {
    const fallbackPerm = window.Notification.permission;
    savePersistedNotificationSettings({
      inAppAlertsEnabled: true,
      lastKnownPermission: fallbackPerm,
      activatedAt: new Date().toISOString(),
    });
    return fallbackPerm;
  }
}

/**
 * Fluxo completo acionado ao clicar no botão "Ativar notificações":
 * 1. Verifica HTTPS e suporte da API.
 * 2. Solicita permissão ao navegador.
 * 3. Persiste o estado ativado para lembrar ao reabrir o site.
 * 4. Dispara notificação real de confirmação (nativa + toast no painel) e registra no histórico.
 * 5. Retorna diagnóstico detalhado para feedback imediato na interface.
 */
export async function activateNotificationsWithFeedback(): Promise<BrowserNotificationDiagnostics> {
  const perm = await requestBrowserNotificationPermission();
  const diagnostics = getNotificationSystemDiagnostics();

  if (perm === 'granted') {
    const title = 'EDUMODS FIIs — Notificações Ativadas!';
    const body =
      'Perfeito! Seus alertas de Preço-Teto, P/VP, Proventos e Risco estão sendo monitorados em tempo real.';
    await deliverNativeNotification(title, body, `edumods_activated_${Date.now()}`);
    emitInAppToast({
      title,
      message: body,
      category: 'oportunidade',
    });
    appendNotificationHistory({
      notificationId: `activation_${Date.now()}`,
      title,
      message: body,
      category: 'teste',
      channel: 'navegador_nativo',
    });
  } else {
    // Mesmo se o navegador bloquear ou estiver em iframe, ativa os alertas visuais na tela e confirma imediatamente
    const title =
      perm === 'denied'
        ? 'Alertas no Painel Ativados (Permissão Nativa Bloqueada)'
        : diagnostics.isEmbeddedIframe
        ? 'Alertas em Tempo Real Ativados no Painel!'
        : 'Monitoramento de Alertas Ativado!';
    const body =
      perm === 'denied'
        ? 'Os avisos na tela foram ativados! Para liberar também pop-ups do navegador, siga as instruções exibidas no painel.'
        : 'Você receberá avisos visuais imediatos no topo da tela sempre que um alerta programado for atingido.';
    emitInAppToast({
      title,
      message: body,
      category: perm === 'denied' ? 'importante' : 'oportunidade',
    });
    appendNotificationHistory({
      notificationId: `activation_panel_${Date.now()}`,
      title,
      message: body,
      category: 'teste',
      channel: 'sistema_painel',
    });
  }

  return diagnostics;
}

/**
 * Envia uma notificação de teste real (no navegador se permitido + banner toast ao vivo + registro no histórico).
 */
export async function sendRealTestNotification(params: {
  activeCount: number;
  triggeredCount: number;
  sampleTicker?: string;
}): Promise<{
  deliveredNative: boolean;
  diagnostics: BrowserNotificationDiagnostics;
  message: string;
}> {
  const { activeCount, triggeredCount, sampleTicker } = params;
  savePersistedNotificationSettings({
    inAppAlertsEnabled: true,
    activatedAt: loadPersistedNotificationSettings().activatedAt || new Date().toISOString(),
  });

  const title = `Teste Real de Alerta — EDUMODS FIIs`;
  const body =
    triggeredCount > 0
      ? `Monitoramento ativo: ${triggeredCount} de ${activeCount} alerta(s) já atingiram a meta${
          sampleTicker ? ` (incluindo ${sampleTicker})` : ''
        }!`
      : `Monitoramento confirmado: ${activeCount} alerta(s) ativo(s) sendo vigiados em tempo real.`;

  const deliveredNative = await deliverNativeNotification(
    title,
    body,
    `edumods_test_${Date.now()}`
  );

  emitInAppToast({
    title,
    message: body,
    category: 'teste',
  });

  appendNotificationHistory({
    notificationId: `manual_test_${Date.now()}`,
    title,
    message: body,
    category: 'teste',
    ticker: sampleTicker,
    channel: deliveredNative ? 'navegador_nativo' : 'sistema_painel',
  });

  const diagnostics = getNotificationSystemDiagnostics();
  const feedbackMessage = deliveredNative
    ? 'Notificação real enviada com sucesso para o seu navegador e registrada no Histórico de Disparos!'
    : 'Notificação de teste disparada no painel em tempo real e gravada no Histórico de Disparos!';

  return {
    deliveredNative,
    diagnostics,
    message: feedbackMessage,
  };
}

/**
 * Dispara notificações para todos os alertas importantes/oportunidades atingidos,
 * evitando duplicações (mesmo ID de alerta + meta não dispara duas vezes) e gravando no histórico.
 */
export function dispatchBrowserNotificationsForTriggeredAlerts(
  notifications: PlatformNotification[]
): number {
  let alreadyNotified: string[] = [];
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(NOTIFIED_BROWSER_IDS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) alreadyNotified = parsed;
      }
    }
  } catch {
    alreadyNotified = [];
  }

  const notifiedSet = new Set(alreadyNotified);
  const canSendNative =
    canUseBrowserNotifications() && window.Notification.permission === 'granted';
  const settings = loadPersistedNotificationSettings();

  let sentCount = 0;

  notifications
    .filter((n) => !n.isRead && (n.category === 'importante' || n.category === 'oportunidade'))
    .forEach((n) => {
      if (notifiedSet.has(n.id)) return;

      notifiedSet.add(n.id);
      sentCount += 1;

      if (canSendNative) {
        void deliverNativeNotification(`EDUMODS FIIs — ${n.title}`, n.message, n.id);
      }

      if (settings.inAppAlertsEnabled) {
        emitInAppToast({
          title: n.title,
          message: n.message,
          category: n.category,
        });
      }

      appendNotificationHistory({
        notificationId: n.id,
        title: n.title,
        message: n.message,
        category: n.category,
        ticker: n.ticker,
        channel: canSendNative ? 'navegador_nativo' : 'sistema_painel',
      });
    });

  if (sentCount > 0) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(
          NOTIFIED_BROWSER_IDS_STORAGE_KEY,
          JSON.stringify(Array.from(notifiedSet))
        );
      }
    } catch {
      // ignore
    }
  }

  return sentCount;
}
