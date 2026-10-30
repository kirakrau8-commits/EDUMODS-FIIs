import React, { useState } from 'react';
import {
  Sliders,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Key,
  Shield,
  Activity,
  Server,
  Zap,
  Clock,
  Info,
} from 'lucide-react';
import { usePortfolio } from '../../context/PortfolioContext';
import { brapiAdapter, provider2Adapter, provider3Adapter } from '../../services/marketData/adapters';

export const IntegrationsView: React.FC = () => {
  const { preferences, updatePreferences, refreshQuotes, isRefreshingQuotes, lastQuoteUpdate, holdings } = usePortfolio();

  const [brapiToken, setBrapiToken] = useState(preferences.brapiToken || '');
  const [testingBrapi, setTestingBrapi] = useState(false);
  const [brapiTestResult, setBrapiTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);

  // Provedor 2
  const [p2Name, setP2Name] = useState(preferences.provider2Name || 'Provedor Secundário');
  const [p2Enabled, setP2Enabled] = useState(preferences.provider2Enabled || false);
  const [p2Endpoint, setP2Endpoint] = useState(preferences.provider2Endpoint || '');
  const [p2ApiKey, setP2ApiKey] = useState(preferences.provider2ApiKey || '');
  const [p2TestResult, setP2TestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Provedor 3
  const [p3Name, setP3Name] = useState(preferences.provider3Name || 'Provedor Terciário');
  const [p3Enabled, setP3Enabled] = useState(preferences.provider3Enabled || false);
  const [p3Endpoint, setP3Endpoint] = useState(preferences.provider3Endpoint || '');
  const [p3ApiKey, setP3ApiKey] = useState(preferences.provider3ApiKey || '');
  const [p3TestResult, setP3TestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSaveBrapi = () => {
    updatePreferences({ brapiToken });
  };

  const handleTestBrapi = async () => {
    setTestingBrapi(true);
    setBrapiTestResult(null);
    try {
      const res = await brapiAdapter.testConnection({ token: brapiToken });
      setBrapiTestResult(res);
      if (res.success) {
        updatePreferences({ brapiToken });
      }
    } finally {
      setTestingBrapi(false);
    }
  };

  const handleTestP2 = async () => {
    provider2Adapter.isEnabled = p2Enabled;
    const res = await provider2Adapter.testConnection({ endpoint: p2Endpoint, apiKey: p2ApiKey });
    setP2TestResult(res);
    if (res.success) {
      updatePreferences({
        provider2Name: p2Name,
        provider2Enabled: p2Enabled,
        provider2Endpoint: p2Endpoint,
        provider2ApiKey: p2ApiKey,
      });
    }
  };

  const handleTestP3 = async () => {
    provider3Adapter.isEnabled = p3Enabled;
    const res = await provider3Adapter.testConnection({ endpoint: p3Endpoint, apiKey: p3ApiKey });
    setP3TestResult(res);
    if (res.success) {
      updatePreferences({
        provider3Name: p3Name,
        provider3Enabled: p3Enabled,
        provider3Endpoint: p3Endpoint,
        provider3ApiKey: p3ApiKey,
      });
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 shadow-xl space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            Conectividade & APIs
          </span>
          <span className="text-xs text-slate-400">Arquitetura por Adaptadores</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-white">
          Configuração de APIs de Mercado
        </h1>
        <p className="text-xs text-slate-400 max-w-2xl">
          Gerencie o provedor oficial BRAPI e prepare adaptadores opcionais independentes. Cotações utilizam cache inteligente de 5 minutos e fallback com salvaguarda dos dados da carteira.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PROVEDOR 1: BRAPI (Principal) */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-5 shadow-lg">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">BRAPI — Provedor Principal</h2>
                <span className="text-[11px] text-slate-400">API B3 em tempo real para cotas e proventos de FIIs</span>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Ativo
            </span>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label htmlFor="brapi-token-input" className="text-slate-300 font-semibold block mb-1">
                Token de Acesso BRAPI (Opcional no modo público)
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Key className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    id="brapi-token-input"
                    type="password"
                    placeholder="Insira seu token BRAPI (ex: p87sdh6...)"
                    value={brapiToken}
                    onChange={(e) => setBrapiToken(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSaveBrapi}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700"
                >
                  Salvar
                </button>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                O token fica gravado de forma segura no perfil local do usuário.
              </span>
            </div>

            {/* Status e Estatísticas de Consulta */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-900 rounded-xl border border-slate-800 text-slate-300">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Última Consulta</span>
                <span className="font-mono text-white text-xs mt-0.5 block flex items-center gap-1">
                  <Clock className="w-3 h-3 text-emerald-400" />
                  {lastQuoteUpdate}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Ativos Monitorados</span>
                <span className="font-mono text-emerald-400 text-xs mt-0.5 block font-bold">
                  {holdings.length} fundos da carteira
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Tempo de Cache</span>
                <span className="font-mono text-slate-300 text-xs mt-0.5 block">
                  5 minutos (TTL)
                </span>
              </div>
            </div>

            {/* Teste de Conexão */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleTestBrapi}
                disabled={testingBrapi}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl border border-slate-700 flex items-center gap-2 transition-colors"
              >
                <Activity className={`w-3.5 h-3.5 text-emerald-400 ${testingBrapi ? 'animate-pulse' : ''}`} />
                <span>{testingBrapi ? 'Testando Conexão...' : 'Testar Conexão BRAPI'}</span>
              </button>

              <button
                type="button"
                onClick={() => refreshQuotes()}
                disabled={isRefreshingQuotes}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md flex items-center gap-2 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingQuotes ? 'animate-spin' : ''}`} />
                <span>{isRefreshingQuotes ? 'Sincronizando...' : 'Atualizar Cotações Agora'}</span>
              </button>
            </div>

            {/* Resultado do Teste */}
            {brapiTestResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
                  brapiTestResult.success
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                }`}
              >
                {brapiTestResult.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                )}
                <span>{brapiTestResult.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* Card de Regras de Contingência */}
        <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-4 shadow-lg">
          <div className="flex items-center gap-2 text-emerald-400">
            <Shield className="w-5 h-5" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Políticas de Segurança</h3>
          </div>
          <div className="space-y-3 text-xs text-slate-400 leading-relaxed">
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
              <strong className="text-white block">Proteção contra Zero:</strong>
              <p>Falhas de conexão nunca substituem cotações válidas por zero nem alteram preços médios ou histórico.</p>
            </div>
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
              <strong className="text-white block">Economia de Requisições:</strong>
              <p>Consultas são agrupadas em lote único apenas para os tickers da sua carteira, evitando custos de API desnecessários.</p>
            </div>
          </div>
        </div>
      </div>

      {/* PROVEDORES OPCIONAIS 2 E 3 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Provedor Opcional 2 */}
        <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-4 shadow-lg">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold text-white">Provedor Opcional 2</h3>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <span>Habilitar</span>
              <input
                type="checkbox"
                checked={p2Enabled}
                onChange={(e) => setP2Enabled(e.target.checked)}
                className="rounded accent-emerald-500"
              />
            </label>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label htmlFor="p2-name-input" className="text-slate-300 font-medium block mb-1">Nome do Provedor</label>
              <input
                id="p2-name-input"
                type="text"
                value={p2Name}
                onChange={(e) => setP2Name(e.target.value)}
                disabled={!p2Enabled}
                placeholder="Ex: API Personalizada"
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white disabled:opacity-50"
              />
            </div>
            <div>
              <label htmlFor="p2-endpoint-input" className="text-slate-300 font-medium block mb-1">Endpoint HTTP Seguro</label>
              <input
                id="p2-endpoint-input"
                type="url"
                value={p2Endpoint}
                onChange={(e) => setP2Endpoint(e.target.value)}
                disabled={!p2Enabled}
                placeholder="https://api.exemplo.com.br/cotacoes"
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white disabled:opacity-50 font-mono"
              />
            </div>
            <div>
              <label htmlFor="p2-apikey-input" className="text-slate-300 font-medium block mb-1">Chave de API / Header Token</label>
              <input
                id="p2-apikey-input"
                type="password"
                value={p2ApiKey}
                onChange={(e) => setP2ApiKey(e.target.value)}
                disabled={!p2Enabled}
                placeholder="Bearer token"
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white disabled:opacity-50 font-mono"
              />
            </div>

            <button
              type="button"
              onClick={handleTestP2}
              disabled={!p2Enabled}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-semibold rounded-lg border border-slate-700"
            >
              Testar Conexão Provedor 2
            </button>

            {p2TestResult && (
              <p className={`text-xs ${p2TestResult.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                {p2TestResult.message}
              </p>
            )}
          </div>
        </div>

        {/* Provedor Opcional 3 */}
        <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-4 shadow-lg">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold text-white">Provedor Opcional 3</h3>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <span>Habilitar</span>
              <input
                type="checkbox"
                checked={p3Enabled}
                onChange={(e) => setP3Enabled(e.target.checked)}
                className="rounded accent-emerald-500"
              />
            </label>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label htmlFor="p3-name-input" className="text-slate-300 font-medium block mb-1">Nome do Provedor</label>
              <input
                id="p3-name-input"
                type="text"
                value={p3Name}
                onChange={(e) => setP3Name(e.target.value)}
                disabled={!p3Enabled}
                placeholder="Ex: Provedor Institucional"
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white disabled:opacity-50"
              />
            </div>
            <div>
              <label htmlFor="p3-endpoint-input" className="text-slate-300 font-medium block mb-1">Endpoint HTTP Seguro</label>
              <input
                id="p3-endpoint-input"
                type="url"
                value={p3Endpoint}
                onChange={(e) => setP3Endpoint(e.target.value)}
                disabled={!p3Enabled}
                placeholder="https://api.institucional.com.br/fii"
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white disabled:opacity-50 font-mono"
              />
            </div>
            <div>
              <label htmlFor="p3-apikey-input" className="text-slate-300 font-medium block mb-1">Chave de API / Header Token</label>
              <input
                id="p3-apikey-input"
                type="password"
                value={p3ApiKey}
                onChange={(e) => setP3ApiKey(e.target.value)}
                disabled={!p3Enabled}
                placeholder="API Key"
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white disabled:opacity-50 font-mono"
              />
            </div>

            <button
              type="button"
              onClick={handleTestP3}
              disabled={!p3Enabled}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-semibold rounded-lg border border-slate-700"
            >
              Testar Conexão Provedor 3
            </button>

            {p3TestResult && (
              <p className={`text-xs ${p3TestResult.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                {p3TestResult.message}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
