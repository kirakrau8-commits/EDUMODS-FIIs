import { fetchLiveMarketQuotesServer } from '../src/server/pushAndMonitorService';

export default async function handler(req: any, res: any) {
  try {
    const tickersParam = String(req.query?.tickers || '');
    const tokenParam = req.query?.token ? String(req.query.token) : undefined;
    const tickers = tickersParam
      .split(',')
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);

    const data = await fetchLiveMarketQuotesServer(tickers, tokenParam);
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Falha ao consultar cotações no servidor.',
    });
  }
}
