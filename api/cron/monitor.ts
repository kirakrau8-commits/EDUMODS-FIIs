import { runAutomaticFinancialMonitor } from '../../src/server/pushAndMonitorService';

export default async function handler(req: any, res: any) {
  try {
    const cronSecret = (process.env.CRON_SECRET || '').trim();
    const authHeader = req.headers?.authorization || '';
    const isPost = req.method === 'POST';

    if (
      cronSecret &&
      !cronSecret.startsWith('your-') &&
      !isPost &&
      authHeader !== `Bearer ${cronSecret}`
    ) {
      res.status(401).json({ error: 'Não autorizado para acionar Cron externo.' });
      return;
    }

    const body =
      isPost && req.body
        ? typeof req.body === 'string'
          ? JSON.parse(req.body)
          : req.body
        : undefined;

    const result = await runAutomaticFinancialMonitor(body);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Erro na execução do monitoramento.',
    });
  }
}
