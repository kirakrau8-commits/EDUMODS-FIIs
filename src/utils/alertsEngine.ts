import {
  CustomPriceAlert,
  DividendEvent,
  FIIHolding,
  PortfolioGoals,
  UserPreferences,
} from '../types/fii';
import { VERIFIED_FII_DATABASE } from '../data/fiiDatabase';
import { formatBRL, formatDateBR } from './formatters';

export type NotificationCategory = 'importante' | 'oportunidade' | 'lembrete';
export type CustomAlertState = 'ATINGIDO' | 'ATIVO' | 'PAUSADO' | 'ERRO';
export type NotificationChannel =
  | 'web_push_background'
  | 'service_worker_nativo'
  | 'navegador_nativo'
  | 'sistema_painel';

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
  quoteSource?: string;
  quoteUpdatedAt?: string;
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
  priority: number; // 1 = importante, 2 = oportunidade, 3 = lembrete
  alertSubType?:
    | 'PRECO_TETO'
    | 'PVP_MAXIMO'
    | 'PROVENTO_MINIMO'
    | 'PRECO_COMPRA'
    | 'ABAIXO_PM'
    | 'CONCENTRACAO'
    | 'DY_ABAIXO_META'
    | 'NOVO_PROVENTO'
    | 'DATA_COM_PROXIMA'
    | 'LEMBRETE_PAGAMENTO'
    | 'PAGAMENTO_HOJE'
    | 'PROVENTO_PREVISTO'
    | 'META_ATINGIDA'
    | 'ERRO_REGRA'
    | 'COTACAO_CONTINGENCIA';
}

export interface NotificationHistoryEntry {
  id: string;
  notificationId: string;
  timestamp: string;
  title: string;
  message: string;
  category: NotificationCategory | 'teste';
  ticker?: string;
  channel: NotificationChannel;
}

export interface PushSubscriptionDiagnostics {
  pushSupported: boolean;
  serviceWorkerActive: boolean;
  swVersion?: string;
  isSubscribed: boolean;
  endpointMasked: string | null;
  subscribedAt: string | null;
  serverPersisted: boolean;
  vapidConfiguredFromEnv: boolean;
  lastPushError: string | null;
}

export interface ServerMonitoringDiagnostics {
  lastMonitorRunAt: string | null;
  lastQuoteUpdateAt: string | null;
  quoteSource: string;
  isFallbackData: boolean;
  evaluatedCount: number;
  triggeredCount: number;
  pushedCount: number;
  activeSubscriptionsCount: number;
  lastStatus: 'ok' | 'warning' | 'error' | 'idle';
  lastError: string | null;
}

export interface BrowserNotificationDiagnostics {
  apiSupported: boolean;
  serviceWorkerSupported: boolean;
  pushManagerSupported: boolean;
  isSecureContext: boolean;
  isEmbeddedIframe: boolean;
  permission: NotificationPermission | 'unsupported';
  inAppAlertsEnabled: boolean;
  activatedAt: string | null;
  statusCode:
    | 'granted'
    | 'denied'
    | 'iframe_restricted'
    | 'insecure_context'
    | 'unsupported'
    | 'default';
  statusTitle: string;
  statusDescription: string;
  instructions: string[];
  push: PushSubscriptionDiagnostics;
  monitoring: ServerMonitoringDiagnostics;
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
const PUSH_DIAG_STORAGE_KEY = 'edumods_fii_personal_v1_push_diagnostics';
const MONITOR_DIAG_STORAGE_KEY = 'edumods_fii_personal_v1_monitor_diagnostics';

interface PersistedNotificationSettings {
  inAppAlertsEnabled: boolean;
  lastKnownPermission: NotificationPermission | 'unsupported';
  activatedAt: string | null;
}

/**
 * Converte uma chave pública VAPID Base64 URL-safe para Uint8Array exigido pelo PushManager.subscribe()
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData =
    typeof window !== 'undefined' && typeof window.atob === 'function'
      ? window.atob(base64)
      : Buffer.from(base64, 'base64').toString('binary');
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function maskPushEndpoint(endpoint?: string | null): string | null {
  if (!endpoint || typeof endpoint !== 'string') return null;
  try {
    const u = new URL(endpoint);
    const pathParts = u.pathname.split('/').filter(Boolean);
    const tail = pathParts[pathParts.length - 1] || '';
    const shortTail =
      tail.length > 12 ? `${tail.slice(0, 6)}...${tail.slice(-6)}` : tail;
    return `${u.origin}/.../${shortTail}`;
  } catch {
    return endpoint.length > 24
      ? `${endpoint.slice(0, 16)}...${endpoint.slice(-8)}`
      : endpoint;
  }
}

export function loadPushDiagnostics(): PushSubscriptionDiagnostics {
  const swSupported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  const pushSupported = typeof window !== 'undefined' && 'PushManager' in window;
  const fallback: PushSubscriptionDiagnostics = {
    pushSupported,
    serviceWorkerActive: Boolean(
      swSupported && navigator.serviceWorker && navigator.serviceWorker.controller
    ),
    isSubscribed: false,
    endpointMasked: null,
    subscribedAt: null,
    serverPersisted: false,
    vapidConfiguredFromEnv: false,
    lastPushError: null,
  };
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(PUSH_DIAG_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      ...fallback,
      ...parsed,
      pushSupported,
    };
  } catch {
    return fallback;
  }
}

export function savePushDiagnostics(
  partial: Partial<PushSubscriptionDiagnostics>
): PushSubscriptionDiagnostics {
  const current = loadPushDiagnostics();
  const next: PushSubscriptionDiagnostics = {
    ...current,
    ...partial,
  };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PUSH_DIAG_STORAGE_KEY, JSON.stringify(next));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('edumods-notifications-updated'));
    }
  } catch {
    // ignore
  }
  return next;
}

export function loadMonitoringDiagnostics(): ServerMonitoringDiagnostics {
  const fallback: ServerMonitoringDiagnostics = {
    lastMonitorRunAt: null,
    lastQuoteUpdateAt: null,
    quoteSource: 'Aguardando 1º ciclo',
    isFallbackData: false,
    evaluatedCount: 0,
    triggeredCount: 0,
    pushedCount: 0,
    activeSubscriptionsCount: 0,
    lastStatus: 'idle',
    lastError: null,
  };
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(MONITOR_DIAG_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      ...fallback,
      ...parsed,
    };
  } catch {
    return fallback;
  }
}

export function saveMonitoringDiagnostics(
  partial: Partial<ServerMonitoringDiagnostics>
): ServerMonitoringDiagnostics {
  const current = loadMonitoringDiagnostics();
  const next: ServerMonitoringDiagnostics = {
    ...current,
    ...partial,
  };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MONITOR_DIAG_STORAGE_KEY, JSON.stringify(next));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('edumods-notifications-updated'));
    }
  } catch {
    // ignore
  }
  return next;
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
  // Evita duplicar exatamente o mesmo notificationId se não for um teste manual
  if (
    entry.category !== 'teste' &&
    current.some((item) => item.notificationId === entry.notificationId)
  ) {
    return current;
  }

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
  const next = [newItem, ...current].slice(0, 100);
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

export function mergeServerNotificationHistory(
  serverLogs: Array<{
    notificationId: string;
    timestamp: string;
    title: string;
    message: string;
    category: NotificationCategory | 'teste';
    ticker?: string;
    channel?: NotificationChannel;
  }>
): NotificationHistoryEntry[] {
  if (!Array.isArray(serverLogs) || serverLogs.length === 0) {
    return loadNotificationHistory();
  }
  const current = loadNotificationHistory();
  const existingIds = new Set(current.map((c) => c.notificationId));
  let added = false;

  for (const log of serverLogs) {
    if (!log.notificationId || existingIds.has(log.notificationId)) continue;
    existingIds.add(log.notificationId);
    added = true;
    current.push({
      id: `srv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      notificationId: log.notificationId,
      timestamp: log.timestamp || new Date().toISOString(),
      title: log.title,
      message: log.message,
      category: log.category || 'oportunidade',
      ticker: log.ticker,
      channel: log.channel || 'web_push_background',
    });
  }

  if (added) {
    current.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    const trimmed = current.slice(0, 100);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(NOTIFICATION_HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('edumods-notifications-updated'));
      }
    } catch {
      // ignore
    }
    return trimmed;
  }

  return current;
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

let swListenerAttached = false;

/**
 * Registra e aguarda a ativação real do Service Worker (/sw.js),
 * conectando também o listener para receber eventos PUSH_DELIVERED em tempo real.
 */
export async function registerNotificationServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    if (!swListenerAttached) {
      swListenerAttached = true;
      navigator.serviceWorker.addEventListener('message', (event) => {
        const data = event.data;
        if (data && data.type === 'PUSH_DELIVERED' && data.payload) {
          appendNotificationHistory({
            notificationId: data.payload.notificationId || `push_${Date.now()}`,
            title: data.payload.title || 'EDUMODS FIIs',
            message: data.payload.message || '',
            category: data.payload.category || 'oportunidade',
            ticker: data.payload.ticker || undefined,
            channel: 'web_push_background',
            timestamp: data.payload.timestamp,
          });
        }
      });
    }

    let reg = await navigator.serviceWorker.getRegistration('/');
    if (!reg) {
      reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    } else {
      void reg.update().catch(() => {});
    }

    // Aguarda Service Worker ficar ativo (necessário no Android para showNotification e PushManager)
    const readyPromise = navigator.serviceWorker.ready;
    const timeoutPromise = new Promise<ServiceWorkerRegistration | null>((resolve) =>
      setTimeout(() => resolve(reg || null), 3500)
    );
    const activeReg = (await Promise.race([readyPromise, timeoutPromise])) || reg;

    if (activeReg && activeReg.active) {
      savePushDiagnostics({
        serviceWorkerActive: true,
        swVersion: '2.0.0',
      });
    }

    return activeReg || null;
  } catch (err) {
    savePushDiagnostics({
      serviceWorkerActive: false,
      lastPushError: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Entrega uma notificação nativa REAL na central de notificações do Android / Sistema Operacional
 * usando prioritariamente ServiceWorkerRegistration.showNotification().
 * NUNCA retorna delivered=true se a chamada nativa falhar ou não for permitida.
 */
export async function deliverNativeNotificationWithDiagnostics(
  title: string,
  body: string,
  tag: string,
  extra?: { category?: string; ticker?: string; requireInteraction?: boolean }
): Promise<{
  delivered: boolean;
  channel: 'service_worker_nativo' | 'navegador_nativo' | 'none';
  error?: string;
}> {
  if (!isHttpsOrSecureContext()) {
    return {
      delivered: false,
      channel: 'none',
      error:
        'Conexão não segura (HTTP). O Android e os navegadores exigem HTTPS para exibir notificações nativas.',
    };
  }

  if (!canUseBrowserNotifications()) {
    return {
      delivered: false,
      channel: 'none',
      error: 'Este navegador não suporta a API de Notificações Nativas (Web Notifications API).',
    };
  }

  const currentPerm = window.Notification.permission;
  if (currentPerm !== 'granted') {
    return {
      delivered: false,
      channel: 'none',
      error:
        currentPerm === 'denied'
          ? 'Permissão de notificações está BLOQUEADA nas configurações do navegador/Android. Clique no cadeado ao lado da URL -> Permissões -> Notificações -> Permitir.'
          : isRunningInIframe()
          ? 'A permissão nativa não pôde ser concedida porque o site está dentro de um quadro (iframe). Abra o endereço diretamente no navegador do Android para liberar notificações nativas.'
          : 'Permissão de notificações ainda não foi concedida. Clique em "Ativar notificações" e confirme em "Permitir".',
    };
  }

  let swErrorDetail = '';

  // 1. Método Oficial Android & PWA: ServiceWorkerRegistration.showNotification()
  try {
    const reg = await registerNotificationServiceWorker();
    if (reg && typeof reg.showNotification === 'function') {
      await reg.showNotification(title, {
        body,
        tag,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        vibrate: [200, 100, 200],
        renotify: true,
        requireInteraction: Boolean(extra?.requireInteraction),
        data: {
          url: '/',
          category: extra?.category || 'oportunidade',
          ticker: extra?.ticker || null,
          notificationId: tag,
          receivedAt: new Date().toISOString(),
        },
      } as NotificationOptions);

      return {
        delivered: true,
        channel: 'service_worker_nativo',
      };
    } else {
      swErrorDetail = 'Service Worker ainda não está ativo para chamar showNotification.';
    }
  } catch (err) {
    swErrorDetail = err instanceof Error ? err.message : String(err);
  }

  // 2. Fallback para Desktop (em Android Chrome new Notification() lança TypeError e exige SW)
  try {
    const n = new window.Notification(title, {
      body,
      tag,
      icon: '/pwa-192x192.png',
    });
    if (n) {
      return {
        delivered: true,
        channel: 'navegador_nativo',
      };
    }
  } catch (fallbackErr) {
    const fbMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
    return {
      delivered: false,
      channel: 'none',
      error: swErrorDetail
        ? `Falha no Service Worker (${swErrorDetail}) e no construtor Notification (${fbMsg}).`
        : `Falha ao exibir notificação nativa: ${fbMsg}`,
    };
  }

  return {
    delivered: false,
    channel: 'none',
    error: swErrorDetail || 'Não foi possível entregar a notificação nativa ao sistema operacional.',
  };
}

/**
 * Cria ou renova a inscrição Web Push (PushManager.subscribe) com chave VAPID do servidor
 * e salva a inscrição com segurança no backend (/api/push/subscribe -> Supabase).
 */
export async function subscribeDeviceToWebPush(portfolioState?: {
  userId?: string;
  holdings?: FIIHolding[];
  dividends?: DividendEvent[];
  preferences?: UserPreferences;
  goals?: PortfolioGoals;
}): Promise<{
  success: boolean;
  isSubscribed: boolean;
  endpointMasked: string | null;
  serverPersisted: boolean;
  vapidConfiguredFromEnv: boolean;
  error?: string;
}> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    const err = 'Este navegador não possui suporte a Web Push em segundo plano (PushManager ausente).';
    savePushDiagnostics({
      pushSupported: false,
      isSubscribed: false,
      lastPushError: err,
    });
    return {
      success: false,
      isSubscribed: false,
      endpointMasked: null,
      serverPersisted: false,
      vapidConfiguredFromEnv: false,
      error: err,
    };
  }

  if (window.Notification.permission !== 'granted') {
    const err = 'A permissão de notificações precisa estar CONCEDIDA antes de criar a inscrição Push.';
    savePushDiagnostics({
      isSubscribed: false,
      lastPushError: err,
    });
    return {
      success: false,
      isSubscribed: false,
      endpointMasked: null,
      serverPersisted: false,
      vapidConfiguredFromEnv: false,
      error: err,
    };
  }

  try {
    const reg = await registerNotificationServiceWorker();
    if (!reg || !reg.pushManager) {
      throw new Error('Service Worker ou PushManager não pôde ser inicializado.');
    }

    // 1. Busca a chave pública VAPID do servidor
    const keyRes = await fetch('/api/push/vapid-public-key');
    if (!keyRes.ok) {
      throw new Error(`Servidor Push retornou HTTP ${keyRes.status} ao buscar chave VAPID.`);
    }
    const keyData = await keyRes.json();
    const publicKey: string = keyData.publicKey;
    const vapidConfiguredFromEnv = Boolean(keyData.vapidConfiguredFromEnv);

    if (!publicKey) {
      throw new Error('Chave pública VAPID não disponível no servidor.');
    }

    const applicationServerKey = urlBase64ToUint8Array(publicKey);

    // 2. Verifica inscrição existente ou cria uma nova com PushManager.subscribe()
    let subscription = await reg.pushManager.getSubscription();

    if (subscription && subscription.options?.applicationServerKey) {
      const existingKey = new Uint8Array(subscription.options.applicationServerKey);
      const keysMatch =
        existingKey.length === applicationServerKey.length &&
        existingKey.every((val, idx) => val === applicationServerKey[idx]);
      if (!keysMatch) {
        // Chave VAPID mudou: remove inscrição antiga para renovar limpa
        await subscription.unsubscribe();
        subscription = null;
      }
    }

    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      });
    }

    const subJson = subscription.toJSON();
    const masked = maskPushEndpoint(subJson.endpoint);

    // 3. Salva a inscrição e suas chaves no servidor/Supabase
    const saveRes = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subJson,
        userAgent: navigator.userAgent,
        portfolioState,
      }),
    });

    const saveData = await saveRes.json().catch(() => ({}));
    if (!saveRes.ok || !saveData.success) {
      throw new Error(saveData.error || `Erro ao salvar inscrição Push no servidor (HTTP ${saveRes.status}).`);
    }

    const nowIso = new Date().toISOString();
    savePushDiagnostics({
      pushSupported: true,
      serviceWorkerActive: true,
      isSubscribed: true,
      endpointMasked: masked,
      subscribedAt: nowIso,
      serverPersisted: Boolean(saveData.supabasePersisted || saveData.serverPersisted),
      vapidConfiguredFromEnv,
      lastPushError: null,
    });

    if (saveData.monitoringState) {
      saveMonitoringDiagnostics(saveData.monitoringState);
    }

    return {
      success: true,
      isSubscribed: true,
      endpointMasked: masked,
      serverPersisted: Boolean(saveData.supabasePersisted || saveData.serverPersisted),
      vapidConfiguredFromEnv,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    savePushDiagnostics({
      isSubscribed: false,
      lastPushError: errMsg,
    });
    return {
      success: false,
      isSubscribed: false,
      endpointMasked: null,
      serverPersisted: false,
      vapidConfiguredFromEnv: false,
      error: errMsg,
    };
  }
}

/**
 * Sincroniza o estado atual da carteira/alertas com o serviço de monitoramento no servidor
 * e obtém o diagnóstico mais recente do último monitoramento e histórico disparado em segundo plano.
 */
export async function syncPortfolioWithServerMonitor(params: {
  userId: string;
  holdings: FIIHolding[];
  dividends: DividendEvent[];
  preferences: UserPreferences;
  goals?: PortfolioGoals;
  runMonitorNow?: boolean;
}): Promise<ServerMonitoringDiagnostics | null> {
  if (typeof window === 'undefined') return null;
  try {
    const endpoint = params.runMonitorNow ? '/api/cron/monitor' : '/api/monitor/status';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.monitoringState) {
      saveMonitoringDiagnostics(data.monitoringState);
    }
    if (Array.isArray(data.recentLogs) && data.recentLogs.length > 0) {
      mergeServerNotificationHistory(data.recentLogs);
    }
    if (typeof data.vapidConfiguredFromEnv === 'boolean') {
      savePushDiagnostics({ vapidConfiguredFromEnv: data.vapidConfiguredFromEnv });
    }
    return data.monitoringState || null;
  } catch {
    return null;
  }
}

/**
 * Calcula diferença em dias inteiros entre duas datas YYYY-MM-DD (positivo se targetDate for no futuro)
 */
export function diffDaysISO(referenceDateISO: string, targetDateISO: string): number {
  const refClean = (referenceDateISO || '').slice(0, 10);
  const tgtClean = (targetDateISO || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(refClean) || !/^\d{4}-\d{2}-\d{2}$/.test(tgtClean)) {
    return 999;
  }
  const refMs = Date.parse(`${refClean}T00:00:00Z`);
  const tgtMs = Date.parse(`${tgtClean}T00:00:00Z`);
  return Math.round((tgtMs - refMs) / (1000 * 60 * 60 * 24));
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
    } else if (alert.type === 'PRECO_TETO' || alert.type === 'PRECO_COMPRA') {
      currentReferenceValue = currentPrice;
      const ruleName = alert.type === 'PRECO_COMPRA' ? 'Preço de Compra' : 'Preço-Teto';
      if (currentPrice > 0 && currentPrice <= alert.thresholdValue) {
        isTriggered = true;
        const diff = alert.thresholdValue - currentPrice;
        statusLabel = `${ruleName} Atingido`;
        differenceSummary = `Cotação atual (${formatBRL(currentPrice)}) está ${formatBRL(diff)} abaixo do seu limite (${formatBRL(alert.thresholdValue)}).`;
      } else {
        const pctAbove = ((currentPrice - alert.thresholdValue) / alert.thresholdValue) * 100;
        statusLabel = 'Monitorando (Acima do Teto)';
        differenceSummary = `Cotação (${formatBRL(currentPrice)}) está ${pctAbove.toFixed(1)}% acima do valor desejado (${formatBRL(alert.thresholdValue)}).`;
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
      quoteSource: holding?.quoteSource || 'B3 Oficial',
      quoteUpdatedAt: holding?.lastQuoteUpdate || 'Tempo Real',
    };
  });
}

/**
 * Constrói a lista consolidada de todas as notificações e regras de monitoramento:
 * - Oportunidades: Preço-teto, P/VP máximo, Provento mínimo, Preço de compra abaixo do PM, Metas atingidas
 * - Avisos importantes: Concentração excessiva, Dividend Yield abaixo da meta, Erros de regra, Contingência de cotação
 * - Lembretes: Novos proventos anunciados, Data-com próxima, Lembretes antes da data de pagamento, Pagamentos hoje e Proventos previstos
 */
export function buildPlatformNotifications(params: {
  holdings: FIIHolding[];
  dividends: DividendEvent[];
  preferences: UserPreferences;
  goals?: PortfolioGoals;
  readIds?: string[];
  referenceDateISO?: string;
  announcedDividends?: Array<{
    ticker: string;
    ratePerShare: number;
    paymentDate: string;
    dataCom?: string;
  }>;
  isFallbackQuoteData?: boolean;
}): {
  all: PlatformNotification[];
  unread: PlatformNotification[];
  read: PlatformNotification[];
  evaluatedCustomAlerts: EvaluatedCustomAlert[];
} {
  const {
    holdings,
    dividends,
    preferences,
    goals,
    readIds = [],
    referenceDateISO = new Date().toISOString().slice(0, 10),
    announcedDividends = [],
    isFallbackQuoteData = false,
  } = params;
  const readSet = new Set(readIds);
  const notifications: PlatformNotification[] = [];

  // 1. Alertas Customizados Disparados ou Com Erro (Preço-teto, P/VP máximo, Provento mínimo, Preço de compra)
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
        alertSubType: 'ERRO_REGRA',
      });
      return;
    }

    if (!ev.isTriggered) return;

    const id = `custom_alert_${ev.alert.id}_${ev.alert.thresholdValue}`;
    const typeLabel =
      ev.alert.type === 'PRECO_TETO'
        ? 'Preço-Teto de Compra'
        : ev.alert.type === 'PRECO_COMPRA'
        ? 'Preço Alvo de Compra'
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
      }) · Fonte: ${ev.quoteSource || 'B3'}`,
      ticker: ev.alert.ticker,
      isRead: readSet.has(id),
      priority: 2,
      alertSubType: ev.alert.type,
    });
  });

  // 2. Concentração Excessiva na Carteira (Categoria: 'importante')
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
        alertSubType: 'CONCENTRACAO',
      });
    }
  });

  // 3. Dividend Yield Abaixo da Meta (Categoria: 'importante')
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
        alertSubType: 'DY_ABAIXO_META',
      });
    }
  });

  // 4. Metas Financeiras Atingidas (Renda Mensal ou Patrimônio Alvo)
  if (goals && holdings.length > 0) {
    const totalEquity = holdings.reduce((acc, h) => acc + h.marketValue, 0);
    const estMonthlyIncome = holdings.reduce(
      (acc, h) => acc + h.quantity * (h.monthlyYieldPerShare || 0),
      0
    );

    if (goals.totalEquityGoal > 0 && totalEquity >= goals.totalEquityGoal) {
      const id = `goal_equity_${goals.totalEquityGoal}`;
      notifications.push({
        id,
        category: 'oportunidade',
        title: 'Meta de Patrimônio Atingida!',
        message: `Sua carteira alcançou ${formatBRL(totalEquity)}, superando a meta configurada de ${formatBRL(goals.totalEquityGoal)}.`,
        detail: 'Acesse a aba Metas & FIRE para revisar seu próximo marco patrimonial.',
        isRead: readSet.has(id),
        priority: 2,
        alertSubType: 'META_ATINGIDA',
      });
    }

    if (goals.monthlyIncomeGoal > 0 && estMonthlyIncome >= goals.monthlyIncomeGoal) {
      const id = `goal_income_${goals.monthlyIncomeGoal}`;
      notifications.push({
        id,
        category: 'oportunidade',
        title: 'Meta de Renda Passiva Mensal Atingida!',
        message: `Sua renda mensal estimada (${formatBRL(estMonthlyIncome)}/mês) atingiu a meta de ${formatBRL(goals.monthlyIncomeGoal)}/mês.`,
        detail: 'Parabéns pela consistência nos aportes e reinvestimento de dividendos!',
        isRead: readSet.has(id),
        priority: 2,
        alertSubType: 'META_ATINGIDA',
      });
    }
  }

  // 5. Novos Proventos Anunciados pelas Fontes de Mercado
  announcedDividends.forEach((ann) => {
    const cleanTicker = ann.ticker.toUpperCase().trim();
    const holding = holdings.find((h) => h.ticker.toUpperCase() === cleanTicker);
    if (!holding) return;
    const alreadyInDividends = dividends.some(
      (d) =>
        d.ticker.toUpperCase() === cleanTicker &&
        d.paymentDate === ann.paymentDate
    );
    if (alreadyInDividends) return;

    const totalExpected = holding.quantity * ann.ratePerShare;
    const id = `div_announced_${cleanTicker}_${ann.paymentDate}`;
    notifications.push({
      id,
      category: 'lembrete',
      title: `Novo Provento Anunciado: ${cleanTicker}`,
      message: `${cleanTicker} anunciou ${formatBRL(ann.ratePerShare)}/cota (Total estimado: ${formatBRL(totalExpected)}) para pagamento em ${formatDateBR(ann.paymentDate)}.`,
      detail: ann.dataCom
        ? `Data-Com: ${formatDateBR(ann.dataCom)} · ${holding.quantity} cotas na carteira.`
        : `${holding.quantity} cotas elegíveis na carteira.`,
      ticker: cleanTicker,
      isRead: readSet.has(id),
      priority: 2,
      alertSubType: 'NOVO_PROVENTO',
    });
  });

  // 6. Proventos Previstos, Data-Com Próxima e Lembretes Antes da Data de Pagamento
  dividends
    .filter((d) => d.status === 'PREVISTO')
    .forEach((d) => {
      const daysToPayment = diffDaysISO(referenceDateISO, d.paymentDate);
      const daysToDataCom = d.dataCom ? diffDaysISO(referenceDateISO, d.dataCom) : 999;

      // 6a. Data-Com Hoje ou Próxima (0 a 3 dias)
      if (daysToDataCom >= 0 && daysToDataCom <= 3) {
        const dcId = `div_datacom_${d.id}`;
        notifications.push({
          id: dcId,
          category: 'lembrete',
          title:
            daysToDataCom === 0
              ? `Data-Com Hoje: ${d.ticker}`
              : `Data-Com em ${daysToDataCom} dia(s): ${d.ticker}`,
          message: `Data-base para direito ao provento de ${formatBRL(d.ratePerShare)}/cota em ${formatDateBR(d.dataCom)}.`,
          detail: `Pagamento agendado para ${formatDateBR(d.paymentDate)} (${formatBRL(d.totalAmount)}).`,
          ticker: d.ticker,
          dividendId: d.id,
          isRead: readSet.has(dcId),
          priority: 2,
          alertSubType: 'DATA_COM_PROXIMA',
        });
      }

      // 6b. Lembrete de Pagamento (Hoje ou Faltando 1 a 5 dias, além do agendamento previsto)
      const id = `div_pending_${d.id}`;
      let title = `Provento Agendado: ${d.ticker}`;
      let message = `Recebimento previsto de ${formatBRL(d.totalAmount)} em ${formatDateBR(d.paymentDate)}.`;
      let subType: PlatformNotification['alertSubType'] = 'PROVENTO_PREVISTO';

      if (daysToPayment === 0) {
        title = `Pagamento de Provento Hoje: ${d.ticker}`;
        message = `Hoje cai na conta ${formatBRL(d.totalAmount)} de ${d.ticker} (${formatDateBR(d.paymentDate)})!`;
        subType = 'PAGAMENTO_HOJE';
      } else if (daysToPayment > 0 && daysToPayment <= 5) {
        title = `Lembrete de Pagamento (${daysToPayment}d): ${d.ticker}`;
        message = `Faltam ${daysToPayment} dia(s) para receber ${formatBRL(d.totalAmount)} de ${d.ticker} em ${formatDateBR(d.paymentDate)}.`;
        subType = 'LEMBRETE_PAGAMENTO';
      }

      notifications.push({
        id,
        category: 'lembrete',
        title,
        message,
        detail: `${d.quantityEligible} cotas elegíveis × ${formatBRL(d.ratePerShare)}/cota (Data-Com: ${formatDateBR(d.dataCom)}).`,
        ticker: d.ticker,
        dividendId: d.id,
        isRead: readSet.has(id),
        priority: daysToPayment >= 0 && daysToPayment <= 2 ? 2 : 3,
        alertSubType: subType,
      });
    });

  // 7. Aviso transparente caso cotações estejam em modo de contingência local
  if (isFallbackQuoteData) {
    const staleId = `quote_fallback_notice_${referenceDateISO}`;
    notifications.push({
      id: staleId,
      category: 'importante',
      title: 'Cotações em Modo de Contingência Local',
      message:
        'As fontes externas de cotação em tempo real não responderam no último ciclo; os alertas foram avaliados usando a última cotação salva.',
      detail: 'Configure seu token da BRAPI ou aguarde a reconexão automática do servidor.',
      isRead: readSet.has(staleId),
      priority: 3,
      alertSubType: 'COTACAO_CONTINGENCIA',
    });
  }

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
 * Diagnóstico completo e em tempo real do estado de notificações do Android/Navegador,
 * Service Worker, Inscrição Web Push e Monitoramento Automático no Servidor.
 */
export function getNotificationSystemDiagnostics(): BrowserNotificationDiagnostics {
  const apiSupported = canUseBrowserNotifications();
  const serviceWorkerSupported =
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  const pushManagerSupported = typeof window !== 'undefined' && 'PushManager' in window;
  const isSecure = isHttpsOrSecureContext();
  const inIframe = isRunningInIframe();
  const permission = getBrowserNotificationPermission();
  const persisted = loadPersistedNotificationSettings();
  const pushDiag = loadPushDiagnostics();
  const monitorDiag = loadMonitoringDiagnostics();

  if (!isSecure) {
    return {
      apiSupported,
      serviceWorkerSupported,
      pushManagerSupported,
      isSecureContext: false,
      isEmbeddedIframe: inIframe,
      permission,
      inAppAlertsEnabled: persisted.inAppAlertsEnabled,
      activatedAt: persisted.activatedAt,
      statusCode: 'insecure_context',
      statusTitle: 'Conexão HTTP Não Segura Detectada (Requer HTTPS)',
      statusDescription:
        'O Android e os navegadores exigem conexão HTTPS (ou localhost) para liberar Service Worker, Web Push e notificações nativas.',
      instructions: [
        'Acesse o sistema pelo endereço oficial HTTPS (ex: https://edumods-fiis.vercel.app).',
      ],
      push: pushDiag,
      monitoring: monitorDiag,
    };
  }

  if (!apiSupported) {
    return {
      apiSupported: false,
      serviceWorkerSupported,
      pushManagerSupported,
      isSecureContext: isSecure,
      isEmbeddedIframe: inIframe,
      permission: 'unsupported',
      inAppAlertsEnabled: persisted.inAppAlertsEnabled,
      activatedAt: persisted.activatedAt,
      statusCode: 'unsupported',
      statusTitle: 'Navegador sem Suporte à API Nativa de Notificações',
      statusDescription:
        'Seu navegador atual não possui suporte à Web Notifications API / Service Worker.',
      instructions: [
        'No celular Android, abra o site no Google Chrome atualizado.',
        'Toque no menu do Chrome (3 pontos) -> "Adicionar à tela inicial" / "Instalar aplicativo" para melhor entrega em segundo plano.',
      ],
      push: pushDiag,
      monitoring: monitorDiag,
    };
  }

  if (permission === 'granted') {
    const pushReady = pushDiag.isSubscribed;
    return {
      apiSupported: true,
      serviceWorkerSupported,
      pushManagerSupported,
      isSecureContext: true,
      isEmbeddedIframe: inIframe,
      permission: 'granted',
      inAppAlertsEnabled: true,
      activatedAt: persisted.activatedAt,
      statusCode: 'granted',
      statusTitle: pushReady
        ? 'Notificações Nativas & Web Push em Segundo Plano Ativos!'
        : 'Permissão Concedida (Service Worker Ativo · Sincronizando Push)',
      statusDescription: pushReady
        ? `Dispositivo inscrito no Web Push (${pushDiag.endpointMasked || 'Ativo'}). Você receberá notificações nativas na central do Android inclusive com o site fechado.`
        : 'Permissão nativa concedida! Clique em "Testar Notificação" ou "Ativar notificações" para validar o Service Worker e a inscrição Web Push no servidor.',
      instructions: [
        'Use o botão "Testar Notificação" para disparar um envio real via Service Worker + Web Push do servidor e confirmar na barra de status do Android.',
      ],
      push: pushDiag,
      monitoring: monitorDiag,
    };
  }

  if (permission === 'denied') {
    return {
      apiSupported: true,
      serviceWorkerSupported,
      pushManagerSupported,
      isSecureContext: true,
      isEmbeddedIframe: inIframe,
      permission: 'denied',
      inAppAlertsEnabled: persisted.inAppAlertsEnabled,
      activatedAt: persisted.activatedAt,
      statusCode: 'denied',
      statusTitle: 'Permissão Nativa Bloqueada nas Configurações do Android / Navegador',
      statusDescription:
        'O navegador bloqueou o envio de notificações nativas para este site. As notificações na barra do Android NÃO funcionarão até você liberar a permissão nas configurações do navegador.',
      instructions: [
        '1. No Chrome do Android, toque no ícone de cadeado/ajustes ao lado da barra de endereço (URL).',
        '2. Toque em "Permissões" -> "Notificações" e altere para "Permitir".',
        '3. Recarregue a página e clique em "Ativar notificações".',
      ],
      push: pushDiag,
      monitoring: monitorDiag,
    };
  }

  if (inIframe) {
    return {
      apiSupported: true,
      serviceWorkerSupported,
      pushManagerSupported,
      isSecureContext: true,
      isEmbeddedIframe: true,
      permission: 'default',
      inAppAlertsEnabled: persisted.inAppAlertsEnabled,
      activatedAt: persisted.activatedAt,
      statusCode: 'iframe_restricted',
      statusTitle: 'Janela Incorporada (Iframe) Detectada — Abra em Guia Direta para Push Nativo',
      statusDescription:
        'Navegadores bloqueiam o pedido de permissão nativa do sistema operacional e o Web Push dentro de quadros incorporados (iframes). Abra o endereço diretamente em uma nova guia ou no Chrome do celular Android.',
      instructions: [
        'Clique em "Abrir em Nova Guia Direta" ao lado ou acesse diretamente https://edumods-fiis.vercel.app no Chrome do Android.',
        'Em seguida, clique em "Ativar notificações" e confirme em "Permitir".',
      ],
      push: pushDiag,
      monitoring: monitorDiag,
    };
  }

  return {
    apiSupported: true,
    serviceWorkerSupported,
    pushManagerSupported,
    isSecureContext: true,
    isEmbeddedIframe: inIframe,
    permission: 'default',
    inAppAlertsEnabled: persisted.inAppAlertsEnabled,
    activatedAt: persisted.activatedAt,
    statusCode: 'default',
    statusTitle: 'Permissão Nativa do Android / Navegador Pendente',
    statusDescription:
      'Clique em "Ativar notificações" e selecione "Permitir" na janela do navegador para registrar o Service Worker e ativar o Web Push em segundo plano.',
    instructions: [
      'Ao clicar em "Ativar notificações", confirme em "Permitir" na caixa de diálogo do navegador/Android.',
    ],
    push: pushDiag,
    monitoring: monitorDiag,
  };
}

/**
 * Solicita a permissão real do navegador, registra o Service Worker e cria a inscrição Web Push.
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
      await subscribeDeviceToWebPush();
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
 * Fluxo acionado ao clicar no botão "Ativar notificações":
 * 1. Solicita permissão nativa ao Android/Navegador.
 * 2. Registra Service Worker (/sw.js) e cria a inscrição PushManager.subscribe() no servidor.
 * 3. Se concedido, entrega uma notificação nativa real via Service Worker + Push de confirmação.
 * 4. Retorna o diagnóstico real (sem falsos positivos).
 */
export async function activateNotificationsWithFeedback(portfolioState?: {
  userId?: string;
  holdings?: FIIHolding[];
  dividends?: DividendEvent[];
  preferences?: UserPreferences;
  goals?: PortfolioGoals;
}): Promise<BrowserNotificationDiagnostics> {
  const perm = await requestBrowserNotificationPermission();

  if (perm === 'granted') {
    await subscribeDeviceToWebPush(portfolioState);
    const title = 'EDUMODS FIIs — Push em Segundo Plano Ativo!';
    const body =
      'Inscrição concluída! Seus alertas de Preço-Teto, P/VP, Proventos e Risco chegarão na central do Android mesmo com o site fechado.';
    const nativeRes = await deliverNativeNotificationWithDiagnostics(
      title,
      body,
      `edumods_activated_${Date.now()}`
    );

    if (nativeRes.delivered && nativeRes.channel !== 'none') {
      appendNotificationHistory({
        notificationId: `activation_${Date.now()}`,
        title,
        message: body,
        category: 'teste',
        channel: nativeRes.channel,
      });
    }
  }

  return getNotificationSystemDiagnostics();
}

/**
 * Executa o TESTE REAL E AUDITÁVEL DE NOTIFICAÇÃO NATIVA + WEB PUSH DO SERVIDOR:
 * - Se a permissão não estiver concedida, solicita imediatamente.
 * - Se continuar não concedida ou se o Service Worker/Push falhar, retorna deliveredNative: false
 *   e error detalhado (NUNCA mostra mensagem de sucesso falso!).
 * - Testa TANTO o ServiceWorkerRegistration.showNotification() QUANTO o envio de Web Push
 *   criptografado pelo servidor (/api/push/test).
 */
export async function sendRealTestNotification(params: {
  activeCount: number;
  triggeredCount: number;
  sampleTicker?: string;
  portfolioState?: {
    userId?: string;
    holdings?: FIIHolding[];
    dividends?: DividendEvent[];
    preferences?: UserPreferences;
    goals?: PortfolioGoals;
  };
}): Promise<{
  deliveredNative: boolean;
  deliveredServerPush: boolean;
  error?: string;
  diagnostics: BrowserNotificationDiagnostics;
  message: string;
}> {
  const { activeCount, triggeredCount, sampleTicker, portfolioState } = params;

  // 1. Se a permissão ainda estiver 'default', tenta solicitar ao usuário no clique
  if (canUseBrowserNotifications() && window.Notification.permission === 'default') {
    await requestBrowserNotificationPermission();
  }

  const title = `EDUMODS FIIs — Teste Nativo Android & Push`;
  const body =
    triggeredCount > 0
      ? `Entrega confirmada! ${triggeredCount} de ${activeCount} alerta(s) atingiram a meta${
          sampleTicker ? ` (ex: ${sampleTicker})` : ''
        }.`
      : `Entrega confirmada! ${activeCount} alerta(s) sendo monitorados automaticamente em segundo plano.`;
  const tag = `edumods_test_${Date.now()}`;

  // 2. Garante inscrição Push atualizada no servidor (se permissão = granted)
  let deliveredServerPush = false;
  let serverPushError: string | undefined;

  if (canUseBrowserNotifications() && window.Notification.permission === 'granted') {
    const subRes = await subscribeDeviceToWebPush(portfolioState);
    if (subRes.isSubscribed) {
      try {
        const pushTestRes = await fetch('/api/push/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            body,
            tag: `${tag}_push`,
            category: 'teste',
            ticker: sampleTicker || 'HGLG11',
          }),
        });
        const pushTestData = await pushTestRes.json().catch(() => ({}));
        if (pushTestRes.ok && pushTestData.success && pushTestData.deliveredCount > 0) {
          deliveredServerPush = true;
        } else {
          serverPushError =
            pushTestData.error ||
            'O servidor tentou enviar o Push, mas o endpoint do navegador não confirmou o recebimento.';
        }
      } catch (err) {
        serverPushError = err instanceof Error ? err.message : String(err);
      }
    } else {
      serverPushError = subRes.error;
    }
  }

  // 3. Se o Push do servidor já entregou (o próprio sw.js no evento 'push' chama showNotification),
  // ou se o Push não pôde ser usado (ex: ambiente sem FCM), testa e garante a entrega via ServiceWorkerRegistration.showNotification
  let deliveredSwNative = false;
  let nativeError: string | undefined;

  if (!deliveredServerPush) {
    const swRes = await deliverNativeNotificationWithDiagnostics(title, body, tag, {
      category: 'teste',
      ticker: sampleTicker,
    });
    deliveredSwNative = swRes.delivered;
    nativeError = swRes.error;
  } else {
    deliveredSwNative = true;
  }

  const deliveredNative = deliveredServerPush || deliveredSwNative;
  const diagnostics = getNotificationSystemDiagnostics();

  // REGRA ESTRITA: NUNCA mostrar sucesso se a notificação nativa não tiver sido entregue!
  if (!deliveredNative) {
    const exactError =
      nativeError ||
      serverPushError ||
      'A notificação nativa não pôde ser entregue à central do sistema operacional.';

    return {
      deliveredNative: false,
      deliveredServerPush: false,
      error: exactError,
      diagnostics,
      message: `Falha ao entregar notificação nativa: ${exactError}`,
    };
  }

  // Se chegou aqui, a notificação nativa foi REALMENTE entregue via Service Worker / Web Push!
  if (!deliveredServerPush) {
    appendNotificationHistory({
      notificationId: `manual_test_${Date.now()}`,
      title,
      message: body,
      category: 'teste',
      ticker: sampleTicker,
      channel: 'service_worker_nativo',
    });
  }

  emitInAppToast({
    title,
    message: deliveredServerPush
      ? `${body} (Entregue via Servidor Web Push + Service Worker)`
      : `${body} (Entregue via Service Worker showNotification)`,
    category: 'teste',
  });

  const feedbackMessage = deliveredServerPush
    ? 'Sucesso comprovado! Mensagem enviada pelo Servidor Web Push (VAPID), recebida pelo Service Worker em segundo plano e exibida na central de notificações do seu dispositivo.'
    : `Notificação nativa exibida na central do dispositivo via Service Worker (showNotification)!${
        serverPushError ? ` Observação sobre o Push em segundo plano: ${serverPushError}` : ''
      }`;

  return {
    deliveredNative: true,
    deliveredServerPush,
    diagnostics,
    message: feedbackMessage,
  };
}

/**
 * Dispara notificações nativas para todos os alertas importantes/oportunidades/lembretes atingidos,
 * evitando duplicações (mesmo ID de alerta não dispara duas vezes) e gravando no histórico.
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
    .filter(
      (n) =>
        !n.isRead &&
        (n.category === 'importante' ||
          n.category === 'oportunidade' ||
          n.alertSubType === 'PAGAMENTO_HOJE' ||
          n.alertSubType === 'LEMBRETE_PAGAMENTO' ||
          n.alertSubType === 'NOVO_PROVENTO')
    )
    .forEach((n) => {
      if (notifiedSet.has(n.id)) return;

      notifiedSet.add(n.id);
      sentCount += 1;

      if (canSendNative) {
        void deliverNativeNotificationWithDiagnostics(
          `EDUMODS FIIs — ${n.title}`,
          n.message,
          n.id,
          { category: n.category, ticker: n.ticker }
        ).then((res) => {
          appendNotificationHistory({
            notificationId: n.id,
            title: n.title,
            message: n.message,
            category: n.category,
            ticker: n.ticker,
            channel:
              res.delivered && res.channel !== 'none' ? res.channel : 'sistema_painel',
          });
        });
      } else {
        appendNotificationHistory({
          notificationId: n.id,
          title: n.title,
          message: n.message,
          category: n.category,
          ticker: n.ticker,
          channel: 'sistema_painel',
        });
      }

      if (settings.inAppAlertsEnabled) {
        emitInAppToast({
          title: n.title,
          message: n.message,
          category: n.category,
        });
      }
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
