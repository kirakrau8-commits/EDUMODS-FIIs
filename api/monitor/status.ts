import { getServerMonitoringStatus } from '../../src/server/pushAndMonitorService';

export default async function handler(req: any, res: any) {
  try {
    const body =
      req.method === 'POST'
        ? typeof req.body === 'string'
          ? JSON.parse(req.body)
          : req.body || undefined
        : undefined;
    const status = await getServerMonitoringStatus(body);
    res.status(200).json(status);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Erro ao consultar status de monitoramento.',
    });
  }
}
