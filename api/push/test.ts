import { dispatchPushToSubscribedDevices } from '../../src/server/pushAndMonitorService';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { title, body: msgBody, tag, category, ticker } = body;
    const result = await dispatchPushToSubscribedDevices({
      title: title || 'EDUMODS FIIs — Teste de Push em Segundo Plano',
      body:
        msgBody ||
        'Notificação Push enviada pelo servidor com criptografia VAPID e recebida pelo Service Worker!',
      tag: tag || `edumods_srv_test_${Date.now()}`,
      category: category || 'teste',
      ticker: ticker || 'HGLG11',
    });

    if (!result.success) {
      res.status(200).json({
        success: false,
        deliveredCount: 0,
        attemptedCount: result.attemptedCount,
        error:
          result.errors[0] ||
          'Não foi possível entregar a mensagem Push ao dispositivo inscrito.',
        errors: result.errors,
      });
      return;
    }

    res.status(200).json({
      success: true,
      deliveredCount: result.deliveredCount,
      attemptedCount: result.attemptedCount,
      expiredRemovedCount: result.expiredRemovedCount,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      deliveredCount: 0,
      error: err instanceof Error ? err.message : 'Erro ao enviar Web Push de teste.',
    });
  }
}
