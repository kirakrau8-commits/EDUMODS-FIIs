import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  getOrInitVapidConfig,
  savePushSubscriptionOnServer,
  dispatchPushToSubscribedDevices,
  fetchLiveMarketQuotesServer,
  runAutomaticFinancialMonitor,
  getServerMonitoringStatus,
} from './src/server/pushAndMonitorService';
import { processAssistantChatMessage } from './src/server/geminiAssistantService';

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Inicializa chaves VAPID na subida do servidor
  getOrInitVapidConfig();

  // 1. Chave pública VAPID para PushManager.subscribe()
  app.get('/api/push/vapid-public-key', (_req, res) => {
    try {
      const vapid = getOrInitVapidConfig();
      res.json({
        publicKey: vapid.publicKey,
        vapidConfiguredFromEnv: vapid.fromEnv,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Falha ao obter chave pública VAPID.',
      });
    }
  });

  // 2. Registro e atualização de inscrição Web Push no Supabase / Servidor
  app.post('/api/push/subscribe', async (req, res) => {
    try {
      const result = await savePushSubscriptionOnServer(req.body || {});
      if (!result.success) {
        res.status(400).json(result);
        return;
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : 'Erro interno ao registrar inscrição Push.',
      });
    }
  });

  // 3. Disparo de teste real de Web Push pelo servidor
  app.post('/api/push/test', async (req, res) => {
    try {
      const { title, body, tag, category, ticker } = req.body || {};
      const result = await dispatchPushToSubscribedDevices({
        title: title || 'EDUMODS FIIs — Teste de Push em Segundo Plano',
        body:
          body ||
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

      res.json({
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
  });

  // 4. Proxy seguro de Cotações e Proventos em Tempo Real da B3 (BRAPI + Yahoo Finance SA)
  app.get('/api/quotes', async (req, res) => {
    try {
      const tickersParam = String(req.query.tickers || '');
      const tokenParam = req.query.token ? String(req.query.token) : undefined;
      const tickers = tickersParam
        .split(',')
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean);

      const data = await fetchLiveMarketQuotesServer(tickers, tokenParam);
      res.json(data);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Falha ao consultar cotações no servidor.',
      });
    }
  });

  // 5. Status e Sincronização do Monitoramento Automático
  app.get('/api/monitor/status', async (_req, res) => {
    try {
      const status = await getServerMonitoringStatus();
      res.json(status);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Erro ao consultar status de monitoramento.',
      });
    }
  });

  app.post('/api/monitor/status', async (req, res) => {
    try {
      const status = await getServerMonitoringStatus(req.body || undefined);
      res.json(status);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Erro ao sincronizar status de monitoramento.',
      });
    }
  });

  // 6. Execução do Monitoramento Financeiro Automático (Cron Job / Disparo Manual)
  const handleCronMonitor = async (req: express.Request, res: express.Response) => {
    try {
      const cronSecret = (process.env.CRON_SECRET || '').trim();
      const authHeader = req.headers.authorization || '';
      const isInternalPost = req.method === 'POST';

      if (
        cronSecret &&
        !cronSecret.startsWith('your-') &&
        !isInternalPost &&
        authHeader !== `Bearer ${cronSecret}`
      ) {
        res.status(401).json({ error: 'Não autorizado para acionar Cron externo.' });
        return;
      }

      const result = await runAutomaticFinancialMonitor(
        req.method === 'POST' ? req.body : undefined
      );
      res.json(result);
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : 'Erro na execução do monitoramento.',
      });
    }
  };

  app.get('/api/cron/monitor', handleCronMonitor);
  app.post('/api/cron/monitor', handleCronMonitor);

  // 7. Assistente de Inteligência Artificial Especializado em FIIs (Gemini 3.8 Flash)
  app.post('/api/assistant/chat', async (req, res) => {
    try {
      const response = await processAssistantChatMessage(req.body || {});
      res.json(response);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Erro ao processar mensagem com assistente.',
        reply: 'Desculpe, ocorreu uma instabilidade temporária ao consultar o modelo financeiro.',
      });
    }
  });

  // Vite middleware em desenvolvimento; estáticos de dist em produção
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EDUMODS FIIs Server + Push Monitor ativo em http://0.0.0.0:${PORT}`);
    // Executa o primeiro ciclo de monitoramento em segundo plano após iniciar
    setTimeout(() => {
      void runAutomaticFinancialMonitor().catch(() => {});
    }, 2500);

    // Agendamento automático contínuo a cada 5 minutos no servidor ativo
    setInterval(() => {
      void runAutomaticFinancialMonitor().catch(() => {});
    }, 5 * 60 * 1000);
  });
}

startServer();
