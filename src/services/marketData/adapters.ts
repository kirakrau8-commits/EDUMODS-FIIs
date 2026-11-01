import { ConnectionTestResult, IMarketDataAdapter, MarketQuote } from './types';
import { VERIFIED_FII_DATABASE } from '../../data/fiiDatabase';

interface CachedQuoteEntry {
  quote: MarketQuote;
  cachedAt: number;
}

const QUOTE_CACHE: Map<string, CachedQuoteEntry> = new Map();
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutos de cache

export class BrapiAdapter implements IMarketDataAdapter {
  id = 'brapi';
  name = 'BRAPI & B3 Tempo Real';
  isEnabled = true;

  async testConnection(config: { token?: string }): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    const token = config.token?.trim();

    // 1. Tenta via proxy seguro do servidor (/api/quotes) que suporta BRAPI + B3 Tempo Real (Yahoo SA)
    try {
      const serverUrl = `/api/quotes?tickers=HGLG11${token ? `&token=${encodeURIComponent(token)}` : ''}`;
      const res = await fetch(serverUrl);
      if (res.ok) {
        const data = await res.json();
        const latencyMs = Date.now() - startTime;
        if (data && data.quotes && data.quotes.HGLG11 && !data.isFallbackData) {
          return {
            success: true,
            message: `Conexão estabelecida em tempo real (${data.source || 'B3 Oficial'}, ${latencyMs}ms). HGLG11 = R$ ${Number(data.quotes.HGLG11.price).toFixed(2)}.`,
            latencyMs,
            assetCount: 1,
          };
        }
      }
    } catch {
      // Continua para teste direto BRAPI
    }

    // 2. Teste direto na BRAPI
    try {
      const testTicker = 'HGLG11';
      const url = token
        ? `https://brapi.dev/api/quote/${testTicker}?token=${encodeURIComponent(token)}`
        : `https://brapi.dev/api/quote/${testTicker}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return {
            success: false,
            message:
              'A API direta da BRAPI exige token de autenticação para este ativo. O servidor utilizará o feed B3 Tempo Real automático.',
            latencyMs,
          };
        }
        if (response.status === 429) {
          return {
            success: false,
            message: 'Limite de requisições do plano BRAPI atingido.',
            latencyMs,
          };
        }
        return {
          success: false,
          message: `Falha na conexão com BRAPI (HTTP ${response.status}).`,
          latencyMs,
        };
      }

      const data = await response.json();
      if (data.results && data.results.length > 0) {
        return {
          success: true,
          message: `Conexão estabelecida com sucesso via BRAPI (${latencyMs}ms). Cotação de teste obtida.`,
          latencyMs,
          assetCount: 1,
        };
      }

      return {
        success: true,
        message: 'Conectado à BRAPI (modo padrão)',
        latencyMs,
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const isAbort = (err as { name?: string })?.name === 'AbortError';
      return {
        success: false,
        message: isAbort
          ? 'Tempo limite de resposta excedido ao conectar na BRAPI (Timeout de 6s).'
          : 'Não foi possível contatar o servidor da BRAPI diretamente.',
        latencyMs,
      };
    }
  }

  async fetchQuotes(
    tickers: string[],
    config: { token?: string }
  ): Promise<Record<string, MarketQuote>> {
    const results: Record<string, MarketQuote> = {};
    const tickersToFetch: string[] = [];
    const now = Date.now();

    tickers.forEach((ticker) => {
      const clean = ticker.toUpperCase().trim();
      const cached = QUOTE_CACHE.get(clean);
      if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
        results[clean] = cached.quote;
      } else if (clean) {
        tickersToFetch.push(clean);
      }
    });

    if (tickersToFetch.length === 0) {
      return results;
    }

    const token = config.token?.trim();

    // 1. Prioridade: Busca pelo servidor backend (/api/quotes) que consulta BRAPI + B3 Tempo Real sem bloqueio CORS
    try {
      const tickerQuery = tickersToFetch.join(',');
      const serverUrl = `/api/quotes?tickers=${encodeURIComponent(tickerQuery)}${
        token ? `&token=${encodeURIComponent(token)}` : ''
      }`;
      const response = await fetch(serverUrl);
      if (response.ok) {
        const data = await response.json();
        if (data && data.quotes && typeof data.quotes === 'object') {
          Object.entries(data.quotes).forEach(([sym, q]: [string, any]) => {
            if (q && typeof q.price === 'number' && q.price > 0) {
              const quote: MarketQuote = {
                ticker: sym.toUpperCase(),
                price: Number(q.price.toFixed(2)),
                changePercent: Number((q.changePercent || 0).toFixed(2)),
                updatedAt: q.updatedAt || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                source: q.source || 'B3 Tempo Real',
                vpa: q.vpa,
                lastDividend: q.lastDividend,
              };
              results[sym.toUpperCase()] = quote;
              QUOTE_CACHE.set(sym.toUpperCase(), { quote, cachedAt: now });
            }
          });
        }
      }
    } catch {
      // Se estiver rodando sem rota /api/quotes, tenta BRAPI direto abaixo
    }

    const remainingTickers = tickersToFetch.filter((t) => !results[t]);

    // 2. Fallback direto para BRAPI se ainda faltarem ativos
    if (remainingTickers.length > 0) {
      try {
        const tickerQuery = remainingTickers.join(',');
        const url = token
          ? `https://brapi.dev/api/quote/${tickerQuery}?token=${encodeURIComponent(token)}`
          : `https://brapi.dev/api/quote/${tickerQuery}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data.results)) {
            data.results.forEach(
              (item: {
                symbol?: string;
                regularMarketPrice?: number;
                regularMarketChangePercent?: number;
              }) => {
                const sym = item.symbol?.toUpperCase();
                if (sym && typeof item.regularMarketPrice === 'number' && item.regularMarketPrice > 0) {
                  const quote: MarketQuote = {
                    ticker: sym,
                    price: Number(item.regularMarketPrice.toFixed(2)),
                    changePercent: Number((item.regularMarketChangePercent || 0).toFixed(2)),
                    updatedAt: new Date().toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                    source: 'BRAPI Oficial',
                  };
                  results[sym] = quote;
                  QUOTE_CACHE.set(sym, { quote, cachedAt: now });
                }
              }
            );
          }
        }
      } catch {
        // Continua para contingência local informada
      }
    }

    // 3. Contingência local transparente (informa explicitamente que é base de contingência)
    tickersToFetch.forEach((ticker) => {
      if (!results[ticker]) {
        const local = VERIFIED_FII_DATABASE[ticker];
        if (local) {
          const fallbackQuote: MarketQuote = {
            ticker,
            price: local.currentPrice,
            changePercent: 0,
            updatedAt: 'Contingência Local',
            source: 'Contingência Local (Sem Conexão Externa)',
            vpa: local.vpa,
            lastDividend: local.lastDividend,
          };
          results[ticker] = fallbackQuote;
        }
      }
    });

    return results;
  }
}

export class CustomOptionalAdapter implements IMarketDataAdapter {
  id: string;
  name: string;
  isEnabled: boolean;

  constructor(id: string, name: string, isEnabled = false) {
    this.id = id;
    this.name = name;
    this.isEnabled = isEnabled;
  }

  async testConnection(config: { endpoint?: string; apiKey?: string }): Promise<ConnectionTestResult> {
    if (!this.isEnabled) {
      return {
        success: false,
        message: `${this.name} está desativado. Habilite o provedor e informe as credenciais para testar.`,
      };
    }
    if (!config.endpoint) {
      return {
        success: false,
        message: 'Endpoint HTTP não configurado para o provedor secundário.',
      };
    }

    const start = Date.now();
    try {
      const response = await fetch(config.endpoint, {
        headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
      });
      const latencyMs = Date.now() - start;
      return {
        success: response.ok,
        message: response.ok
          ? `Provedor conectado com sucesso (${latencyMs}ms).`
          : `Erro de resposta: HTTP ${response.status}`,
        latencyMs,
      };
    } catch {
      return {
        success: false,
        message: 'Não foi possível alcançar o endpoint do provedor personalizado.',
      };
    }
  }

  async fetchQuotes(): Promise<Record<string, MarketQuote>> {
    return {};
  }
}

export const brapiAdapter = new BrapiAdapter();
export const provider2Adapter = new CustomOptionalAdapter('provider_2', 'Provedor Opcional 2', false);
export const provider3Adapter = new CustomOptionalAdapter('provider_3', 'Provedor Opcional 3', false);
