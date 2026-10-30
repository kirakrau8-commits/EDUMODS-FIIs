export interface MarketQuote {
  ticker: string;
  price: number;
  changePercent?: number;
  updatedAt: string;
  source: string;
  vpa?: number;
  lastDividend?: number;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
  assetCount?: number;
}

export interface IMarketDataAdapter {
  id: string;
  name: string;
  isEnabled: boolean;
  testConnection(config: { token?: string; endpoint?: string; apiKey?: string }): Promise<ConnectionTestResult>;
  fetchQuotes(
    tickers: string[],
    config: { token?: string; endpoint?: string; apiKey?: string }
  ): Promise<Record<string, MarketQuote>>;
}
