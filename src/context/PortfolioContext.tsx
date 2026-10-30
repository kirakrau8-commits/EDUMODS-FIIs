import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import {
  FIIHolding,
  Transaction,
  DividendEvent,
  PortfolioGoals,
  UserPreferences,
  OperationType,
} from '../types/fii';
import { VERIFIED_FII_DATABASE } from '../data/fiiDatabase';
import {
  calculateWeightedAveragePrice,
  calculateSaleResult,
  calculateUnrealizedGain,
} from '../utils/financialMath';
import { brapiAdapter } from '../services/marketData/adapters';

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

  // Metrics
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

  // Actions
  addTransaction: (tx: Omit<Transaction, 'id' | 'total'>) => { success: boolean; error?: string };
  updateTransaction: (id: string, updated: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  updateHolding: (ticker: string, changes: Partial<FIIHolding>) => void;
  deleteHolding: (ticker: string) => void;
  addManualDividend: (dividend: Omit<DividendEvent, 'id' | 'totalAmount'>) => void;
  updateDividend: (id: string, updated: Partial<DividendEvent>) => void;
  deleteDividend: (id: string) => void;
  updateDividendStatus: (id: string, status: DividendEvent['status']) => void;
  updateHoldingTargetWeight: (ticker: string, targetWeight: number) => void;
  updateHoldingNotes: (ticker: string, notes: string) => void;
  toggleFavorite: (ticker: string) => void;
  updateGoals: (goals: Partial<PortfolioGoals>) => void;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
  toggleHideValues: () => void;
  refreshQuotes: () => Promise<void>;
  isRefreshingQuotes: boolean;
  lastQuoteUpdate: string;

  // Backup & Import
  exportDataJSON: () => string;
  exportTransactionsCSV: () => string;
  importDataJSON: (jsonStr: string) => { success: boolean; message: string };
  resetPortfolioToDemo: () => void;
  clearPortfolioData: () => void;
}

const DEFAULT_USERS: UserAccount[] = [
  {
    id: 'user_eduardo',
    name: 'Eduardo Rodrigues',
    email: 'eduardorodriguesdossantos046@gmail.com',
    role: 'admin',
    plan: 'VIP',
    createdAt: '2026-01-15',
  },
  {
    id: 'user_demo_investor',
    name: 'Investidor Pro',
    email: 'investidor@edumods.com.br',
    role: 'user',
    plan: 'Pro',
    createdAt: '2026-03-10',
  },
];

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
  activePlan: 'VIP',
};

// Seed demo holdings
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
      portfolioWeight: 0, // calculado dinamicamente
      targetWeight: target,
      manager: db?.manager,
      indexer: db?.indexer,
      locationStates: db?.locationStates,
      lastQuoteUpdate: 'B3 Oficial',
      quoteSource: 'BRAPI / B3',
      notes: 'Posição estratégica de longo prazo.',
      isFavorite: true,
    };
  });
}

function createDemoTransactions(): Transaction[] {
  return [
    {
      id: 'tx_1',
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
      id: 'tx_2',
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
      id: 'tx_3',
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
      id: 'tx_4',
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
      id: 'tx_5',
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
      id: 'div_1',
      ticker: 'MXRF11',
      dataCom: '2026-10-15',
      paymentDate: '2026-10-24',
      quantityEligible: 1000,
      ratePerShare: 0.09,
      totalAmount: 90.0,
      status: 'RECEBIDO',
    },
    {
      id: 'div_2',
      ticker: 'HGLG11',
      dataCom: '2026-10-15',
      paymentDate: '2026-10-25',
      quantityEligible: 50,
      ratePerShare: 1.1,
      totalAmount: 55.0,
      status: 'RECEBIDO',
    },
    {
      id: 'div_3',
      ticker: 'KNIP11',
      dataCom: '2026-10-15',
      paymentDate: '2026-10-28',
      quantityEligible: 55,
      ratePerShare: 0.85,
      totalAmount: 46.75,
      status: 'RECEBIDO',
    },
    {
      id: 'div_4',
      ticker: 'XPML11',
      dataCom: '2026-10-18',
      paymentDate: '2026-10-29',
      quantityEligible: 60,
      ratePerShare: 0.92,
      totalAmount: 55.2,
      status: 'RECEBIDO',
    },
    {
      id: 'div_5',
      ticker: 'BTLG11',
      dataCom: '2026-10-15',
      paymentDate: '2026-10-31',
      quantityEligible: 45,
      ratePerShare: 0.78,
      totalAmount: 35.1,
      status: 'PREVISTO',
    },
    {
      id: 'div_6',
      ticker: 'MXRF11',
      dataCom: '2026-11-14',
      paymentDate: '2026-11-25',
      quantityEligible: 1000,
      ratePerShare: 0.09,
      totalAmount: 90.0,
      status: 'PREVISTO',
    },
    {
      id: 'div_7',
      ticker: 'HGLG11',
      dataCom: '2026-11-14',
      paymentDate: '2026-11-25',
      quantityEligible: 50,
      ratePerShare: 1.1,
      totalAmount: 55.0,
      status: 'PREVISTO',
    },
  ];
}

const PortfolioContext = createContext<PortfolioContextType | null>(null);

export const PortfolioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [availableUsers, setAvailableUsers] = useState<UserAccount[]>(() => {
    const saved = localStorage.getItem('edumods_users');
    return saved ? JSON.parse(saved) : DEFAULT_USERS;
  });

  const [currentUser, setCurrentUser] = useState<UserAccount>(() => {
    const saved = localStorage.getItem('edumods_current_user');
    return saved ? JSON.parse(saved) : DEFAULT_USERS[0];
  });

  // State isolado por conta de usuário
  const userStorageKey = `edumods_fii_data_${currentUser.id}`;

  const [holdings, setHoldings] = useState<FIIHolding[]>(() => {
    const saved = localStorage.getItem(`${userStorageKey}_holdings`);
    return saved ? JSON.parse(saved) : createDemoHoldings();
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem(`${userStorageKey}_transactions`);
    return saved ? JSON.parse(saved) : createDemoTransactions();
  });

  const [dividends, setDividends] = useState<DividendEvent[]>(() => {
    const saved = localStorage.getItem(`${userStorageKey}_dividends`);
    return saved ? JSON.parse(saved) : createDemoDividends();
  });

  const [goals, setGoalsState] = useState<PortfolioGoals>(() => {
    const saved = localStorage.getItem(`${userStorageKey}_goals`);
    return saved ? JSON.parse(saved) : INITIAL_GOALS;
  });

  const [preferences, setPreferencesState] = useState<UserPreferences>(() => {
    const saved = localStorage.getItem(`${userStorageKey}_preferences`);
    return saved ? JSON.parse(saved) : INITIAL_PREFERENCES;
  });

  const [notes, setNotes] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem(`${userStorageKey}_notes`);
    return saved ? JSON.parse(saved) : {
      geral: 'Foco em FIIs de tijolo de alta liquidez com dividend yield acima de 9% a.a.',
      HGLG11: 'Galpões logísticos classe A no sudeste com inquilinos sólidos.',
    };
  });

  const [isRefreshingQuotes, setIsRefreshingQuotes] = useState(false);
  const [lastQuoteUpdate, setLastQuoteUpdate] = useState<string>('Atualizado hoje');

  // Salva no localStorage quando os estados mudam
  useEffect(() => {
    localStorage.setItem(`${userStorageKey}_holdings`, JSON.stringify(holdings));
  }, [holdings, userStorageKey]);

  useEffect(() => {
    localStorage.setItem(`${userStorageKey}_transactions`, JSON.stringify(transactions));
  }, [transactions, userStorageKey]);

  useEffect(() => {
    localStorage.setItem(`${userStorageKey}_dividends`, JSON.stringify(dividends));
  }, [dividends, userStorageKey]);

  useEffect(() => {
    localStorage.setItem(`${userStorageKey}_goals`, JSON.stringify(goals));
  }, [goals, userStorageKey]);

  useEffect(() => {
    localStorage.setItem(`${userStorageKey}_preferences`, JSON.stringify(preferences));
  }, [preferences, userStorageKey]);

  useEffect(() => {
    localStorage.setItem(`${userStorageKey}_notes`, JSON.stringify(notes));
  }, [notes, userStorageKey]);

  // Recalcular métricas de patrimônio
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

    // Calcular o peso de cada ativo no portfólio
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

    // Média baseada nos ativos atuais da carteira
    const estimatedMonthlyTotal = holdings.reduce(
      (acc, h) => acc + h.quantity * h.monthlyYieldPerShare,
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

  // Troca de usuário / isolamento
  const switchUser = useCallback((user: UserAccount) => {
    setCurrentUser(user);
    localStorage.setItem('edumods_current_user', JSON.stringify(user));

    const key = `edumods_fii_data_${user.id}`;
    const savedH = localStorage.getItem(`${key}_holdings`);
    const savedT = localStorage.getItem(`${key}_transactions`);
    const savedD = localStorage.getItem(`${key}_dividends`);
    const savedG = localStorage.getItem(`${key}_goals`);
    const savedP = localStorage.getItem(`${key}_preferences`);
    const savedN = localStorage.getItem(`${key}_notes`);

    setHoldings(savedH ? JSON.parse(savedH) : createDemoHoldings());
    setTransactions(savedT ? JSON.parse(savedT) : createDemoTransactions());
    setDividends(savedD ? JSON.parse(savedD) : createDemoDividends());
    setGoalsState(savedG ? JSON.parse(savedG) : INITIAL_GOALS);
    setPreferencesState(savedP ? JSON.parse(savedP) : INITIAL_PREFERENCES);
    setNotes(savedN ? JSON.parse(savedN) : {});
  }, []);

  const createNewUserAccount = useCallback((name: string, email: string) => {
    const newUser: UserAccount = {
      id: `user_${Date.now()}`,
      name,
      email,
      role: 'user',
      plan: 'Gratuito',
      createdAt: new Date().toISOString().split('T')[0],
    };
    const updated = [...availableUsers, newUser];
    setAvailableUsers(updated);
    localStorage.setItem('edumods_users', JSON.stringify(updated));
    switchUser(newUser);
  }, [availableUsers, switchUser]);

  const deleteAccount = useCallback((userId: string) => {
    if (availableUsers.length <= 1) return;
    const remaining = availableUsers.filter((u) => u.id !== userId);
    setAvailableUsers(remaining);
    localStorage.setItem('edumods_users', JSON.stringify(remaining));

    // Remove dados isolados
    const key = `edumods_fii_data_${userId}`;
    localStorage.removeItem(`${key}_holdings`);
    localStorage.removeItem(`${key}_transactions`);
    localStorage.removeItem(`${key}_dividends`);
    localStorage.removeItem(`${key}_goals`);
    localStorage.removeItem(`${key}_preferences`);
    localStorage.removeItem(`${key}_notes`);

    if (currentUser.id === userId) {
      switchUser(remaining[0]);
    }
  }, [availableUsers, currentUser.id, switchUser]);

  // Ações de Transação
  const addTransaction = useCallback(
    (tx: Omit<Transaction, 'id' | 'total'>): { success: boolean; error?: string } => {
      const ticker = tx.ticker.toUpperCase().trim();
      if (!ticker) {
        return { success: false, error: 'O ticker do fundo é obrigatório.' };
      }
      if (tx.quantity <= 0 || tx.price <= 0) {
        return { success: false, error: 'Quantidade e preço devem ser maiores que zero.' };
      }

      const totalValue =
        tx.type === 'VENDA'
          ? tx.quantity * tx.price - (tx.fees || 0)
          : tx.quantity * tx.price + (tx.fees || 0);

      const existingHolding = holdings.find((h) => h.ticker === ticker);
      let realizedResult: number | undefined;

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
          // Posição zerada
          setHoldings((prev) => prev.filter((h) => h.ticker !== ticker));
        } else {
          setHoldings((prev) =>
            prev.map((h) => {
              if (h.ticker !== ticker) return h;
              const { marketValue, unrealizedGain, unrealizedGainPercent } = calculateUnrealizedGain(
                saleRes.remainingQuantity,
                saleRes.averagePrice,
                h.currentPrice
              );
              return {
                ...h,
                quantity: saleRes.remainingQuantity,
                totalCost: saleRes.totalCostRemaining,
                marketValue,
                unrealizedGain,
                unrealizedGainPercent,
              };
            })
          );
        }
      } else {
        // COMPRA, SUBSCRICAO
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
        const currentPrice = existingHolding ? existingHolding.currentPrice : (dbInfo ? dbInfo.currentPrice : tx.price);
        const { marketValue, unrealizedGain, unrealizedGainPercent } = calculateUnrealizedGain(
          buyRes.newQuantity,
          buyRes.newAveragePrice,
          currentPrice
        );

        if (existingHolding) {
          setHoldings((prev) =>
            prev.map((h) => {
              if (h.ticker !== ticker) return h;
              return {
                ...h,
                quantity: buyRes.newQuantity,
                averagePrice: buyRes.newAveragePrice,
                totalCost: buyRes.totalCost,
                marketValue,
                unrealizedGain,
                unrealizedGainPercent,
              };
            })
          );
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
          setHoldings((prev) => [...prev, newHolding]);
        }
      }

      const newTx: Transaction = {
        id: `tx_${Date.now()}`,
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

      setTransactions((prev) => [newTx, ...prev]);
      return { success: true };
    },
    [holdings]
  );

  const updateTransaction = useCallback((id: string, updated: Partial<Transaction>) => {
    setTransactions((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const newTx = { ...t, ...updated };
        const total =
          newTx.type === 'VENDA'
            ? newTx.quantity * newTx.price - (newTx.fees || 0)
            : newTx.quantity * newTx.price + (newTx.fees || 0);
        return { ...newTx, total: Number(total.toFixed(2)) };
      })
    );
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateHolding = useCallback((ticker: string, changes: Partial<FIIHolding>) => {
    setHoldings((prev) =>
      prev.map((h) => {
        if (h.ticker !== ticker) return h;
        const newQty = changes.quantity !== undefined ? changes.quantity : h.quantity;
        const newAvg = changes.averagePrice !== undefined ? changes.averagePrice : h.averagePrice;
        const newPrice = changes.currentPrice !== undefined ? changes.currentPrice : h.currentPrice;
        const { marketValue, unrealizedGain, unrealizedGainPercent } = calculateUnrealizedGain(
          newQty,
          newAvg,
          newPrice
        );
        const vpa = changes.vpa !== undefined ? changes.vpa : h.vpa;
        const pvp = vpa > 0 ? Number((newPrice / vpa).toFixed(2)) : h.pvp;
        const lastDiv = changes.monthlyYieldPerShare !== undefined ? changes.monthlyYieldPerShare : h.monthlyYieldPerShare;
        const monthlyDY = newPrice > 0 ? (lastDiv / newPrice) * 100 : 0;

        return {
          ...h,
          ...changes,
          quantity: newQty,
          averagePrice: newAvg,
          currentPrice: newPrice,
          totalCost: Number((newQty * newAvg).toFixed(2)),
          marketValue,
          unrealizedGain,
          unrealizedGainPercent,
          pvp,
          monthlyYieldPerShare: lastDiv,
          monthlyDividendYield: Number(monthlyDY.toFixed(2)),
        };
      })
    );
  }, []);

  const deleteHolding = useCallback((ticker: string) => {
    setHoldings((prev) => prev.filter((h) => h.ticker !== ticker));
  }, []);

  const addManualDividend = useCallback(
    (div: Omit<DividendEvent, 'id' | 'totalAmount'>) => {
      const totalAmount = Number((div.quantityEligible * div.ratePerShare).toFixed(2));
      const newDiv: DividendEvent = {
        ...div,
        id: `div_${Date.now()}`,
        totalAmount,
        isManual: true,
      };
      setDividends((prev) => [newDiv, ...prev]);
    },
    []
  );

  const updateDividend = useCallback((id: string, updated: Partial<DividendEvent>) => {
    setDividends((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;
        const newDiv = { ...d, ...updated };
        const total = Number((newDiv.quantityEligible * newDiv.ratePerShare).toFixed(2));
        return { ...newDiv, totalAmount: total };
      })
    );
  }, []);

  const deleteDividend = useCallback((id: string) => {
    setDividends((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const updateDividendStatus = useCallback(
    (id: string, status: DividendEvent['status']) => {
      setDividends((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status } : d))
      );
    },
    []
  );

  const updateHoldingTargetWeight = useCallback(
    (ticker: string, targetWeight: number) => {
      setHoldings((prev) =>
        prev.map((h) => (h.ticker === ticker ? { ...h, targetWeight } : h))
      );
    },
    []
  );

  const updateHoldingNotes = useCallback(
    (ticker: string, text: string) => {
      setHoldings((prev) =>
        prev.map((h) => (h.ticker === ticker ? { ...h, notes: text } : h))
      );
      setNotes((prev) => ({ ...prev, [ticker]: text }));
    },
    []
  );

  const toggleFavorite = useCallback((ticker: string) => {
    setHoldings((prev) =>
      prev.map((h) => (h.ticker === ticker ? { ...h, isFavorite: !h.isFavorite } : h))
    );
  }, []);

  const updateGoals = useCallback((newGoals: Partial<PortfolioGoals>) => {
    setGoalsState((prev) => ({ ...prev, ...newGoals }));
  }, []);

  const updatePreferences = useCallback((newPrefs: Partial<UserPreferences>) => {
    setPreferencesState((prev) => ({ ...prev, ...newPrefs }));
  }, []);

  const toggleHideValues = useCallback(() => {
    setPreferencesState((prev) => ({ ...prev, hideValues: !prev.hideValues }));
  }, []);

  // Atualização em lote com BRAPI / Cache
  const refreshQuotes = useCallback(async () => {
    if (holdings.length === 0) return;
    setIsRefreshingQuotes(true);

    try {
      const tickers = holdings.map((h) => h.ticker);
      const quotes = await brapiAdapter.fetchQuotes(tickers, {
        token: preferences.brapiToken,
      });

      setHoldings((prev) =>
        prev.map((h) => {
          const q = quotes[h.ticker];
          if (q && q.price > 0) {
            const { marketValue, unrealizedGain, unrealizedGainPercent } = calculateUnrealizedGain(
              h.quantity,
              h.averagePrice,
              q.price
            );
            const pvp = h.vpa > 0 ? Number((q.price / h.vpa).toFixed(2)) : h.pvp;
            return {
              ...h,
              currentPrice: q.price,
              marketValue,
              unrealizedGain,
              unrealizedGainPercent,
              pvp,
              lastQuoteUpdate: q.updatedAt,
              quoteSource: q.source,
            };
          }
          return h;
        })
      );

      setLastQuoteUpdate(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } finally {
      setIsRefreshingQuotes(false);
    }
  }, [holdings, preferences.brapiToken]);

  // Exportações e Backups
  const exportDataJSON = useCallback(() => {
    const backup = {
      version: '1.0.0',
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
          `"${t.id}","${t.ticker}","${t.type}","${t.date}",${t.quantity},${t.price},${t.fees},${t.total},${t.realizedResult || 0},"${t.notes || ''}"`
      )
      .join('\n');
    return headers + rows;
  }, [transactions]);

  const importDataJSON = useCallback(
    (jsonStr: string): { success: boolean; message: string } => {
      try {
        const parsed = JSON.parse(jsonStr);
        if (!parsed || (!Array.isArray(parsed.holdings) && !Array.isArray(parsed.transactions))) {
          return {
            success: false,
            message: 'Estrutura do arquivo inválida. Certifique-se de que é um backup do EDUMODS FIIs.',
          };
        }

        if (Array.isArray(parsed.holdings)) setHoldings(parsed.holdings);
        if (Array.isArray(parsed.transactions)) setTransactions(parsed.transactions);
        if (Array.isArray(parsed.dividends)) setDividends(parsed.dividends);
        if (parsed.goals) setGoalsState(parsed.goals);
        if (parsed.preferences) setPreferencesState(parsed.preferences);
        if (parsed.notes) setNotes(parsed.notes);

        return { success: true, message: 'Dados restaurados com sucesso!' };
      } catch {
        return { success: false, message: 'Falha ao processar arquivo JSON de backup.' };
      }
    },
    []
  );

  const resetPortfolioToDemo = useCallback(() => {
    setHoldings(createDemoHoldings());
    setTransactions(createDemoTransactions());
    setDividends(createDemoDividends());
    setGoalsState(INITIAL_GOALS);
    setPreferencesState(INITIAL_PREFERENCES);
  }, []);

  const clearPortfolioData = useCallback(() => {
    setHoldings([]);
    setTransactions([]);
    setDividends([]);
  }, []);

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
