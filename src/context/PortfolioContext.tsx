import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import {
  FIIHolding,
  Transaction,
  DividendEvent,
  PortfolioGoals,
  UserPreferences,
} from '../types/fii';
import { VERIFIED_FII_DATABASE } from '../data/fiiDatabase';
import {
  calculateWeightedAveragePrice,
  calculateSaleResult,
  calculateUnrealizedGain,
} from '../utils/financialMath';
import { brapiAdapter } from '../services/marketData/adapters';
import { useAuth, PERSONAL_USER_ID } from './AuthContext';
import {
  fetchUserProfile,
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
  saveUserPreferencesToDb,
  deleteAllUserDataFromDb,
  syncLocalDataToSupabase,
  markUserInitialized,
  generateSecureId,
  ensureValidUuid,
  resolvePersonalOwnerUserId,
} from '../services/supabaseDb';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: 'admin' | 'user';
  plan: 'Gratuito' | 'Pro' | 'VIP';
  createdAt: string;
}

interface PortfolioContextType {
  currentUser: UserAccount;
  switchUser: (user: UserAccount) => void;
  availableUsers: UserAccount[];
  createNewUserAccount: (name: string, email: string) => void;
  deleteAccount: (userId: string) => void;

  holdings: FIIHolding[];
  transactions: Transaction[];
  dividends: DividendEvent[];
  goals: PortfolioGoals;
  preferences: UserPreferences;
  notes: Record<string, string>;

  // Sincronização & Persistência
  isSyncing: boolean;
  syncError: string | null;
  lastSyncedAt: Date | null;
  reloadFromSupabase: () => Promise<void>;

  // Métricas
  totalInvested: number;
  totalMarketValue: number;
  totalUnrealizedGain: number;
  totalUnrealizedGainPercent: number;
  monthlyDividendsReceived: number;
  monthlyDividendsForecasted: number;
  averageMonthlyDividends: {
    last3Months: number;
    last6Months: number;
    last12Months: number;
  };

  // Ações CRUD
  addTransaction: (tx: Omit<Transaction, 'id' | 'total'>) => Promise<{ success: boolean; error?: string }>;
  updateTransaction: (id: string, updated: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  updateHolding: (ticker: string, changes: Partial<FIIHolding>) => Promise<void>;
  deleteHolding: (ticker: string) => Promise<void>;
  addManualDividend: (dividend: Omit<DividendEvent, 'id' | 'totalAmount'>) => Promise<void>;
  updateDividend: (id: string, updated: Partial<DividendEvent>) => Promise<void>;
  deleteDividend: (id: string) => Promise<void>;
  updateDividendStatus: (id: string, status: DividendEvent['status']) => Promise<void>;
  updateHoldingTargetWeight: (ticker: string, targetWeight: number) => Promise<void>;
  updateHoldingNotes: (ticker: string, notes: string) => Promise<void>;
  toggleFavorite: (ticker: string) => Promise<void>;
  updateGoals: (goals: Partial<PortfolioGoals>) => Promise<void>;
  updatePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
  toggleHideValues: () => Promise<void>;
  refreshQuotes: () => Promise<void>;
  isRefreshingQuotes: boolean;
  lastQuoteUpdate: string;

  // Backup & Import
  exportDataJSON: () => string;
  exportTransactionsCSV: () => string;
  importDataJSON: (jsonStr: string) => Promise<{ success: boolean; message: string }>;
  resetPortfolioToDemo: () => Promise<void>;
  clearPortfolioData: () => Promise<void>;
}

const PERSONAL_STORAGE_PREFIX = 'edumods_fii_personal_v1';

const INITIAL_GOALS: PortfolioGoals = {
  monthlyIncomeGoal: 5000,
  totalEquityGoal: 500000,
  currentLivingExpenses: 4500,
  fireSafeYieldPercent: 9.5,
};

const INITIAL_PREFERENCES: UserPreferences = {
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

function createDemoHoldings(): FIIHolding[] {
  const seedItems = [
    { ticker: 'HGLG11', qty: 50, avg: 154.5, target: 20 },
    { ticker: 'MXRF11', qty: 1000, avg: 9.75, target: 15 },
    { ticker: 'KNIP11', qty: 55, avg: 90.4, target: 20 },
    { ticker: 'XPML11', qty: 60, avg: 97.8, target: 25 },
    { ticker: 'BTLG11', qty: 45, avg: 96.5, target: 20 },
  ];

  return seedItems.map(({ ticker, qty, avg, target }) => {
    const db = VERIFIED_FII_DATABASE[ticker];
    const curPrice = db ? db.currentPrice : avg;
    const vpa = db ? db.vpa : curPrice;
    const lastDiv = db ? db.lastDividend : 0.8;
    const totalCost = qty * avg;
    const marketVal = qty * curPrice;
    const unrealized = marketVal - totalCost;
    const unrealizedPct = totalCost > 0 ? (unrealized / totalCost) * 100 : 0;
    const pvp = vpa > 0 ? curPrice / vpa : 1;

    return {
      ticker,
      name: db ? db.name : ticker,
      category: db ? db.category : 'Tijolo',
      segment: db ? db.segment : 'Logística',
      quantity: qty,
      averagePrice: avg,
      currentPrice: curPrice,
      totalCost,
      marketValue: marketVal,
      unrealizedGain: unrealized,
      unrealizedGainPercent: unrealizedPct,
      monthlyYieldPerShare: lastDiv,
      monthlyDividendYield: (lastDiv / curPrice) * 100,
      annualDividendYield: db ? db.annualDY : 10.5,
      vpa,
      pvp: Number(pvp.toFixed(2)),
      portfolioWeight: 0,
      targetWeight: target,
      manager: db?.manager,
      indexer: db?.indexer,
      locationStates: db?.locationStates,
      lastQuoteUpdate: 'B3 Oficial',
      quoteSource: 'BRAPI / B3',
      notes: 'Posição estratégica em carteira recomendada.',
      isFavorite: true,
    };
  });
}

function createDemoTransactions(): Transaction[] {
  return [
    {
      id: generateSecureId(),
      ticker: 'HGLG11',
      type: 'COMPRA',
      date: '2026-08-10',
      quantity: 50,
      price: 154.5,
      fees: 0,
      total: 7725,
      notes: 'Aporte mensal planejado',
    },
    {
      id: generateSecureId(),
      ticker: 'MXRF11',
      type: 'COMPRA',
      date: '2026-08-15',
      quantity: 1000,
      price: 9.75,
      fees: 0,
      total: 9750,
      notes: 'Reinvestimento de proventos',
    },
    {
      id: generateSecureId(),
      ticker: 'KNIP11',
      type: 'COMPRA',
      date: '2026-09-05',
      quantity: 55,
      price: 90.4,
      fees: 0,
      total: 4972,
      notes: 'Alocação defensiva em IPCA',
    },
    {
      id: generateSecureId(),
      ticker: 'XPML11',
      type: 'COMPRA',
      date: '2026-09-18',
      quantity: 60,
      price: 97.8,
      fees: 0,
      total: 5868,
      notes: 'Exposição em shopping centers',
    },
    {
      id: generateSecureId(),
      ticker: 'BTLG11',
      type: 'COMPRA',
      date: '2026-10-02',
      quantity: 45,
      price: 96.5,
      fees: 0,
      total: 4342.5,
      notes: 'Diversificação logística BTG',
    },
  ];
}

function createDemoDividends(): DividendEvent[] {
  return [
    {
      id: generateSecureId(),
      ticker: 'MXRF11',
      dataCom: '2026-10-15',
      paymentDate: '2026-10-24',
      quantityEligible: 1000,
      ratePerShare: 0.09,
      totalAmount: 90.0,
      status: 'RECEBIDO',
    },
    {
      id: generateSecureId(),
      ticker: 'HGLG11',
      dataCom: '2026-10-15',
      paymentDate: '2026-10-25',
      quantityEligible: 50,
      ratePerShare: 1.1,
      totalAmount: 55.0,
      status: 'RECEBIDO',
    },
    {
      id: generateSecureId(),
      ticker: 'KNIP11',
      dataCom: '2026-10-15',
      paymentDate: '2026-10-28',
      quantityEligible: 55,
      ratePerShare: 0.85,
      totalAmount: 46.75,
      status: 'RECEBIDO',
    },
    {
      id: generateSecureId(),
      ticker: 'XPML11',
      dataCom: '2026-10-18',
      paymentDate: '2026-10-29',
      quantityEligible: 60,
      ratePerShare: 0.92,
      totalAmount: 55.2,
      status: 'RECEBIDO',
    },
    {
      id: generateSecureId(),
      ticker: 'BTLG11',
      dataCom: '2026-10-15',
      paymentDate: '2026-10-31',
      quantityEligible: 45,
      ratePerShare: 0.78,
      totalAmount: 35.1,
      status: 'PREVISTO',
    },
  ];
}

interface InitialLocalData {
  holdings: FIIHolding[];
  transactions: Transaction[];
  dividends: DividendEvent[];
  goals: PortfolioGoals;
  preferences: UserPreferences;
  notes: Record<string, string>;
  hasLocalModifiedState: boolean;
}

function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Carrega imediatamente os dados persistidos no navegador (localStorage) para que
 * a carteira nunca seja perdida ao fechar o navegador ou atualizar a página (F5).
 * Também verifica chaves anteriores (edumods_fii_data_*) caso o usuário já tenha
 * dados salvos no navegador de versões anteriores.
 */
function loadInitialLocalPortfolioState(): InitialLocalData {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {
      holdings: createDemoHoldings(),
      transactions: createDemoTransactions(),
      dividends: createDemoDividends(),
      goals: INITIAL_GOALS,
      preferences: INITIAL_PREFERENCES,
      notes: { geral: 'Carteira de FIIs de alta liquidez e proventos consistentes.' },
      hasLocalModifiedState: false,
    };
  }

  // 1. Verifica o armazenamento pessoal oficial (v1)
  const isPersonalInit = localStorage.getItem(`${PERSONAL_STORAGE_PREFIX}_initialized`) === 'true';
  if (isPersonalInit) {
    return {
      holdings: safeParseJson<FIIHolding[]>(
        localStorage.getItem(`${PERSONAL_STORAGE_PREFIX}_holdings`),
        []
      ),
      transactions: safeParseJson<Transaction[]>(
        localStorage.getItem(`${PERSONAL_STORAGE_PREFIX}_transactions`),
        []
      ),
      dividends: safeParseJson<DividendEvent[]>(
        localStorage.getItem(`${PERSONAL_STORAGE_PREFIX}_dividends`),
        []
      ),
      goals: {
        ...INITIAL_GOALS,
        ...safeParseJson<Partial<PortfolioGoals>>(
          localStorage.getItem(`${PERSONAL_STORAGE_PREFIX}_goals`),
          {}
        ),
      },
      preferences: {
        ...INITIAL_PREFERENCES,
        ...safeParseJson<Partial<UserPreferences>>(
          localStorage.getItem(`${PERSONAL_STORAGE_PREFIX}_preferences`),
          {}
        ),
      },
      notes: safeParseJson<Record<string, string>>(
        localStorage.getItem(`${PERSONAL_STORAGE_PREFIX}_notes`),
        {}
      ),
      hasLocalModifiedState:
        localStorage.getItem(`${PERSONAL_STORAGE_PREFIX}_user_modified`) === 'true',
    };
  }

  // 2. Migra automaticamente qualquer chave anterior (edumods_fii_data_*) existente no navegador
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('edumods_fii_data_') && key.endsWith('_initialized')) {
      const legacyPrefix = key.replace(/_initialized$/, '');
      if (localStorage.getItem(key) === 'true') {
        const legacyHoldings = safeParseJson<FIIHolding[]>(
          localStorage.getItem(`${legacyPrefix}_holdings`),
          []
        );
        const legacyTx = safeParseJson<Transaction[]>(
          localStorage.getItem(`${legacyPrefix}_transactions`),
          []
        );
        const legacyDiv = safeParseJson<DividendEvent[]>(
          localStorage.getItem(`${legacyPrefix}_dividends`),
          []
        );
        const legacyGoals = {
          ...INITIAL_GOALS,
          ...safeParseJson<Partial<PortfolioGoals>>(
            localStorage.getItem(`${legacyPrefix}_goals`),
            {}
          ),
        };
        const legacyPrefs = {
          ...INITIAL_PREFERENCES,
          ...safeParseJson<Partial<UserPreferences>>(
            localStorage.getItem(`${legacyPrefix}_preferences`),
            {}
          ),
        };
        const legacyNotes = safeParseJson<Record<string, string>>(
          localStorage.getItem(`${legacyPrefix}_notes`),
          {}
        );

        localStorage.setItem(`${PERSONAL_STORAGE_PREFIX}_initialized`, 'true');
        localStorage.setItem(`${PERSONAL_STORAGE_PREFIX}_holdings`, JSON.stringify(legacyHoldings));
        localStorage.setItem(`${PERSONAL_STORAGE_PREFIX}_transactions`, JSON.stringify(legacyTx));
        localStorage.setItem(`${PERSONAL_STORAGE_PREFIX}_dividends`, JSON.stringify(legacyDiv));
        localStorage.setItem(`${PERSONAL_STORAGE_PREFIX}_goals`, JSON.stringify(legacyGoals));
        localStorage.setItem(`${PERSONAL_STORAGE_PREFIX}_preferences`, JSON.stringify(legacyPrefs));
        localStorage.setItem(`${PERSONAL_STORAGE_PREFIX}_notes`, JSON.stringify(legacyNotes));

        return {
          holdings: legacyHoldings,
          transactions: legacyTx,
          dividends: legacyDiv,
          goals: legacyGoals,
          preferences: legacyPrefs,
          notes: legacyNotes,
          hasLocalModifiedState: true,
        };
      }
    }
  }

  // 3. Primeira abertura limpa: inicializa carteira inicial e grava no localStorage
  const demoHoldings = createDemoHoldings();
  const demoTx = createDemoTransactions();
  const demoDiv = createDemoDividends();
  const demoNotes = {
    geral: 'Carteira de FIIs de alta liquidez e proventos consistentes.',
  };

  localStorage.setItem(`${PERSONAL_STORAGE_PREFIX}_initialized`, 'true');
  localStorage.setItem(`${PERSONAL_STORAGE_PREFIX}_holdings`, JSON.stringify(demoHoldings));
  localStorage.setItem(`${PERSONAL_STORAGE_PREFIX}_transactions`, JSON.stringify(demoTx));
  localStorage.setItem(`${PERSONAL_STORAGE_PREFIX}_dividends`, JSON.stringify(demoDiv));
  localStorage.setItem(`${PERSONAL_STORAGE_PREFIX}_goals`, JSON.stringify(INITIAL_GOALS));
  localStorage.setItem(`${PERSONAL_STORAGE_PREFIX}_preferences`, JSON.stringify(INITIAL_PREFERENCES));
  localStorage.setItem(`${PERSONAL_STORAGE_PREFIX}_notes`, JSON.stringify(demoNotes));

  return {
    holdings: demoHoldings,
    transactions: demoTx,
    dividends: demoDiv,
    goals: INITIAL_GOALS,
    preferences: INITIAL_PREFERENCES,
    notes: demoNotes,
    hasLocalModifiedState: false,
  };
}

function persistPersonalLocalStorage(
  data: {
    holdings?: FIIHolding[];
    transactions?: Transaction[];
    dividends?: DividendEvent[];
    goals?: PortfolioGoals;
    preferences?: UserPreferences;
    notes?: Record<string, string>;
  },
  markUserModified = true
): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  localStorage.setItem(`${PERSONAL_STORAGE_PREFIX}_initialized`, 'true');
  if (markUserModified) {
    localStorage.setItem(`${PERSONAL_STORAGE_PREFIX}_user_modified`, 'true');
  }
  if (data.holdings !== undefined) {
    localStorage.setItem(`${PERSONAL_STORAGE_PREFIX}_holdings`, JSON.stringify(data.holdings));
  }
  if (data.transactions !== undefined) {
    localStorage.setItem(`${PERSONAL_STORAGE_PREFIX}_transactions`, JSON.stringify(data.transactions));
  }
  if (data.dividends !== undefined) {
    localStorage.setItem(`${PERSONAL_STORAGE_PREFIX}_dividends`, JSON.stringify(data.dividends));
  }
  if (data.goals !== undefined) {
    localStorage.setItem(`${PERSONAL_STORAGE_PREFIX}_goals`, JSON.stringify(data.goals));
  }
  if (data.preferences !== undefined) {
    localStorage.setItem(`${PERSONAL_STORAGE_PREFIX}_preferences`, JSON.stringify(data.preferences));
  }
  if (data.notes !== undefined) {
    localStorage.setItem(`${PERSONAL_STORAGE_PREFIX}_notes`, JSON.stringify(data.notes));
  }
}

const PortfolioContext = createContext<PortfolioContextType | null>(null);

export const PortfolioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isConfigured } = useAuth();

  const initialLocal = useMemo(() => loadInitialLocalPortfolioState(), []);

  const [ownerUserId, setOwnerUserId] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(`${PERSONAL_STORAGE_PREFIX}_owner_id`) || PERSONAL_USER_ID;
    }
    return PERSONAL_USER_ID;
  });

  const [ownerName, setOwnerName] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(`${PERSONAL_STORAGE_PREFIX}_owner_name`) || 'Eduardo';
    }
    return 'Eduardo';
  });

  // Uso pessoal exclusivo com 100% dos recursos liberados (VIP + admin)
  const currentUser = useMemo<UserAccount>(
    () => ({
      id: ownerUserId,
      name: ownerName,
      email: 'uso.pessoal@edumods.local',
      role: 'admin',
      plan: 'VIP',
      createdAt: '2026-01-01',
    }),
    [ownerUserId, ownerName]
  );

  const availableUsers = useMemo<UserAccount[]>(() => [currentUser], [currentUser]);

  // Estados locais inicializados sincronicamente do localStorage para persistência imediata
  const [holdings, setHoldings] = useState<FIIHolding[]>(initialLocal.holdings);
  const [transactions, setTransactions] = useState<Transaction[]>(initialLocal.transactions);
  const [dividends, setDividends] = useState<DividendEvent[]>(initialLocal.dividends);
  const [goals, setGoalsState] = useState<PortfolioGoals>(initialLocal.goals);
  const [preferences, setPreferencesState] = useState<UserPreferences>(initialLocal.preferences);
  const [notes, setNotes] = useState<Record<string, string>>(initialLocal.notes);

  // Estados de Sincronização e Cotações
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(() => new Date());
  const [isRefreshingQuotes, setIsRefreshingQuotes] = useState<boolean>(false);
  const [lastQuoteUpdate, setLastQuoteUpdate] = useState<string>('B3 Oficial');

  const hasMountedRef = useRef<boolean>(true);

  // Mantém o localStorage sempre sincronizado com qualquer alteração de estado
  useEffect(() => {
    persistPersonalLocalStorage({ holdings }, false);
  }, [holdings]);

  useEffect(() => {
    persistPersonalLocalStorage({ transactions }, false);
  }, [transactions]);

  useEffect(() => {
    persistPersonalLocalStorage({ dividends }, false);
  }, [dividends]);

  useEffect(() => {
    persistPersonalLocalStorage({ goals }, false);
  }, [goals]);

  useEffect(() => {
    persistPersonalLocalStorage({ preferences }, false);
  }, [preferences]);

  useEffect(() => {
    persistPersonalLocalStorage({ notes }, false);
  }, [notes]);

  // ============================================================================
  // SINCRONIZAÇÃO COM SUPABASE DATABASE (SEM EXIGIR LOGIN / AUTH)
  // ============================================================================
  const syncWithSupabaseDatabase = useCallback(
    async (forcePullFromRemote = false) => {
      if (!isConfigured) {
        setIsSyncing(false);
        return;
      }

      setIsSyncing(true);
      setSyncError(null);

      try {
        const resolvedId = await resolvePersonalOwnerUserId(ownerUserId);
        if (resolvedId !== ownerUserId) {
          setOwnerUserId(resolvedId);
          localStorage.setItem(`${PERSONAL_STORAGE_PREFIX}_owner_id`, resolvedId);
        }

        const [
          remoteProfile,
          remoteHoldings,
          remoteTransactions,
          remoteDividends,
          remoteGoalsRes,
          remoteNotes,
        ] = await Promise.all([
          fetchUserProfile(resolvedId),
          fetchHoldingsFromDb(resolvedId),
          fetchTransactionsFromDb(resolvedId),
          fetchDividendsFromDb(resolvedId),
          fetchGoalsWithMetaFromDb(resolvedId),
          fetchNotesFromDb(resolvedId),
        ]);

        if (remoteProfile?.full_name && remoteProfile.full_name.trim()) {
          setOwnerName(remoteProfile.full_name.trim());
          localStorage.setItem(`${PERSONAL_STORAGE_PREFIX}_owner_name`, remoteProfile.full_name.trim());
        }

        const remoteHasData =
          Boolean(remoteProfile?.is_initialized) ||
          remoteHoldings.length > 0 ||
          remoteTransactions.length > 0 ||
          remoteDividends.length > 0 ||
          Object.keys(remoteNotes).length > 0;

        const userModifiedLocally =
          localStorage.getItem(`${PERSONAL_STORAGE_PREFIX}_user_modified`) === 'true';

        if (remoteHasData && (forcePullFromRemote || !userModifiedLocally)) {
          // Carrega os dados do Supabase e atualiza o armazenamento local
          const mergedNotes: Record<string, string> = { ...remoteNotes };
          const reconciledHoldings = remoteHoldings.map((h) => {
            const noteFromTable = mergedNotes[h.ticker];
            if (noteFromTable !== undefined && !h.notes) {
              return { ...h, notes: noteFromTable };
            }
            if (h.notes && mergedNotes[h.ticker] === undefined) {
              mergedNotes[h.ticker] = h.notes;
            }
            return h;
          });

          let loadedPrefs: UserPreferences = { ...INITIAL_PREFERENCES };
          if (remoteProfile?.preferences) {
            loadedPrefs = { ...loadedPrefs, ...remoteProfile.preferences };
          }
          if (
            remoteGoalsRes?.hideValues !== undefined &&
            remoteProfile?.preferences?.hideValues === undefined
          ) {
            loadedPrefs.hideValues = remoteGoalsRes.hideValues;
          }

          const targetGoals = remoteGoalsRes?.goals || INITIAL_GOALS;

          setHoldings(reconciledHoldings);
          setTransactions(remoteTransactions);
          setDividends(remoteDividends);
          setGoalsState(targetGoals);
          setPreferencesState(loadedPrefs);
          setNotes(mergedNotes);

          persistPersonalLocalStorage(
            {
              holdings: reconciledHoldings,
              transactions: remoteTransactions,
              dividends: remoteDividends,
              goals: targetGoals,
              preferences: loadedPrefs,
              notes: mergedNotes,
            },
            false
          );
        } else {
          // Envia o estado local atual para o banco Supabase em segundo plano
          await syncLocalDataToSupabase(
            resolvedId,
            {
              holdings,
              transactions,
              dividends,
              goals,
              preferences,
              notes,
            },
            { replaceExisting: false }
          );
        }

        setLastSyncedAt(new Date());
      } catch (err: unknown) {
        // Se o Supabase ainda estiver com RLS antigo exigindo Auth, mantém o funcionamento
        // 100% normal e persistido localmente sem reverter nem bloquear o usuário.
        console.info(
          'Persistência local ativa. Aviso de sincronização remota Supabase:',
          err instanceof Error ? err.message : err
        );
      } finally {
        if (hasMountedRef.current) {
          setIsSyncing(false);
        }
      }
    },
    [isConfigured, ownerUserId, holdings, transactions, dividends, goals, preferences, notes]
  );

  // Sincroniza uma vez ao abrir o aplicativo
  const initialSyncDoneRef = useRef<boolean>(false);
  useEffect(() => {
    hasMountedRef.current = true;
    if (!initialSyncDoneRef.current) {
      initialSyncDoneRef.current = true;
      syncWithSupabaseDatabase(false);
    }
    return () => {
      hasMountedRef.current = false;
    };
  }, [syncWithSupabaseDatabase]);

  // ============================================================================
  // CÁLCULO DE MÉTRICAS DA CARTEIRA
  // ============================================================================
  const {
    totalInvested,
    totalMarketValue,
    totalUnrealizedGain,
    totalUnrealizedGainPercent,
    holdingsWithWeights,
  } = useMemo(() => {
    let invested = 0;
    let market = 0;

    holdings.forEach((h) => {
      invested += h.totalCost;
      market += h.marketValue;
    });

    const gain = market - invested;
    const gainPct = invested > 0 ? (gain / invested) * 100 : 0;

    const withWeights = holdings.map((h) => ({
      ...h,
      portfolioWeight: market > 0 ? Number(((h.marketValue / market) * 100).toFixed(2)) : 0,
    }));

    return {
      totalInvested: Number(invested.toFixed(2)),
      totalMarketValue: Number(market.toFixed(2)),
      totalUnrealizedGain: Number(gain.toFixed(2)),
      totalUnrealizedGainPercent: Number(gainPct.toFixed(2)),
      holdingsWithWeights: withWeights,
    };
  }, [holdings]);

  // Proventos mensais calculados
  const { monthlyDividendsReceived, monthlyDividendsForecasted, averageMonthlyDividends } = useMemo(() => {
    let received = 0;
    let forecasted = 0;

    dividends.forEach((d) => {
      if (d.status === 'RECEBIDO') {
        received += d.totalAmount;
      } else if (d.status === 'PREVISTO') {
        forecasted += d.totalAmount;
      }
    });

    const estimatedMonthlyTotal = holdings.reduce(
      (acc, h) => acc + h.quantity * (h.monthlyYieldPerShare || 0),
      0
    );

    return {
      monthlyDividendsReceived: Number(received.toFixed(2)),
      monthlyDividendsForecasted: Number(forecasted.toFixed(2)),
      averageMonthlyDividends: {
        last3Months: Number((estimatedMonthlyTotal * 0.98).toFixed(2)),
        last6Months: Number((estimatedMonthlyTotal * 0.95).toFixed(2)),
        last12Months: Number((estimatedMonthlyTotal * 0.92).toFixed(2)),
      },
    };
  }, [dividends, holdings]);

  // ============================================================================
  // OPERAÇÕES PERSISTIDAS IMEDIATAMENTE (LOCALSTORAGE + SUPABASE DATABASE)
  // ============================================================================

  // 1. Excluir Holding (POSIÇÃO) e sua anotação vinculada
  const deleteHolding = useCallback(
    async (ticker: string) => {
      const cleanTicker = ticker.toUpperCase().trim();
      const nextHoldings = holdings.filter((h) => h.ticker !== cleanTicker);
      const nextNotes = { ...notes };
      delete nextNotes[cleanTicker];

      setSyncError(null);
      setHoldings(nextHoldings);
      setNotes(nextNotes);
      persistPersonalLocalStorage({ holdings: nextHoldings, notes: nextNotes }, true);
      setLastSyncedAt(new Date());

      try {
        await deleteHoldingFromDb(currentUser.id, cleanTicker);
        await deleteNoteFromDb(currentUser.id, cleanTicker);
        await markUserInitialized(currentUser.id, { preferences });
      } catch (err: unknown) {
        console.info(`Posição ${cleanTicker} removida localmente (aviso Supabase):`, err);
      }
    },
    [currentUser.id, holdings, notes, preferences]
  );

  // 2. Atualizar Dados de Posição
  const updateHolding = useCallback(
    async (ticker: string, changes: Partial<FIIHolding>) => {
      const cleanTicker = ticker.toUpperCase().trim();
      const existing = holdings.find((h) => h.ticker === cleanTicker);
      if (!existing) return;

      const newQty = changes.quantity !== undefined ? changes.quantity : existing.quantity;
      const newAvg = changes.averagePrice !== undefined ? changes.averagePrice : existing.averagePrice;
      const newPrice =
        changes.currentPrice !== undefined ? changes.currentPrice : existing.currentPrice;
      const { marketValue, unrealizedGain, unrealizedGainPercent } = calculateUnrealizedGain(
        newQty,
        newAvg,
        newPrice
      );
      const vpa = changes.vpa !== undefined ? changes.vpa : existing.vpa;
      const pvp = vpa > 0 ? Number((newPrice / vpa).toFixed(2)) : existing.pvp;
      const lastDiv =
        changes.monthlyYieldPerShare !== undefined
          ? changes.monthlyYieldPerShare
          : existing.monthlyYieldPerShare;
      const monthlyDY = newPrice > 0 ? (lastDiv / newPrice) * 100 : 0;

      const merged: FIIHolding = {
        ...existing,
        ...changes,
        quantity: newQty,
        averagePrice: newAvg,
        currentPrice: newPrice,
        totalCost: Number((newQty * newAvg).toFixed(2)),
        marketValue,
        unrealizedGain,
        unrealizedGainPercent,
        vpa,
        pvp,
        monthlyYieldPerShare: lastDiv,
        monthlyDividendYield: Number(monthlyDY.toFixed(2)),
      };

      const nextHoldings = holdings.map((h) => (h.ticker === cleanTicker ? merged : h));

      setSyncError(null);
      setHoldings(nextHoldings);
      persistPersonalLocalStorage({ holdings: nextHoldings }, true);
      setLastSyncedAt(new Date());

      try {
        await saveHoldingToDb(currentUser.id, merged);
      } catch (err: unknown) {
        console.info(`Posição ${cleanTicker} atualizada localmente (aviso Supabase):`, err);
      }
    },
    [currentUser.id, holdings]
  );

  // 3. Atualizar Meta de Alocação (% Alvo)
  const updateHoldingTargetWeight = useCallback(
    async (ticker: string, targetWeight: number) => {
      const cleanTicker = ticker.toUpperCase().trim();
      const existing = holdings.find((h) => h.ticker === cleanTicker);
      if (!existing) return;

      const updatedHolding: FIIHolding = { ...existing, targetWeight };
      const nextHoldings = holdings.map((h) => (h.ticker === cleanTicker ? updatedHolding : h));

      setSyncError(null);
      setHoldings(nextHoldings);
      persistPersonalLocalStorage({ holdings: nextHoldings }, true);
      setLastSyncedAt(new Date());

      try {
        await saveHoldingToDb(currentUser.id, updatedHolding);
      } catch (err: unknown) {
        console.info(`Meta de ${cleanTicker} salva localmente (aviso Supabase):`, err);
      }
    },
    [currentUser.id, holdings]
  );

  // 4. Atualizar Anotações de um Fundo ou Notas Gerais
  const updateHoldingNotes = useCallback(
    async (ticker: string, text: string) => {
      const cleanTicker = ticker.trim() === 'geral' ? 'geral' : ticker.toUpperCase().trim();

      const existing = holdings.find((h) => h.ticker === cleanTicker);
      const updatedHolding: FIIHolding | null = existing ? { ...existing, notes: text } : null;
      const nextHoldings = updatedHolding
        ? holdings.map((h) => (h.ticker === cleanTicker ? updatedHolding : h))
        : holdings;
      const nextNotes = { ...notes, [cleanTicker]: text };

      setSyncError(null);
      setHoldings(nextHoldings);
      setNotes(nextNotes);
      persistPersonalLocalStorage({ holdings: nextHoldings, notes: nextNotes }, true);
      setLastSyncedAt(new Date());

      try {
        if (updatedHolding) {
          await saveHoldingToDb(currentUser.id, updatedHolding);
        }
        await saveNoteToDb(currentUser.id, cleanTicker, text);
      } catch (err: unknown) {
        console.info(`Anotação de ${cleanTicker} salva localmente (aviso Supabase):`, err);
      }
    },
    [currentUser.id, holdings, notes]
  );

  // 5. Favoritar Ativo
  const toggleFavorite = useCallback(
    async (ticker: string) => {
      const cleanTicker = ticker.toUpperCase().trim();
      const existing = holdings.find((h) => h.ticker === cleanTicker);
      if (!existing) return;

      const updatedHolding: FIIHolding = { ...existing, isFavorite: !existing.isFavorite };
      const nextHoldings = holdings.map((h) => (h.ticker === cleanTicker ? updatedHolding : h));

      setSyncError(null);
      setHoldings(nextHoldings);
      persistPersonalLocalStorage({ holdings: nextHoldings }, true);
      setLastSyncedAt(new Date());

      try {
        await saveHoldingToDb(currentUser.id, updatedHolding);
      } catch (err: unknown) {
        console.info(`Favorito de ${cleanTicker} salvo localmente (aviso Supabase):`, err);
      }
    },
    [currentUser.id, holdings]
  );

  // 6. Adicionar Operação / Transação (Compra, Venda, Subscrição)
  const addTransaction = useCallback(
    async (tx: Omit<Transaction, 'id' | 'total'>): Promise<{ success: boolean; error?: string }> => {
      const ticker = tx.ticker.toUpperCase().trim();
      if (!ticker) {
        return { success: false, error: 'O ticker do fundo é obrigatório.' };
      }
      if (tx.quantity <= 0 || tx.price <= 0) {
        return { success: false, error: 'Quantidade e preço devem ser maiores que zero.' };
      }

      setSyncError(null);

      const totalValue =
        tx.type === 'VENDA'
          ? tx.quantity * tx.price - (tx.fees || 0)
          : tx.quantity * tx.price + (tx.fees || 0);

      const existingHolding = holdings.find((h) => h.ticker === ticker);
      let realizedResult: number | undefined;
      let updatedHoldingToSave: FIIHolding | null = null;
      let shouldDeleteHolding = false;
      let nextHoldings = [...holdings];
      const nextNotes = { ...notes };

      if (tx.type === 'VENDA') {
        if (!existingHolding || existingHolding.quantity < tx.quantity) {
          return {
            success: false,
            error: `Saldo insuficiente para venda. Você possui ${
              existingHolding ? existingHolding.quantity : 0
            } cotas de ${ticker}.`,
          };
        }

        const saleRes = calculateSaleResult(
          existingHolding.quantity,
          existingHolding.averagePrice,
          tx.quantity,
          tx.price,
          tx.fees || 0
        );

        realizedResult = saleRes.realizedResult;

        if (saleRes.remainingQuantity === 0) {
          shouldDeleteHolding = true;
          nextHoldings = holdings.filter((h) => h.ticker !== ticker);
          delete nextNotes[ticker];
        } else {
          const { marketValue, unrealizedGain, unrealizedGainPercent } = calculateUnrealizedGain(
            saleRes.remainingQuantity,
            saleRes.averagePrice,
            existingHolding.currentPrice
          );
          const updated: FIIHolding = {
            ...existingHolding,
            quantity: saleRes.remainingQuantity,
            totalCost: saleRes.totalCostRemaining,
            marketValue,
            unrealizedGain,
            unrealizedGainPercent,
          };
          updatedHoldingToSave = updated;
          nextHoldings = holdings.map((h) => (h.ticker === ticker ? updated : h));
        }
      } else {
        // COMPRA, SUBSCRICAO, AMORTIZACAO
        const prevQty = existingHolding ? existingHolding.quantity : 0;
        const prevAvg = existingHolding ? existingHolding.averagePrice : 0;

        const buyRes = calculateWeightedAveragePrice(
          prevQty,
          prevAvg,
          tx.quantity,
          tx.price,
          tx.fees || 0
        );

        const dbInfo = VERIFIED_FII_DATABASE[ticker];
        const currentPrice = existingHolding
          ? existingHolding.currentPrice
          : dbInfo
          ? dbInfo.currentPrice
          : tx.price;

        const { marketValue, unrealizedGain, unrealizedGainPercent } = calculateUnrealizedGain(
          buyRes.newQuantity,
          buyRes.newAveragePrice,
          currentPrice
        );

        if (existingHolding) {
          const updated: FIIHolding = {
            ...existingHolding,
            quantity: buyRes.newQuantity,
            averagePrice: buyRes.newAveragePrice,
            totalCost: buyRes.totalCost,
            marketValue,
            unrealizedGain,
            unrealizedGainPercent,
          };
          updatedHoldingToSave = updated;
          nextHoldings = holdings.map((h) => (h.ticker === ticker ? updated : h));
        } else {
          const vpa = dbInfo ? dbInfo.vpa : tx.price;
          const pvp = vpa > 0 ? currentPrice / vpa : 1;
          const newHolding: FIIHolding = {
            ticker,
            name: dbInfo ? dbInfo.name : `${ticker} FII`,
            category: dbInfo ? dbInfo.category : 'Tijolo',
            segment: dbInfo ? dbInfo.segment : 'Logística',
            quantity: buyRes.newQuantity,
            averagePrice: buyRes.newAveragePrice,
            currentPrice,
            totalCost: buyRes.totalCost,
            marketValue,
            unrealizedGain,
            unrealizedGainPercent,
            monthlyYieldPerShare: dbInfo ? dbInfo.lastDividend : 0.8,
            monthlyDividendYield: dbInfo ? dbInfo.monthlyDY : 0.8,
            annualDividendYield: dbInfo ? dbInfo.annualDY : 9.5,
            vpa,
            pvp: Number(pvp.toFixed(2)),
            portfolioWeight: 0,
            targetWeight: 10,
            manager: dbInfo?.manager || 'Gestão Ativa',
            indexer: dbInfo?.indexer || 'IPCA',
            locationStates: dbInfo?.locationStates || ['SP'],
            notes: '',
            isFavorite: false,
          };
          updatedHoldingToSave = newHolding;
          nextHoldings = [...holdings, newHolding];
        }
      }

      const generatedTxId = generateSecureId();
      const newTx: Transaction = {
        id: generatedTxId,
        ticker,
        type: tx.type,
        date: tx.date,
        quantity: tx.quantity,
        price: tx.price,
        fees: tx.fees || 0,
        total: Number(totalValue.toFixed(2)),
        realizedResult,
        notes: tx.notes,
      };

      const nextTransactions = [newTx, ...transactions];

      setHoldings(nextHoldings);
      setNotes(nextNotes);
      setTransactions(nextTransactions);
      persistPersonalLocalStorage(
        {
          holdings: nextHoldings,
          notes: nextNotes,
          transactions: nextTransactions,
        },
        true
      );
      setLastSyncedAt(new Date());

      try {
        const savedId = await saveTransactionToDb(currentUser.id, newTx);
        if (savedId && savedId !== generatedTxId) {
          const updatedTxs = nextTransactions.map((item) =>
            item.id === generatedTxId ? { ...item, id: savedId } : item
          );
          setTransactions(updatedTxs);
          persistPersonalLocalStorage({ transactions: updatedTxs }, true);
        }

        if (shouldDeleteHolding) {
          await deleteHoldingFromDb(currentUser.id, ticker);
          await deleteNoteFromDb(currentUser.id, ticker);
          await markUserInitialized(currentUser.id, { preferences });
        } else if (updatedHoldingToSave) {
          await saveHoldingToDb(currentUser.id, updatedHoldingToSave);
        }
      } catch (err: unknown) {
        console.info('Operação gravada localmente (aviso Supabase):', err);
      }

      return { success: true };
    },
    [currentUser.id, holdings, transactions, notes, preferences]
  );

  // Função auxiliar para reverter e/ou reaplicar o efeito de uma transação na posição da carteira
  const reconcileHoldingAfterTxChange = useCallback(
    (
      currentHoldings: FIIHolding[],
      oldTx: Transaction | null,
      newTx: Transaction | null
    ): {
      nextHoldings: FIIHolding[];
      updatedHoldingToSave: FIIHolding | null;
      deletedTicker: string | null;
    } => {
      const targetTicker = (newTx?.ticker || oldTx?.ticker || '').toUpperCase().trim();
      if (!targetTicker) {
        return { nextHoldings: currentHoldings, updatedHoldingToSave: null, deletedTicker: null };
      }

      const existing = currentHoldings.find((h) => h.ticker.toUpperCase() === targetTicker);
      if (!existing && !newTx) {
        return { nextHoldings: currentHoldings, updatedHoldingToSave: null, deletedTicker: null };
      }

      let qty = existing ? existing.quantity : 0;
      let totalCost = existing ? existing.totalCost : 0;
      let avgPrice = existing ? existing.averagePrice : 0;

      // 1. Reverte o efeito da transação antiga (se existir)
      if (oldTx) {
        if (oldTx.type === 'COMPRA' || oldTx.type === 'SUBSCRICAO') {
          const oldTxCost = oldTx.quantity * oldTx.price + (oldTx.fees || 0);
          qty = Math.max(0, qty - oldTx.quantity);
          totalCost = Math.max(0, totalCost - oldTxCost);
          avgPrice = qty > 0 ? totalCost / qty : 0;
        } else if (oldTx.type === 'VENDA') {
          qty = qty + oldTx.quantity;
          totalCost = qty * avgPrice;
        }
      }

      // 2. Aplica o efeito da nova transação (se existir)
      if (newTx) {
        if (newTx.type === 'COMPRA' || newTx.type === 'SUBSCRICAO') {
          const buyRes = calculateWeightedAveragePrice(
            qty,
            avgPrice,
            newTx.quantity,
            newTx.price,
            newTx.fees || 0
          );
          qty = buyRes.newQuantity;
          avgPrice = buyRes.newAveragePrice;
          totalCost = buyRes.totalCost;
        } else if (newTx.type === 'VENDA') {
          qty = Math.max(0, qty - newTx.quantity);
          totalCost = Number((qty * avgPrice).toFixed(2));
        }
      }

      if (qty <= 0) {
        return {
          nextHoldings: currentHoldings.filter((h) => h.ticker.toUpperCase() !== targetTicker),
          updatedHoldingToSave: null,
          deletedTicker: existing ? targetTicker : null,
        };
      }

      const dbInfo = VERIFIED_FII_DATABASE[targetTicker];
      const currentPrice = existing?.currentPrice ?? dbInfo?.currentPrice ?? newTx?.price ?? avgPrice;
      const { marketValue, unrealizedGain, unrealizedGainPercent } = calculateUnrealizedGain(
        qty,
        avgPrice,
        currentPrice
      );

      if (existing) {
        const updatedHolding: FIIHolding = {
          ...existing,
          quantity: qty,
          averagePrice: Number(avgPrice.toFixed(2)),
          totalCost: Number(totalCost.toFixed(2)),
          marketValue,
          unrealizedGain,
          unrealizedGainPercent,
        };
        return {
          nextHoldings: currentHoldings.map((h) =>
            h.ticker.toUpperCase() === targetTicker ? updatedHolding : h
          ),
          updatedHoldingToSave: updatedHolding,
          deletedTicker: null,
        };
      }

      return { nextHoldings: currentHoldings, updatedHoldingToSave: null, deletedTicker: null };
    },
    []
  );

  // 7. Atualizar Transação
  const updateTransaction = useCallback(
    async (id: string, updated: Partial<Transaction>) => {
      const existingTx = transactions.find((t) => t.id === id);
      if (!existingTx) return;

      const mergedTx = { ...existingTx, ...updated };
      const total =
        mergedTx.type === 'VENDA'
          ? mergedTx.quantity * mergedTx.price - (mergedTx.fees || 0)
          : mergedTx.quantity * mergedTx.price + (mergedTx.fees || 0);

      let realizedResult = mergedTx.realizedResult;
      const holdingForTicker = holdings.find(
        (h) => h.ticker.toUpperCase() === mergedTx.ticker.toUpperCase()
      );
      if (mergedTx.type === 'VENDA' && holdingForTicker) {
        const sellCalc = calculateSaleResult(
          Math.max(holdingForTicker.quantity, mergedTx.quantity),
          holdingForTicker.averagePrice,
          mergedTx.quantity,
          mergedTx.price,
          mergedTx.fees || 0
        );
        realizedResult = sellCalc.realizedResult;
      }

      const finalTx: Transaction = {
        ...mergedTx,
        total: Number(total.toFixed(2)),
        realizedResult,
      };
      const nextTransactions = transactions.map((t) => (t.id === id ? finalTx : t));

      const { nextHoldings, updatedHoldingToSave, deletedTicker } = reconcileHoldingAfterTxChange(
        holdings,
        existingTx,
        finalTx
      );

      setSyncError(null);
      setHoldings(nextHoldings);
      setTransactions(nextTransactions);
      persistPersonalLocalStorage(
        { holdings: nextHoldings, transactions: nextTransactions },
        true
      );
      setLastSyncedAt(new Date());

      try {
        const savedId = await saveTransactionToDb(currentUser.id, finalTx);
        if (savedId && savedId !== id) {
          const syncedTxs = nextTransactions.map((t) =>
            t.id === id ? { ...t, id: savedId } : t
          );
          setTransactions(syncedTxs);
          persistPersonalLocalStorage({ transactions: syncedTxs }, true);
        }
        if (deletedTicker) {
          await deleteHoldingFromDb(currentUser.id, deletedTicker);
        } else if (updatedHoldingToSave) {
          await saveHoldingToDb(currentUser.id, updatedHoldingToSave);
        }
      } catch (err: unknown) {
        console.info('Transação atualizada localmente (aviso Supabase):', err);
      }
    },
    [currentUser.id, transactions, holdings, reconcileHoldingAfterTxChange]
  );

  // 8. Excluir Transação
  const deleteTransaction = useCallback(
    async (id: string) => {
      const existingTx = transactions.find((t) => t.id === id) || null;
      const nextTransactions = transactions.filter((t) => t.id !== id);

      const { nextHoldings, updatedHoldingToSave, deletedTicker } = reconcileHoldingAfterTxChange(
        holdings,
        existingTx,
        null
      );

      setSyncError(null);
      setHoldings(nextHoldings);
      setTransactions(nextTransactions);
      persistPersonalLocalStorage(
        { holdings: nextHoldings, transactions: nextTransactions },
        true
      );
      setLastSyncedAt(new Date());

      try {
        await deleteTransactionFromDb(currentUser.id, id);
        if (deletedTicker) {
          await deleteHoldingFromDb(currentUser.id, deletedTicker);
        } else if (updatedHoldingToSave) {
          await saveHoldingToDb(currentUser.id, updatedHoldingToSave);
        }
        if (nextTransactions.length === 0 && nextHoldings.length === 0) {
          await markUserInitialized(currentUser.id, { preferences });
        }
      } catch (err: unknown) {
        console.info('Transação excluída localmente (aviso Supabase):', err);
      }
    },
    [currentUser.id, transactions, holdings, preferences, reconcileHoldingAfterTxChange]
  );

  // 9. Proventos e Dividendos (Adicionar Manualmente)
  const addManualDividend = useCallback(
    async (div: Omit<DividendEvent, 'id' | 'totalAmount'>) => {
      const generatedId = generateSecureId();
      const totalAmount = Number((div.quantityEligible * div.ratePerShare).toFixed(2));
      const newDiv: DividendEvent = {
        ...div,
        id: generatedId,
        totalAmount,
        isManual: true,
      };

      const nextDividends = [newDiv, ...dividends];
      setSyncError(null);
      setDividends(nextDividends);
      persistPersonalLocalStorage({ dividends: nextDividends }, true);
      setLastSyncedAt(new Date());

      try {
        const savedId = await saveDividendToDb(currentUser.id, newDiv);
        if (savedId && savedId !== generatedId) {
          const syncedDivs = nextDividends.map((d) =>
            d.id === generatedId ? { ...d, id: savedId } : d
          );
          setDividends(syncedDivs);
          persistPersonalLocalStorage({ dividends: syncedDivs }, true);
        }
      } catch (err: unknown) {
        console.info('Provento salvo localmente (aviso Supabase):', err);
      }
    },
    [currentUser.id, dividends]
  );

  // 10. Atualizar Provento
  const updateDividend = useCallback(
    async (id: string, updated: Partial<DividendEvent>) => {
      const existingDiv = dividends.find((d) => d.id === id);
      if (!existingDiv) return;

      const mergedDiv = { ...existingDiv, ...updated };
      const total = Number((mergedDiv.quantityEligible * mergedDiv.ratePerShare).toFixed(2));
      const finalDiv: DividendEvent = { ...mergedDiv, totalAmount: total };
      const nextDividends = dividends.map((d) => (d.id === id ? finalDiv : d));

      setSyncError(null);
      setDividends(nextDividends);
      persistPersonalLocalStorage({ dividends: nextDividends }, true);
      setLastSyncedAt(new Date());

      try {
        const savedId = await saveDividendToDb(currentUser.id, finalDiv);
        if (savedId && savedId !== id) {
          const syncedDivs = nextDividends.map((d) =>
            d.id === id ? { ...d, id: savedId } : d
          );
          setDividends(syncedDivs);
          persistPersonalLocalStorage({ dividends: syncedDivs }, true);
        }
      } catch (err: unknown) {
        console.info('Provento atualizado localmente (aviso Supabase):', err);
      }
    },
    [currentUser.id, dividends]
  );

  // 11. Excluir Provento
  const deleteDividend = useCallback(
    async (id: string) => {
      const nextDividends = dividends.filter((d) => d.id !== id);

      setSyncError(null);
      setDividends(nextDividends);
      persistPersonalLocalStorage({ dividends: nextDividends }, true);
      setLastSyncedAt(new Date());

      try {
        await deleteDividendFromDb(currentUser.id, id);
        if (nextDividends.length === 0 && holdings.length === 0) {
          await markUserInitialized(currentUser.id, { preferences });
        }
      } catch (err: unknown) {
        console.info('Provento excluído localmente (aviso Supabase):', err);
      }
    },
    [currentUser.id, dividends, holdings.length, preferences]
  );

  // 12. Atualizar Status do Provento
  const updateDividendStatus = useCallback(
    async (id: string, status: DividendEvent['status']) => {
      const existingDiv = dividends.find((d) => d.id === id);
      if (!existingDiv) return;

      const updatedObj: DividendEvent = { ...existingDiv, status };
      const nextDividends = dividends.map((d) => (d.id === id ? updatedObj : d));

      setSyncError(null);
      setDividends(nextDividends);
      persistPersonalLocalStorage({ dividends: nextDividends }, true);
      setLastSyncedAt(new Date());

      try {
        const savedId = await saveDividendToDb(currentUser.id, updatedObj);
        if (savedId && savedId !== id) {
          const syncedDivs = nextDividends.map((d) =>
            d.id === id ? { ...d, id: savedId } : d
          );
          setDividends(syncedDivs);
          persistPersonalLocalStorage({ dividends: syncedDivs }, true);
        }
      } catch (err: unknown) {
        console.info('Status do provento atualizado localmente (aviso Supabase):', err);
      }
    },
    [currentUser.id, dividends]
  );

  // 13. Metas Financeiras
  const updateGoals = useCallback(
    async (newGoals: Partial<PortfolioGoals>) => {
      const merged = { ...goals, ...newGoals };
      setSyncError(null);
      setGoalsState(merged);
      persistPersonalLocalStorage({ goals: merged }, true);
      setLastSyncedAt(new Date());

      try {
        await saveGoalsToDb(currentUser.id, merged, preferences.hideValues);
      } catch (err: unknown) {
        console.info('Metas salvas localmente (aviso Supabase):', err);
      }
    },
    [currentUser.id, goals, preferences.hideValues]
  );

  // 14. Preferências do Usuário
  const updatePreferences = useCallback(
    async (newPrefs: Partial<UserPreferences>) => {
      const merged: UserPreferences = { ...preferences, ...newPrefs };
      setSyncError(null);
      setPreferencesState(merged);
      persistPersonalLocalStorage({ preferences: merged }, true);
      setLastSyncedAt(new Date());

      try {
        await saveUserPreferencesToDb(currentUser.id, merged);
      } catch (err: unknown) {
        console.info('Preferências salvas localmente (aviso Supabase):', err);
      }
    },
    [currentUser.id, preferences]
  );

  const toggleHideValues = useCallback(async () => {
    const nextPrefs: UserPreferences = {
      ...preferences,
      hideValues: !preferences.hideValues,
    };
    setSyncError(null);
    setPreferencesState(nextPrefs);
    persistPersonalLocalStorage({ preferences: nextPrefs }, true);
    setLastSyncedAt(new Date());

    try {
      await saveUserPreferencesToDb(currentUser.id, nextPrefs);
    } catch (err: unknown) {
      console.info('Visibilidade de valores salva localmente (aviso Supabase):', err);
    }
  }, [currentUser.id, preferences]);

  // 15. Atualização de Cotações com BRAPI
  const refreshQuotes = useCallback(async () => {
    if (holdings.length === 0) return;
    setIsRefreshingQuotes(true);

    try {
      const tickers = holdings.map((h) => h.ticker);
      const quotes = await brapiAdapter.fetchQuotes(tickers, {
        token: preferences.brapiToken,
      });

      const updatedHoldingsList: FIIHolding[] = [];
      const nextHoldings: FIIHolding[] = holdings.map((h) => {
        const q = quotes[h.ticker];
        if (q && q.price > 0) {
          const { marketValue, unrealizedGain, unrealizedGainPercent } = calculateUnrealizedGain(
            h.quantity,
            h.averagePrice,
            q.price
          );
          const pvp = h.vpa > 0 ? Number((q.price / h.vpa).toFixed(2)) : h.pvp;
          const nextHolding: FIIHolding = {
            ...h,
            currentPrice: q.price,
            marketValue,
            unrealizedGain,
            unrealizedGainPercent,
            pvp,
            lastQuoteUpdate: q.updatedAt,
            quoteSource: q.source,
          };
          updatedHoldingsList.push(nextHolding);
          return nextHolding;
        }
        return h;
      });

      if (updatedHoldingsList.length > 0) {
        setSyncError(null);
        setHoldings(nextHoldings);
        persistPersonalLocalStorage({ holdings: nextHoldings }, true);
        setLastSyncedAt(new Date());

        try {
          for (const item of updatedHoldingsList) {
            await saveHoldingToDb(currentUser.id, item);
          }
        } catch (err) {
          console.info('Cotações salvas localmente (aviso Supabase):', err);
        }
      }

      setLastQuoteUpdate(
        new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      );
    } catch (err: unknown) {
      console.info('Aviso ao atualizar cotações:', err);
    } finally {
      setIsRefreshingQuotes(false);
    }
  }, [holdings, preferences.brapiToken, currentUser.id]);

  // 16. Sincronização Manual com Supabase
  const reloadFromSupabase = useCallback(async () => {
    await syncWithSupabaseDatabase(false);
  }, [syncWithSupabaseDatabase]);

  // 17. Resetar Carteira para Modelo Demo
  const resetPortfolioToDemo = useCallback(async () => {
    const demoH = createDemoHoldings();
    const demoT = createDemoTransactions();
    const demoD = createDemoDividends();
    const demoNotes = {
      geral: 'Carteira de FIIs de alta liquidez e proventos consistentes.',
    };

    setSyncError(null);
    setIsSyncing(true);

    setHoldings(demoH);
    setTransactions(demoT);
    setDividends(demoD);
    setGoalsState(INITIAL_GOALS);
    setPreferencesState(INITIAL_PREFERENCES);
    setNotes(demoNotes);

    persistPersonalLocalStorage(
      {
        holdings: demoH,
        transactions: demoT,
        dividends: demoD,
        goals: INITIAL_GOALS,
        preferences: INITIAL_PREFERENCES,
        notes: demoNotes,
      },
      true
    );
    setLastSyncedAt(new Date());

    try {
      const res = await syncLocalDataToSupabase(
        currentUser.id,
        {
          holdings: demoH,
          transactions: demoT,
          dividends: demoD,
          goals: INITIAL_GOALS,
          preferences: INITIAL_PREFERENCES,
          notes: demoNotes,
        },
        { replaceExisting: true }
      );

      if (res.success) {
        setTransactions(res.transactions);
        setDividends(res.dividends);
        persistPersonalLocalStorage(
          {
            transactions: res.transactions,
            dividends: res.dividends,
          },
          true
        );
      }
    } catch (err) {
      console.info('Carteira Demo restaurada localmente (aviso Supabase):', err);
    } finally {
      setIsSyncing(false);
    }
  }, [currentUser.id]);

  // 18. Limpar Todos os Dados da Carteira
  const clearPortfolioData = useCallback(async () => {
    setSyncError(null);
    setHoldings([]);
    setTransactions([]);
    setDividends([]);
    setNotes({});

    persistPersonalLocalStorage(
      {
        holdings: [],
        transactions: [],
        dividends: [],
        notes: {},
      },
      true
    );
    setLastSyncedAt(new Date());

    try {
      await deleteAllUserDataFromDb(currentUser.id, { includeNotes: true });
    } catch (err: unknown) {
      console.info('Dados limpos localmente (aviso Supabase):', err);
    }
  }, [currentUser.id]);

  // Backup & Import
  const exportDataJSON = useCallback(() => {
    const backup = {
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      user: currentUser,
      holdings,
      transactions,
      dividends,
      goals,
      preferences,
      notes,
    };
    return JSON.stringify(backup, null, 2);
  }, [currentUser, holdings, transactions, dividends, goals, preferences, notes]);

  const exportTransactionsCSV = useCallback(() => {
    const headers = 'ID,Ticker,Tipo,Data,Quantidade,Preco,Taxas,Total,ResultadoRealizado,Notas\n';
    const rows = transactions
      .map(
        (t) =>
          `"${t.id}","${t.ticker}","${t.type}","${t.date}",${t.quantity},${t.price},${t.fees},${t.total},${
            t.realizedResult || 0
          },"${t.notes || ''}"`
      )
      .join('\n');
    return headers + rows;
  }, [transactions]);

  // 19. Importação de Backup JSON
  const importDataJSON = useCallback(
    async (jsonStr: string): Promise<{ success: boolean; message: string }> => {
      let parsed: any;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        return { success: false, message: 'Falha ao processar arquivo JSON de backup (formato inválido).' };
      }

      if (!parsed || (!Array.isArray(parsed.holdings) && !Array.isArray(parsed.transactions))) {
        return {
          success: false,
          message: 'Estrutura do arquivo inválida. Certifique-se de que é um backup do EDUMODS FIIs.',
        };
      }

      const newH: FIIHolding[] = Array.isArray(parsed.holdings) ? parsed.holdings : [];
      const newT: Transaction[] = Array.isArray(parsed.transactions)
        ? parsed.transactions.map((t: Transaction) => ({
            ...t,
            id: ensureValidUuid(t.id),
          }))
        : [];
      const newD: DividendEvent[] = Array.isArray(parsed.dividends)
        ? parsed.dividends.map((d: DividendEvent) => ({
            ...d,
            id: ensureValidUuid(d.id),
          }))
        : [];
      const newGoals: PortfolioGoals = parsed.goals ? { ...INITIAL_GOALS, ...parsed.goals } : goals;
      const newPrefs: UserPreferences = parsed.preferences
        ? { ...INITIAL_PREFERENCES, ...parsed.preferences }
        : preferences;
      const newNotes: Record<string, string> = parsed.notes || {};

      // Validação básica de integridade antes de aplicar
      for (const h of newH) {
        if (!h || typeof h.ticker !== 'string' || !h.ticker.trim()) {
          return {
            success: false,
            message: 'Posição inválida detectada no arquivo (ticker ausente).',
          };
        }
      }

      setSyncError(null);
      setIsSyncing(true);

      setHoldings(newH);
      setTransactions(newT);
      setDividends(newD);
      setGoalsState(newGoals);
      setPreferencesState(newPrefs);
      setNotes(newNotes);

      persistPersonalLocalStorage(
        {
          holdings: newH,
          transactions: newT,
          dividends: newD,
          goals: newGoals,
          preferences: newPrefs,
          notes: newNotes,
        },
        true
      );
      setLastSyncedAt(new Date());

      try {
        const res = await syncLocalDataToSupabase(
          currentUser.id,
          {
            holdings: newH,
            transactions: newT,
            dividends: newD,
            goals: newGoals,
            preferences: newPrefs,
            notes: newNotes,
          },
          { replaceExisting: true }
        );

        if (res.success) {
          setTransactions(res.transactions);
          setDividends(res.dividends);
          persistPersonalLocalStorage(
            {
              transactions: res.transactions,
              dividends: res.dividends,
            },
            true
          );
        }
      } catch (err) {
        console.info('Backup restaurado localmente (aviso Supabase):', err);
      } finally {
        setIsSyncing(false);
      }

      return {
        success: true,
        message: 'Dados restaurados e salvos com sucesso!',
      };
    },
    [currentUser.id, goals, preferences]
  );

  const switchUser = useCallback((user: UserAccount) => {
    if (user.name && user.name.trim()) {
      setOwnerName(user.name.trim());
      localStorage.setItem(`${PERSONAL_STORAGE_PREFIX}_owner_name`, user.name.trim());
    }
  }, []);

  const createNewUserAccount = useCallback((name: string) => {
    if (name && name.trim()) {
      setOwnerName(name.trim());
      localStorage.setItem(`${PERSONAL_STORAGE_PREFIX}_owner_name`, name.trim());
    }
  }, []);

  const deleteAccount = useCallback(() => {}, []);

  return (
    <PortfolioContext.Provider
      value={{
        currentUser,
        switchUser,
        availableUsers,
        createNewUserAccount,
        deleteAccount,
        holdings: holdingsWithWeights,
        transactions,
        dividends,
        goals,
        preferences,
        notes,
        isSyncing,
        syncError,
        lastSyncedAt,
        reloadFromSupabase,
        totalInvested,
        totalMarketValue,
        totalUnrealizedGain,
        totalUnrealizedGainPercent,
        monthlyDividendsReceived,
        monthlyDividendsForecasted,
        averageMonthlyDividends,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        updateHolding,
        deleteHolding,
        addManualDividend,
        updateDividend,
        deleteDividend,
        updateDividendStatus,
        updateHoldingTargetWeight,
        updateHoldingNotes,
        toggleFavorite,
        updateGoals,
        updatePreferences,
        toggleHideValues,
        refreshQuotes,
        isRefreshingQuotes,
        lastQuoteUpdate,
        exportDataJSON,
        exportTransactionsCSV,
        importDataJSON,
        resetPortfolioToDemo,
        clearPortfolioData,
      }}
    >
      {children}
    </PortfolioContext.Provider>
  );
};

export const usePortfolio = () => {
  const context = useContext(PortfolioContext);
  if (!context) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
};
