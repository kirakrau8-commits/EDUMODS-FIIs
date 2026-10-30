import React, { useState } from 'react';
import { MapPin, Building, Info } from 'lucide-react';
import { usePortfolio } from '../../context/PortfolioContext';
import { formatBRL } from '../../utils/formatters';

export const PropertiesMapView: React.FC = () => {
  const { holdings, preferences } = usePortfolio();

  const [selectedState, setSelectedState] = useState<string>('SP');

  // Filtrar apenas fundos de tijolo e híbridos
  const physicalFunds = holdings.filter(
    (h) => h.category === 'Tijolo' || h.category === 'Híbrido'
  );

  // Mapear por estado
  const stateSummary: Record<string, { count: number; funds: string[]; totalValue: number }> = {};

  physicalFunds.forEach((h) => {
    const states = h.locationStates || ['SP'];
    const valPerState = h.marketValue / states.length;
    states.forEach((uf) => {
      if (!stateSummary[uf]) {
        stateSummary[uf] = { count: 0, funds: [], totalValue: 0 };
      }
      stateSummary[uf].count += 1;
      stateSummary[uf].funds.push(h.ticker);
      stateSummary[uf].totalValue += valPerState;
    });
  });

  const stateNames: Record<string, string> = {
    SP: 'São Paulo',
    RJ: 'Rio de Janeiro',
    MG: 'Minas Gerais',
    SC: 'Santa Catarina',
    PR: 'Paraná',
    RS: 'Rio Grande do Sul',
    BA: 'Bahia',
    PE: 'Pernambuco',
    CE: 'Ceará',
    AM: 'Amazonas',
    DF: 'Distrito Federal',
    GO: 'Goiás',
    RN: 'Rio Grande do Norte',
  };

  const selectedData = stateSummary[selectedState];

  return (
    <div className="space-y-6 pb-12">
      <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 shadow-xl space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            Geolocalização
          </span>
          <span className="text-xs text-slate-400">Ativos Reais</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-white">
          Mapa de Imóveis & Ativos no Brasil
        </h1>
        <p className="text-xs text-slate-400 max-w-2xl">
          Visualize a concentração geográfica dos galpões logísticos, shoppings centers e lajes corporativas da sua carteira por unidade federativa.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Seletor de Estados */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Estados com Presença Imobiliária
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {Object.keys(stateSummary).map((uf) => {
              const isSelected = selectedState === uf;
              return (
                <button
                  key={uf}
                  onClick={() => setSelectedState(uf)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-md'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sm">{uf}</span>
                    <span className="text-[10px] text-emerald-400 font-semibold">
                      {stateSummary[uf].count} fundo{stateSummary[uf].count > 1 ? 's' : ''}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 block mt-1">
                    {stateNames[uf] || uf}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detalhes do Estado Selecionado */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <span className="text-xs text-slate-500 uppercase font-semibold">Estado Selecionado</span>
              <h3 className="text-xl font-bold text-white mt-0.5">
                {stateNames[selectedState] || selectedState} ({selectedState})
              </h3>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 uppercase font-semibold">Patrimônio Alocado no Estado</span>
              <span className="text-lg font-bold text-emerald-400 font-mono block">
                {formatBRL(selectedData?.totalValue || 0, preferences.hideValues)}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Fundos com Imóveis em {selectedState}:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {physicalFunds
                .filter((h) => (h.locationStates || ['SP']).includes(selectedState))
                .map((fii) => (
                  <div
                    key={fii.ticker}
                    className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-white text-xs">{fii.ticker}</span>
                      <span className="text-[10px] text-slate-400">{fii.segment}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight truncate">
                      {fii.name}
                    </p>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[10px] text-slate-400">
                      <span>Cotas: {fii.quantity}</span>
                      <strong className="text-emerald-400 font-mono">{formatBRL(fii.marketValue, preferences.hideValues)}</strong>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
