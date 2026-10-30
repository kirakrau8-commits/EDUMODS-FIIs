export type FIICategory = 'Tijolo' | 'Papel' | 'Fundo de Fundos' | 'Híbrido' | 'Fiagro' | 'Outro';

export type FIISegment =
  | 'Logística'
  | 'Recebíveis Imobiliários'
  | 'Shoppings'
  | 'Lajes Corporativas'
  | 'Renda Urbana'
  | 'Hospitalar'
  | 'Educacional'
  | 'Misto'
  | 'Agro';

export type IndexerType = 'IPCA' | 'CDI' | 'IGP-M' | 'Pré-fixado' | 'Misto';

export interface FIIHolding {
  ticker: string;
  name: string;
  category: FIICategory;
  segment: FIISegment;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  totalCost: number;
  marketValue: number;
  unrealizedGain: number;
  unrealizedGainPercent: number;
  monthlyYieldPerShare: number;
  monthlyDividendYield: number; // percentage, e.g. 0.85
  annualDividendYield: number; // percentage, e.g. 10.2
  vpa: number; // Valor Patrimonial por Ação/Cota
  pvp: number; // Preço / VPA
  portfolioWeight: number; // percentage e.g. 15.5
  targetWeight: number; // percentage set by user in ideal allocation
  notes?: string;
  isFavorite?: boolean;
  manager?: string; // Gestor/Admin, e.g. 'Credit Suisse (CSHG)', 'Kinea', 'XP Vista'
  indexer?: IndexerType;
  locationStates?: string[]; // e.g. ['SP', 'RJ', 'MG']
  lastQuoteUpdate?: string;
  quoteSource?: string;
}

export type OperationType = 'COMPRA' | 'VENDA' | 'SUBSCRICAO' | 'AMORTIZACAO';

export interface Transaction {
  id: string;
  ticker: string;
  type: OperationType;
  date: string; // YYYY-MM-DD
  quantity: number;
  price: number;
  fees: number;
  total: number;
  realizedResult?: number; // Para vendas: lucro/prejuízo realizado
  notes?: string;
}

export type DividendStatus = 'RECEBIDO' | 'PREVISTO' | 'CANCELADO';

export interface DividendEvent {
  id: string;
  ticker: string;
  dataCom: string; // YYYY-MM-DD
  paymentDate: string; // YYYY-MM-DD
  quantityEligible: number;
  ratePerShare: number; // R$ por cota
  totalAmount: number; // quantity * ratePerShare
  status: DividendStatus;
  isManual?: boolean;
}

export interface RebalanceItem {
  ticker: string;
  currentWeight: number;
  targetWeight: number;
  currentValue: number;
  targetValue: number;
  differenceValue: number;
  suggestedContribution: number;
  suggestedShares: number;
}

export interface UserPreferences {
  hideValues: boolean;
  currency: string;
  autoRefreshQuotes: boolean;
  maxConcentrationAlertPercent: number; // e.g. 20%
  minYieldAlertPercent: number; // e.g. 8%
  activePlan: 'Gratuito' | 'Pro' | 'VIP';
  brapiToken?: string;
  provider2Name?: string;
  provider2Enabled?: boolean;
  provider2Endpoint?: string;
  provider2ApiKey?: string;
  provider3Name?: string;
  provider3Enabled?: boolean;
  provider3Endpoint?: string;
  provider3ApiKey?: string;
}

export interface PortfolioGoals {
  monthlyIncomeGoal: number; // R$ por mês
  totalEquityGoal: number; // R$ de patrimônio
  currentLivingExpenses: number; // Custo de vida mensal
  fireSafeYieldPercent: number; // Ex: 8% ao ano de DY
}
