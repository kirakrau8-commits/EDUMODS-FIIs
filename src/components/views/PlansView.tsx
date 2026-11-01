import React from 'react';
import { Check, ShieldCheck } from 'lucide-react';

export const PlansView: React.FC = () => {
  const unlockedFeatures = [
    'Fundos e posições ilimitados na carteira',
    'Registro ilimitado de compras, vendas, subscrições e amortizações',
    'Calendário completo de dividendos e proventos',
    'Todas as calculadoras financeiras e simulador FIRE desbloqueados',
    'Sincronização em tempo real via BRAPI + 2 provedores extras',
    'Mapa geográfico interativo de imóveis no Brasil',
    'Diagnóstico avançado de saúde, vacância e risco',
    'Backup e restauração completos em JSON, CSV e relatório PDF',
    'Persistência automática permanente sem exigir login',
  ];

  return (
    <div className="space-y-6 pb-12">
      <div className="p-6 rounded-2xl bg-[#0F172A] border border-emerald-500/40 shadow-xl space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Uso Pessoal Exclusivo
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-white">
          Acesso Total Desbloqueado
        </h1>
        <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
          Esta plataforma está configurada para uso pessoal exclusivo, com 100% das funcionalidades liberadas permanentemente e sem restrições de planos.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          {unlockedFeatures.map((feat) => (
            <div
              key={feat}
              className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-200"
            >
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{feat}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
