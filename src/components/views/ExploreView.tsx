import React, { useState } from 'react';
import {
  Search,
  Building,
  ArrowDownRight,
  Sparkles,
  CheckCircle2,
  X,
} from 'lucide-react';
import { VERIFIED_FII_DATABASE } from '../../data/fiiDatabase';
import { formatBRL, formatPercent } from '../../utils/formatters';
import { usePortfolio } from '../../context/PortfolioContext';
import { InfoTooltip, TabGuideBanner } from '../common/InfoTooltip';

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
      fii.segment.toLowerCase().includes(search.toLowerCase()) ||
      fii.manager.toLowerCase().includes(search.toLowerCase());

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

  const exampleSearchChips = [
    { label: 'HGLG11 (Galpões)', query: 'HGLG11' },
    { label: 'MXRF11 (Papel)', query: 'MXRF11' },
    { label: 'XPML11 (Shoppings)', query: 'XPML11' },
    { label: 'KNIP11 (IPCA)', query: 'KNIP11' },
    { label: 'Logística', query: 'Logística' },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 shadow-xl space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            Catálogo Oficial B3
          </span>
          <span className="text-xs text-slate-400">
            {allFIIs.length} Fundos Imobiliários Verificados
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-white">
          Explorar Fundos Imobiliários (FIIs)
        </h1>
        <p className="text-xs text-slate-400 max-w-2xl">
          Pesquise fundos pela sigla (ticker), compare o preço de mercado com o valor real dos imóveis (P/VP) e adicione ativos à sua carteira com um clique.
        </p>
      </div>

      {/* Guia Rápido para Iniciantes */}
      <TabGuideBanner
        title="O que significam as siglas e os números desta aba?"
        subtitle="Guia rápido para entender os indicadores antes de escolher um FII"
        items={[
          {
            term: 'Ticker / Sigla (Ex: HGLG11, MXRF11)',
            meaning:
              'É o código de 4 letras seguidas do número 11 usado para negociar o fundo na Bolsa de Valores brasileira (B3).',
            example: 'HGLG11 = CSHG Logística; XPML11 = XP Malls (Shoppings).',
          },
          {
            term: 'Tijolo vs. Papel vs. Híbrido',
            meaning:
              'FIIs de Tijolo são donos de imóveis físicos (galpões, shoppings). FIIs de Papel investem em títulos de dívida imobiliária (CRIs). Híbridos misturam os dois.',
          },
          {
            term: 'P/VP, VPA e DY Anual',
            meaning:
              'VPA é o preço justo patrimonial de 1 cota. P/VP abaixo de 1,00 indica desconto. DY Anual é o percentual de aluguéis pagos em 12 meses (isento de IR).',
          },
        ]}
      />

      {/* Filtros e Busca com Exemplos Clicáveis */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-3.5 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Pesquisar por sigla (ex: HGLG11), nome, setor ou gestora..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
                aria-label="Limpar busca"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filtro P/VP */}
          <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto">
            <button
              onClick={() => setPvpFilter('TODOS')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                pvpFilter === 'TODOS' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Todos os Preços
            </button>
            <button
              onClick={() => setPvpFilter('DESCONTO')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                pvpFilter === 'DESCONTO' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Baratos / Com Desconto (P/VP &lt; 1,00)
            </button>
            <button
              onClick={() => setPvpFilter('AGIO')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                pvpFilter === 'AGIO' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Com Ágio (P/VP &gt;= 1,00)
            </button>
          </div>
        </div>

        {/* Exemplos de Pesquisa Rápida */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-slate-400 flex items-center gap-1 mr-1">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            Exemplos de busca:
          </span>
          {exampleSearchChips.map((chip) => (
            <button
              key={chip.query}
              type="button"
              onClick={() => setSearch(chip.query === search ? '' : chip.query)}
              className={`px-2 py-0.5 rounded-md font-mono transition-colors ${
                search === chip.query
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Filtro por Categoria e Segmento */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-500 mr-1 font-semibold uppercase">
              Tipo (Categoria):
            </span>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setSelectedCategory(c)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  selectedCategory === c
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-500 mr-1 font-semibold uppercase">
              Setor (Segmento):
            </span>
            {segments.map((seg) => (
              <button
                key={seg}
                onClick={() => setSelectedSegment(seg)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  selectedSegment === seg
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {seg === 'Recebíveis Imobiliários' ? 'Recebíveis (CRI)' : seg}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid de Cards dos FIIs */}
      {filteredFIIs.length === 0 ? (
        <div className="p-10 text-center rounded-2xl bg-[#0F172A] border border-slate-800 space-y-2">
          <Building className="w-8 h-8 text-slate-500 mx-auto" />
          <h3 className="text-sm font-bold text-white">Nenhum FII encontrado para esse filtro</h3>
          <p className="text-xs text-slate-400">
            Tente limpar o campo de busca ou selecionar "TODOS" nas categorias acima.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setSelectedCategory('TODOS');
              setSelectedSegment('TODOS');
              setPvpFilter('TODOS');
            }}
            className="mt-2 px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold"
          >
            Mostrar Todos os Fundos
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFIIs.map((fii) => {
            const isHolding = holdings.some((h) => h.ticker === fii.ticker);
            const isDiscount = fii.pvp < 1.0;

            return (
              <div
                key={fii.ticker}
                className="p-5 rounded-2xl bg-[#0F172A] border border-slate-800 hover:border-slate-700 transition-all shadow-md space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-extrabold text-white font-mono">
                          {fii.ticker}
                        </span>
                        {isHolding && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Na Carteira
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 truncate block max-w-[210px]">
                        {fii.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <span
                        className={`text-xs font-bold font-mono px-2 py-0.5 rounded-md tabular-nums ${
                          isDiscount
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        P/VP {fii.pvp.toFixed(2)}
                      </span>
                      <InfoTooltip
                        title={`P/VP de ${fii.ticker}`}
                        description={
                          isDiscount
                            ? `Negociado com desconto! O preço atual (${formatBRL(fii.currentPrice)}) está abaixo do valor patrimonial (${formatBRL(fii.vpa)}).`
                            : `Negociado próximo ou acima do valor patrimonial (${formatBRL(fii.vpa)}).`
                        }
                        align="right"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-200 font-semibold">
                      {fii.category}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                      {fii.segment}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 font-mono">
                      Indexador: {fii.indexer}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                    {fii.description}
                  </p>
                </div>

                {/* Indicadores Chave com Explicações */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-500 font-sans uppercase flex items-center gap-1">
                      Cotação
                    </span>
                    <strong className="text-white font-bold tabular-nums">
                      {formatBRL(fii.currentPrice)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-sans uppercase flex items-center gap-1">
                      VPA Justo
                    </span>
                    <strong className="text-slate-300 tabular-nums">{formatBRL(fii.vpa)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-sans uppercase flex items-center gap-1">
                      Últ. Aluguel
                    </span>
                    <strong className="text-emerald-300 tabular-nums">
                      {formatBRL(fii.lastDividend)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-sans uppercase flex items-center gap-1">
                      DY Anual
                    </span>
                    <strong className="text-emerald-400 font-bold tabular-nums">
                      {formatPercent(fii.annualDY, false)}
                    </strong>
                  </div>
                </div>

                {/* Ação de Adicionar / Comprar */}
                <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                  <span className="text-[11px] text-slate-400">
                    Liquidez: <strong className="text-slate-300 font-mono">{fii.avgDailyVolume}/dia</strong>
                  </span>
                  <button
                    onClick={() => onOpenTransactionModal(fii.ticker)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-colors"
                  >
                    <ArrowDownRight className="w-3.5 h-3.5" />
                    <span>{isHolding ? 'Comprar Mais' : 'Adicionar à Carteira'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
