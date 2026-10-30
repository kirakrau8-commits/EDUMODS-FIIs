import React, { useState } from 'react';
import { BookOpen, Search, Star, ExternalLink, HelpCircle } from 'lucide-react';

interface GlossaryTerm {
  term: string;
  category: string;
  definition: string;
  example: string;
  formula?: string;
}

const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    term: 'P/VP (Preço sobre Valor Patrimonial)',
    category: 'Múltiplos de Valuation',
    definition: 'Razão entre o preço de mercado da cota e seu valor patrimonial contábil (VPA). Valores abaixo de 1,00 indicam desconto em relação ao patrimônio do fundo, enquanto acima de 1,00 indicam ágio.',
    example: 'Um fundo com cotação a R$ 90,00 e VPA de R$ 100,00 tem P/VP de 0,90 (10% de desconto).',
    formula: 'P/VP = Preço de Mercado / VPA',
  },
  {
    term: 'DY (Dividend Yield)',
    category: 'Rendimentos',
    definition: 'Indicador que mede o retorno gerado exclusivamente pelos proventos distribuídos pelo fundo em relação ao preço pago pela cota.',
    example: 'Um fundo que pagou R$ 10,00 de proventos nos últimos 12 meses e cuja cota custa R$ 100,00 possui um Dividend Yield de 10% a.a.',
    formula: 'DY Anual = (Soma de Proventos em 12 Meses / Preço da Cota) × 100',
  },
  {
    term: 'VPA (Valor Patrimonial por Cota)',
    category: 'Contabilidade',
    definition: 'Patrimônio líquido do fundo (imóveis avaliados por laudo técnico + caixa + CRIs - passivos) dividido pelo número total de cotas emitidas.',
    example: 'Se um fundo tem patrimônio de R$ 1 bilhão e 10 milhões de cotas, o VPA é R$ 100,00.',
    formula: 'VPA = Patrimônio Líquido Total / Quantidade Total de Cotas',
  },
  {
    term: 'CRI (Certificado de Recebíveis Imobiliários)',
    category: 'Instrumentos Financeiros',
    definition: 'Título de renda fixa lastreado em créditos imobiliários (financiamentos, aluguéis futuros, parcelas de loteamentos). É o principal ativo dos fundos de papel.',
    example: 'KNIP11 e MXRF11 investem preponderantemente em carteiras diversificadas de CRIs.',
  },
  {
    term: 'Vacância Física vs Vacância Financeira',
    category: 'Operacional de Tijolo',
    definition: 'Vacância física é a porcentagem da área locável que está vazia sem inquilino. Vacância financeira é a perda de receita de aluguel sobre o potencial total (incluindo carências e descontos).',
    example: 'Se um galpão de 100.000 m² tem 5.000 m² desocupados, a vacância física é de 5%.',
  },
  {
    term: 'ABL (Área Bruta Locável)',
    category: 'Operacional de Tijolo',
    definition: 'Soma total de metros quadrados de todas as áreas de um imóvel que estão disponíveis para serem alugadas aos locatários.',
    example: 'Fundos de galpões logísticos classe A como HGLG11 e XPLG11 possuem centenas de milhares de m² de ABL própria.',
  },
  {
    term: 'WAULT (Weighted Average Unexpired Lease Term)',
    category: 'Risco de Contratos',
    definition: 'Prazo médio ponderado de vencimento dos contratos de locação dos imóveis. Quanto maior o WAULT, maior a previsibilidade de receita futura.',
    example: 'Um WAULT de 8 anos significa que, em média ponderada pela receita, os contratos vencem daqui a 8 anos.',
  },
  {
    term: 'Contrato Atípico (Built to Suit / Sale & Leaseback)',
    category: 'Jurídico e Contratos',
    definition: 'Contrato de longo prazo (geralmente 10 a 20 anos) com multa rescisória integral correspondente a todos os aluguéis restantes até o final do contrato, sem direito à revisão de valor.',
    example: 'Fundos de renda urbana como ALZR11 e TRXF11 utilizam predominantemente contratos atípicos.',
  },
  {
    term: 'IFIX (Índice de Fundos Imobiliários)',
    category: 'Mercado e Benchmarks',
    definition: 'Índice de retorno total calculado pela B3 que mede o desempenho médio ponderado das cotas dos FIIs mais negociados no mercado brasileiro.',
    example: 'Usado como referência principal para comparar a rentabilidade de uma carteira de FIIs.',
  },
  {
    term: 'Data-Com e Data Ex',
    category: 'Proventos',
    definition: 'Data-Com é o último dia útil em que o investidor precisa ter cotas do fundo em carteira para ter direito a receber o próximo provento. No dia seguinte (Data Ex), quem comprar a cota não tem direito ao provento anunciado.',
    example: 'Se a data-com for 15 de outubro, quem comprar no dia 16 não recebe o rendimento de outubro.',
  },
  {
    term: 'LTV (Loan to Value)',
    category: 'Alavancagem',
    definition: 'Razão entre o valor da dívida líquida associada a um imóvel ou fundo e o valor de avaliação de mercado do ativo.',
    example: 'Um imóvel de R$ 100 milhões com dívida securitizada de R$ 30 milhões tem LTV de 30%.',
    formula: 'LTV = (Dívida / Valor de Mercado do Ativo) × 100',
  },
];

export const GlossaryView: React.FC = () => {
  const [search, setSearch] = useState('');

  const filtered = GLOSSARY_TERMS.filter(
    (t) =>
      t.term.toLowerCase().includes(search.toLowerCase()) ||
      t.definition.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 shadow-xl space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            Dicionário do Investidor
          </span>
          <span className="text-xs text-slate-400">{GLOSSARY_TERMS.length} termos técnicos explicados</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-white">
          Glossário Completo de Fundos Imobiliários
        </h1>
        <p className="text-xs text-slate-400 max-w-2xl">
          Consulte termos essenciais para análise de relatórios gerenciais, fatos relevantes e demonstrações financeiras de FIIs.
        </p>
      </div>

      {/* Busca */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        <input
          type="text"
          placeholder="Buscar termo ou conceito (ex: P/VP, WAULT, CRI)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
        />
      </div>

      {/* Grid de Cards dos Termos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((item) => (
          <div
            key={item.term}
            className="p-5 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-3 shadow-md"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white font-mono">{item.term}</h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                {item.category}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{item.definition}</p>
            {item.formula && (
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 font-mono text-xs text-emerald-400">
                {item.formula}
              </div>
            )}
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-400 italic">
              <strong className="text-slate-300 not-italic font-semibold">Exemplo Prático: </strong>
              {item.example}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
