import React, { useState } from 'react';
import { Database, Download, Upload, FileText, CheckCircle2, AlertCircle, Save, FileDown, ShieldCheck } from 'lucide-react';
import { usePortfolio } from '../../context/PortfolioContext';
import { generatePortfolioPDFReport } from '../../utils/pdfExport';
import { useAuth } from '../../context/AuthContext';

export const BackupView: React.FC = () => {
  const {
    exportDataJSON,
    exportTransactionsCSV,
    importDataJSON,
    notes,
    updateHoldingNotes,
    holdings,
    dividends,
    goals,
    totalInvested,
    totalMarketValue,
    totalUnrealizedGain,
    totalUnrealizedGainPercent,
    monthlyDividendsReceived,
    monthlyDividendsForecasted,
  } = usePortfolio();
  const { user } = useAuth();

  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [generalNotes, setGeneralNotes] = useState(notes.geral || '');
  const [notesSaved, setNotesSaved] = useState(false);

  const handleDownloadJSON = () => {
    const jsonStr = exportDataJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `edumods_fii_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadCSV = () => {
    const csvContent = exportTransactionsCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `edumods_fii_operacoes_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    generatePortfolioPDFReport({
      user: { email: user?.email || 'investidor@edumods.com' },
      holdings,
      dividends,
      goals,
      summary: {
        totalInvested,
        currentPortfolioValue: totalMarketValue,
        totalProfitLoss: totalUnrealizedGain,
        totalProfitLossPercentage: totalUnrealizedGainPercent,
        monthlyDividendYieldRate: 0.85,
        estimatedMonthlyDividends: monthlyDividendsReceived + monthlyDividendsForecasted,
      },
    });
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = importDataJSON(content);
      setImportStatus(res);
      setTimeout(() => setImportStatus(null), 5000);
    };
    reader.readAsText(file);
  };

  const handleSaveGeneralNotes = () => {
    updateHoldingNotes('geral', generalNotes);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 3000);
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 shadow-xl space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            Segurança de Dados
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-white">
          Backup, Exportação & Notas Estratégicas
        </h1>
        <p className="text-xs text-slate-400 max-w-2xl">
          Exporte seus dados em JSON ou CSV para custódia offline e restaure seus dados a qualquer momento com integridade garantida.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Painel de Exportação e Importação */}
        <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-5 shadow-lg">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Database className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Backup e Restauração
            </h2>
          </div>

          <div className="space-y-4 text-xs">
            {/* Exportar */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
              <span className="font-semibold text-white block">Exportar Carteira Completa</span>
              <p className="text-slate-400">
                Gera um arquivo com posições, transações, metas, preferências e notas pessoais.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  onClick={handleDownloadJSON}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar Backup JSON</span>
                </button>
                <button
                  onClick={handleDownloadCSV}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg border border-slate-700 transition-colors"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Operações CSV</span>
                </button>
                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 font-semibold rounded-lg border border-emerald-500/40 transition-colors"
                  title="Gerar e imprimir relatório executivo em PDF"
                >
                  <FileDown className="w-4 h-4 text-emerald-400" />
                  <span>Relatório Executivo PDF</span>
                </button>
              </div>
            </div>

            {/* Importar */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
              <span className="font-semibold text-white block">Restaurar de Backup JSON</span>
              <p className="text-slate-400">
                Carregue um arquivo JSON gerado previamente pelo EDUMODS FIIs. Os dados atuais serão substituídos com validação prévia.
              </p>
              <div>
                <label className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg border border-slate-700 cursor-pointer w-fit transition-colors">
                  <Upload className="w-4 h-4 text-emerald-400" />
                  <span>Selecionar Arquivo JSON</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileImport}
                    className="hidden"
                  />
                </label>
              </div>

              {importStatus && (
                <div
                  className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                    importStatus.success
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {importStatus.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  )}
                  <span>{importStatus.message}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Painel de Notas Estratégicas do Investidor */}
        <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-4 shadow-lg flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Notas Estratégicas Pessoais
                </h2>
              </div>
              {notesSaved && (
                <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Salvo!
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400">
              Registre suas diretrizes de investimento, regras de aportes, critérios de corte e teses estratégicas da carteira.
            </p>

            <textarea
              rows={8}
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              placeholder="Ex: Não pagar mais que 1,05 de P/VP em tijolo. Manter ao menos 40% em logística e shoppings classe A..."
              className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs leading-relaxed focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          <button
            onClick={handleSaveGeneralNotes}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>Salvar Notas Estratégicas</span>
          </button>
        </div>
      </div>

      {/* Painel Informativo de Persistência Supabase Auth & RLS */}
      <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-3 shadow-lg">
        <div className="flex items-center gap-2 text-emerald-400">
          <ShieldCheck className="w-5 h-5" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Arquitetura de Dados: Supabase Auth & Row Level Security (RLS)
          </h2>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          O sistema opera com autenticação obrigatória via <strong>Supabase Auth</strong>. O acesso só é liberado para investidores previamente cadastrados e autorizados.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
            <span className="font-semibold text-emerald-400 block">1. Autenticação Segura</span>
            <span className="text-slate-400 text-[11px] block">
              Sessões JWT protegidas com chave pública / anon. Chaves secretas ou service_role nunca são expostas no frontend.
            </span>
          </div>
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
            <span className="font-semibold text-blue-400 block">2. Isolamento de Dados</span>
            <span className="text-slate-400 text-[11px] block">
              Cache e preferências salvos com chave isolada por usuário. Os dados de um investidor nunca vazam para outra conta.
            </span>
          </div>
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
            <span className="font-semibold text-purple-400 block">3. Políticas RLS na Nuvem</span>
            <span className="text-slate-400 text-[11px] block">
              O arquivo <code>supabase-schema.sql</code> na raiz contém as tabelas e regras RLS prontas para replicação em nuvem.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
