import fs from 'node:fs';
import path from 'node:path';
import webpush from 'web-push';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  DividendEvent,
  FIIHolding,
  PortfolioGoals,
  UserPreferences,
} from '../types/fii';
import { VERIFIED_FII_DATABASE } from '../data/fiiDatabase';
import { calculateUnrealizedGain } from '../utils/financialMath';
import {
  buildPlatformNotifications,
  NotificationCategory,
  NotificationChannel,
  ServerMonitoringDiagnostics,
} from '../utils/alertsEngine';
import { PERSONAL_USER_ID, SYSTEM_PREFS_NOTE_TOPIC } from '../services/supabaseDb';

export interface StoredPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
  isActive: boolean;
  failCount: number;
  lastError?: string | null;
  lastSuccessAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ServerNotificationLog {
  id: string;
  notificationId: string;
  timestamp: string;
  title: string;
  message: string;
  category: NotificationCategory | 'teste';
  ticker?: string;
  channel: NotificationChannel;
  deliveredCount: number;
}

interface PersistedServerState {
  userId: string;
  subscriptions: StoredPushSubscription[];
  dispatchedIds: string[];
  recentLogs: ServerNotificationLog[];
  monitoringState: ServerMonitoringDiagnostics;
  portfolioSnapshot?: {
    holdings: FIIHolding[];
    dividends: DividendEvent[];
    preferences: UserPreferences;
    goals?: PortfolioGoals;
  };
}

const VAPID_CACHE_FILE = path.resolve(process.cwd(), '.vapid-keys.json');
const SERVER_STATE_FILE = path.resolve(process.cwd(), '.push-server-state.json');

let cachedVapidKeys: {
  publicKey: string;
  privateKey: string;
  subject: string;
  fromEnv: boolean;
} | null = null;

/**
 * Obtém as chaves VAPID das variáveis secretas de ambiente (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)
 * ou gera um par persistente local em desenvolvimento para garantir funcionamento real.
 */
export function getOrInitVapidConfig(): {
  publicKey: string;
  privateKey: string;
  subject: string;
  fromEnv: boolean;
} {
  const envPub = (process.env.VAPID_PUBLIC_KEY || '').trim();
  const envPriv = (process.env.VAPID_PRIVATE_KEY || '').trim();
  const subject = (process.env.VAPID_SUBJECT || 'mailto:contato@edumods.com.br').trim();

  if (envPub && envPriv) {
    cachedVapidKeys = {
      publicKey: envPub,
      privateKey: envPriv,
      subject,
      fromEnv: true,
    };
    webpush.setVapidDetails(subject, envPub, envPriv);
    return cachedVapidKeys;
  }

  if (cachedVapidKeys) {
    return cachedVapidKeys;
  }

  try {
    if (fs.existsSync(VAPID_CACHE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(VAPID_CACHE_FILE, 'utf-8'));
      if (parsed.publicKey && parsed.privateKey) {
        cachedVapidKeys = {
          publicKey: parsed.publicKey,
          privateKey: parsed.privateKey,
          subject,
          fromEnv: false,
        };
        webpush.setVapidDetails(subject, parsed.publicKey, parsed.privateKey);
        return cachedVapidKeys;
      }
    }
  } catch {
    // ignore file read error in serverless read-only environments
  }

  const generated = webpush.generateVAPIDKeys();
  cachedVapidKeys = {
    publicKey: generated.publicKey,
    privateKey: generated.privateKey,
    subject,
    fromEnv: false,
  };

  try {
    fs.writeFileSync(
      VAPID_CACHE_FILE,
      JSON.stringify(
        {
          publicKey: generated.publicKey,
          privateKey: generated.privateKey,
          createdAt: new Date().toISOString(),
        },
        null,
        2
      ),
      'utf-8'
    );
  } catch {
    // ignore in read-only fs
  }

  webpush.setVapidDetails(subject, generated.publicKey, generated.privateKey);
  return cachedVapidKeys;
}

/**
 * Cria cliente Supabase seguro no servidor (priorizando SUPABASE_SERVICE_ROLE_KEY para acesso
 * exclusivo à tabela protegida fii_push_subscriptions).
 */
function getServerSupabaseClient(): {
  client: SupabaseClient | null;
  hasServiceRole: boolean;
} {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    'https://yhqoufgcoajcjoybhvbc.supabase.co'
  ).trim();

  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const anonKey = (
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim();

  const keyToUse = serviceRoleKey || anonKey;
  if (!url || !keyToUse || keyToUse.startsWith('your-')) {
    return { client: null, hasServiceRole: false };
  }

  return {
    client: createClient(url, keyToUse, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }),
    hasServiceRole: Boolean(serviceRoleKey && !serviceRoleKey.startsWith('your-')),
  };
}

let inMemoryServerState: PersistedServerState = {
  userId: PERSONAL_USER_ID,
  subscriptions: [],
  dispatchedIds: [],
  recentLogs: [],
  monitoringState: {
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
  },
};

function loadServerState(): PersistedServerState {
  try {
    if (fs.existsSync(SERVER_STATE_FILE)) {
      const raw = fs.readFileSync(SERVER_STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      inMemoryServerState = {
        ...inMemoryServerState,
        ...parsed,
        monitoringState: {
          ...inMemoryServerState.monitoringState,
          ...(parsed.monitoringState || {}),
        },
      };
    }
  } catch {
    // usa estado em memória
  }
  return inMemoryServerState;
}

function saveServerState(state: PersistedServerState): void {
  inMemoryServerState = state;
  try {
    fs.writeFileSync(SERVER_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch {
    // ignora em ambiente serverless somente-leitura
  }
}

/**
 * Salva ou atualiza uma inscrição Web Push no Supabase (fii_push_subscriptions) e no estado do servidor
 */
export async function savePushSubscriptionOnServer(params: {
  subscription: {
    endpoint?: string;
    keys?: {
      p256dh?: string;
      auth?: string;
    };
  };
  oldEndpoint?: string;
  userAgent?: string;
  portfolioState?: {
    userId?: string;
    holdings?: FIIHolding[];
    dividends?: DividendEvent[];
    preferences?: UserPreferences;
    goals?: PortfolioGoals;
  };
}): Promise<{
  success: boolean;
  supabasePersisted: boolean;
  serverPersisted: boolean;
  activeSubscriptionsCount: number;
  monitoringState: ServerMonitoringDiagnostics;
  error?: string;
}> {
  const { subscription, oldEndpoint, userAgent, portfolioState } = params;
  const endpoint = subscription?.endpoint?.trim();
  const p256dh = subscription?.keys?.p256dh?.trim();
  const auth = subscription?.keys?.auth?.trim();

  if (!endpoint || !p256dh || !auth) {
    return {
      success: false,
      supabasePersisted: false,
      serverPersisted: false,
      activeSubscriptionsCount: 0,
      monitoringState: loadServerState().monitoringState,
      error: 'Inscrição Push incompleta: endpoint, p256dh e auth são obrigatórios.',
    };
  }

  const state = loadServerState();
  const nowIso = new Date().toISOString();

  if (portfolioState) {
    if (portfolioState.userId) state.userId = portfolioState.userId;
    state.portfolioSnapshot = {
      holdings: portfolioState.holdings || state.portfolioSnapshot?.holdings || [],
      dividends: portfolioState.dividends || state.portfolioSnapshot?.dividends || [],
      preferences:
        portfolioState.preferences ||
        state.portfolioSnapshot?.preferences || {
          hideValues: false,
          currency: 'BRL',
          autoRefreshQuotes: true,
          maxConcentrationAlertPercent: 25,
          minYieldAlertPercent: 8,
          customAlerts: [],
        },
      goals: portfolioState.goals || state.portfolioSnapshot?.goals,
    };
  }

  // Remove oldEndpoint caso seja renovação automática (pushsubscriptionchange)
  if (oldEndpoint) {
    state.subscriptions = state.subscriptions.filter((s) => s.endpoint !== oldEndpoint);
  }

  const existingIdx = state.subscriptions.findIndex((s) => s.endpoint === endpoint);
  const newSubRecord: StoredPushSubscription = {
    endpoint,
    keys: { p256dh, auth },
    userAgent: userAgent || '',
    isActive: true,
    failCount: 0,
    lastError: null,
    lastSuccessAt: existingIdx >= 0 ? state.subscriptions[existingIdx].lastSuccessAt : null,
    createdAt: existingIdx >= 0 ? state.subscriptions[existingIdx].createdAt : nowIso,
    updatedAt: nowIso,
  };

  if (existingIdx >= 0) {
    state.subscriptions[existingIdx] = newSubRecord;
  } else {
    state.subscriptions.push(newSubRecord);
  }

  let supabasePersisted = false;
  const { client } = getServerSupabaseClient();

  if (client) {
    try {
      if (oldEndpoint) {
        await client.from('fii_push_subscriptions').delete().eq('endpoint', oldEndpoint);
      }
      const { error } = await client.from('fii_push_subscriptions').upsert(
        {
          user_id: state.userId || PERSONAL_USER_ID,
          endpoint,
          p256dh_key: p256dh,
          auth_key: auth,
          user_agent: userAgent || '',
          is_active: true,
          fail_count: 0,
          last_error: null,
          updated_at: nowIso,
        },
        { onConflict: 'endpoint' }
      );
      if (!error) {
        supabasePersisted = true;
      }
    } catch {
      // Tabela pode ainda não ter sido migrada ou sem SUPABASE_SERVICE_ROLE_KEY
    }
  }

  const activeCount = state.subscriptions.filter((s) => s.isActive).length;
  state.monitoringState.activeSubscriptionsCount = activeCount;
  saveServerState(state);

  return {
    success: true,
    supabasePersisted,
    serverPersisted: true,
    activeSubscriptionsCount: activeCount,
    monitoringState: state.monitoringState,
  };
}

/**
 * Carrega todas as inscrições Push ativas (mesclando Supabase fii_push_subscriptions + estado do servidor)
 */
async function loadActiveSubscriptions(userId: string): Promise<StoredPushSubscription[]> {
  const state = loadServerState();
  const byEndpoint = new Map<string, StoredPushSubscription>();

  for (const sub of state.subscriptions) {
    if (sub.isActive && sub.endpoint && sub.keys?.p256dh && sub.keys?.auth) {
      byEndpoint.set(sub.endpoint, sub);
    }
  }

  const { client } = getServerSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('fii_push_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (!error && Array.isArray(data)) {
        for (const row of data) {
          if (row.endpoint && row.p256dh_key && row.auth_key) {
            byEndpoint.set(row.endpoint, {
              endpoint: row.endpoint,
              keys: {
                p256dh: row.p256dh_key,
                auth: row.auth_key,
              },
              userAgent: row.user_agent || '',
              isActive: Boolean(row.is_active),
              failCount: Number(row.fail_count) || 0,
              lastError: row.last_error || null,
              lastSuccessAt: row.last_success_at || null,
              createdAt: row.created_at || new Date().toISOString(),
              updatedAt: row.updated_at || new Date().toISOString(),
            });
          }
        }
      }
    } catch {
      // ignora se tabela não acessível
    }
  }

  const merged = Array.from(byEndpoint.values());
  state.subscriptions = merged;
  state.monitoringState.activeSubscriptionsCount = merged.length;
  saveServerState(state);
  return merged;
}

/**
 * Envia uma notificação Web Push para uma inscrição com suporte a até 3 tentativas (retry)
 * e limpeza automática caso a inscrição esteja expirada (HTTP 404 ou 410).
 */
async function sendWebPushWithRetry(
  sub: StoredPushSubscription,
  payloadObj: Record<string, any>,
  maxAttempts = 3
): Promise<{
  delivered: boolean;
  expired: boolean;
  error?: string;
}> {
  getOrInitVapidConfig();
  const payloadStr = JSON.stringify(payloadObj);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (
        sub.endpoint.startsWith('http://127.0.0.1') ||
        sub.endpoint.startsWith('http://localhost')
      ) {
        const reqDetails = webpush.generateRequestDetails(
          {
            endpoint: sub.endpoint,
            keys: sub.keys,
          },
          payloadStr,
          {
            TTL: 86400,
            urgency: 'high',
          }
        );
        const res = await fetch(reqDetails.endpoint, {
          method: reqDetails.method || 'POST',
          headers: reqDetails.headers as Record<string, string>,
          body: reqDetails.body ? new Uint8Array(reqDetails.body) : undefined,
        });
        if (!res.ok) {
          const err: any = new Error(`HTTP ${res.status}`);
          err.statusCode = res.status;
          err.body = await res.text().catch(() => '');
          throw err;
        }
        return { delivered: true, expired: false };
      }

      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: sub.keys,
        },
        payloadStr,
        {
          TTL: 86400, // 24h de vida útil caso o celular esteja sem sinal no momento
          urgency: 'high',
        }
      );
      return { delivered: true, expired: false };
    } catch (err: any) {
      const statusCode = Number(err?.statusCode || 0);
      const errMsg = err?.body || err?.message || String(err);

      // 404 ou 410 indica que o dispositivo revogou ou expirou a inscrição no FCM/Mozilla
      if (statusCode === 404 || statusCode === 410) {
        return {
          delivered: false,
          expired: true,
          error: `Inscrição Push expirada ou revogada pelo dispositivo (HTTP ${statusCode}).`,
        };
      }

      // Erros de cliente definitivos (400, 401, 403) não precisam de retry
      if (statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
        return {
          delivered: false,
          expired: false,
          error: `Erro HTTP ${statusCode} do servidor Push: ${errMsg}`,
        };
      }

      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, attempt * 400));
      } else {
        return {
          delivered: false,
          expired: false,
          error: `Falha após ${maxAttempts} tentativas de envio Push: ${errMsg}`,
        };
      }
    }
  }

  return { delivered: false, expired: false, error: 'Erro desconhecido no envio Web Push.' };
}

/**
 * Dispara uma notificação Push para todos os dispositivos inscritos do usuário,
 * limpando inscrições expiradas e atualizando contadores de sucesso/erro no Supabase.
 */
export async function dispatchPushToSubscribedDevices(params: {
  userId?: string;
  title: string;
  body: string;
  tag: string;
  category?: NotificationCategory | 'teste';
  ticker?: string;
  url?: string;
  requireInteraction?: boolean;
}): Promise<{
  success: boolean;
  attemptedCount: number;
  deliveredCount: number;
  expiredRemovedCount: number;
  errors: string[];
}> {
  const state = loadServerState();
  const userId = params.userId || state.userId || PERSONAL_USER_ID;
  const activeSubs = await loadActiveSubscriptions(userId);

  if (activeSubs.length === 0) {
    return {
      success: false,
      attemptedCount: 0,
      deliveredCount: 0,
      expiredRemovedCount: 0,
      errors: [
        'Nenhuma inscrição Web Push ativa encontrada no servidor para este dispositivo. Clique em "Ativar notificações" no navegador do celular.',
      ],
    };
  }

  let deliveredCount = 0;
  let expiredRemovedCount = 0;
  const errors: string[] = [];
  const { client } = getServerSupabaseClient();
  const nowIso = new Date().toISOString();

  const updatedSubs: StoredPushSubscription[] = [];

  for (const sub of activeSubs) {
    const res = await sendWebPushWithRetry(sub, {
      title: params.title,
      body: params.body,
      tag: params.tag,
      notificationId: params.tag,
      category: params.category || 'oportunidade',
      ticker: params.ticker || null,
      url: params.url || '/',
      requireInteraction: Boolean(params.requireInteraction),
      timestamp: nowIso,
    });

    if (res.delivered) {
      deliveredCount += 1;
      updatedSubs.push({
        ...sub,
        failCount: 0,
        lastError: null,
        lastSuccessAt: nowIso,
        updatedAt: nowIso,
      });
      if (client) {
        try {
          await client
            .from('fii_push_subscriptions')
            .update({
              fail_count: 0,
              last_error: null,
              last_success_at: nowIso,
              updated_at: nowIso,
            })
            .eq('endpoint', sub.endpoint);
        } catch {
          // ignore
        }
      }
    } else if (res.expired) {
      expiredRemovedCount += 1;
      if (res.error) errors.push(res.error);
      if (client) {
        try {
          await client
            .from('fii_push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint);
        } catch {
          // ignore
        }
      }
    } else {
      const nextFail = (sub.failCount || 0) + 1;
      if (res.error) errors.push(res.error);
      updatedSubs.push({
        ...sub,
        failCount: nextFail,
        lastError: res.error || 'Falha de entrega',
        isActive: nextFail < 10,
        updatedAt: nowIso,
      });
      if (client) {
        try {
          await client
            .from('fii_push_subscriptions')
            .update({
              fail_count: nextFail,
              last_error: res.error || 'Falha de entrega',
              is_active: nextFail < 10,
              updated_at: nowIso,
            })
            .eq('endpoint', sub.endpoint);
        } catch {
          // ignore
        }
      }
    }
  }

  state.subscriptions = updatedSubs;
  state.monitoringState.activeSubscriptionsCount = updatedSubs.filter((s) => s.isActive).length;
  saveServerState(state);

  return {
    success: deliveredCount > 0,
    attemptedCount: activeSubs.length,
    deliveredCount,
    expiredRemovedCount,
    errors,
  };
}

/**
 * Busca cotações reais e atualizadas da B3 no servidor:
 * 1. BRAPI Oficial (se BRAPI_TOKEN estiver configurado)
 * 2. Yahoo Finance B3 (.SA) em Tempo Real (sem necessidade de chave, trazendo também dividendos anunciados)
 * 3. Contingência Local (marcada explicitamente com isFallbackData = true)
 */
export async function fetchLiveMarketQuotesServer(
  tickers: string[],
  customBrapiToken?: string
): Promise<{
  quotes: Record<
    string,
    {
      ticker: string;
      price: number;
      changePercent: number;
      updatedAt: string;
      source: string;
      vpa?: number;
      lastDividend?: number;
    }
  >;
  announcedDividends: Array<{
    ticker: string;
    ratePerShare: number;
    paymentDate: string;
    dataCom?: string;
  }>;
  source: string;
  isFallbackData: boolean;
}> {
  const cleanTickers = Array.from(
    new Set(tickers.map((t) => (t || '').toUpperCase().trim()).filter((t) => t.length >= 4))
  );

  const quotes: Record<
    string,
    {
      ticker: string;
      price: number;
      changePercent: number;
      updatedAt: string;
      source: string;
      vpa?: number;
      lastDividend?: number;
    }
  > = {};
  const announcedDividends: Array<{
    ticker: string;
    ratePerShare: number;
    paymentDate: string;
    dataCom?: string;
  }> = [];

  if (cleanTickers.length === 0) {
    return {
      quotes,
      announcedDividends,
      source: 'B3 Tempo Real',
      isFallbackData: false,
    };
  }

  const token = (customBrapiToken || process.env.BRAPI_TOKEN || '').trim();
  let liveResolvedCount = 0;
  let primarySourceLabel = '';

  // 1. Tenta via BRAPI se houver token configurado
  if (token && !token.startsWith('your-')) {
    try {
      const url = `https://brapi.dev/api/quote/${cleanTickers.join(',')}?token=${encodeURIComponent(token)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.results)) {
          for (const item of data.results) {
            const sym = (item.symbol || '').toUpperCase().trim();
            if (sym && typeof item.regularMarketPrice === 'number' && item.regularMarketPrice > 0) {
              const localRef = VERIFIED_FII_DATABASE[sym];
              quotes[sym] = {
                ticker: sym,
                price: Number(item.regularMarketPrice.toFixed(2)),
                changePercent: Number((item.regularMarketChangePercent || 0).toFixed(2)),
                updatedAt: new Date().toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
                source: 'BRAPI Oficial (B3)',
                vpa: localRef?.vpa,
                lastDividend: localRef?.lastDividend,
              };
              liveResolvedCount++;
              primarySourceLabel = 'BRAPI Oficial (B3)';
            }
          }
        }
      }
    } catch {
      // continua para Yahoo Finance SA
    }
  }

  // 2. Para todos os tickers que ainda não obtiveram cotação ao vivo, busca na B3 via Yahoo Finance (.SA)
  const missingTickers = cleanTickers.filter((t) => !quotes[t]);
  if (missingTickers.length > 0) {
    await Promise.all(
      missingTickers.map(async (ticker) => {
        try {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
            ticker
          )}.SA?interval=1d&range=3mo&events=div`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5500);
          const res = await fetch(url, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (!res.ok) return;
          const data = await res.json();
          const result = data?.chart?.result?.[0];
          const meta = result?.meta;
          if (meta && typeof meta.regularMarketPrice === 'number' && meta.regularMarketPrice > 0) {
            const localRef = VERIFIED_FII_DATABASE[ticker];
            const prevClose = meta.chartPreviousClose || meta.regularMarketPrice;
            const changePct =
              prevClose > 0 ? ((meta.regularMarketPrice - prevClose) / prevClose) * 100 : 0;

            let updatedAtFormatted = new Date().toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            });
            if (meta.regularMarketTime) {
              const dt = new Date(meta.regularMarketTime * 1000);
              updatedAtFormatted = dt.toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              });
            }

            // Verifica se há proventos recentes nos eventos do Yahoo Finance
            let latestDivRate = localRef?.lastDividend;
            const divEvents = result?.events?.dividends;
            if (divEvents && typeof divEvents === 'object') {
              const divList = Object.values(divEvents) as Array<{ amount?: number; date?: number }>;
              divList.sort((a, b) => (b.date || 0) - (a.date || 0));
              if (divList.length > 0 && typeof divList[0].amount === 'number' && divList[0].amount > 0) {
                latestDivRate = Number(divList[0].amount.toFixed(4));
                if (divList[0].date) {
                  const payIso = new Date(divList[0].date * 1000).toISOString().slice(0, 10);
                  announcedDividends.push({
                    ticker,
                    ratePerShare: latestDivRate,
                    paymentDate: payIso,
                  });
                }
              }
            }

            quotes[ticker] = {
              ticker,
              price: Number(meta.regularMarketPrice.toFixed(2)),
              changePercent: Number(changePct.toFixed(2)),
              updatedAt: updatedAtFormatted,
              source: 'B3 Tempo Real (SAO)',
              vpa: localRef?.vpa,
              lastDividend: latestDivRate,
            };
            liveResolvedCount++;
            if (!primarySourceLabel) {
              primarySourceLabel = 'B3 Tempo Real (SAO)';
            }
          }
        } catch {
          // fallback abaixo
        }
      })
    );
  }

  // 3. Se algum ativo continuar sem cotação ao vivo, preenche com a base de contingência e informa explicitamente
  let fallbackUsed = false;
  for (const ticker of cleanTickers) {
    if (!quotes[ticker]) {
      const local = VERIFIED_FII_DATABASE[ticker];
      if (local) {
        fallbackUsed = true;
        quotes[ticker] = {
          ticker,
          price: local.currentPrice,
          changePercent: 0,
          updatedAt: 'Base Local de Contingência',
          source: 'Contingência Local (Offline)',
          vpa: local.vpa,
          lastDividend: local.lastDividend,
        };
      }
    }
  }

  const isFallbackData = liveResolvedCount === 0 && fallbackUsed;

  return {
    quotes,
    announcedDividends,
    source: primarySourceLabel || (isFallbackData ? 'Contingência Local (Offline)' : 'B3 Tempo Real'),
    isFallbackData,
  };
}

/**
 * Carrega os dados da carteira do usuário diretamente do Supabase (ou do snapshot sincronizado no servidor)
 * para execução autônoma do Cron Job com o site fechado.
 */
async function loadPortfolioForServerMonitoring(
  overrideSnapshot?: {
    userId?: string;
    holdings?: FIIHolding[];
    dividends?: DividendEvent[];
    preferences?: UserPreferences;
    goals?: PortfolioGoals;
  }
): Promise<{
  userId: string;
  holdings: FIIHolding[];
  dividends: DividendEvent[];
  preferences: UserPreferences;
  goals?: PortfolioGoals;
}> {
  const state = loadServerState();

  if (
    overrideSnapshot &&
    Array.isArray(overrideSnapshot.holdings) &&
    overrideSnapshot.preferences
  ) {
    const uid = overrideSnapshot.userId || state.userId || PERSONAL_USER_ID;
    state.userId = uid;
    state.portfolioSnapshot = {
      holdings: overrideSnapshot.holdings,
      dividends: overrideSnapshot.dividends || [],
      preferences: overrideSnapshot.preferences,
      goals: overrideSnapshot.goals,
    };
    saveServerState(state);
  }

  const { client } = getServerSupabaseClient();
  let userId = state.userId || PERSONAL_USER_ID;

  if (client) {
    try {
      // Descobre user_id ativo no Supabase
      const { data: profRows } = await client
        .from('fii_user_profiles')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1);

      if (Array.isArray(profRows) && profRows.length > 0 && profRows[0].user_id) {
        userId = String(profRows[0].user_id);
      }

      const [holdingsRes, divsRes, goalsRes, notesRes] = await Promise.all([
        client.from('fii_holdings').select('*').eq('user_id', userId),
        client.from('fii_dividends').select('*').eq('user_id', userId),
        client.from('fii_goals').select('*').eq('user_id', userId).limit(1),
        client
          .from('fii_notes')
          .select('topic, content')
          .eq('user_id', userId)
          .eq('topic', SYSTEM_PREFS_NOTE_TOPIC)
          .limit(1),
      ]);

      const dbHoldingsRaw = Array.isArray(holdingsRes.data) ? holdingsRes.data : [];
      const dbDivsRaw = Array.isArray(divsRes.data) ? divsRes.data : [];

      if (dbHoldingsRaw.length > 0 || (Array.isArray(profRows) && profRows.length > 0)) {
        const mappedHoldings: FIIHolding[] = dbHoldingsRaw.map((row: any) => {
          const ticker = String(row.ticker || '').toUpperCase().trim();
          const qty = Number(row.quantity) || 0;
          const avgPrice = Number(row.average_price) || 0;
          const dbInfo = VERIFIED_FII_DATABASE[ticker];
          const currentPrice =
            Number(row.current_price) > 0
              ? Number(row.current_price)
              : dbInfo?.currentPrice || avgPrice;
          const vpa = Number(row.vpa) > 0 ? Number(row.vpa) : dbInfo?.vpa || currentPrice || 100;
          const pvp = vpa > 0 ? Number((currentPrice / vpa).toFixed(2)) : 1;
          const lastDiv =
            Number(row.last_dividend) > 0
              ? Number(row.last_dividend)
              : dbInfo?.lastDividend || 0.8;
          const monthlyDY = currentPrice > 0 ? (lastDiv / currentPrice) * 100 : 0.85;
          const { marketValue, unrealizedGain, unrealizedGainPercent } = calculateUnrealizedGain(
            qty,
            avgPrice,
            currentPrice
          );

          return {
            ticker,
            name: row.name || dbInfo?.name || `${ticker} FII`,
            category: row.category || dbInfo?.category || 'Tijolo',
            segment: row.segment || dbInfo?.segment || 'Logística',
            quantity: qty,
            averagePrice: avgPrice,
            currentPrice,
            totalCost: Number((qty * avgPrice).toFixed(2)),
            marketValue,
            unrealizedGain,
            unrealizedGainPercent,
            monthlyYieldPerShare: lastDiv,
            monthlyDividendYield: Number(monthlyDY.toFixed(2)),
            annualDividendYield: dbInfo?.annualDY || Number((monthlyDY * 12).toFixed(2)),
            vpa,
            pvp,
            portfolioWeight: 0,
            targetWeight: Number(row.target_percentage) || 10,
            quoteSource: 'Supabase DB',
            lastQuoteUpdate: 'Sincronizado',
          };
        });

        const totalMarket = mappedHoldings.reduce((acc, h) => acc + h.marketValue, 0);
        mappedHoldings.forEach((h) => {
          h.portfolioWeight =
            totalMarket > 0 ? Number(((h.marketValue / totalMarket) * 100).toFixed(2)) : 0;
        });

        const mappedDividends: DividendEvent[] = dbDivsRaw.map((row: any) => {
          const rate = Number(row.value_per_share) || 0;
          const total = Number(row.total_value) || 0;
          const qty =
            Number(row.quantity_eligible) > 0
              ? Number(row.quantity_eligible)
              : rate > 0
              ? Math.round(total / rate)
              : 0;
          const upper = String(row.status || '').toUpperCase();
          return {
            id: String(row.id),
            ticker: String(row.ticker || '').toUpperCase().trim(),
            dataCom: row.base_date || row.payment_date,
            paymentDate: row.payment_date,
            quantityEligible: qty,
            ratePerShare: rate,
            totalAmount: total,
            status: upper === 'PREVISTO' ? 'PREVISTO' : upper === 'CANCELADO' ? 'CANCELADO' : 'RECEBIDO',
          };
        });

        let prefs: UserPreferences = {
          hideValues: false,
          currency: 'BRL',
          autoRefreshQuotes: true,
          maxConcentrationAlertPercent: 25,
          minYieldAlertPercent: 8.0,
          customAlerts: [
            { id: 'alt_1', ticker: 'HGLG11', type: 'PRECO_TETO', thresholdValue: 155.0, isActive: true },
            { id: 'alt_2', ticker: 'MXRF11', type: 'PVP_MAXIMO', thresholdValue: 1.02, isActive: true },
            { id: 'alt_3', ticker: 'KNIP11', type: 'PROVENTO_MINIMO', thresholdValue: 0.85, isActive: true },
          ],
        };

        if (Array.isArray(notesRes.data) && notesRes.data[0]?.content) {
          try {
            prefs = { ...prefs, ...JSON.parse(notesRes.data[0].content) };
          } catch {
            // ignore
          }
        }
        if (Array.isArray(profRows) && profRows[0]?.preferences) {
          prefs = { ...prefs, ...profRows[0].preferences };
        }
        // Se o cliente acabou de enviar overrideSnapshot com customAlerts mais recentes, prioriza
        if (overrideSnapshot?.preferences) {
          prefs = { ...prefs, ...overrideSnapshot.preferences };
        }

        let goals: PortfolioGoals | undefined;
        if (Array.isArray(goalsRes.data) && goalsRes.data[0]) {
          const g = goalsRes.data[0];
          goals = {
            totalEquityGoal: Number(g.target_equity) || 500000,
            monthlyIncomeGoal: Number(g.target_monthly_dividend) || 5000,
            currentLivingExpenses: Number(g.current_living_expenses) || 4500,
            fireSafeYieldPercent: Number(g.fire_safe_yield_percent) || 9.5,
          };
        }

        return {
          userId,
          holdings: mappedHoldings.length > 0 ? mappedHoldings : state.portfolioSnapshot?.holdings || [],
          dividends: mappedDividends.length > 0 ? mappedDividends : state.portfolioSnapshot?.dividends || [],
          preferences: prefs,
          goals: goals || state.portfolioSnapshot?.goals,
        };
      }
    } catch {
      // Fallback para snapshot salvo no servidor
    }
  }

  return {
    userId,
    holdings: state.portfolioSnapshot?.holdings || [],
    dividends: state.portfolioSnapshot?.dividends || [],
    preferences: state.portfolioSnapshot?.preferences || {
      hideValues: false,
      currency: 'BRL',
      autoRefreshQuotes: true,
      maxConcentrationAlertPercent: 25,
      minYieldAlertPercent: 8.0,
      customAlerts: [
        { id: 'alt_1', ticker: 'HGLG11', type: 'PRECO_TETO', thresholdValue: 155.0, isActive: true },
        { id: 'alt_2', ticker: 'MXRF11', type: 'PVP_MAXIMO', thresholdValue: 1.02, isActive: true },
        { id: 'alt_3', ticker: 'KNIP11', type: 'PROVENTO_MINIMO', thresholdValue: 0.85, isActive: true },
      ],
    },
    goals: state.portfolioSnapshot?.goals,
  };
}

/**
 * Executa o ciclo completo de Monitoramento Financeiro Automático no Servidor:
 * 1. Carrega carteira, proventos, metas e regras de alerta do Supabase / Servidor.
 * 2. Busca cotações e novos anúncios de proventos em tempo real na B3 (BRAPI + Yahoo Finance SA).
 * 3. Avalia todas as regras configuradas (Preço-teto, P/VP, Provento mínimo, Preço de compra, Concentração, DY, Data-Com, Pagamentos).
 * 4. Evita duplicidade consultando fii_notification_logs e dispatchedIds.
 * 5. Envia Web Push real para todos os dispositivos inscritos (mesmo com o site fechado).
 * 6. Registra histórico e diagnóstico completo.
 */
export async function runAutomaticFinancialMonitor(overrideSnapshot?: {
  userId?: string;
  holdings?: FIIHolding[];
  dividends?: DividendEvent[];
  preferences?: UserPreferences;
  goals?: PortfolioGoals;
}): Promise<{
  success: boolean;
  monitoringState: ServerMonitoringDiagnostics;
  recentLogs: ServerNotificationLog[];
  triggeredNotifications: Array<{ id: string; title: string; message: string; category: string }>;
  vapidConfiguredFromEnv: boolean;
}> {
  const vapid = getOrInitVapidConfig();
  const state = loadServerState();
  const nowIso = new Date().toISOString();

  try {
    const portfolio = await loadPortfolioForServerMonitoring(overrideSnapshot);
    const { userId, holdings, dividends, preferences, goals } = portfolio;

    // Coleta todos os tickers da carteira e dos alertas personalizados ativos
    const alertTickers = (preferences.customAlerts || [])
      .filter((a) => a.isActive && a.ticker)
      .map((a) => a.ticker.toUpperCase().trim());
    const holdingTickers = holdings.map((h) => h.ticker.toUpperCase().trim());
    const allTickers = Array.from(new Set([...holdingTickers, ...alertTickers]));

    // 1. Busca cotações atualizadas e anúncios de proventos em tempo real
    const marketData = await fetchLiveMarketQuotesServer(allTickers, preferences.brapiToken);

    // 2. Atualiza cotações e pesos da carteira com os dados recém-obtidos
    let totalMarket = 0;
    const updatedHoldings: FIIHolding[] = holdings.map((h) => {
      const q = marketData.quotes[h.ticker.toUpperCase().trim()];
      if (!q || q.price <= 0) {
        totalMarket += h.marketValue;
        return h;
      }
      const { marketValue, unrealizedGain, unrealizedGainPercent } = calculateUnrealizedGain(
        h.quantity,
        h.averagePrice,
        q.price
      );
      const vpa = q.vpa || h.vpa || q.price;
      const pvp = vpa > 0 ? Number((q.price / vpa).toFixed(2)) : h.pvp;
      const lastDiv = q.lastDividend || h.monthlyYieldPerShare;
      const monthlyDY = q.price > 0 ? Number(((lastDiv / q.price) * 100).toFixed(2)) : h.monthlyDividendYield;

      totalMarket += marketValue;
      return {
        ...h,
        currentPrice: q.price,
        marketValue,
        unrealizedGain,
        unrealizedGainPercent,
        vpa,
        pvp,
        monthlyYieldPerShare: lastDiv,
        monthlyDividendYield: monthlyDY,
        lastQuoteUpdate: q.updatedAt,
        quoteSource: q.source,
      };
    });

    updatedHoldings.forEach((h) => {
      h.portfolioWeight =
        totalMarket > 0 ? Number(((h.marketValue / totalMarket) * 100).toFixed(2)) : 0;
    });

    // Também injeta cotações em holdings virtuais temporários caso o usuário monitore um FII fora da carteira
    const holdingsWithVirtualQuotes: FIIHolding[] = [...updatedHoldings];
    for (const ticker of alertTickers) {
      if (!holdingsWithVirtualQuotes.some((h) => h.ticker.toUpperCase() === ticker)) {
        const q = marketData.quotes[ticker];
        const dbRef = VERIFIED_FII_DATABASE[ticker];
        if (q && q.price > 0) {
          const vpa = q.vpa || dbRef?.vpa || q.price;
          const pvp = vpa > 0 ? Number((q.price / vpa).toFixed(2)) : 1;
          const lastDiv = q.lastDividend || dbRef?.lastDividend || 0.8;
          holdingsWithVirtualQuotes.push({
            ticker,
            name: dbRef?.name || `${ticker} FII`,
            category: dbRef?.category || 'Tijolo',
            segment: dbRef?.segment || 'Logística',
            quantity: 0,
            averagePrice: q.price,
            currentPrice: q.price,
            totalCost: 0,
            marketValue: 0,
            unrealizedGain: 0,
            unrealizedGainPercent: 0,
            monthlyYieldPerShare: lastDiv,
            monthlyDividendYield: Number(((lastDiv / q.price) * 100).toFixed(2)),
            annualDividendYield: dbRef?.annualDY || Number((((lastDiv / q.price) * 100) * 12).toFixed(2)),
            vpa,
            pvp,
            portfolioWeight: 0,
            targetWeight: 0,
            lastQuoteUpdate: q.updatedAt,
            quoteSource: q.source,
          });
        }
      }
    }

    // 3. Avalia todas as regras financeiras
    const evaluation = buildPlatformNotifications({
      holdings: holdingsWithVirtualQuotes.filter((h) => h.quantity > 0),
      dividends,
      preferences,
      goals,
      announcedDividends: marketData.announcedDividends,
      isFallbackQuoteData: marketData.isFallbackData,
    });

    // Reavalia customAlerts incluindo FIIs fora da carteira com cotação ao vivo
    const customOnlyEval = buildPlatformNotifications({
      holdings: holdingsWithVirtualQuotes,
      dividends: [],
      preferences: {
        ...preferences,
        maxConcentrationAlertPercent: 999,
        minYieldAlertPercent: 0,
      },
    });

    const combinedMap = new Map<string, (typeof evaluation.all)[number]>();
    for (const item of evaluation.all) {
      combinedMap.set(item.id, item);
    }
    for (const item of customOnlyEval.all) {
      combinedMap.set(item.id, item);
    }
    const allNotifications = Array.from(combinedMap.values());

    // 4. Carrega histórico já disparado no Supabase + Servidor para bloquear duplicidades
    const { client } = getServerSupabaseClient();
    const alreadyDispatched = new Set<string>(state.dispatchedIds || []);

    if (client) {
      try {
        const { data: existingLogs } = await client
          .from('fii_notification_logs')
          .select('notification_id, title, message, category, ticker, channel, created_at, delivered_count')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(100);

        if (Array.isArray(existingLogs)) {
          for (const row of existingLogs) {
            if (row.notification_id) {
              alreadyDispatched.add(String(row.notification_id));
            }
          }
        }
      } catch {
        // ignora se tabela ainda não existir
      }
    }

    // 5. Seleciona notificações recém-atingidas que ainda não foram enviadas via Push
    const candidatesToPush = allNotifications.filter(
      (n) =>
        n.alertSubType !== 'COTACAO_CONTINGENCIA' &&
        !alreadyDispatched.has(n.id)
    );

    let pushedCount = 0;

    for (const notif of candidatesToPush) {
      const pushTitle = marketData.isFallbackData
        ? `EDUMODS FIIs — ${notif.title} (Cotação de Contingência)`
        : `EDUMODS FIIs — ${notif.title}`;

      const pushResult = await dispatchPushToSubscribedDevices({
        userId,
        title: pushTitle,
        body: notif.message,
        tag: notif.id,
        category: notif.category,
        ticker: notif.ticker,
      });

      alreadyDispatched.add(notif.id);
      if (pushResult.deliveredCount > 0) {
        pushedCount += pushResult.deliveredCount;
      }

      const logEntry: ServerNotificationLog = {
        id: `srvlog_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        notificationId: notif.id,
        timestamp: nowIso,
        title: notif.title,
        message: notif.message,
        category: notif.category,
        ticker: notif.ticker,
        channel:
          pushResult.deliveredCount > 0 ? 'web_push_background' : 'sistema_painel',
        deliveredCount: pushResult.deliveredCount,
      };

      state.recentLogs = [logEntry, ...(state.recentLogs || [])].slice(0, 80);

      if (client) {
        try {
          await client.from('fii_notification_logs').upsert(
            {
              user_id: userId,
              notification_id: notif.id,
              category: notif.category,
              title: notif.title,
              message: notif.message,
              ticker: notif.ticker || null,
              channel: logEntry.channel,
              delivered_count: pushResult.deliveredCount,
              created_at: nowIso,
            },
            { onConflict: 'user_id,notification_id' }
          );
        } catch {
          // ignore
        }
      }
    }

    state.dispatchedIds = Array.from(alreadyDispatched).slice(-300);
    const activeSubs = await loadActiveSubscriptions(userId);

    const evaluatedRulesCount =
      (preferences.customAlerts || []).filter((a) => a.isActive).length +
      updatedHoldings.length * 2 +
      dividends.filter((d) => d.status === 'PREVISTO').length;

    const nextMonitoringState: ServerMonitoringDiagnostics = {
      lastMonitorRunAt: nowIso,
      lastQuoteUpdateAt: nowIso,
      quoteSource: marketData.source,
      isFallbackData: marketData.isFallbackData,
      evaluatedCount: evaluatedRulesCount,
      triggeredCount: allNotifications.length,
      pushedCount,
      activeSubscriptionsCount: activeSubs.length,
      lastStatus: marketData.isFallbackData ? 'warning' : 'ok',
      lastError: null,
    };

    state.monitoringState = nextMonitoringState;
    state.portfolioSnapshot = {
      holdings: updatedHoldings,
      dividends,
      preferences,
      goals,
    };
    saveServerState(state);

    if (client) {
      try {
        await client.from('fii_monitoring_state').upsert(
          {
            user_id: userId,
            last_monitor_run_at: nowIso,
            last_quote_update_at: nowIso,
            quote_source: marketData.source,
            is_fallback_data: marketData.isFallbackData,
            evaluated_count: evaluatedRulesCount,
            triggered_count: allNotifications.length,
            pushed_count: pushedCount,
            last_status: nextMonitoringState.lastStatus,
            last_error: null,
            updated_at: nowIso,
          },
          { onConflict: 'user_id' }
        );
      } catch {
        // ignore
      }
    }

    return {
      success: true,
      monitoringState: nextMonitoringState,
      recentLogs: state.recentLogs,
      triggeredNotifications: allNotifications.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        category: n.category,
      })),
      vapidConfiguredFromEnv: vapid.fromEnv,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    state.monitoringState = {
      ...state.monitoringState,
      lastMonitorRunAt: nowIso,
      lastStatus: 'error',
      lastError: errMsg,
    };
    saveServerState(state);

    return {
      success: false,
      monitoringState: state.monitoringState,
      recentLogs: state.recentLogs,
      triggeredNotifications: [],
      vapidConfiguredFromEnv: vapid.fromEnv,
    };
  }
}

export async function getServerMonitoringStatus(overrideSnapshot?: {
  userId?: string;
  holdings?: FIIHolding[];
  dividends?: DividendEvent[];
  preferences?: UserPreferences;
  goals?: PortfolioGoals;
}): Promise<{
  monitoringState: ServerMonitoringDiagnostics;
  recentLogs: ServerNotificationLog[];
  vapidConfiguredFromEnv: boolean;
}> {
  const vapid = getOrInitVapidConfig();
  const state = loadServerState();

  if (overrideSnapshot && Array.isArray(overrideSnapshot.holdings) && overrideSnapshot.preferences) {
    state.portfolioSnapshot = {
      holdings: overrideSnapshot.holdings,
      dividends: overrideSnapshot.dividends || [],
      preferences: overrideSnapshot.preferences,
      goals: overrideSnapshot.goals,
    };
    saveServerState(state);
  }

  // Se ainda não executou nenhum ciclo desde que o servidor subiu, executa o 1º ciclo agora
  if (!state.monitoringState.lastMonitorRunAt) {
    const runRes = await runAutomaticFinancialMonitor(overrideSnapshot);
    return {
      monitoringState: runRes.monitoringState,
      recentLogs: runRes.recentLogs,
      vapidConfiguredFromEnv: runRes.vapidConfiguredFromEnv,
    };
  }

  return {
    monitoringState: state.monitoringState,
    recentLogs: state.recentLogs,
    vapidConfiguredFromEnv: vapid.fromEnv,
  };
}
