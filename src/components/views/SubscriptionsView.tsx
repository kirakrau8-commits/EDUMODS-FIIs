import React, { useState } from 'react';
import { Layers, Calendar, PlusCircle, CheckCircle, Clock } from 'lucide-react';
import { usePortfolio } from '../../context/PortfolioContext';
import { formatBRL, formatDateBR } from '../../utils/formatters';
import { TabGuideBanner } from '../common/InfoTooltip';

interface SubscriptionOffer {
  id: string;
  ticker: string;
  factor: number; // Ex: 0.15 (15% da posição)
  subscriptionPrice: number;
  marketPrice: number;
  periodLimitDate: string;
  status: 'EM_ANDAMENTO' | 'ENCERRADA';
}

const DEMO_SUBSCRIPTIONS: SubscriptionOffer[] = [
  {
    id: 'sub_1',
    ticker: 'HGLG11',
    factor: 0.12,
    subscriptionPrice: 152.0,
    marketPrice: 158.45,
    periodLimitDate: '2026-11-20',
    status: 'EM_ANDAMENTO',
  },
  {
    id: 'sub_2',
    ticker: 'BTLG11',
    factor: 0.18,
    subscriptionPrice: 94.5,
    marketPrice: 98.7,
    periodLimitDate: '2026-11-28',
    status: 'EM_ANDAMENTO',
  },
];

export const SubscriptionsView: React.FC = () => {
  const { holdings, addTransaction } = usePortfolio();
  const [exercisedFeedback, setExercisedFeedback] = useState<string | null>(null);

  const handleExercise = (sub: SubscriptionOffer) => {
    const userHolding = holdings.find((h) => h.ticker === sub.ticker);
    const sharesEligible = userHolding ? Math.floor(userHolding.quantity * sub.factor) : 10;

    addTransaction({
      ticker: sub.ticker,
      type: 'SUBSCRICAO',
      date: new Date().toISOString().split('T')[0],
      quantity: Math.max(1, sharesEligible),
      price: sub.subscriptionPrice,
      fees: 0,
      notes: `Exercício de direito de subscrição a ${formatBRL(sub.subscriptionPrice)}`,
    });

    setExercisedFeedback(`Exercício de subscrição de ${sub.ticker} registrado com sucesso!`);
    setTimeout(() => setExercisedFeedback(null), 4000);
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 shadow-xl space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            Direitos & Emissões
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-white">
          Subscrições & Emissões de Cotas
        </h1>
        <p className="text-xs text-slate-400 max-w-2xl">
          Acompanhe ofertas públicas de novas cotas, fatores de proporção e exerça seus direitos com preço fixado abaixo da cotação de mercado.
        </p>
      </div>

      <TabGuideBanner
        title="O que é uma Subscrição de FIIs?"
        subtitle="Quando um fundo quer crescer e comprar novos imóveis, ele emite novas cotas e dá preferência aos cotistas atuais."
        items={[
          {
            term: 'Preço de Emissão com Desconto',
            definition: 'Normalmente as novas cotas são oferecidas por um valor abaixo da cotação atual da Bolsa (B3), permitindo reduzir seu Preço Médio.',
          },
          {
            term: 'Fator de Proporção',
            definition: 'Define quantas cotas novas você tem direito de comprar. Exemplo: fator de 12% (0,12) em 100 cotas dá direito a subscrever 12 novas cotas.',
          },
          {
            term: 'Registro Automático na Carteira',
            definition: 'Ao clicar em "Exercer Direito de Subscrição", o sistema lança a operação automaticamente na sua aba Operações e recalcula seu Preço Médio.',
          },
        ]}
      />

      {exercisedFeedback && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{exercisedFeedback}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DEMO_SUBSCRIPTIONS.map((sub) => {
          const discount = ((sub.marketPrice - sub.subscriptionPrice) / sub.marketPrice) * 100;
          return (
            <div
              key={sub.id}
              className="p-5 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-4 shadow-lg"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-lg font-bold text-white font-mono">{sub.ticker}</span>
                  <span className="text-xs text-slate-400 block">Emissão de Novas Cotas</span>
                </div>
                <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  {discount.toFixed(1)}% Desconto vs Mercado
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-sans">Preço Emissão</span>
                  <strong className="text-emerald-400">{formatBRL(sub.subscriptionPrice)}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-sans">Cotação B3</span>
                  <strong className="text-slate-300">{formatBRL(sub.marketPrice)}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-sans">Prazo Limite</span>
                  <strong className="text-white">{formatDateBR(sub.periodLimitDate)}</strong>
                </div>
              </div>

              <button
                onClick={() => handleExercise(sub)}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-colors"
              >
                Exercer Direito de Subscrição
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
