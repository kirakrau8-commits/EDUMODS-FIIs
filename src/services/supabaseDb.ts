import { supabase as defaultSupabase, isSupabaseConfigured as defaultIsConfigured } from './supabase';
import {
  FIIHolding,
  Transaction,
  DividendEvent,
  PortfolioGoals,
  UserPreferences,
  OperationType,
  DividendStatus,
} from '../types/fii';
import { VERIFIED_FII_DATABASE } from '../data/fiiDatabase';
import { calculateUnrealizedGain } from '../utils/financialMath';

// Identificador UUID fixo para uso pessoal exclusivo (sem necessidade de login/Auth)
export const PERSONAL_USER_ID = '00000000-0000-4000-8000-000000000001';

// Tópicos internos reservados em fii_notes para garantir persistência de inicialização
// e preferências mesmo em bancos que ainda não criaram a tabela fii_user_profiles
export const SYSTEM_INIT_NOTE_TOPIC = '__edumods_initialized__';
export const SYSTEM_PREFS_NOTE_TOPIC = '__edumods_preferences__';

// Permite injeção de cliente para testes automatizados sem afetar produção
let activeSupabaseClient: any = defaultSupabase;
let activeIsConfiguredOverride: boolean | null = null;

export function setSupabaseClientForTesting(client: any, configured = true): void {
  activeSupabaseClient = client;
  activeIsConfiguredOverride = configured;
}

export function resetSupabaseClientForTesting(): void {
  activeSupabaseClient = defaultSupabase;
  activeIsConfiguredOverride = null;
}

function getClient(): any {
  return activeSupabaseClient;
}

function checkConfigured(): boolean {
  if (activeIsConfiguredOverride !== null) {
    return activeIsConfiguredOverride;
  }
  return defaultIsConfigured();
}

/**
 * Descobre automaticamente se já existe um user_id gravado nas tabelas do Supabase
 * (por exemplo, da conta anterior do proprietário) para manter compatibilidade total,
 * ou retorna o PERSONAL_USER_ID padrão de uso pessoal.
 */
export async function resolvePersonalOwnerUserId(
  fallbackId: string = PERSONAL_USER_ID
): Promise<string> {
  if (!checkConfigured()) return fallbackId;
  const supabase = getClient();

  try {
    const { data: profileRows, error: profErr } = await supabase
      .from('fii_user_profiles')
      .select('user_id, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (!profErr && Array.isArray(profileRows) && profileRows.length > 0 && profileRows[0]?.user_id) {
      return String(profileRows[0].user_id);
    }
  } catch {
    // Ignora se tabela não existir ou bloquear
  }

  try {
    const { data: holdingRows, error: holdErr } = await supabase
      .from('fii_holdings')
      .select('user_id')
      .limit(1);

    if (!holdErr && Array.isArray(holdingRows) && holdingRows.length > 0 && holdingRows[0]?.user_id) {
      return String(holdingRows[0].user_id);
    }
  } catch {
    // Ignora
  }

  return fallbackId;
}

/**
 * Interface do Perfil do Usuário armazenado no Supabase
 */
export interface SupabaseUserProfile {
  id?: string;
  user_id: string;
  full_name?: string;
  plan?: string;
  role?: string;
  preferences?: Partial<UserPreferences>;
  is_initialized: boolean;
  updated_at?: string;
}

/**
 * Interface dos registros de Posições (fii_holdings) no Supabase
 */
interface RawHoldingRow {
  id?: string;
  user_id: string;
  ticker: string;
  quantity: number | string;
  average_price: number | string | null;
  category: string;
  segment: string;
  notes: string | null;
  target_percentage: number | string | null;
  is_favorite?: boolean | null;
  name?: string | null;
  current_price?: number | string | null;
  vpa?: number | string | null;
  last_dividend?: number | string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Interface dos registros de Operações (fii_transactions) no Supabase
 */
interface RawTransactionRow {
  id?: string;
  user_id: string;
  ticker: string;
  type: string;
  date: string;
  quantity: number | string;
  price: number | string | null;
  fees: number | string;
  realized_result?: number | string | null;
  broker?: string | null;
  notes?: string | null;
  created_at?: string;
}

/**
 * Interface dos registros de Proventos (fii_dividends) no Supabase
 */
interface RawDividendRow {
  id?: string;
  user_id: string;
  ticker: string;
  payment_date: string;
  base_date?: string | null;
  quantity_eligible?: number | string | null;
  value_per_share: number | string;
  total_value: number | string;
  status: string;
  is_manual?: boolean | null;
  created_at?: string;
}

/**
 * Interface dos registros de Metas (fii_goals) no Supabase
 */
interface RawGoalsRow {
  id?: string;
  user_id: string;
  target_equity: number | string;
  target_monthly_dividend: number | string;
  current_living_expenses?: number | string | null;
  fire_safe_yield_percent?: number | string | null;
  hide_values?: boolean | null;
  updated_at?: string;
}

/**
 * Interface dos registros de Notas (fii_notes) no Supabase
 */
interface RawNoteRow {
  id?: string;
  user_id: string;
  topic: string;
  content: string;
  updated_at?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ANY_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Verifica se uma string é um UUID compatível com colunas UUID do PostgreSQL
 */
export const isValidUuid = (value?: string | null): boolean => {
  if (!value || typeof value !== 'string') return false;
  return ANY_UUID_REGEX.test(value.trim());
};

/**
 * Gera sempre um UUID v4 RFC 4122 válido (36 caracteres), 100% compatível
 * com colunas UUID nativas do PostgreSQL no Supabase.
 */
export const generateSecureId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    const uuid = crypto.randomUUID();
    if (UUID_REGEX.test(uuid)) {
      return uuid;
    }
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Garante que o ID seja um UUID válido para o PostgreSQL; se não for, gera um novo UUID v4.
 */
export const ensureValidUuid = (id?: string | null): string => {
  if (id && isValidUuid(id)) {
    return id.trim();
  }
  return generateSecureId();
};

function isMissingColumnOrSchemaError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  const code = error.code || '';
  return (
    code === 'PGRST204' ||
    code === '42703' ||
    msg.includes('column') ||
    msg.includes('does not exist') ||
    msg.includes('schema cache')
  );
}

function isCheckConstraintError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  const code = error.code || '';
  return code === '23514' || msg.includes('check constraint') || msg.includes('violates check');
}

function isUniqueConstraintMissingError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  const code = error.code || '';
  return (
    code === '42P10' ||
    msg.includes('no unique or exclusion constraint') ||
    msg.includes('there is no unique')
  );
}

/**
 * Fallback seguro para bancos em que o índice UNIQUE de onConflict ainda não foi criado:
 * consulta pela chave lógica e executa UPDATE (se existir) ou INSERT (se não existir).
 */
async function upsertWithLookupFallback(
  table: string,
  payload: Record<string, any>,
  conflictColumns: string[]
): Promise<{ error: { message: string; code?: string } | null }> {
  const supabase = getClient();
  const onConflict = conflictColumns.join(',');

  const { error } = await supabase.from(table).upsert(payload, { onConflict });
  if (!error) {
    return { error: null };
  }

  if (isUniqueConstraintMissingError(error)) {
    let selectQuery = supabase.from(table).select('id');
    for (const col of conflictColumns) {
      selectQuery = selectQuery.eq(col, payload[col]);
    }
    const { data: existingRows, error: selectErr } = await selectQuery;
    if (selectErr) {
      return { error: selectErr };
    }

    if (Array.isArray(existingRows) && existingRows.length > 0) {
      let updateQuery = supabase.from(table).update(payload);
      for (const col of conflictColumns) {
        updateQuery = updateQuery.eq(col, payload[col]);
      }
      const { error: updateErr } = await updateQuery;
      return { error: updateErr };
    } else {
      const insertPayload = { id: payload.id || generateSecureId(), ...payload };
      if (typeof supabase.from(table).insert === 'function') {
        const { error: insertErr } = await supabase.from(table).insert(insertPayload);
        return { error: insertErr };
      }
      const { error: fallbackUpsertErr } = await supabase
        .from(table)
        .upsert(insertPayload, { onConflict: 'id' });
      return { error: fallbackUpsertErr };
    }
  }

  return { error };
}

// ============================================================================
// 1. GESTÃO DE PERFIL, PREFERÊNCIAS E ESTADO DE INICIALIZAÇÃO
// ============================================================================

/**
 * Remove qualquer campo administrativo (plan, role, activePlan) do objeto de preferências
 * visuais/funcionais para impedir escalonamento de privilégios pelo cliente.
 */
export function sanitizeVisualPreferences(
  prefs?: Partial<UserPreferences> | null
): Partial<UserPreferences> {
  if (!prefs || typeof prefs !== 'object') return {};
  const clean: Partial<UserPreferences> = {};
  if (prefs.hideValues !== undefined) clean.hideValues = Boolean(prefs.hideValues);
  if (typeof prefs.currency === 'string') clean.currency = prefs.currency;
  if (prefs.autoRefreshQuotes !== undefined) clean.autoRefreshQuotes = Boolean(prefs.autoRefreshQuotes);
  if (typeof prefs.maxConcentrationAlertPercent === 'number') {
    clean.maxConcentrationAlertPercent = prefs.maxConcentrationAlertPercent;
  }
  if (typeof prefs.minYieldAlertPercent === 'number') {
    clean.minYieldAlertPercent = prefs.minYieldAlertPercent;
  }
  if (typeof prefs.brapiToken === 'string') clean.brapiToken = prefs.brapiToken;
  if (typeof prefs.provider2Name === 'string') clean.provider2Name = prefs.provider2Name;
  if (prefs.provider2Enabled !== undefined) clean.provider2Enabled = Boolean(prefs.provider2Enabled);
  if (typeof prefs.provider2Endpoint === 'string') clean.provider2Endpoint = prefs.provider2Endpoint;
  if (typeof prefs.provider2ApiKey === 'string') clean.provider2ApiKey = prefs.provider2ApiKey;
  if (typeof prefs.provider3Name === 'string') clean.provider3Name = prefs.provider3Name;
  if (prefs.provider3Enabled !== undefined) clean.provider3Enabled = Boolean(prefs.provider3Enabled);
  if (typeof prefs.provider3Endpoint === 'string') clean.provider3Endpoint = prefs.provider3Endpoint;
  if (typeof prefs.provider3ApiKey === 'string') clean.provider3ApiKey = prefs.provider3ApiKey;
  if (Array.isArray(prefs.customAlerts)) clean.customAlerts = prefs.customAlerts;
  return clean;
}

export async function fetchUserProfile(userId: string): Promise<SupabaseUserProfile | null> {
  if (!checkConfigured() || !userId) return null;
  const supabase = getClient();

  let profileFromTable: SupabaseUserProfile | null = null;

  try {
    let { data, error } = await supabase
      .from('fii_user_profiles')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: true });

    if (error && isMissingColumnOrSchemaError(error)) {
      const retry = await supabase
        .from('fii_user_profiles')
        .select('*')
        .eq('user_id', userId);
      data = retry.data;
      error = retry.error;
    }

    if (!error && Array.isArray(data) && data.length > 0) {
      const rows = [...(data as Array<SupabaseUserProfile & { created_at?: string }>)];
      // Ordena do mais antigo para o mais recente usando updated_at (ou created_at) se presente,
      // para consolidar campos válidos sem descartar dados nem falhar com PGRST116
      rows.sort((a, b) => {
        const timeA = a.updated_at ? Date.parse(a.updated_at) : a.created_at ? Date.parse(a.created_at) : 0;
        const timeB = b.updated_at ? Date.parse(b.updated_at) : b.created_at ? Date.parse(b.created_at) : 0;
        return (isNaN(timeA) ? 0 : timeA) - (isNaN(timeB) ? 0 : timeB);
      });

      const mergedPrefs: Partial<UserPreferences> = {};
      let mergedFullName: string | undefined;
      let mergedPlan: string | undefined;
      let mergedRole: string | undefined;
      let anyInitialized = false;
      let latestId: string | undefined;
      let latestUpdatedAt: string | undefined;

      for (const r of rows) {
        if (r.id) latestId = r.id;
        if (r.updated_at) latestUpdatedAt = r.updated_at;
        if (r.is_initialized) anyInitialized = true;
        if (r.full_name && r.full_name.trim() !== '') mergedFullName = r.full_name;
        if (r.plan && r.plan.trim() !== '' && (!mergedPlan || r.plan !== 'Gratuito')) {
          mergedPlan = r.plan;
        }
        if (r.role && r.role.trim() !== '' && (!mergedRole || r.role !== 'user')) {
          mergedRole = r.role;
        }
        if (r.preferences && typeof r.preferences === 'object') {
          Object.assign(mergedPrefs, sanitizeVisualPreferences(r.preferences));
        }
      }

      profileFromTable = {
        id: latestId,
        user_id: userId,
        full_name: mergedFullName,
        plan: mergedPlan || 'Gratuito',
        role: mergedRole || 'user',
        preferences: Object.keys(mergedPrefs).length > 0 ? mergedPrefs : undefined,
        is_initialized: anyInitialized,
        updated_at: latestUpdatedAt,
      };
    }
  } catch {
    // Tabela fii_user_profiles pode ainda não existir se a migração não foi rodada
  }

  // Fallback de inicialização e preferências via fii_notes (compatível com schema original)
  let initializedFromNotes = false;
  let prefsFromNotes: Partial<UserPreferences> | undefined;

  try {
    const { data: sysNotes, error: notesError } = await supabase
      .from('fii_notes')
      .select('topic, content, updated_at')
      .eq('user_id', userId)
      .in('topic', [SYSTEM_INIT_NOTE_TOPIC, SYSTEM_PREFS_NOTE_TOPIC]);

    if (!notesError && Array.isArray(sysNotes)) {
      const sortedNotes = [...sysNotes].sort((a: any, b: any) => {
        const tA = a.updated_at ? Date.parse(a.updated_at) : 0;
        const tB = b.updated_at ? Date.parse(b.updated_at) : 0;
        return (isNaN(tA) ? 0 : tA) - (isNaN(tB) ? 0 : tB);
      });
      for (const row of sortedNotes) {
        if (row.topic === SYSTEM_INIT_NOTE_TOPIC && row.content === 'true') {
          initializedFromNotes = true;
        }
        if (row.topic === SYSTEM_PREFS_NOTE_TOPIC && row.content) {
          try {
            const parsed = JSON.parse(row.content);
            prefsFromNotes = {
              ...(prefsFromNotes || {}),
              ...sanitizeVisualPreferences(parsed),
            };
          } catch {
            // Ignora JSON inválido
          }
        }
      }
    }
  } catch {
    // Ignora se falhar
  }

  if (profileFromTable) {
    return {
      ...profileFromTable,
      is_initialized: Boolean(profileFromTable.is_initialized || initializedFromNotes),
      preferences: profileFromTable.preferences
        ? { ...(prefsFromNotes || {}), ...profileFromTable.preferences }
        : prefsFromNotes,
    };
  }

  if (initializedFromNotes || prefsFromNotes) {
    return {
      user_id: userId,
      plan: 'Gratuito',
      role: 'user',
      is_initialized: initializedFromNotes,
      preferences: prefsFromNotes,
    };
  }

  return null;
}

export async function markUserInitialized(
  userId: string,
  extra?: { fullName?: string; preferences?: UserPreferences }
): Promise<void> {
  if (!checkConfigured() || !userId) return;
  const nowIso = new Date().toISOString();
  const cleanPrefs = extra?.preferences ? sanitizeVisualPreferences(extra.preferences) : undefined;

  let savedInProfile = false;
  let savedInNotes = false;
  let lastError: string | null = null;

  // 1. Tenta gravar na tabela dedicada fii_user_profiles (sem tocar em plan ou role)
  try {
    const payload: Record<string, unknown> = {
      user_id: userId,
      is_initialized: true,
      updated_at: nowIso,
    };
    if (extra?.fullName) payload.full_name = extra.fullName;
    if (cleanPrefs) payload.preferences = cleanPrefs;

    const { error } = await upsertWithLookupFallback('fii_user_profiles', payload, ['user_id']);

    if (!error) {
      savedInProfile = true;
    } else {
      lastError = error.message;
    }
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
  }

  // 2. Grava marcador redundante em fii_notes (compatível com o schema original)
  try {
    const { error: noteError } = await upsertWithLookupFallback(
      'fii_notes',
      {
        user_id: userId,
        topic: SYSTEM_INIT_NOTE_TOPIC,
        content: 'true',
        updated_at: nowIso,
      },
      ['user_id', 'topic']
    );
    if (!noteError) {
      savedInNotes = true;
    } else if (!lastError) {
      lastError = noteError.message;
    }

    if (cleanPrefs) {
      await upsertWithLookupFallback(
        'fii_notes',
        {
          user_id: userId,
          topic: SYSTEM_PREFS_NOTE_TOPIC,
          content: JSON.stringify(cleanPrefs),
          updated_at: nowIso,
        },
        ['user_id', 'topic']
      );
    }
  } catch (err) {
    if (!lastError) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  if (!savedInProfile && !savedInNotes && lastError) {
    throw new Error(`Falha ao registrar estado de inicialização da conta: ${lastError}`);
  }
}

export async function saveUserPreferencesToDb(
  userId: string,
  preferences: UserPreferences
): Promise<void> {
  if (!checkConfigured() || !userId) return;
  const supabase = getClient();
  const nowIso = new Date().toISOString();
  const cleanPreferences = sanitizeVisualPreferences(preferences);

  let savedSomewhere = false;
  let lastError: string | null = null;

  // 1. Salvar em fii_user_profiles (NUNCA envia role ou plan a partir do cliente)
  try {
    const { error } = await upsertWithLookupFallback(
      'fii_user_profiles',
      {
        user_id: userId,
        is_initialized: true,
        preferences: cleanPreferences,
        updated_at: nowIso,
      },
      ['user_id']
    );
    if (!error) {
      savedSomewhere = true;
    } else {
      lastError = error.message;
    }
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
  }

  // 2. Salvar em fii_notes (fallback compatível com schema original)
  try {
    const { error: noteErr } = await upsertWithLookupFallback(
      'fii_notes',
      {
        user_id: userId,
        topic: SYSTEM_PREFS_NOTE_TOPIC,
        content: JSON.stringify(cleanPreferences),
        updated_at: nowIso,
      },
      ['user_id', 'topic']
    );
    if (!noteErr) {
      savedSomewhere = true;
    } else if (!lastError) {
      lastError = noteErr.message;
    }
  } catch (err) {
    if (!lastError) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  // 3. Atualizar hide_values em fii_goals caso já exista linha para o usuário
  try {
    await supabase
      .from('fii_goals')
      .update({ hide_values: Boolean(cleanPreferences.hideValues), updated_at: nowIso })
      .eq('user_id', userId);
  } catch {
    // Não bloqueante se a linha de metas ainda não existir
  }

  if (!savedSomewhere && lastError) {
    throw new Error(`Erro ao salvar preferências no Supabase: ${lastError}`);
  }
}

// ============================================================================
// 2. POSIÇÕES / HOLDINGS (fii_holdings)
// ============================================================================

export async function fetchHoldingsFromDb(userId: string): Promise<FIIHolding[]> {
  if (!checkConfigured() || !userId) return [];
  const supabase = getClient();

  const { data, error } = await supabase
    .from('fii_holdings')
    .select('*')
    .eq('user_id', userId)
    .order('ticker', { ascending: true });

  if (error) {
    console.error('Erro ao buscar fii_holdings no Supabase:', error.message);
    throw new Error(`Falha ao carregar carteira do Supabase: ${error.message}`);
  }

  const rows = (data || []) as RawHoldingRow[];

  return rows.map((row) => {
    const ticker = row.ticker.toUpperCase().trim();
    const qty = Number(row.quantity) || 0;
    const avgPrice = Number(row.average_price) || 0;
    const target =
      row.target_percentage !== null && row.target_percentage !== undefined
        ? Number(row.target_percentage)
        : 10;
    const dbInfo = VERIFIED_FII_DATABASE[ticker];

    const storedCurPrice =
      row.current_price !== null && row.current_price !== undefined ? Number(row.current_price) : 0;
    const storedVpa = row.vpa !== null && row.vpa !== undefined ? Number(row.vpa) : 0;
    const storedLastDiv =
      row.last_dividend !== null && row.last_dividend !== undefined
        ? Number(row.last_dividend)
        : 0;

    const currentPrice =
      storedCurPrice > 0 ? storedCurPrice : dbInfo ? dbInfo.currentPrice : avgPrice;
    const vpa =
      storedVpa > 0 ? storedVpa : dbInfo ? dbInfo.vpa : currentPrice > 0 ? currentPrice : 100;
    const pvp = vpa > 0 ? Number((currentPrice / vpa).toFixed(2)) : 1;
    const lastDiv = storedLastDiv > 0 ? storedLastDiv : dbInfo ? dbInfo.lastDividend : 0.8;
    const monthlyDY = currentPrice > 0 ? (lastDiv / currentPrice) * 100 : 0.85;

    const { marketValue, unrealizedGain, unrealizedGainPercent } = calculateUnrealizedGain(
      qty,
      avgPrice,
      currentPrice
    );

    return {
      ticker,
      name: row.name || (dbInfo ? dbInfo.name : `${ticker} FII`),
      category: (row.category as any) || (dbInfo ? dbInfo.category : 'Tijolo'),
      segment: (row.segment as any) || (dbInfo ? dbInfo.segment : 'Logística'),
      quantity: qty,
      averagePrice: avgPrice,
      currentPrice,
      totalCost: Number((qty * avgPrice).toFixed(2)),
      marketValue,
      unrealizedGain,
      unrealizedGainPercent,
      monthlyYieldPerShare: lastDiv,
      monthlyDividendYield: Number(monthlyDY.toFixed(2)),
      annualDividendYield: dbInfo ? dbInfo.annualDY : Number((monthlyDY * 12).toFixed(2)),
      vpa,
      pvp,
      portfolioWeight: 0,
      targetWeight: target,
      manager: dbInfo?.manager || 'Gestão Ativa',
      indexer: dbInfo?.indexer || 'IPCA',
      locationStates: dbInfo?.locationStates || ['SP'],
      lastQuoteUpdate: 'B3 / BRAPI',
      quoteSource: 'Supabase DB / B3',
      notes: row.notes || '',
      isFavorite: Boolean(row.is_favorite),
    };
  });
}

export async function saveHoldingToDb(userId: string, holding: FIIHolding): Promise<void> {
  if (!checkConfigured() || !userId) return;
  const cleanTicker = holding.ticker.toUpperCase().trim();
  const nowIso = new Date().toISOString();

  const extendedPayload: RawHoldingRow = {
    user_id: userId,
    ticker: cleanTicker,
    quantity: holding.quantity,
    average_price: holding.averagePrice ?? null,
    category: holding.category,
    segment: holding.segment,
    notes: holding.notes || '',
    target_percentage: holding.targetWeight ?? 10,
    is_favorite: Boolean(holding.isFavorite),
    name: holding.name || cleanTicker,
    current_price: holding.currentPrice,
    vpa: holding.vpa,
    last_dividend: holding.monthlyYieldPerShare,
    updated_at: nowIso,
  };

  const { error } = await upsertWithLookupFallback('fii_holdings', extendedPayload, [
    'user_id',
    'ticker',
  ]);

  if (error) {
    if (isMissingColumnOrSchemaError(error)) {
      // Fallback para bancos que ainda não executaram a migração de novas colunas
      const legacyPayload = {
        user_id: userId,
        ticker: cleanTicker,
        quantity: holding.quantity,
        average_price: holding.averagePrice,
        category: holding.category,
        segment: holding.segment,
        notes: holding.notes || '',
        target_percentage: holding.targetWeight ?? 10,
        updated_at: nowIso,
      };

      const { error: retryError } = await upsertWithLookupFallback(
        'fii_holdings',
        legacyPayload,
        ['user_id', 'ticker']
      );

      if (retryError) {
        console.error(`Erro ao salvar holding ${cleanTicker} no Supabase:`, retryError.message);
        throw new Error(`Erro ao salvar ${cleanTicker} no banco de dados: ${retryError.message}`);
      }
      return;
    }

    console.error(`Erro ao salvar holding ${cleanTicker} no Supabase:`, error.message);
    throw new Error(`Erro ao salvar ${cleanTicker} no banco de dados: ${error.message}`);
  }
}

export async function deleteHoldingFromDb(userId: string, ticker: string): Promise<void> {
  if (!checkConfigured() || !userId) return;
  const supabase = getClient();

  const cleanTicker = ticker.toUpperCase().trim();
  const { error } = await supabase
    .from('fii_holdings')
    .delete()
    .eq('user_id', userId)
    .eq('ticker', cleanTicker);

  if (error) {
    console.error(`Erro ao excluir holding ${cleanTicker} no Supabase:`, error.message);
    throw new Error(`Erro ao excluir ${cleanTicker} no Supabase: ${error.message}`);
  }

  // Verificação contra bloqueio silencioso de RLS (PostgreSQL retorna error: null e 0 linhas removidas se faltar política FOR DELETE)
  const { data: remaining, error: checkError } = await supabase
    .from('fii_holdings')
    .select('id')
    .eq('user_id', userId)
    .eq('ticker', cleanTicker);

  if (!checkError && Array.isArray(remaining) && remaining.length > 0) {
    throw new Error(
      `A exclusão de ${cleanTicker} foi bloqueada pelas políticas RLS do Supabase (0 linhas removidas). Execute o script supabase-migration.sql no SQL Editor do Supabase para habilitar a política DELETE.`
    );
  }
}

// ============================================================================
// 3. TRANSAÇÕES / OPERAÇÕES (fii_transactions)
// ============================================================================

export async function fetchTransactionsFromDb(userId: string): Promise<Transaction[]> {
  if (!checkConfigured() || !userId) return [];
  const supabase = getClient();

  const { data, error } = await supabase
    .from('fii_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error) {
    console.error('Erro ao buscar fii_transactions no Supabase:', error.message);
    throw new Error(`Falha ao carregar transações do Supabase: ${error.message}`);
  }

  const rows = (data || []) as RawTransactionRow[];

  return rows.map((row) => {
    const qty = Number(row.quantity) || 0;
    const price = Number(row.price) || 0;
    const fees = Number(row.fees) || 0;
    const isVenda = row.type.toUpperCase() === 'VENDA';
    const total = isVenda ? qty * price - fees : qty * price + fees;

    let cleanType: OperationType = 'COMPRA';
    const upper = row.type.toUpperCase();
    if (upper === 'VENDA') cleanType = 'VENDA';
    else if (upper === 'SUBSCRICAO' || upper === 'SUBCRICAO') cleanType = 'SUBSCRICAO';
    else if (upper === 'AMORTIZACAO') cleanType = 'AMORTIZACAO';

    const realizedResult =
      row.realized_result !== null && row.realized_result !== undefined
        ? Number(row.realized_result)
        : undefined;

    return {
      id: ensureValidUuid(row.id),
      ticker: row.ticker.toUpperCase().trim(),
      type: cleanType,
      date: row.date,
      quantity: qty,
      price: price,
      fees: fees,
      total: Number(total.toFixed(2)),
      realizedResult,
      notes: row.notes || '',
    };
  });
}

export async function saveTransactionToDb(userId: string, tx: Transaction): Promise<string> {
  if (!checkConfigured() || !userId) return ensureValidUuid(tx.id);
  const supabase = getClient();

  const rowId = ensureValidUuid(tx.id);

  const extendedPayload: RawTransactionRow = {
    id: rowId,
    user_id: userId,
    ticker: tx.ticker.toUpperCase().trim(),
    type: tx.type,
    date: tx.date,
    quantity: tx.quantity,
    price: tx.price ?? null,
    fees: tx.fees || 0,
    realized_result: tx.realizedResult !== undefined ? tx.realizedResult : null,
    broker: 'B3 Oficial',
    notes: tx.notes || '',
  };

  const { data, error } = await supabase
    .from('fii_transactions')
    .upsert(extendedPayload, { onConflict: 'id' })
    .select('id')
    .single();

  if (error) {
    if (isMissingColumnOrSchemaError(error) || isCheckConstraintError(error)) {
      // No schema original, SUBSCRICAO estava grafado como SUBCRICAO e não havia realized_result
      const legacyType = tx.type === 'SUBSCRICAO' ? 'SUBCRICAO' : tx.type;
      const legacyPayload = {
        id: rowId,
        user_id: userId,
        ticker: tx.ticker.toUpperCase().trim(),
        type: legacyType,
        date: tx.date,
        quantity: tx.quantity,
        price: tx.price,
        fees: tx.fees || 0,
        broker: 'B3 Oficial',
        notes: tx.notes || '',
      };

      const { data: retryData, error: retryError } = await supabase
        .from('fii_transactions')
        .upsert(legacyPayload, { onConflict: 'id' })
        .select('id')
        .single();

      if (retryError) {
        console.error('Erro ao salvar transação no Supabase:', retryError.message);
        throw new Error(`Erro ao salvar operação no Supabase: ${retryError.message}`);
      }

      return retryData?.id || rowId;
    }

    console.error('Erro ao salvar transação no Supabase:', error.message);
    throw new Error(`Erro ao salvar operação no Supabase: ${error.message}`);
  }

  return data?.id || rowId;
}

export async function deleteTransactionFromDb(userId: string, txId: string): Promise<void> {
  if (!checkConfigured() || !userId) return;
  const supabase = getClient();

  const { error } = await supabase
    .from('fii_transactions')
    .delete()
    .eq('user_id', userId)
    .eq('id', txId);

  if (error) {
    console.error(`Erro ao excluir transação ${txId} no Supabase:`, error.message);
    throw new Error(`Erro ao excluir transação no Supabase: ${error.message}`);
  }

  // Verificação contra bloqueio silencioso de RLS no DELETE
  const { data: remaining, error: checkError } = await supabase
    .from('fii_transactions')
    .select('id')
    .eq('user_id', userId)
    .eq('id', txId);

  if (!checkError && Array.isArray(remaining) && remaining.length > 0) {
    throw new Error(
      'A exclusão da operação foi bloqueada pelas políticas RLS do Supabase (0 linhas removidas). Execute o script supabase-migration.sql no SQL Editor do Supabase para habilitar a política DELETE.'
    );
  }
}

// ============================================================================
// 4. PROVENTOS / RENDIMENTOS (fii_dividends)
// ============================================================================

export async function fetchDividendsFromDb(userId: string): Promise<DividendEvent[]> {
  if (!checkConfigured() || !userId) return [];
  const supabase = getClient();

  const { data, error } = await supabase
    .from('fii_dividends')
    .select('*')
    .eq('user_id', userId)
    .order('payment_date', { ascending: false });

  if (error) {
    console.error('Erro ao buscar fii_dividends no Supabase:', error.message);
    throw new Error(`Falha ao carregar proventos do Supabase: ${error.message}`);
  }

  const rows = (data || []) as RawDividendRow[];

  return rows.map((row) => {
    const rate = Number(row.value_per_share) || 0;
    const total = Number(row.total_value) || 0;
    const storedQty =
      row.quantity_eligible !== null && row.quantity_eligible !== undefined
        ? Number(row.quantity_eligible)
        : 0;
    const qty = storedQty > 0 ? storedQty : rate > 0 ? Math.round(total / rate) : 0;

    let cleanStatus: DividendStatus = 'RECEBIDO';
    const upper = (row.status || '').toUpperCase();
    if (upper === 'PREVISTO') cleanStatus = 'PREVISTO';
    else if (upper === 'CANCELADO') cleanStatus = 'CANCELADO';
    else if (upper === 'PAGO' || upper === 'RECEBIDO') cleanStatus = 'RECEBIDO';

    return {
      id: ensureValidUuid(row.id),
      ticker: row.ticker.toUpperCase().trim(),
      dataCom: row.base_date || row.payment_date,
      paymentDate: row.payment_date,
      quantityEligible: qty,
      ratePerShare: rate,
      totalAmount: total,
      status: cleanStatus,
      isManual: row.is_manual !== null && row.is_manual !== undefined ? Boolean(row.is_manual) : true,
    };
  });
}

export async function saveDividendToDb(userId: string, div: DividendEvent): Promise<string> {
  if (!checkConfigured() || !userId) return ensureValidUuid(div.id);
  const supabase = getClient();

  const rowId = ensureValidUuid(div.id);
  const dbStatus = div.status === 'RECEBIDO' ? 'PAGO' : div.status;

  const extendedPayload: RawDividendRow = {
    id: rowId,
    user_id: userId,
    ticker: div.ticker.toUpperCase().trim(),
    payment_date: div.paymentDate,
    base_date: div.dataCom || div.paymentDate,
    quantity_eligible: div.quantityEligible,
    value_per_share: div.ratePerShare,
    total_value: div.totalAmount,
    status: dbStatus,
    is_manual: div.isManual ?? true,
  };

  const { data, error } = await supabase
    .from('fii_dividends')
    .upsert(extendedPayload, { onConflict: 'id' })
    .select('id')
    .single();

  if (error) {
    if (isMissingColumnOrSchemaError(error) || isCheckConstraintError(error)) {
      const legacyStatus = div.status === 'PREVISTO' || div.status === 'CANCELADO' ? 'PREVISTO' : 'PAGO';
      const legacyPayload = {
        id: rowId,
        user_id: userId,
        ticker: div.ticker.toUpperCase().trim(),
        payment_date: div.paymentDate,
        base_date: div.dataCom || div.paymentDate,
        value_per_share: div.ratePerShare,
        total_value: div.totalAmount,
        status: legacyStatus,
      };

      const { data: retryData, error: retryError } = await supabase
        .from('fii_dividends')
        .upsert(legacyPayload, { onConflict: 'id' })
        .select('id')
        .single();

      if (retryError) {
        console.error('Erro ao salvar dividendo no Supabase:', retryError.message);
        throw new Error(`Erro ao salvar provento no Supabase: ${retryError.message}`);
      }

      return retryData?.id || rowId;
    }

    console.error('Erro ao salvar dividendo no Supabase:', error.message);
    throw new Error(`Erro ao salvar provento no Supabase: ${error.message}`);
  }

  return data?.id || rowId;
}

export async function deleteDividendFromDb(userId: string, divId: string): Promise<void> {
  if (!checkConfigured() || !userId) return;
  const supabase = getClient();

  const { error } = await supabase
    .from('fii_dividends')
    .delete()
    .eq('user_id', userId)
    .eq('id', divId);

  if (error) {
    console.error(`Erro ao excluir provento ${divId} no Supabase:`, error.message);
    throw new Error(`Erro ao excluir dividendo no Supabase: ${error.message}`);
  }

  // Verificação contra bloqueio silencioso de RLS no DELETE
  const { data: remaining, error: checkError } = await supabase
    .from('fii_dividends')
    .select('id')
    .eq('user_id', userId)
    .eq('id', divId);

  if (!checkError && Array.isArray(remaining) && remaining.length > 0) {
    throw new Error(
      'A exclusão do provento foi bloqueada pelas políticas RLS do Supabase (0 linhas removidas). Execute o script supabase-migration.sql no SQL Editor do Supabase para habilitar a política DELETE.'
    );
  }
}

// ============================================================================
// 5. METAS PATRIMONIAIS (fii_goals)
// ============================================================================

export interface LoadedGoalsResult {
  goals: PortfolioGoals;
  hideValues?: boolean;
}

export async function fetchGoalsWithMetaFromDb(userId: string): Promise<LoadedGoalsResult | null> {
  if (!checkConfigured() || !userId) return null;
  const supabase = getClient();

  let { data, error } = await supabase
    .from('fii_goals')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: true });

  if (error && isMissingColumnOrSchemaError(error)) {
    const retry = await supabase
      .from('fii_goals')
      .select('*')
      .eq('user_id', userId);
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error('Erro ao consultar fii_goals no Supabase:', error.message);
    throw new Error(`Falha ao carregar metas do Supabase: ${error.message}`);
  }

  if (!Array.isArray(data) || data.length === 0) return null;

  const rows = [...(data as Array<RawGoalsRow & { created_at?: string }>)];
  // Garante ordenação determinística do mais antigo para o mais recente caso existam múltiplos registros
  rows.sort((a, b) => {
    const timeA = a.updated_at ? Date.parse(a.updated_at) : a.created_at ? Date.parse(a.created_at) : 0;
    const timeB = b.updated_at ? Date.parse(b.updated_at) : b.created_at ? Date.parse(b.created_at) : 0;
    return (isNaN(timeA) ? 0 : timeA) - (isNaN(timeB) ? 0 : timeB);
  });

  // Consolida metas válidas sem descartar valores personalizados caso haja mais de uma linha
  let monthlyIncomeGoal = 5000;
  let totalEquityGoal = 500000;
  let currentLivingExpenses = 4500;
  let fireSafeYieldPercent = 9.5;
  let hideValues: boolean | undefined = undefined;

  let hasCustomIncome = false;
  let hasCustomEquity = false;
  let hasCustomExpenses = false;
  let hasCustomYield = false;

  for (const row of rows) {
    const inc = Number(row.target_monthly_dividend);
    if (inc > 0 && (!hasCustomIncome || inc !== 5000)) {
      monthlyIncomeGoal = inc;
      if (inc !== 5000) hasCustomIncome = true;
    }

    const eq = Number(row.target_equity);
    if (eq > 0 && (!hasCustomEquity || eq !== 500000)) {
      totalEquityGoal = eq;
      if (eq !== 500000) hasCustomEquity = true;
    }

    const exp = Number(row.current_living_expenses);
    if (exp > 0 && (!hasCustomExpenses || exp !== 4500)) {
      currentLivingExpenses = exp;
      if (exp !== 4500) hasCustomExpenses = true;
    }

    const yld = Number(row.fire_safe_yield_percent);
    if (yld > 0 && (!hasCustomYield || yld !== 9.5)) {
      fireSafeYieldPercent = yld;
      if (yld !== 9.5) hasCustomYield = true;
    }

    if (row.hide_values !== null && row.hide_values !== undefined) {
      hideValues = Boolean(row.hide_values);
    }
  }

  return {
    goals: {
      monthlyIncomeGoal,
      totalEquityGoal,
      currentLivingExpenses,
      fireSafeYieldPercent,
    },
    hideValues,
  };
}

export async function fetchGoalsFromDb(userId: string): Promise<PortfolioGoals | null> {
  const res = await fetchGoalsWithMetaFromDb(userId);
  return res ? res.goals : null;
}

export async function saveGoalsToDb(
  userId: string,
  goals: PortfolioGoals,
  hideValues?: boolean
): Promise<void> {
  if (!checkConfigured() || !userId) return;
  const nowIso = new Date().toISOString();

  const extendedPayload: RawGoalsRow = {
    user_id: userId,
    target_equity: goals.totalEquityGoal,
    target_monthly_dividend: goals.monthlyIncomeGoal,
    current_living_expenses: goals.currentLivingExpenses,
    fire_safe_yield_percent: goals.fireSafeYieldPercent,
    ...(hideValues !== undefined ? { hide_values: hideValues } : {}),
    updated_at: nowIso,
  };

  const { error } = await upsertWithLookupFallback('fii_goals', extendedPayload, ['user_id']);

  if (error) {
    if (isMissingColumnOrSchemaError(error)) {
      const legacyPayload: Record<string, unknown> = {
        user_id: userId,
        target_equity: goals.totalEquityGoal,
        target_monthly_dividend: goals.monthlyIncomeGoal,
        updated_at: nowIso,
      };
      if (hideValues !== undefined) {
        legacyPayload.hide_values = hideValues;
      }

      const { error: retryError } = await upsertWithLookupFallback('fii_goals', legacyPayload, [
        'user_id',
      ]);

      if (retryError) {
        console.error('Erro ao salvar metas no Supabase:', retryError.message);
        throw new Error(`Erro ao salvar metas no Supabase: ${retryError.message}`);
      }
      return;
    }

    console.error('Erro ao salvar metas no Supabase:', error.message);
    throw new Error(`Erro ao salvar metas no Supabase: ${error.message}`);
  }
}

// ============================================================================
// 6. ANOTAÇÕES & TESES ESTRATÉGICAS (fii_notes)
// ============================================================================

export async function fetchNotesFromDb(userId: string): Promise<Record<string, string>> {
  if (!checkConfigured() || !userId) return {};
  const supabase = getClient();

  const { data, error } = await supabase
    .from('fii_notes')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Erro ao consultar fii_notes no Supabase:', error.message);
    throw new Error(`Falha ao carregar anotações do Supabase: ${error.message}`);
  }

  const rows = [...((data || []) as RawNoteRow[])];
  rows.sort((a, b) => {
    const tA = a.updated_at ? Date.parse(a.updated_at) : 0;
    const tB = b.updated_at ? Date.parse(b.updated_at) : 0;
    return (isNaN(tA) ? 0 : tA) - (isNaN(tB) ? 0 : tB);
  });

  const map: Record<string, string> = {};
  rows.forEach((n) => {
    // Ignora tópicos internos de sistema
    if (!n.topic.startsWith('__edumods_')) {
      map[n.topic] = n.content || '';
    }
  });
  return map;
}

export async function saveNoteToDb(userId: string, topic: string, content: string): Promise<void> {
  if (!checkConfigured() || !userId) return;

  const payload: RawNoteRow = {
    user_id: userId,
    topic,
    content,
    updated_at: new Date().toISOString(),
  };

  const { error } = await upsertWithLookupFallback('fii_notes', payload, ['user_id', 'topic']);

  if (error) {
    console.error(`Erro ao salvar nota ${topic} no Supabase:`, error.message);
    throw new Error(`Erro ao salvar anotação no Supabase: ${error.message}`);
  }
}

export async function deleteNoteFromDb(userId: string, topic: string): Promise<void> {
  if (!checkConfigured() || !userId || !topic) return;
  const supabase = getClient();
  const cleanTopic = topic.trim();

  const { error } = await supabase
    .from('fii_notes')
    .delete()
    .eq('user_id', userId)
    .eq('topic', cleanTopic);

  if (error) {
    console.error(`Erro ao excluir nota ${cleanTopic} no Supabase:`, error.message);
    throw new Error(`Erro ao excluir anotação no Supabase: ${error.message}`);
  }

  // Confirma que a anotação vinculada ao tópico foi efetivamente excluída para este user_id
  const { data: remaining, error: checkError } = await supabase
    .from('fii_notes')
    .select('id')
    .eq('user_id', userId)
    .eq('topic', cleanTopic);

  if (!checkError && Array.isArray(remaining) && remaining.length > 0) {
    throw new Error(
      `A exclusão da anotação de ${cleanTopic} foi bloqueada pelas políticas RLS do Supabase (0 linhas removidas).`
    );
  }
}

// ============================================================================
// 7. LIMPEZA TOTAL E SUBSTITUIÇÃO SEGURA DE CARTEIRA (clear / reset / import)
// ============================================================================

export async function deleteAllUserDataFromDb(
  userId: string,
  options: { includeNotes?: boolean } = { includeNotes: true }
): Promise<void> {
  if (!checkConfigured() || !userId) return;
  const supabase = getClient();

  const [holdingsRes, txRes, divRes] = await Promise.all([
    supabase.from('fii_holdings').delete().eq('user_id', userId),
    supabase.from('fii_transactions').delete().eq('user_id', userId),
    supabase.from('fii_dividends').delete().eq('user_id', userId),
  ]);

  if (holdingsRes.error) {
    throw new Error(`Erro ao excluir posições no Supabase: ${holdingsRes.error.message}`);
  }
  if (txRes.error) {
    throw new Error(`Erro ao excluir transações no Supabase: ${txRes.error.message}`);
  }
  if (divRes.error) {
    throw new Error(`Erro ao excluir proventos no Supabase: ${divRes.error.message}`);
  }

  // Confirma que a exclusão não foi bloqueada silenciosamente por falta de política RLS FOR DELETE
  const { data: remHoldings, error: remHoldErr } = await supabase
    .from('fii_holdings')
    .select('id')
    .eq('user_id', userId);
  if (!remHoldErr && Array.isArray(remHoldings) && remHoldings.length > 0) {
    throw new Error(
      'A exclusão das posições foi bloqueada pelas políticas RLS do Supabase. Execute o script supabase-migration.sql no SQL Editor do Supabase.'
    );
  }

  if (options.includeNotes !== false) {
    const notesRes = await supabase
      .from('fii_notes')
      .delete()
      .eq('user_id', userId)
      .not('topic', 'in', `("${SYSTEM_INIT_NOTE_TOPIC}","${SYSTEM_PREFS_NOTE_TOPIC}")`);

    if (notesRes.error) {
      throw new Error(`Erro ao excluir anotações no Supabase: ${notesRes.error.message}`);
    }
  }

  // Garante que a conta permaneça marcada como inicializada para NUNCA recriar seed Demo
  await markUserInitialized(userId);
}

/**
 * Sincroniza um conjunto de dados com o Supabase utilizando estratégia segura de
 * validação prévia, cópia temporária (snapshot), gravação antes da exclusão e
 * recuperação automática em caso de falha de rede ou banco.
 *
 * Quando replaceExisting = true (usado em Reset para Demo e Importação de Backup):
 * 1. Valida todos os dados de entrada em memória antes de tocar no banco.
 * 2. Captura um snapshot completo do estado atual do usuário no Supabase.
 * 3. Grava os novos registros primeiro (sem apagar os dados antigos previamente).
 * 4. Se qualquer gravação falhar no meio do caminho, restaura automaticamente o snapshot
 *    anterior e remove os registros parciais para evitar perda de dados ou carteira incompleta.
 * 5. Somente após confirmar que 100% dos novos dados foram gravados com sucesso,
 *    remove os registros antigos obsoletos que não fazem parte da nova carteira.
 */
export async function syncLocalDataToSupabase(
  userId: string,
  localData: {
    holdings: FIIHolding[];
    transactions: Transaction[];
    dividends: DividendEvent[];
    goals?: PortfolioGoals;
    preferences?: UserPreferences;
    notes?: Record<string, string>;
  },
  options: { replaceExisting?: boolean } = {}
): Promise<{
  success: boolean;
  countMigrated: number;
  transactions: Transaction[];
  dividends: DividendEvent[];
  error?: string;
}> {
  if (!checkConfigured() || !userId) {
    return {
      success: false,
      countMigrated: 0,
      transactions: localData.transactions,
      dividends: localData.dividends,
      error: 'Supabase não configurado.',
    };
  }

  // 1. Validação estrita em memória antes de alterar qualquer registro no banco
  for (const h of localData.holdings || []) {
    if (!h || typeof h.ticker !== 'string' || !h.ticker.trim()) {
      return {
        success: false,
        countMigrated: 0,
        transactions: localData.transactions,
        dividends: localData.dividends,
        error: 'Posição inválida detectada (ticker ausente). Nenhum dado foi alterado no banco.',
      };
    }
    if (typeof h.quantity !== 'number' || isNaN(h.quantity) || h.quantity < 0) {
      return {
        success: false,
        countMigrated: 0,
        transactions: localData.transactions,
        dividends: localData.dividends,
        error: `Quantidade inválida para o ativo ${h.ticker}. Nenhum dado foi alterado no banco.`,
      };
    }
  }

  for (const t of localData.transactions || []) {
    if (!t || typeof t.ticker !== 'string' || !t.ticker.trim()) {
      return {
        success: false,
        countMigrated: 0,
        transactions: localData.transactions,
        dividends: localData.dividends,
        error: 'Operação inválida detectada (ticker ausente). Nenhum dado foi alterado no banco.',
      };
    }
  }

  for (const d of localData.dividends || []) {
    if (!d || typeof d.ticker !== 'string' || !d.ticker.trim()) {
      return {
        success: false,
        countMigrated: 0,
        transactions: localData.transactions,
        dividends: localData.dividends,
        error: 'Provento inválido detectado (ticker ausente). Nenhum dado foi alterado no banco.',
      };
    }
  }

  let count = 0;

  // Snapshot do estado anterior para recuperação automática em caso de falha durante replaceExisting
  let prevHoldings: FIIHolding[] = [];
  let prevTransactions: Transaction[] = [];
  let prevDividends: DividendEvent[] = [];
  let prevGoalsRes: LoadedGoalsResult | null = null;
  let prevNotes: Record<string, string> = {};
  let prevProfile: SupabaseUserProfile | null = null;

  const overwrittenHoldingsMap = new Map<string, FIIHolding>();
  const newlyInsertedHoldingTickers = new Set<string>();
  const deletedOldHoldings: FIIHolding[] = [];
  const stagedTxIds: string[] = [];
  const deletedOldTransactions: Transaction[] = [];
  const stagedDivIds: string[] = [];
  const deletedOldDividends: DividendEvent[] = [];
  const overwrittenNotesMap = new Map<string, string>();
  const newlyInsertedNoteTopics = new Set<string>();
  const deletedOldNotes: Array<[string, string]> = [];
  let goalsModified = false;
  let prefsModified = false;

  try {
    if (options.replaceExisting) {
      // Captura snapshot completo dos dados atuais no Supabase ANTES de qualquer escrita
      const [snapH, snapT, snapD, snapG, snapN, snapP] = await Promise.all([
        fetchHoldingsFromDb(userId),
        fetchTransactionsFromDb(userId),
        fetchDividendsFromDb(userId),
        fetchGoalsWithMetaFromDb(userId),
        fetchNotesFromDb(userId),
        fetchUserProfile(userId),
      ]);
      prevHoldings = snapH;
      prevTransactions = snapT;
      prevDividends = snapD;
      prevGoalsRes = snapG;
      prevNotes = snapN;
      prevProfile = snapP;
    }

    const prevHoldingsByTicker = new Map<string, FIIHolding>(
      prevHoldings.map((h) => [h.ticker.toUpperCase().trim(), h])
    );
    const prevTxIds = new Set<string>(prevTransactions.map((t) => t.id));
    const prevDivIds = new Set<string>(prevDividends.map((d) => d.id));

    // 2. Grava (stage) as novas posições primeiro
    const targetHoldingTickers = new Set<string>();
    for (const h of localData.holdings) {
      const cleanTicker = h.ticker.toUpperCase().trim();
      targetHoldingTickers.add(cleanTicker);
      if (options.replaceExisting) {
        const prevH = prevHoldingsByTicker.get(cleanTicker);
        if (prevH) {
          if (!overwrittenHoldingsMap.has(cleanTicker)) {
            overwrittenHoldingsMap.set(cleanTicker, prevH);
          }
        } else {
          newlyInsertedHoldingTickers.add(cleanTicker);
        }
      }
      await saveHoldingToDb(userId, h);
      count++;
    }

    // 3. Grava (stage) as novas transações usando IDs distintos caso colidam com o snapshot anterior
    const syncedTransactions: Transaction[] = [];
    for (const t of localData.transactions) {
      const candidateId = ensureValidUuid(t.id);
      const safeId =
        options.replaceExisting && prevTxIds.has(candidateId) ? generateSecureId() : candidateId;
      const savedId = await saveTransactionToDb(userId, { ...t, id: safeId });
      stagedTxIds.push(savedId);
      syncedTransactions.push({ ...t, id: savedId });
      count++;
    }

    // 4. Grava (stage) os novos proventos usando IDs distintos caso colidam com o snapshot anterior
    const syncedDividends: DividendEvent[] = [];
    for (const d of localData.dividends) {
      const candidateId = ensureValidUuid(d.id);
      const safeId =
        options.replaceExisting && prevDivIds.has(candidateId) ? generateSecureId() : candidateId;
      const savedId = await saveDividendToDb(userId, { ...d, id: safeId });
      stagedDivIds.push(savedId);
      syncedDividends.push({ ...d, id: savedId });
      count++;
    }

    // 5. Grava metas
    if (localData.goals) {
      goalsModified = true;
      await saveGoalsToDb(userId, localData.goals, localData.preferences?.hideValues);
    }

    // 6. Grava notas
    const targetNoteTopics = new Set<string>();
    if (localData.notes) {
      for (const [topic, content] of Object.entries(localData.notes)) {
        if (!topic.startsWith('__edumods_')) {
          targetNoteTopics.add(topic);
          if (options.replaceExisting) {
            if (Object.prototype.hasOwnProperty.call(prevNotes, topic)) {
              if (!overwrittenNotesMap.has(topic)) {
                overwrittenNotesMap.set(topic, prevNotes[topic]);
              }
            } else {
              newlyInsertedNoteTopics.add(topic);
            }
          }
          await saveNoteToDb(userId, topic, content);
        }
      }
    }

    // 7. Grava preferências se fornecidas (sem alterar role/plan)
    if (localData.preferences) {
      prefsModified = true;
      await saveUserPreferencesToDb(userId, localData.preferences);
    }

    // 8. Marca usuário como inicializado no banco
    await markUserInitialized(userId, { preferences: localData.preferences });

    // 9. SOMENTE após confirmar que 100% dos novos dados foram gravados sem erro,
    // remove os registros obsoletos do snapshot anterior quando replaceExisting = true
    if (options.replaceExisting) {
      for (const oldH of prevHoldings) {
        const oldTicker = oldH.ticker.toUpperCase().trim();
        if (!targetHoldingTickers.has(oldTicker)) {
          await deleteHoldingFromDb(userId, oldTicker);
          deletedOldHoldings.push(oldH);
        }
      }

      for (const oldTx of prevTransactions) {
        if (!stagedTxIds.includes(oldTx.id)) {
          await deleteTransactionFromDb(userId, oldTx.id);
          deletedOldTransactions.push(oldTx);
        }
      }

      for (const oldDiv of prevDividends) {
        if (!stagedDivIds.includes(oldDiv.id)) {
          await deleteDividendFromDb(userId, oldDiv.id);
          deletedOldDividends.push(oldDiv);
        }
      }

      for (const oldTopic of Object.keys(prevNotes)) {
        if (!oldTopic.startsWith('__edumods_') && !targetNoteTopics.has(oldTopic)) {
          const oldContent = prevNotes[oldTopic];
          await deleteNoteFromDb(userId, oldTopic);
          deletedOldNotes.push([oldTopic, oldContent]);
        }
      }
    }

    return {
      success: true,
      countMigrated: count,
      transactions: syncedTransactions,
      dividends: syncedDividends,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Falha ao sincronizar dados com o Supabase.';
    console.error('Falha durante sincronização com Supabase:', message);

    // RECUPERAÇÃO AUTOMÁTICA DO SNAPSHOT ANTERIOR EM CASO DE FALHA PARCIAL
    if (options.replaceExisting) {
      try {
        for (const [, oldH] of overwrittenHoldingsMap.entries()) {
          await saveHoldingToDb(userId, oldH);
        }
        for (const deletedH of deletedOldHoldings) {
          await saveHoldingToDb(userId, deletedH);
        }
        for (const newTicker of newlyInsertedHoldingTickers) {
          await deleteHoldingFromDb(userId, newTicker);
        }
        for (const deletedTx of deletedOldTransactions) {
          await saveTransactionToDb(userId, deletedTx);
        }
        for (const txId of stagedTxIds) {
          await deleteTransactionFromDb(userId, txId);
        }
        for (const deletedDiv of deletedOldDividends) {
          await saveDividendToDb(userId, deletedDiv);
        }
        for (const divId of stagedDivIds) {
          await deleteDividendFromDb(userId, divId);
        }
        if (goalsModified && prevGoalsRes?.goals) {
          await saveGoalsToDb(userId, prevGoalsRes.goals, prevGoalsRes.hideValues);
        }
        for (const [topic, oldContent] of overwrittenNotesMap.entries()) {
          await saveNoteToDb(userId, topic, oldContent);
        }
        for (const [deletedTopic, deletedContent] of deletedOldNotes) {
          await saveNoteToDb(userId, deletedTopic, deletedContent);
        }
        for (const newTopic of newlyInsertedNoteTopics) {
          await deleteNoteFromDb(userId, newTopic);
        }
        if (prefsModified && prevProfile?.preferences) {
          await saveUserPreferencesToDb(userId, prevProfile.preferences as UserPreferences);
        }
      } catch (rollbackErr) {
        console.error('Aviso durante recuperação automática do snapshot:', rollbackErr);
      }
    }

    return {
      success: false,
      countMigrated: 0,
      transactions: localData.transactions,
      dividends: localData.dividends,
      error: message,
    };
  }
}

