import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateSecureId,
  isValidUuid,
  ensureValidUuid,
  setSupabaseClientForTesting,
  resetSupabaseClientForTesting,
  fetchUserProfile,
  markUserInitialized,
  saveUserPreferencesToDb,
  fetchHoldingsFromDb,
  saveHoldingToDb,
  deleteHoldingFromDb,
  fetchTransactionsFromDb,
  saveTransactionToDb,
  deleteTransactionFromDb,
  fetchDividendsFromDb,
  saveDividendToDb,
  deleteDividendFromDb,
  fetchGoalsWithMetaFromDb,
  saveGoalsToDb,
  fetchNotesFromDb,
  saveNoteToDb,
  deleteNoteFromDb,
  deleteAllUserDataFromDb,
  syncLocalDataToSupabase,
  SYSTEM_INIT_NOTE_TOPIC,
  SYSTEM_PREFS_NOTE_TOPIC,
} from './supabaseDb';
import { FIIHolding, Transaction, DividendEvent, UserPreferences, PortfolioGoals } from '../types/fii';

/**
 * In-memory mock implementation of the Supabase PostgREST client for unit testing
 * all CRUD flows, RLS user_id filtering, optional column fallback, missing UNIQUE
 * constraint fallback (42P10), and silent RLS delete block detection.
 */
function createMockSupabaseClient(options?: {
  legacySchemaOnly?: boolean;
  failOnTable?: Record<string, string>;
  failOnTableOperationCount?: Record<string, { failAtCall: number; message: string }>;
  disableUserProfilesTable?: boolean;
  missingUniqueConstraintOnTables?: string[];
  silentlyBlockDeleteOnTables?: string[];
}) {
  const store: Record<string, any[]> = {
    fii_holdings: [],
    fii_transactions: [],
    fii_dividends: [],
    fii_goals: [],
    fii_notes: [],
    fii_user_profiles: [],
  };
  const writeCallCounts: Record<string, number> = {};

  const legacyAllowedColumns: Record<string, string[]> = {
    fii_holdings: [
      'id',
      'user_id',
      'ticker',
      'quantity',
      'average_price',
      'category',
      'segment',
      'notes',
      'target_percentage',
      'created_at',
      'updated_at',
    ],
    fii_transactions: [
      'id',
      'user_id',
      'ticker',
      'type',
      'date',
      'quantity',
      'price',
      'fees',
      'broker',
      'notes',
      'created_at',
    ],
    fii_dividends: [
      'id',
      'user_id',
      'ticker',
      'payment_date',
      'base_date',
      'value_per_share',
      'total_value',
      'status',
      'created_at',
    ],
    fii_goals: [
      'id',
      'user_id',
      'target_equity',
      'target_monthly_dividend',
      'target_monthly_investment',
      'target_years',
      'hide_values',
      'updated_at',
    ],
    fii_notes: ['id', 'user_id', 'topic', 'content', 'updated_at'],
  };

  const validateLegacyColumns = (table: string, payload: Record<string, any>) => {
    if (options?.disableUserProfilesTable && table === 'fii_user_profiles') {
      return { code: '42P01', message: 'relation "public.fii_user_profiles" does not exist' };
    }
    if (!options?.legacySchemaOnly) return null;

    const allowed = legacyAllowedColumns[table];
    if (!allowed) return null;
    for (const key of Object.keys(payload)) {
      if (!allowed.includes(key)) {
        return {
          code: 'PGRST204',
          message: `Could not find the '${key}' column of '${table}' in the schema cache`,
        };
      }
    }
    if (table === 'fii_transactions' && payload.type === 'SUBSCRICAO') {
      return {
        code: '23514',
        message: 'new row for relation "fii_transactions" violates check constraint "fii_transactions_type_check"',
      };
    }
    if (table === 'fii_dividends' && !['PAGO', 'PREVISTO'].includes(payload.status)) {
      return {
        code: '23514',
        message: 'new row for relation "fii_dividends" violates check constraint "fii_dividends_status_check"',
      };
    }
    return null;
  };

  return {
    store,
    from(table: string) {
      const filters: Array<(row: any) => boolean> = [];
      let pendingOperation: 'select' | 'upsert' | 'insert' | 'update' | 'delete' = 'select';
      let pendingPayload: any = null;
      let pendingConflictKey = '';

      const execute = () => {
        if (options?.failOnTable?.[table]) {
          return { data: null, error: { message: options.failOnTable[table], code: '500' } };
        }
        if (pendingOperation !== 'select' && options?.failOnTableOperationCount?.[table]) {
          writeCallCounts[table] = (writeCallCounts[table] || 0) + 1;
          const rule = options.failOnTableOperationCount[table];
          if (writeCallCounts[table] === rule.failAtCall) {
            return { data: null, error: { message: rule.message, code: '500' } };
          }
        }
        if (options?.disableUserProfilesTable && table === 'fii_user_profiles') {
          return {
            data: null,
            error: { message: 'relation "public.fii_user_profiles" does not exist', code: '42P01' },
          };
        }

        const rows = store[table] || [];

        if (pendingOperation === 'select') {
          const matched = rows.filter((r) => filters.every((fn) => fn(r)));
          return { data: matched, error: null };
        }

        if (pendingOperation === 'upsert') {
          const colError = validateLegacyColumns(table, pendingPayload);
          if (colError) return { data: null, error: colError };

          if (
            options?.missingUniqueConstraintOnTables?.includes(table) &&
            pendingConflictKey !== 'id'
          ) {
            return {
              data: null,
              error: {
                code: '42P10',
                message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification',
              },
            };
          }

          const keys = pendingConflictKey.split(',').map((k) => k.trim());
          const existingIdx = rows.findIndex((r) => keys.every((k) => r[k] === pendingPayload[k]));
          const rowWithId = {
            id: pendingPayload.id || generateSecureId(),
            ...pendingPayload,
          };

          if (existingIdx >= 0) {
            rows[existingIdx] = { ...rows[existingIdx], ...rowWithId };
            return { data: rows[existingIdx], error: null };
          } else {
            rows.push(rowWithId);
            return { data: rowWithId, error: null };
          }
        }

        if (pendingOperation === 'insert') {
          const colError = validateLegacyColumns(table, pendingPayload);
          if (colError) return { data: null, error: colError };

          const rowWithId = {
            id: pendingPayload.id || generateSecureId(),
            ...pendingPayload,
          };
          rows.push(rowWithId);
          return { data: rowWithId, error: null };
        }

        if (pendingOperation === 'update') {
          const colError = validateLegacyColumns(table, pendingPayload);
          if (colError) return { data: null, error: colError };

          rows.forEach((r, idx) => {
            if (filters.every((fn) => fn(r))) {
              rows[idx] = { ...r, ...pendingPayload };
            }
          });
          return { data: null, error: null };
        }

        if (pendingOperation === 'delete') {
          if (options?.silentlyBlockDeleteOnTables?.includes(table)) {
            // Simulates PostgreSQL RLS when FOR DELETE policy is missing: 0 rows deleted, error: null
            return { data: null, error: null };
          }
          store[table] = rows.filter((r) => !filters.every((fn) => fn(r)));
          return { data: null, error: null };
        }

        return { data: null, error: null };
      };

      const builder: any = {
        select() {
          if (pendingOperation !== 'upsert' && pendingOperation !== 'insert') {
            pendingOperation = 'select';
          }
          return builder;
        },
        upsert(payload: any, opts?: { onConflict?: string }) {
          pendingOperation = 'upsert';
          pendingPayload = payload;
          pendingConflictKey = opts?.onConflict || 'id';
          return builder;
        },
        insert(payload: any) {
          pendingOperation = 'insert';
          pendingPayload = payload;
          return builder;
        },
        update(payload: any) {
          pendingOperation = 'update';
          pendingPayload = payload;
          return builder;
        },
        delete() {
          pendingOperation = 'delete';
          return builder;
        },
        eq(col: string, val: any) {
          filters.push((row) => row[col] === val);
          return builder;
        },
        in(col: string, vals: any[]) {
          filters.push((row) => vals.includes(row[col]));
          return builder;
        },
        not(col: string, op: string, rawVals: string) {
          if (op === 'in') {
            const parsed = rawVals
              .replace(/^\(|\)$/g, '')
              .split(',')
              .map((s) => s.replace(/^"|"$|^'|'$/g, ''));
            filters.push((row) => !parsed.includes(row[col]));
          }
          return builder;
        },
        order() {
          return builder;
        },
        maybeSingle() {
          const res = execute();
          if (res.error) return Promise.resolve(res);
          const arr = Array.isArray(res.data) ? res.data : [];
          return Promise.resolve({ data: arr[0] ?? null, error: null });
        },
        single() {
          const res = execute();
          if (res.error) return Promise.resolve(res);
          const item = Array.isArray(res.data) ? res.data[0] : res.data;
          return Promise.resolve({ data: item ?? null, error: null });
        },
        then(onFulfilled: any, onRejected: any) {
          return Promise.resolve(execute()).then(onFulfilled, onRejected);
        },
      };

      return builder;
    },
  };
}

const sampleHolding = (ticker = 'HGLG11'): FIIHolding => ({
  ticker,
  name: `${ticker} FII`,
  category: 'Tijolo',
  segment: 'Logística',
  quantity: 25,
  averagePrice: 155.0,
  currentPrice: 162.5,
  totalCost: 3875,
  marketValue: 4062.5,
  unrealizedGain: 187.5,
  unrealizedGainPercent: 4.84,
  monthlyYieldPerShare: 1.15,
  monthlyDividendYield: 0.71,
  annualDividendYield: 8.5,
  vpa: 158.2,
  pvp: 1.03,
  portfolioWeight: 100,
  targetWeight: 20,
  notes: 'Ativo core logístico',
  isFavorite: true,
});

describe('Supabase Database Service & Persistence Verification', () => {
  afterEach(() => {
    resetSupabaseClientForTesting();
  });

  it('1. UUID Generation: generateSecureId & ensureValidUuid always return valid RFC 4122 UUIDs', () => {
    const id1 = generateSecureId();
    const id2 = generateSecureId();

    assert.ok(isValidUuid(id1), `Expected valid UUID, got ${id1}`);
    assert.ok(isValidUuid(id2), `Expected valid UUID, got ${id2}`);
    assert.notEqual(id1, id2);

    // Non-UUID legacy strings are automatically converted to valid UUIDs
    const converted = ensureValidUuid('id_legacy_12345');
    assert.ok(isValidUuid(converted));
    assert.notEqual(converted, 'id_legacy_12345');

    // Valid UUIDs are preserved untouched
    assert.equal(ensureValidUuid(id1), id1);
  });

  it('2. Cenário A: Usuário A cria 3 fundos, exclui todos os 3, faz logout e login novamente — a carteira permanece vazia', async () => {
    const mock = createMockSupabaseClient({ disableUserProfilesTable: true });
    setSupabaseClientForTesting(mock, true);
    const userAId = generateSecureId();

    // Usuário A cria 3 fundos na carteira
    await saveHoldingToDb(userAId, sampleHolding('HGLG11'));
    await saveHoldingToDb(userAId, sampleHolding('MXRF11'));
    await saveHoldingToDb(userAId, sampleHolding('XPML11'));
    await markUserInitialized(userAId);

    const initialHoldings = await fetchHoldingsFromDb(userAId);
    assert.equal(initialHoldings.length, 3);

    // Usuário A exclui todos os 3 fundos da carteira
    await deleteHoldingFromDb(userAId, 'HGLG11');
    await deleteHoldingFromDb(userAId, 'MXRF11');
    await deleteHoldingFromDb(userAId, 'XPML11');
    await markUserInitialized(userAId);

    // Usuário A faz logout e login novamente (ou abre aba anônima)
    const holdingsAfterRelogin = await fetchHoldingsFromDb(userAId);
    const profileAfterRelogin = await fetchUserProfile(userAId);

    assert.equal(holdingsAfterRelogin.length, 0, 'A carteira deve permanecer vazia após excluir os 3 fundos');
    assert.equal(
      profileAfterRelogin?.is_initialized,
      true,
      'A conta deve permanecer marcada como is_initialized = true mesmo sem a tabela fii_user_profiles'
    );
  });

  it('3. Cenário B: Usuário A cria carteira; Usuário B faz login em outra conta e não visualiza nenhum dado do Usuário A', async () => {
    const mock = createMockSupabaseClient();
    setSupabaseClientForTesting(mock, true);
    const userAId = generateSecureId();
    const userBId = generateSecureId();

    // Usuário A cria carteira completa (holdings, transações, proventos, metas, notas e preferências)
    await saveHoldingToDb(userAId, sampleHolding('HGLG11'));
    await saveHoldingToDb(userAId, sampleHolding('KNIP11'));
    await saveTransactionToDb(userAId, {
      id: generateSecureId(),
      ticker: 'HGLG11',
      type: 'COMPRA',
      date: '2026-10-01',
      quantity: 25,
      price: 155,
      fees: 0,
      total: 3875,
    });
    await saveDividendToDb(userAId, {
      id: generateSecureId(),
      ticker: 'HGLG11',
      dataCom: '2026-10-15',
      paymentDate: '2026-10-25',
      quantityEligible: 25,
      ratePerShare: 1.1,
      totalAmount: 27.5,
      status: 'RECEBIDO',
    });
    await saveGoalsToDb(userAId, {
      monthlyIncomeGoal: 12000,
      totalEquityGoal: 1500000,
      currentLivingExpenses: 7000,
      fireSafeYieldPercent: 9.0,
    });
    await saveNoteToDb(userAId, 'geral', 'Tese exclusiva do Usuário A');

    // Usuário B faz login em outra conta e consulta o banco
    const userBHoldings = await fetchHoldingsFromDb(userBId);
    const userBTransactions = await fetchTransactionsFromDb(userBId);
    const userBDividends = await fetchDividendsFromDb(userBId);
    const userBGoals = await fetchGoalsWithMetaFromDb(userBId);
    const userBNotes = await fetchNotesFromDb(userBId);
    const userBProfile = await fetchUserProfile(userBId);

    assert.equal(userBHoldings.length, 0, 'Usuário B não pode ver holdings do Usuário A');
    assert.equal(userBTransactions.length, 0, 'Usuário B não pode ver transações do Usuário A');
    assert.equal(userBDividends.length, 0, 'Usuário B não pode ver proventos do Usuário A');
    assert.equal(userBGoals, null, 'Usuário B não pode ver metas do Usuário A');
    assert.equal(Object.keys(userBNotes).length, 0, 'Usuário B não pode ver notas do Usuário A');
    assert.equal(userBProfile, null, 'Usuário B não pode ver perfil do Usuário A');

    // Tentativa de exclusão por Usuário B não afeta os dados do Usuário A
    await deleteHoldingFromDb(userBId, 'HGLG11');
    const userAHoldingsStillIntact = await fetchHoldingsFromDb(userAId);
    assert.equal(userAHoldingsStillIntact.length, 2, 'Dados do Usuário A permanecem intactos');
  });

  it('4. Persistência de currentPrice, vpa, monthlyYieldPerShare, quantityEligible e realizedResult', async () => {
    const mock = createMockSupabaseClient();
    setSupabaseClientForTesting(mock, true);
    const userId = generateSecureId();

    const customHolding = sampleHolding('BTLG11');
    customHolding.currentPrice = 111.75;
    customHolding.vpa = 104.3;
    customHolding.monthlyYieldPerShare = 0.93;

    await saveHoldingToDb(userId, customHolding);
    const [loadedHolding] = await fetchHoldingsFromDb(userId);

    assert.equal(loadedHolding.currentPrice, 111.75);
    assert.equal(loadedHolding.vpa, 104.3);
    assert.equal(loadedHolding.monthlyYieldPerShare, 0.93);

    // Transação com realizedResult e ID legado não-UUID (sincronização de ID)
    const tx: Transaction = {
      id: 'custom_non_uuid_tx_1',
      ticker: 'BTLG11',
      type: 'VENDA',
      date: '2026-10-15',
      quantity: 10,
      price: 112.0,
      fees: 1.5,
      total: 1118.5,
      realizedResult: 145.25,
      notes: 'Realização parcial de lucro',
    };

    const savedTxId = await saveTransactionToDb(userId, tx);
    assert.ok(isValidUuid(savedTxId), 'O ID retornado pelo saveTransactionToDb deve ser um UUID válido');

    const [loadedTx] = await fetchTransactionsFromDb(userId);
    assert.equal(loadedTx.id, savedTxId);
    assert.equal(loadedTx.realizedResult, 145.25);

    // Dividendo com quantityEligible exata
    const div: DividendEvent = {
      id: 'legacy_div_id',
      ticker: 'BTLG11',
      dataCom: '2026-10-10',
      paymentDate: '2026-10-25',
      quantityEligible: 77,
      ratePerShare: 0.78,
      totalAmount: 60.06,
      status: 'RECEBIDO',
      isManual: true,
    };

    const savedDivId = await saveDividendToDb(userId, div);
    assert.ok(isValidUuid(savedDivId));

    const [loadedDiv] = await fetchDividendsFromDb(userId);
    assert.equal(loadedDiv.id, savedDivId);
    assert.equal(loadedDiv.quantityEligible, 77);
  });

  it('5. Compatibilidade automática (fallback) caso colunas opcionais ou constraints UNIQUE (42P10) ainda não existam', async () => {
    const mock = createMockSupabaseClient({
      legacySchemaOnly: true,
      disableUserProfilesTable: true,
      missingUniqueConstraintOnTables: ['fii_holdings', 'fii_goals', 'fii_notes'],
    });
    setSupabaseClientForTesting(mock, true);
    const userId = generateSecureId();

    // Salva e atualiza o mesmo holding mesmo sem constraint UNIQUE(user_id, ticker)
    await saveHoldingToDb(userId, sampleHolding('KNIP11'));
    const updatedKnip = sampleHolding('KNIP11');
    updatedKnip.quantity = 40;
    await saveHoldingToDb(userId, updatedKnip);

    const txId = await saveTransactionToDb(userId, {
      id: generateSecureId(),
      ticker: 'KNIP11',
      type: 'SUBSCRICAO',
      date: '2026-10-12',
      quantity: 15,
      price: 90.0,
      fees: 0,
      total: 1350,
      realizedResult: 0,
    });
    const divId = await saveDividendToDb(userId, {
      id: generateSecureId(),
      ticker: 'KNIP11',
      dataCom: '2026-10-10',
      paymentDate: '2026-10-20',
      quantityEligible: 15,
      ratePerShare: 0.9,
      totalAmount: 13.5,
      status: 'CANCELADO',
    });

    assert.ok(isValidUuid(txId));
    assert.ok(isValidUuid(divId));

    const holdings = await fetchHoldingsFromDb(userId);
    const txs = await fetchTransactionsFromDb(userId);
    const divs = await fetchDividendsFromDb(userId);

    assert.equal(holdings.length, 1);
    assert.equal(holdings[0].quantity, 40);
    assert.equal(txs.length, 1);
    assert.equal(txs[0].type, 'SUBSCRICAO');
    assert.equal(divs.length, 1);
  });

  it('6. Persistência e carregamento de preferences, customAlerts, hideValues e metas', async () => {
    const mock = createMockSupabaseClient({ disableUserProfilesTable: true });
    setSupabaseClientForTesting(mock, true);
    const userId = generateSecureId();

    const prefs: UserPreferences = {
      hideValues: true,
      currency: 'BRL',
      autoRefreshQuotes: false,
      maxConcentrationAlertPercent: 30,
      minYieldAlertPercent: 9.0,
      activePlan: 'VIP',
      customAlerts: [
        { id: 'alt_custom', ticker: 'HGLG11', type: 'PRECO_TETO', thresholdValue: 150, isActive: true },
      ],
    };
    const goals: PortfolioGoals = {
      monthlyIncomeGoal: 8000,
      totalEquityGoal: 900000,
      currentLivingExpenses: 5500,
      fireSafeYieldPercent: 10.0,
    };

    await saveGoalsToDb(userId, goals, prefs.hideValues);
    await saveUserPreferencesToDb(userId, prefs);

    const loadedProfile = await fetchUserProfile(userId);
    const loadedGoalsRes = await fetchGoalsWithMetaFromDb(userId);
    const visibleNotes = await fetchNotesFromDb(userId);

    assert.equal(loadedProfile?.preferences?.hideValues, true);
    assert.equal(loadedProfile?.preferences?.maxConcentrationAlertPercent, 30);
    assert.equal(loadedProfile?.preferences?.customAlerts?.length, 1);
    assert.equal(loadedProfile?.preferences?.customAlerts?.[0].ticker, 'HGLG11');
    assert.equal(loadedGoalsRes?.goals.monthlyIncomeGoal, 8000);
    assert.equal(loadedGoalsRes?.hideValues, true);
    assert.equal(
      visibleNotes[SYSTEM_PREFS_NOTE_TOPIC],
      undefined,
      'Notas internas de sistema não devem vazar para as notas visíveis do usuário'
    );
    assert.equal(visibleNotes[SYSTEM_INIT_NOTE_TOPIC], undefined);
  });

  it('7. Importação, Reset e Limpeza substituem registros antigos sem misturar dados', async () => {
    const mock = createMockSupabaseClient();
    setSupabaseClientForTesting(mock, true);
    const userId = generateSecureId();

    // Estado antigo no banco
    await saveHoldingToDb(userId, sampleHolding('OLD11'));
    await saveNoteToDb(userId, 'OLD11', 'Nota antiga que deve ser removida no replace');

    // Importa nova carteira com replaceExisting: true
    const syncRes = await syncLocalDataToSupabase(
      userId,
      {
        holdings: [sampleHolding('NEW11')],
        transactions: [],
        dividends: [],
        notes: { NEW11: 'Nova tese de investimento' },
      },
      { replaceExisting: true }
    );

    assert.equal(syncRes.success, true);

    const holdingsAfterImport = await fetchHoldingsFromDb(userId);
    const notesAfterImport = await fetchNotesFromDb(userId);

    assert.equal(holdingsAfterImport.length, 1);
    assert.equal(holdingsAfterImport[0].ticker, 'NEW11');
    assert.equal(notesAfterImport['OLD11'], undefined);
    assert.equal(notesAfterImport['NEW11'], 'Nova tese de investimento');

    // Limpeza total da carteira (clearPortfolioData)
    await deleteAllUserDataFromDb(userId, { includeNotes: true });
    const holdingsAfterClear = await fetchHoldingsFromDb(userId);
    const notesAfterClear = await fetchNotesFromDb(userId);
    const profileAfterClear = await fetchUserProfile(userId);

    assert.equal(holdingsAfterClear.length, 0);
    assert.equal(Object.keys(notesAfterClear).length, 0);
    assert.equal(profileAfterClear?.is_initialized, true);
  });

  it('8. Detecção de bloqueio silencioso de RLS em DELETE e propagação de erros CRUD', async () => {
    const mockSilentDelete = createMockSupabaseClient({
      silentlyBlockDeleteOnTables: ['fii_holdings'],
    });
    setSupabaseClientForTesting(mockSilentDelete, true);
    const userId = generateSecureId();

    await saveHoldingToDb(userId, sampleHolding('HGLG11'));

    // Quando falta política RLS FOR DELETE no banco, o PostgreSQL retorna error: null mas não apaga a linha.
    // deleteHoldingFromDb deve detectar que a linha permaneceu no banco e lançar erro explícito para reverter a UI.
    await assert.rejects(
      () => deleteHoldingFromDb(userId, 'HGLG11'),
      /bloqueada pelas políticas RLS do Supabase/
    );

    const mockError = createMockSupabaseClient({
      failOnTable: {
        fii_holdings: 'Database connection timeout',
        fii_transactions: 'RLS policy violation',
      },
    });
    setSupabaseClientForTesting(mockError, true);

    await assert.rejects(
      () => saveHoldingToDb(userId, sampleHolding('HGLG11')),
      /Database connection timeout/
    );
    await assert.rejects(
      () =>
        saveTransactionToDb(userId, {
          id: generateSecureId(),
          ticker: 'HGLG11',
          type: 'COMPRA',
          date: '2026-10-01',
          quantity: 10,
          price: 150,
          fees: 0,
          total: 1500,
        }),
      /RLS policy violation/
    );
  });

  it('9. Registros duplicados em fii_goals e fii_user_profiles não provocam PGRST116 e consolidam metas e preferências válidas', async () => {
    const mock = createMockSupabaseClient();
    setSupabaseClientForTesting(mock, true);
    const userId = generateSecureId();

    // Simula duas linhas pré-existentes na tabela fii_goals para o mesmo user_id
    // Linha 1 (mais antiga): possui meta de patrimônio customizada (1.200.000) e renda padrão (5.000)
    // Linha 2 (mais recente): possui meta de renda customizada (9.500) e patrimônio padrão (500.000)
    mock.store.fii_goals.push(
      {
        id: generateSecureId(),
        user_id: userId,
        target_equity: 1200000,
        target_monthly_dividend: 5000,
        current_living_expenses: 6200,
        fire_safe_yield_percent: 10.5,
        hide_values: false,
        updated_at: '2026-10-01T10:00:00.000Z',
      },
      {
        id: generateSecureId(),
        user_id: userId,
        target_equity: 500000,
        target_monthly_dividend: 9500,
        current_living_expenses: 4500,
        fire_safe_yield_percent: 9.5,
        hide_values: true,
        updated_at: '2026-10-20T15:30:00.000Z',
      }
    );

    // Simula duas linhas pré-existentes em fii_user_profiles para o mesmo user_id
    mock.store.fii_user_profiles.push(
      {
        id: generateSecureId(),
        user_id: userId,
        full_name: 'Eduardo Investidor',
        plan: 'VIP',
        role: 'admin',
        is_initialized: true,
        preferences: { hideValues: false, maxConcentrationAlertPercent: 20 },
        updated_at: '2026-10-01T10:00:00.000Z',
      },
      {
        id: generateSecureId(),
        user_id: userId,
        full_name: null,
        plan: 'Gratuito',
        role: 'user',
        is_initialized: false,
        preferences: { hideValues: true, minYieldAlertPercent: 9.2 },
        updated_at: '2026-10-20T15:30:00.000Z',
      }
    );

    const goalsRes = await fetchGoalsWithMetaFromDb(userId);
    assert.ok(goalsRes, 'Deve retornar metas consolidadas sem erro PGRST116');
    assert.equal(goalsRes.goals.totalEquityGoal, 1200000, 'Não deve descartar meta válida de patrimônio da linha anterior');
    assert.equal(goalsRes.goals.monthlyIncomeGoal, 9500, 'Deve preservar a meta de renda customizada mais recente');
    assert.equal(goalsRes.goals.currentLivingExpenses, 6200, 'Não deve descartar despesa customizada válida');
    assert.equal(goalsRes.goals.fireSafeYieldPercent, 10.5, 'Não deve descartar taxa FIRE customizada válida');
    assert.equal(goalsRes.hideValues, true);

    const profileRes = await fetchUserProfile(userId);
    assert.ok(profileRes, 'Deve retornar perfil consolidado sem erro PGRST116');
    assert.equal(profileRes.is_initialized, true, 'Se qualquer linha marcou is_initialized=true, deve preservar true');
    assert.equal(profileRes.full_name, 'Eduardo Investidor');
    assert.equal(profileRes.plan, 'VIP');
    assert.equal(profileRes.role, 'admin');
    assert.equal(profileRes.preferences?.hideValues, true);
    assert.equal(profileRes.preferences?.maxConcentrationAlertPercent, 20);
    assert.equal(profileRes.preferences?.minYieldAlertPercent, 9.2);
  });

  it('10. Ao excluir uma posição, deleteNoteFromDb exclui somente a anotação daquele ticker e verifica o RLS', async () => {
    const mock = createMockSupabaseClient();
    setSupabaseClientForTesting(mock, true);
    const userAId = generateSecureId();
    const userBId = generateSecureId();

    await saveNoteToDb(userAId, 'HGLG11', 'Nota de HGLG11 do Usuário A');
    await saveNoteToDb(userAId, 'MXRF11', 'Nota de MXRF11 do Usuário A');
    await saveNoteToDb(userAId, 'geral', 'Estratégia macro do Usuário A');
    await saveNoteToDb(userBId, 'HGLG11', 'Nota de HGLG11 do Usuário B');

    await deleteNoteFromDb(userAId, 'HGLG11');

    const userANotes = await fetchNotesFromDb(userAId);
    const userBNotes = await fetchNotesFromDb(userBId);

    assert.equal(userANotes['HGLG11'], undefined, 'A nota de HGLG11 do Usuário A deve ter sido removida');
    assert.equal(userANotes['MXRF11'], 'Nota de MXRF11 do Usuário A', 'Outras notas de ativos do Usuário A devem ser preservadas');
    assert.equal(userANotes['geral'], 'Estratégia macro do Usuário A', 'A nota geral do Usuário A deve ser preservada');
    assert.equal(userBNotes['HGLG11'], 'Nota de HGLG11 do Usuário B', 'A nota de HGLG11 do Usuário B não pode ser afetada');

    // Verifica que bloqueio silencioso de RLS em fii_notes lança erro explícito
    const mockBlockedNotesDelete = createMockSupabaseClient({
      silentlyBlockDeleteOnTables: ['fii_notes'],
    });
    setSupabaseClientForTesting(mockBlockedNotesDelete, true);
    await saveNoteToDb(userAId, 'XPML11', 'Nota que falhará ao excluir');

    await assert.rejects(
      () => deleteNoteFromDb(userAId, 'XPML11'),
      /bloqueada pelas políticas RLS do Supabase/
    );
  });

  it('11. Falha no meio da substituição de carteira (importação/reset) restaura snapshot anterior e não perde dados', async () => {
    const userId = generateSecureId();

    // Configura mock que falha especificamente na 2ª escrita em fii_transactions (durante a importação do novo backup)
    const mock = createMockSupabaseClient({
      failOnTableOperationCount: {
        fii_transactions: { failAtCall: 2, message: 'Falha simulada de rede no meio da importação de transações' },
      },
    });
    setSupabaseClientForTesting(mock, true);

    // 1. Estado original válido salvo no banco
    await saveHoldingToDb(userId, sampleHolding('HGLG11'));
    await saveHoldingToDb(userId, sampleHolding('KNRI11'));
    await saveTransactionToDb(userId, {
      id: generateSecureId(),
      ticker: 'HGLG11',
      type: 'COMPRA',
      date: '2026-09-10',
      quantity: 25,
      price: 155,
      fees: 0,
      total: 3875,
    });
    await saveNoteToDb(userId, 'HGLG11', 'Tese original protegida');
    await saveNoteToDb(userId, 'geral', 'Diretriz original protegida');

    // 2. Tentativa de substituir toda a carteira por um novo backup que falha no meio (ao gravar a transação)
    const syncRes = await syncLocalDataToSupabase(
      userId,
      {
        holdings: [sampleHolding('MXRF11')],
        transactions: [
          {
            id: generateSecureId(),
            ticker: 'MXRF11',
            type: 'COMPRA',
            date: '2026-10-01',
            quantity: 100,
            price: 10.2,
            fees: 0,
            total: 1020,
          },
        ],
        dividends: [],
        notes: { MXRF11: 'Nota da importação que falhou' },
      },
      { replaceExisting: true }
    );

    // A substituição deve reportar falha explícita
    assert.equal(syncRes.success, false, 'syncLocalDataToSupabase deve retornar success = false quando ocorre erro no meio');
    assert.ok(syncRes.error, 'Deve retornar a mensagem do erro ocorrido');

    // 3. Verifica que os dados originais do usuário foram integralmente preservados/restaurados pelo snapshot
    const holdingsAfterFailedReplace = await fetchHoldingsFromDb(userId);
    const txsAfterFailedReplace = await fetchTransactionsFromDb(userId);
    const notesAfterFailedReplace = await fetchNotesFromDb(userId);

    const tickers = holdingsAfterFailedReplace.map((h) => h.ticker).sort();
    assert.deepEqual(tickers, ['HGLG11', 'KNRI11'], 'As posições originais devem continuar intactas e sem o ativo parcial MXRF11');
    assert.equal(txsAfterFailedReplace.length, 1, 'A transação original deve continuar intacta');
    assert.equal(txsAfterFailedReplace[0].ticker, 'HGLG11');
    assert.equal(notesAfterFailedReplace['HGLG11'], 'Tese original protegida');
    assert.equal(notesAfterFailedReplace['geral'], 'Diretriz original protegida');
    assert.equal(notesAfterFailedReplace['MXRF11'], undefined, 'Notas da importação interrompida não devem permanecer');
  });

  it('12. Segurança de Perfil: cliente nunca define plano VIP por padrão nem promove próprio plan/role via preferências', async () => {
    const mock = createMockSupabaseClient();
    setSupabaseClientForTesting(mock, true);
    const userId = generateSecureId();

    // 1. Ao inicializar usuário ou salvar preferências com tentativa maliciosa de injetar activePlan/plan/role
    await markUserInitialized(userId, { fullName: 'Investidor Teste' });

    const maliciousPrefs = {
      hideValues: true,
      currency: 'BRL' as const,
      autoRefreshQuotes: true,
      maxConcentrationAlertPercent: 25,
      minYieldAlertPercent: 8.5,
      activePlan: 'VIP' as const,
      plan: 'VIP',
      role: 'admin',
    } as any;

    await saveUserPreferencesToDb(userId, maliciousPrefs);

    // 2. Verifica na tabela fii_user_profiles que nem plan nem role foram enviados/promovidos pelo cliente
    const rawProfileRows = mock.store.fii_user_profiles.filter((r) => r.user_id === userId);
    assert.equal(rawProfileRows.length, 1);
    assert.notEqual(rawProfileRows[0].plan, 'VIP', 'O cliente não pode gravar plan = VIP em fii_user_profiles');
    assert.notEqual(rawProfileRows[0].role, 'admin', 'O cliente não pode gravar role = admin em fii_user_profiles');
    assert.equal(rawProfileRows[0].preferences?.activePlan, undefined, 'activePlan deve ser sanitizado das preferências visuais');
    assert.equal(rawProfileRows[0].preferences?.plan, undefined, 'plan deve ser sanitizado das preferências visuais');
    assert.equal(rawProfileRows[0].preferences?.role, undefined, 'role deve ser sanitizado das preferências visuais');

    // 3. Ao carregar perfil sem plan explícito no banco, o padrão deve ser Gratuito e role = user
    const loadedProfile = await fetchUserProfile(userId);
    assert.ok(loadedProfile);
    assert.equal(loadedProfile.plan, 'Gratuito', 'O plano padrão deve ser Gratuito quando não promovido no servidor');
    assert.equal(loadedProfile.role, 'user', 'A role padrão deve ser user');
    assert.equal(loadedProfile.preferences?.hideValues, true);
  });
});
