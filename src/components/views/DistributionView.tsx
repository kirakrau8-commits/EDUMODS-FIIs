import React, { useState, useMemo } from 'react';
import {
  PieChart,
  Layers,
  Building2,
  ShieldAlert,
  ArrowRight,
  Scale,
  MapPin,
  CheckCircle,
  AlertTriangle,
  Sliders,
} from 'lucide-react';
import { usePortfolio } from '../../context/PortfolioContext';
import { formatBRL, formatPercent } from '../../utils/formatters';
import { calculateRebalanceByContribution } from '../../utils/financialMath';
import { InfoTooltip, TabGuideBanner } from '../common/InfoTooltip';

export const DistributionView: React.FC = () => {
  const {
    holdings,
    totalMarketValue,
    totalInvested,
    preferences,
    updateHoldingTargetWeight,
  } = usePortfolio();

  const [baseMetric, setBaseMetric] = useState<'market' | 'cost'>('market');
  const [simulationContribution, setSimulationContribution] = useState<string>('2000');

  // Cálculo de pesos por Categoria
  const categoryDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    const total = baseMetric === 'market' ? totalMarketValue : totalInvested;

    holdings.forEach((h) => {
      const val = baseMetric === 'market' ? h.marketValue : (h.totalCost ?? 0);
      map[h.category] = (map[h.category] || 0) + val;
    });

    return Object.entries(map).map(([category, value]) => ({
      name: category,
      value,
      percentage: total > 0 ? (value / total) * 100 : 0,
    })).sort((a, b) => b.value - a.value);
  }, [holdings, baseMetric, totalMarketValue, totalInvested]);

  // Cálculo de pesos por Segmento
  const segmentDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    const total = baseMetric === 'market' ? totalMarketValue : totalInvested;

    holdings.forEach((h) => {
      const val = baseMetric === 'market' ? h.marketValue : (h.totalCost ?? 0);
      map[h.segment] = (map[h.segment] || 0) + val;
    });

    return Object.entries(map).map(([segment, value]) => ({
      name: segment,
      value,
      percentage: total > 0 ? (value / total) * 100 : 0,
    })).sort((a, b) => b.value - a.value);
  }, [holdings, baseMetric, totalMarketValue, totalInvested]);

  // Cálculo de pesos por Gestor / Administrador
  const managerDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    const total = baseMetric === 'market' ? totalMarketValue : totalInvested;

    holdings.forEach((h) => {
      const managerName = h.manager || 'Outros';
      const val = baseMetric === 'market' ? h.marketValue : (h.totalCost ?? 0);
      map[managerName] = (map[managerName] || 0) + val;
    });

    return Object.entries(map).map(([manager, value]) => ({
      name: manager,
      value,
      percentage: total > 0 ? (value / total) * 100 : 0,
    })).sort((a, b) => b.value - a.value);
  }, [holdings, baseMetric, totalMarketValue, totalInvested]);

  // Cálculo de pesos por Indexador (IPCA, CDI, etc.)
  const indexerDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    const total = baseMetric === 'market' ? totalMarketValue : totalInvested;

    holdings.forEach((h) => {
      const idx = h.indexer || 'IPCA';
      const val = baseMetric === 'market' ? h.marketValue : (h.totalCost ?? 0);
      map[idx] = (map[idx] || 0) + val;
    });

    return Object.entries(map).map(([indexer, value]) => ({
      name: indexer,
      value,
      percentage: total > 0 ? (value / total) * 100 : 0,
    })).sort((a, b) => b.value - a.value);
  }, [holdings, baseMetric, totalMarketValue, totalInvested]);

  // Distribuição Regional por Estados dos Imóveis Físicos
  const stateDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    holdings.forEach((h) => {
      if (h.category === 'Tijolo' || h.category === 'Híbrido') {
        const states = h.locationStates || ['SP'];
        const valPerState = h.marketValue / states.length;
        states.forEach((uf) => {
          map[uf] = (map[uf] || 0) + valPerState;
        });
      }
    });

    return Object.entries(map).map(([uf, value]) => ({
      uf,
      value,
      percentage: totalMarketValue > 0 ? (value / totalMarketValue) * 100 : 0,
    })).sort((a, b) => b.value - a.value);
  }, [holdings, totalMarketValue]);

  // Simulação de Rebalanceamento Inteligente
  const contributionAmount = parseFloat(simulationContribution) || 0;
  const rebalanceData = useMemo(() => {
    const list = holdings.map((h) => ({
      ticker: h.ticker,
      currentPrice: h.currentPrice,
      currentMarketValue: h.marketValue,
      targetWeightPercent: h.targetWeight || 10,
    }));
    return calculateRebalanceByContribution(list, contributionAmount);
  }, [holdings, contributionAmount]);

  const totalTargetPercent = holdings.reduce((acc, h) => acc + (h.targetWeight || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Alternador de Base de Cálculo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-[#0F172A] border border-slate-800 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              Distribuição & Alocação
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white">
            Exposição da Carteira & Alocação Ideal
          </h1>
          <p className="text-xs text-slate-400">
            Analise concentração por categorias, setores, gestoras e simule rebalanceamentos inteligentes por novos aportes.
          </p>
        </div>

        {/* Alternador de Base */}
        <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 self-start sm:self-auto">
          <button
            onClick={() => setBaseMetric('market')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              baseMetric === 'market'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Valor de Mercado
          </button>
          <button
            onClick={() => setBaseMetric('cost')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              baseMetric === 'cost'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Custo de Aquisição
          </button>
        </div>
      </div>

      <TabGuideBanner
        title="Como equilibrar sua carteira e planejar o próximo aporte"
        subtitle="Veja onde seu dinheiro está concentrado e descubra qual fundo comprar no mês para manter a carteira balanceada."
        items={[
          {
            term: 'Tijolo vs. Papel vs. Híbrido',
            definition: 'FIIs de Tijolo são donos de imóveis físicos (galpões, shoppings). FIIs de Papel investem em dívidas imobiliárias (CRIs atrelados ao IPCA ou CDI). Equilibrar ambos protege tanto contra a inflação quanto na queda de juros.',
          },
          {
            term: 'Peso Atual vs. Peso Alvo',
            definition: 'O Peso Atual mostra quanto cada fundo representa hoje na sua carteira. O Peso Alvo é a porcentagem ideal que você deseja ter naquele fundo (você pode ajustar clicando no campo de Peso Alvo na tabela abaixo).',
          },
          {
            term: 'Simulador de Rebalanceamento',
            definition: 'Ao digitar quanto pretende investir no mês (ex: R$ 2.000), o sistema indica exatamente quantas cotas comprar dos fundos que ficaram para trás, sem precisar vender nada.',
          },
        ]}
      />

      {/* Grid: 4 Blocos de Distribuição (Categoria, Segmento, Gestão, Indexador) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Bloco 1: Categoria */}
        <div className="p-5 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider">Por Categoria</span>
            <PieChart className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="space-y-2 pt-1">
            {categoryDistribution.map((item) => (
              <div key={item.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">{item.name}</span>
                  <span className="font-mono text-emerald-400 font-bold">{item.percentage.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bloco 2: Segmento */}
        <div className="p-5 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider">Por Segmento</span>
            <Layers className="w-4 h-4 text-blue-400" />
          </div>
          <div className="space-y-2 pt-1 max-h-48 overflow-y-auto pr-1">
            {segmentDistribution.map((item) => (
              <div key={item.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium truncate max-w-[120px]">{item.name}</span>
                  <span className="font-mono text-blue-400 font-bold">{item.percentage.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bloco 3: Gestão / Administrador */}
        <div className="p-5 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider">Por Gestora</span>
            <Building2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="space-y-2 pt-1 max-h-48 overflow-y-auto pr-1">
            {managerDistribution.map((item) => (
              <div key={item.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium truncate max-w-[130px]">{item.name}</span>
                  <span className="font-mono text-indigo-400 font-bold">{item.percentage.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full rounded-full transition-all"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bloco 4: Indexador */}
        <div className="p-5 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider">Por Indexador</span>
            <Scale className="w-4 h-4 text-amber-400" />
          </div>
          <div className="space-y-2 pt-1">
            {indexerDistribution.map((item) => (
              <div key={item.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">{item.name}</span>
                  <span className="font-mono text-amber-400 font-bold">{item.percentage.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Distribuição Geográfica de Imóveis Físicos */}
      <div className="p-5 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Distribuição Geográfica de Imóveis (FIIs de Tijolo e Híbridos)
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            Fundos de papel são excluídos por não possuírem imóveis físicos diretos
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {stateDistribution.map((item) => (
            <div key={item.uf} className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <strong className="text-sm font-bold text-white font-mono">{item.uf}</strong>
                <span className="text-xs text-emerald-400 font-mono font-bold">
                  {item.percentage.toFixed(1)}%
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono block">
                {formatBRL(item.value, preferences.hideValues)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Painel: Alocação Ideal vs Atual & Simulador de Aporte */}
      <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-4 h-4" />
              Rebalanceamento de Carteira
            </span>
            <h2 className="text-lg font-bold text-white mt-0.5">
              Alocação Atual vs. Alocação Ideal
            </h2>
            <p className="text-xs text-slate-400">
              Defina os percentuais-alvo de cada fundo. O algoritmo sugere onde alocar o próximo aporte para equilibrar a carteira sem realizar vendas desnecessárias.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Simular Aporte de:</span>
            <div className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl">
              <span className="text-xs text-slate-500 font-mono">R$</span>
              <input
                type="number"
                min="0"
                step="100"
                value={simulationContribution}
                onChange={(e) => setSimulationContribution(e.target.value)}
                className="w-24 bg-transparent text-white font-mono text-xs focus:outline-hidden"
                aria-label="Valor do aporte para simulação"
              />
            </div>
          </div>
        </div>

        {totalTargetPercent !== 100 && (
          <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              A soma dos pesos alvo está em <strong>{totalTargetPercent}%</strong> (diferente de 100%). Os valores foram proporcionalmente normalizados para o cálculo.
            </span>
          </div>
        )}

        {/* Tabela de Rebalanceamento */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-800 font-sans">
              <tr>
                <th className="py-2.5 px-3">Fundo</th>
                <th className="py-2.5 px-3 text-right">Peso Atual</th>
                <th className="py-2.5 px-3 text-right">
                  <span className="inline-flex items-center gap-1 justify-end">
                    Peso Alvo (%)
                    <InfoTooltip
                      title="Peso Alvo (%)"
                      description="Qual porcentagem ideal este fundo deveria ter na sua carteira total. Você pode alterar o número diretamente na caixa."
                    />
                  </span>
                </th>
                <th className="py-2.5 px-3 text-right">Valor Atual</th>
                <th className="py-2.5 px-3 text-right">Valor Alvo</th>
                <th className="py-2.5 px-3 text-right">Diferença</th>
                <th className="py-2.5 px-3 text-right text-emerald-400 font-sans">Sugestão de Aporte</th>
                <th className="py-2.5 px-3 text-right text-emerald-400 font-sans">Cotas Sugeridas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rebalanceData.suggestions.map((item) => {
                const isUnderweight = item.differenceValue > 0;
                const rawHolding = holdings.find((h) => h.ticker === item.ticker);
                return (
                  <tr key={item.ticker} className="hover:bg-slate-800/40">
                    <td className="py-3 px-3 font-bold text-white">{item.ticker}</td>
                    <td className="py-3 px-3 text-right text-slate-300">{item.currentWeightPercent.toFixed(1)}%</td>
                    <td className="py-3 px-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={rawHolding?.targetWeight ?? 10}
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                            updateHoldingTargetWeight(item.ticker, val);
                          }}
                          className="w-14 px-2 py-1 text-right bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-hidden focus:border-emerald-500"
                          aria-label={`Peso alvo para ${item.ticker}`}
                        />
                        <span className="text-slate-500">%</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-300">{formatBRL(item.currentMarketValue, preferences.hideValues)}</td>
                    <td className="py-3 px-3 text-right text-slate-300">{formatBRL(item.targetMarketValue, preferences.hideValues)}</td>
                    <td className="py-3 px-3 text-right">
                      <span className={isUnderweight ? 'text-amber-400' : 'text-emerald-400'}>
                        {formatBRL(item.differenceValue, preferences.hideValues, true)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-400">
                      {formatBRL(item.suggestedContribution, preferences.hideValues)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-white">
                      {item.suggestedShares > 0 ? `+${item.suggestedShares} cotas` : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Total Aportado na Simulação: <strong className="text-white font-mono">{formatBRL(rebalanceData.totalAllocated)}</strong></span>
          <span>Troco / Saldo Restante: <strong className="text-emerald-400 font-mono">{formatBRL(rebalanceData.remainingCash)}</strong></span>
        </div>
      </div>
    </div>
  );
};
