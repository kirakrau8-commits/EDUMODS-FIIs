import React from 'react';
import { ShieldAlert, CheckCircle, AlertTriangle, Info, PieChart, ShieldCheck } from 'lucide-react';
import { usePortfolio } from '../../context/PortfolioContext';
import { TabGuideBanner } from '../common/InfoTooltip';

export const HealthRiskView: React.FC = () => {
  const { holdings, preferences } = usePortfolio();

  // Critério 1: Concentração no maior ativo
  const sorted = [...holdings].sort((a, b) => b.portfolioWeight - a.portfolioWeight);
  const top1 = sorted[0];
  const top3Weight = sorted.slice(0, 3).reduce((acc, h) => acc + h.portfolioWeight, 0);

  // Critério 2: Diversificação Setorial
  const segments = Array.from(new Set(holdings.map((h) => h.segment)));

  // Critério 3: Quantidade de fundos
  const totalFunds = holdings.length;

  return (
    <div className="space-y-6 pb-12">
      <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 shadow-xl space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            Governança & Risco
          </span>
          <span className="text-xs text-slate-400">Metodologia Auditável</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-white">
          Diagnóstico de Saúde & Risco da Carteira
        </h1>
        <p className="text-xs text-slate-400 max-w-2xl">
          Avaliação baseada em métricas transparentes e regras de alocação de risco. Sem pontuações arbitrárias: todos os critérios e limites são fundamentados e explicados.
        </p>
      </div>

      <TabGuideBanner
        title="Entenda os indicadores de proteção da sua carteira"
        subtitle="Uma carteira saudável evita depender demais de um único fundo ou de um único setor da economia."
        items={[
          {
            term: 'Concentração no Maior Ativo',
            definition: 'Indica quanto o seu maior FII pesa no patrimônio total. O ideal é que nenhum fundo isolado passe de 15% a 20% da carteira.',
          },
          {
            term: 'Concentração Top 3 Fundos',
            definition: 'Mostra a soma dos seus 3 maiores fundos. Abaixo de 60% garante que um imprevisto em um fundo não comprometa sua renda mensal.',
          },
          {
            term: 'Diversificação Setorial',
            definition: 'Ter pelo menos 3 a 5 setores diferentes (Logística, Recebíveis, Shoppings, Lajes, Híbridos) reduz oscilações em diferentes ciclos econômicos.',
          },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Critério 1: Concentração no Maior Ativo */}
        <div className="p-5 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">Maior Ativo</span>
            {top1 && top1.portfolioWeight > preferences.maxConcentrationAlertPercent ? (
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            ) : (
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            )}
          </div>
          <div>
            <span className="text-xl font-bold text-white font-mono">{top1?.ticker || '-'}</span>
            <span className="text-xs text-slate-400 block mt-0.5">
              Representa <strong>{top1?.portfolioWeight.toFixed(1) || 0}%</strong> do patrimônio
            </span>
          </div>
          <p className="text-xs text-slate-400 border-t border-slate-800 pt-2 leading-relaxed">
            {top1 && top1.portfolioWeight > preferences.maxConcentrationAlertPercent
              ? `Atenção: sua carteira ultrapassou o teto sugerido de ${preferences.maxConcentrationAlertPercent}%. Recomenda-se direcionar novos aportes para outros fundos.`
              : 'Excelente equilíbrio: nenhum ativo individual domina excessivamente a carteira.'}
          </p>
        </div>

        {/* Critério 2: Concentração Top 3 */}
        <div className="p-5 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">Top 3 Fundos</span>
            {top3Weight > 60 ? (
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            ) : (
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            )}
          </div>
          <div>
            <span className="text-xl font-bold text-white font-mono">{top3Weight.toFixed(1)}%</span>
            <span className="text-xs text-slate-400 block mt-0.5">
              Concentração conjunta dos 3 maiores fundos
            </span>
          </div>
          <p className="text-xs text-slate-400 border-t border-slate-800 pt-2 leading-relaxed">
            {top3Weight > 60
              ? 'Concentração moderada-alta. Se um desses 3 ativos sofrer inadimplência ou vacância, o impacto na renda mensal será sentido.'
              : 'Diversificação satisfatória entre os principais componentes da carteira.'}
          </p>
        </div>

        {/* Critério 3: Exposição Setorial */}
        <div className="p-5 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">Setores Presentes</span>
            <PieChart className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <span className="text-xl font-bold text-white font-mono">{segments.length} setores</span>
            <span className="text-xs text-slate-400 block mt-0.5">
              {totalFunds} fundos imobiliários no total
            </span>
          </div>
          <p className="text-xs text-slate-400 border-t border-slate-800 pt-2 leading-relaxed">
            {segments.length >= 3
              ? 'Boa diversificação multissetorial (galpões, recebíveis, shoppings, renda urbana).'
              : 'Carteira concentrada em poucos segmentos. Considere explorar outros setores na aba Explorar.'}
          </p>
        </div>
      </div>
    </div>
  );
};
