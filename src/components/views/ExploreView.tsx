import React, { useState } from 'react';
import { Search, Filter, Star, PlusCircle, Building, ExternalLink, ArrowDownRight } from 'lucide-react';
import { VERIFIED_FII_DATABASE, FIIDataItem } from '../../data/fiiDatabase';
import { formatBRL, formatPercent } from '../../utils/formatters';
import { usePortfolio } from '../../context/PortfolioContext';

interface ExploreViewProps {
  onOpenTransactionModal: (ticker: string) => void;
}

export const ExploreView: React.FC<ExploreViewProps> = ({ onOpenTransactionModal }) => {
  const { holdings } = usePortfolio();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('TODOS');
  const [selectedSegment, setSelectedSegment] = useState<string>('TODOS');
  const [pvpFilter, setPvpFilter] = useState<string>('TODOS');

  const allFIIs = Object.values(VERIFIED_FII_DATABASE);

  const filteredFIIs = allFIIs.filter((fii) => {
    const matchesSearch =
      fii.ticker.toLowerCase().includes(search.toLowerCase()) ||
      fii.name.toLowerCase().includes(search.toLowerCase()) ||
      fii.segment.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      selectedCategory === 'TODOS' || fii.category === selectedCategory;

    const matchesSegment =
      selectedSegment === 'TODOS' || fii.segment === selectedSegment;

    const matchesPvp =
      pvpFilter === 'TODOS'
        ? true
        : pvpFilter === 'DESCONTO'
        ? fii.pvp < 1.0
        : fii.pvp >= 1.0;

    return matchesSearch && matchesCategory && matchesSegment && matchesPvp;
  });

  const categories = ['TODOS', 'Tijolo', 'Papel', 'Híbrido'];
  const segments = [
    'TODOS',
    'Logística',
    'Recebíveis Imobiliários',
    'Shoppings',
    'Lajes Corporativas',
    'Renda Urbana',
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 shadow-xl space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            Mercado B3
          </span>
          <span className="text-xs text-slate-400">Base Verificada de FIIs Brasileiros</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-white">
          Explorar Fundos Imobiliários
        </h1>
        <p className="text-xs text-slate-400 max-w-2xl">
          Filtre por P/VP, dividend yield, categoria e segmento. Encontre ativos com ágio ou desconto patrimonial e adicione à sua carteira com um clique.
        </p>
      </div>

      {/* Filtros e Busca */}
      <div className="p-4 rounded-xl bg-[#0F172A] border border-slate-800 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Pesquisar por ticker (ex: HGLG11), nome ou gestor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          {/* Filtro P/VP */}
          <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800">
            <button
              onClick={() => setPvpFilter('TODOS')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                pvpFilter === 'TODOS' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Qualquer P/VP
            </button>
            <button
              onClick={() => setPvpFilter('DESCONTO')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                pvpFilter === 'DESCONTO' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Com Desconto (P/VP &lt; 1,0)
            </button>
            <button
              onClick={() => setPvpFilter('AGIO')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                pvpFilter === 'AGIO' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Com Ágio (P/VP &gt; 1,0)
            </button>
          </div>
        </div>

        {/* Categorias e Segmentos */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800/80">
          <span className="text-[11px] text-slate-500 mr-1 font-semibold uppercase">Categoria:</span>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCategory(c)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                selectedCategory === c
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de Cards dos FIIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredFIIs.map((fii) => {
          const isHolding = holdings.some((h) => h.ticker === fii.ticker);

          return (
            <div
              key={fii.ticker}
              className="p-5 rounded-2xl bg-[#0F172A] border border-slate-800 hover:border-slate-700 transition-all shadow-md space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-lg font-extrabold text-white font-mono block">
                      {fii.ticker}
                    </span>
                    <span className="text-xs text-slate-400 truncate block max-w-[200px]">
                      {fii.name}
                    </span>
                  </div>

                  <span
                    className={`text-xs font-bold font-mono px-2 py-0.5 rounded-md ${
                      fii.pvp <= 1.0
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    P/VP {fii.pvp.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span className="text-slate-300 font-semibold">{fii.category}</span>
                  <span aria-hidden="true">·</span>
                  <span>{fii.segment}</span>
                  <span aria-hidden="true">·</span>
                  <span>{fii.indexer}</span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                  {fii.description}
                </p>
              </div>

              {/* Indicadores Chave */}
              <div className="grid grid-cols-3 gap-2 p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 font-sans uppercase block">Cotação</span>
                  <strong className="text-white font-bold">{formatBRL(fii.currentPrice)}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-sans uppercase block">VPA</span>
                  <strong className="text-slate-300">{formatBRL(fii.vpa)}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-sans uppercase block">DY Anual</span>
                  <strong className="text-emerald-400 font-bold">{formatPercent(fii.annualDY, false)}</strong>
                </div>
              </div>

              {/* Ação de Adicionar / Comprar */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                <span className="text-[11px] text-slate-500">
                  {isHolding ? 'Em sua carteira' : 'Disponível'}
                </span>
                <button
                  onClick={() => onOpenTransactionModal(fii.ticker)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-colors"
                >
                  <ArrowDownRight className="w-3.5 h-3.5" />
                  <span>Comprar Cotas</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
