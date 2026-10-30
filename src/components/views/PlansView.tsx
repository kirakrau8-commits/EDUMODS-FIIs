import React, { useState } from 'react';
import { CreditCard, Check, ShieldCheck, Zap, Sparkles, AlertCircle, ArrowRight } from 'lucide-react';
import { usePortfolio } from '../../context/PortfolioContext';

export const PlansView: React.FC = () => {
  const { currentUser, preferences, updatePreferences } = usePortfolio();

  const [simulatedCheckoutPlan, setSimulatedCheckoutPlan] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState<string | null>(null);

  const plans = [
    {
      id: 'Gratuito',
      name: 'Plano Gratuito',
      price: 'R$ 0',
      period: 'para sempre',
      description: 'Ideal para quem está começando a investir nos primeiros fundos.',
      features: [
        'Até 5 fundos em carteira',
        'Registro ilimitado de operações',
        'Calendário de dividendos básico',
        'Calculadora Sardinha e Bazin',
        'Cotações com atualização diária',
        'Isolamento e backup de dados',
      ],
      current: currentUser.plan === 'Gratuito',
    },
    {
      id: 'Pro',
      name: 'Plano Pro Investidor',
      price: 'R$ 29,90',
      period: '/mês',
      popular: true,
      description: 'Para o investidor dedicado que busca diversificação e otimização fiscal.',
      features: [
        'Fundos ilimitados na carteira',
        'Sincronização em tempo real via BRAPI',
        'Simulador de rebalanceamento por aporte',
        'Todas as 7 calculadoras financeiras',
        'Mapa geográfico de ativos do Brasil',
        'Histórico e exportação CSV/JSON',
        'Alertas de concentração e preço-teto',
      ],
      current: currentUser.plan === 'Pro',
    },
    {
      id: 'VIP',
      name: 'Plano VIP Alpha',
      price: 'R$ 59,90',
      period: '/mês',
      description: 'Acesso total irrestrito para gestão profissional e patrimonial.',
      features: [
        'Tudo do Plano Pro Investidor',
        'Configuração de 2 provedores de API extras',
        'Diagnóstico profundo de risco e saúde',
        'Planejador completo FIRE e aposentadoria',
        'Múltiplas sub-carteiras e gestão multi-conta',
        'Suporte prioritário e novidades em primeira mão',
      ],
      current: currentUser.plan === 'VIP',
    },
  ];

  const handleSimulateUpgrade = (planId: 'Gratuito' | 'Pro' | 'VIP') => {
    setSimulatedCheckoutPlan(planId);
    setTimeout(() => {
      updatePreferences({ activePlan: planId });
      currentUser.plan = planId;
      setSimulatedCheckoutPlan(null);
      setCheckoutSuccess(`Plano ${planId} ativado com sucesso para esta conta!`);
      setTimeout(() => setCheckoutSuccess(null), 4000);
    }, 800);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 shadow-xl space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            Assinaturas & Comercialização
          </span>
          <span className="text-xs text-slate-400">Pronto para Monetização</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-white">
          Planos do EDUMODS FIIs
        </h1>
        <p className="text-xs text-slate-400 max-w-2xl">
          Arquitetura preparada para integração segura com Stripe / Mercado Pago. Em ambiente de homologação, você pode alternar livremente entre os planos para testar permissões.
        </p>
      </div>

      {checkoutSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{checkoutSuccess}</span>
        </div>
      )}

      {/* Grid de Planos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((p) => (
          <div
            key={p.id}
            className={`p-6 rounded-2xl bg-[#0F172A] border transition-all flex flex-col justify-between relative ${
              p.current
                ? 'border-emerald-500 shadow-xl shadow-emerald-500/10'
                : p.popular
                ? 'border-blue-500/50 shadow-lg'
                : 'border-slate-800'
            }`}
          >
            {p.popular && !p.current && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-blue-600 text-[10px] font-bold text-white uppercase tracking-wider shadow-md">
                Mais Escolhido
              </span>
            )}

            {p.current && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-emerald-600 text-[10px] font-bold text-white uppercase tracking-wider shadow-md">
                Seu Plano Atual
              </span>
            )}

            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-white">{p.name}</h3>
                <p className="text-xs text-slate-400 mt-1">{p.description}</p>
              </div>

              <div className="flex items-baseline gap-1 py-2 border-y border-slate-800">
                <span className="text-3xl font-extrabold text-white font-mono">{p.price}</span>
                <span className="text-xs text-slate-400 font-medium">{p.period}</span>
              </div>

              <ul className="space-y-2.5 text-xs text-slate-300">
                {p.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-800">
              <button
                onClick={() => handleSimulateUpgrade(p.id as 'Gratuito' | 'Pro' | 'VIP')}
                disabled={p.current || simulatedCheckoutPlan === p.id}
                className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                  p.current
                    ? 'bg-slate-800 text-slate-400 cursor-default'
                    : p.popular
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg'
                }`}
              >
                {simulatedCheckoutPlan === p.id ? (
                  <span>Processando...</span>
                ) : p.current ? (
                  <span>Plano Ativo</span>
                ) : (
                  <>
                    <span>Ativar Plano {p.id}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
