import React, { useState } from 'react';
import { Scale, Plus, X } from 'lucide-react';
import { VERIFIED_FII_DATABASE, FIIDataItem } from '../../data/fiiDatabase';
import { formatBRL, formatPercent } from '../../utils/formatters';

export const ComparatorView: React.FC = () => {
  const [selectedTickers, setSelectedTickers] = useState<string[]>(['HGLG11', 'XPLG11', 'BTLG11']);

  const handleAddTicker = (ticker: string) => {
    if (selectedTickers.length < 4 && !selectedTickers.includes(ticker)) {
      setSelectedTickers([...selectedTickers, ticker]);
    }
  };

  const handleRemoveTicker = (ticker: string) => {
    if (selectedTickers.length > 1) {
      setSelectedTickers(selectedTickers.filter((t) => t !== ticker));
    }
  };

  const comparedFunds = selectedTickers
    .map((t) => VERIFIED_FII_DATABASE[t])
    .filter(Boolean);

  const availableTickers = Object.keys(VERIFIED_FII_DATABASE).filter(
    (t) => !selectedTickers.includes(t)
  );

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-[#0F172A] border border-slate-800 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              Análise Multiativo
            </span>
            <span className="text-xs text-slate-400">Até 4 fundos simultâneos</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white">
            Comparador de Fundos Imobiliários
          </h1>
          <p className="text-xs text-slate-400">
            Compare valuation, rendimento histórico, qualidade de gestão e liquidez lado a lado.
          </p>
        </div>

        {selectedTickers.length < 4 && (
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleAddTicker(e.target.value);
                  e.target.value = '';
                }
              }}
              defaultValue=""
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-mono"
            >
              <option value="" disabled>+ Adicionar Fundo...</option>
              {availableTickers.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Grade de Comparação */}
      <div className="overflow-x-auto">
        <div className="min-w-[650px] bg-[#0F172A] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="grid grid-cols-5 p-4 border-b border-slate-800 bg-[#090D16] text-xs font-bold text-slate-400">
            <div>Métrica / Indicador</div>
            {comparedFunds.map((fii) => (
              <div key={fii.ticker} className="flex items-center justify-between font-mono text-white text-sm">
                <span>{fii.ticker}</span>
                {comparedFunds.length > 1 && (
                  <button
                    onClick={() => handleRemoveTicker(fii.ticker)}
                    className="p-1 text-slate-500 hover:text-rose-400"
                    title="Remover fundo"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="divide-y divide-slate-800/60 text-xs">
            {/* Linha Cotação */}
            <div className="grid grid-cols-5 p-3.5 hover:bg-slate-800/30 font-mono">
              <span className="font-sans text-slate-400 font-medium">Cotação Atual</span>
              {comparedFunds.map((fii) => (
                <span key={fii.ticker} className="text-white font-bold">{formatBRL(fii.currentPrice)}</span>
              ))}
            </div>

            {/* Linha P/VP */}
            <div className="grid grid-cols-5 p-3.5 hover:bg-slate-800/30 font-mono">
              <span className="font-sans text-slate-400 font-medium">Múltiplo P/VP</span>
              {comparedFunds.map((fii) => (
                <span
                  key={fii.ticker}
                  className={fii.pvp <= 1.0 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}
                >
                  {fii.pvp.toFixed(2)}
                </span>
              ))}
            </div>

            {/* Linha VPA */}
            <div className="grid grid-cols-5 p-3.5 hover:bg-slate-800/30 font-mono">
              <span className="font-sans text-slate-400 font-medium">VPA (Patrimonial)</span>
              {comparedFunds.map((fii) => (
                <span key={fii.ticker} className="text-slate-300">{formatBRL(fii.vpa)}</span>
              ))}
            </div>

            {/* Linha DY Anual */}
            <div className="grid grid-cols-5 p-3.5 hover:bg-slate-800/30 font-mono">
              <span className="font-sans text-slate-400 font-medium">Dividend Yield Anual</span>
              {comparedFunds.map((fii) => (
                <span key={fii.ticker} className="text-emerald-400 font-bold">{formatPercent(fii.annualDY, false)}</span>
              ))}
            </div>

            {/* Linha Segmento */}
            <div className="grid grid-cols-5 p-3.5 hover:bg-slate-800/30">
              <span className="text-slate-400 font-medium">Segmento</span>
              {comparedFunds.map((fii) => (
                <span key={fii.ticker} className="text-slate-200">{fii.segment}</span>
              ))}
            </div>

            {/* Linha Categoria */}
            <div className="grid grid-cols-5 p-3.5 hover:bg-slate-800/30">
              <span className="text-slate-400 font-medium">Categoria</span>
              {comparedFunds.map((fii) => (
                <span key={fii.ticker} className="text-slate-200 font-semibold">{fii.category}</span>
              ))}
            </div>

            {/* Linha Gestora */}
            <div className="grid grid-cols-5 p-3.5 hover:bg-slate-800/30">
              <span className="text-slate-400 font-medium">Gestora / Admin</span>
              {comparedFunds.map((fii) => (
                <span key={fii.ticker} className="text-slate-300 truncate pr-2">{fii.manager}</span>
              ))}
            </div>

            {/* Linha Liquidez */}
            <div className="grid grid-cols-5 p-3.5 hover:bg-slate-800/30 font-mono">
              <span className="font-sans text-slate-400 font-medium">Volume Diário Médio</span>
              {comparedFunds.map((fii) => (
                <span key={fii.ticker} className="text-slate-200">{fii.avgDailyVolume}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
