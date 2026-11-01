import { getOrInitVapidConfig } from '../../src/server/pushAndMonitorService';

export default async function handler(_req: any, res: any) {
  try {
    const vapid = getOrInitVapidConfig();
    res.status(200).json({
      publicKey: vapid.publicKey,
      vapidConfiguredFromEnv: vapid.fromEnv,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Falha ao obter chave pública VAPID.',
    });
  }
}
