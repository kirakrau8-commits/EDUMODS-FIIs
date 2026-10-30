import { FIIHolding, DividendEvent, PortfolioGoals } from '../types/fii';
import { formatBRL, formatPercent } from './formatters';

interface PDFExportData {
  user: { email: string; name?: string };
  holdings: FIIHolding[];
  dividends: DividendEvent[];
  goals: PortfolioGoals;
  summary: {
    totalInvested: number;
    currentPortfolioValue: number;
    totalProfitLoss: number;
    totalProfitLossPercentage: number;
    monthlyDividendYieldRate: number;
    estimatedMonthlyDividends: number;
  };
}

export function generatePortfolioPDFReport(data: PDFExportData): void {
  const { user, holdings, summary } = data;
  const currentDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Por favor, permita pop-ups para gerar e imprimir o relatório em PDF.');
    return;
  }

  const holdingsRows = holdings
    .map(
      (h) => `
    <tr>
      <td style="padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${h.ticker}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${h.category} - ${h.segment}</td>
      <td style="padding: 8px 12px; text-align: right; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${h.quantity}</td>
      <td style="padding: 8px 12px; text-align: right; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${formatBRL(h.averagePrice)}</td>
      <td style="padding: 8px 12px; text-align: right; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${formatBRL(h.currentPrice)}</td>
      <td style="padding: 8px 12px; text-align: right; font-weight: bold; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${formatBRL(h.marketValue)}</td>
      <td style="padding: 8px 12px; text-align: right; color: ${h.unrealizedGain >= 0 ? '#10B981' : '#EF4444'}; font-weight: bold; border-bottom: 1px solid #e2e8f0; font-family: monospace;">
        ${h.unrealizedGain >= 0 ? '+' : ''}${formatBRL(h.unrealizedGain)} (${formatPercent(h.unrealizedGainPercent, true)})
      </td>
      <td style="padding: 8px 12px; text-align: right; color: #10B981; font-weight: bold; border-bottom: 1px solid #e2e8f0; font-family: monospace;">
        ${formatPercent(h.annualDividendYield)}
      </td>
    </tr>
  `
    )
    .join('');

  const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório Executivo de Carteira - EDUMODS FIIs</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      margin: 0;
      padding: 0;
      background: #ffffff;
      font-size: 11px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 15px;
      border-bottom: 2px solid #10b981;
      margin-bottom: 20px;
    }
    .brand {
      font-size: 22px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.5px;
    }
    .brand span { color: #10b981; }
    .meta { text-align: right; font-size: 10px; color: #64748b; }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 25px;
    }
    .kpi-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
    }
    .kpi-title { font-size: 9px; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 4px; }
    .kpi-value { font-size: 16px; font-weight: 800; color: #0f172a; font-family: monospace; }
    .kpi-positive { color: #10b981; }
    .kpi-negative { color: #ef4444; }
    h2 { font-size: 13px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin-top: 20px; margin-bottom: 10px; border-left: 3px solid #10b981; padding-left: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
    th {
      background: #0f172a;
      color: #ffffff;
      padding: 8px 12px;
      text-align: left;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #e2e8f0;
      font-size: 9px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">EDUMODS <span>FIIs</span></div>
      <div style="font-size: 12px; font-weight: 600; color: #475569; margin-top: 2px;">Relatório de Desempenho & Custódia de Ativos</div>
    </div>
    <div class="meta">
      <div>Investidor: <strong>${user.email}</strong></div>
      <div>Emitido em: ${currentDate}</div>
      <div>Status: <strong>Autenticado (Supabase RLS)</strong></div>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-title">Patrimônio em FIIs</div>
      <div class="kpi-value">${formatBRL(summary.currentPortfolioValue)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Capital Total Aportado</div>
      <div class="kpi-value">${formatBRL(summary.totalInvested)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Resultado Global</div>
      <div class="kpi-value ${summary.totalProfitLoss >= 0 ? 'kpi-positive' : 'kpi-negative'}">
        ${summary.totalProfitLoss >= 0 ? '+' : ''}${formatBRL(summary.totalProfitLoss)} (${formatPercent(summary.totalProfitLossPercentage, true)})
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Renda Mensal Estimada</div>
      <div class="kpi-value kpi-positive">${formatBRL(summary.estimatedMonthlyDividends)}/mês</div>
    </div>
  </div>

  <h2>Detalhamento das Posições em Carteira</h2>
  <table>
    <thead>
      <tr>
        <th>Ticker</th>
        <th>Categoria / Segmento</th>
        <th style="text-align: right;">Cotas</th>
        <th style="text-align: right;">Preço Médio</th>
        <th style="text-align: right;">Cotação</th>
        <th style="text-align: right;">Valor Atual</th>
        <th style="text-align: right;">Lucro / Prejuízo</th>
        <th style="text-align: right;">DY Anual</th>
      </tr>
    </thead>
    <tbody>
      ${holdingsRows}
    </tbody>
  </table>

  <div class="footer">
    <div>EDUMODS FIIs — Inteligência e Gestão de Investimentos Imobiliários</div>
    <div>Documento estritamente confidencial emitido para o titular da conta.</div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
`;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
