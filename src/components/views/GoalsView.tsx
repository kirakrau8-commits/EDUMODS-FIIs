import React, { useState } from 'react';
import { Target, Flame, Edit2, Check, Sparkles, TrendingUp, ShieldCheck } from 'lucide-react';
import { usePortfolio } from '../../context/PortfolioContext';
import { formatBRL, formatPercent } from '../../utils/formatters';
import { calculateFIREProgress } from '../../utils/financialMath';

export const GoalsView: React.FC = () => {
  const {
    goals,
    updateGoals,
    totalMarketValue,
    monthlyDividendsReceived,
    monthlyDividendsForecasted,
    preferences,
  } = usePortfolio();

  const [isEditing, setIsEditing] = useState(false);
  const [incomeGoal, setIncomeGoal] = useState(String(goals.monthlyIncomeGoal));
  const [equityGoal, setEquityGoal] = useState(String(goals.totalEquityGoal));
  const [livingExpenses, setLivingExpenses] = useState(String(goals.currentLivingExpenses));
  const [fireYield, setFireYield] = useState(String(goals.fireSafeYieldPercent));

  const currentMonthlyIncome = monthlyDividendsReceived + monthlyDividendsForecasted;

  const fireData = calculateFIREProgress(
    goals.currentLivingExpenses,
    goals.fireSafeYieldPercent,
    totalMarketValue,
    currentMonthlyIncome
  );

  const handleSave = () => {
    updateGoals({
      monthlyIncomeGoal: parseFloat(incomeGoal) || goals.monthlyIncomeGoal,
      totalEquityGoal: parseFloat(equityGoal) || goals.totalEquityGoal,
      currentLivingExpenses: parseFloat(livingExpenses) || goals.currentLivingExpenses,
      fireSafeYieldPercent: parseFloat(fireYield) || goals.fireSafeYieldPercent,
    });
    setIsEditing(false);
  };

  const incomeProgress = goals.monthlyIncomeGoal > 0 ? Math.min(100, (currentMonthlyIncome / goals.monthlyIncomeGoal) * 100) : 0;
  const equityProgress = goals.totalEquityGoal > 0 ? Math.min(100, (totalMarketValue / goals.totalEquityGoal) * 100) : 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-[#0F172A] border border-slate-800 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              Planejamento de Longo Prazo
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white">
            Metas Patrimoniais & Independência Financeira
          </h1>
          <p className="text-xs text-slate-400">
            Acompanhe o caminho rumo à liberdade financeira cobrindo seu custo de vida mensal com proventos de FIIs.
          </p>
        </div>

        <button
          onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
            isEditing
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
          }`}
        >
          {isEditing ? <Check className="w-4 h-4" /> : <Edit2 className="w-4 h-4 text-emerald-400" />}
          <span>{isEditing ? 'Salvar Metas' : 'Editar Metas'}</span>
        </button>
      </div>

      {/* Grid Principal: Metas Principais e FIRE */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Meta 1: Renda Mensal */}
        <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-4 shadow-lg flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Renda Mensal de Proventos
              </span>
              <Target className="w-4 h-4 text-emerald-400" />
            </div>

            {isEditing ? (
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Meta Desejada (R$/mês)</label>
                <input
                  type="number"
                  value={incomeGoal}
                  onChange={(e) => setIncomeGoal(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-emerald-500 rounded-lg text-white font-mono text-sm"
                />
              </div>
            ) : (
              <div>
                <div className="text-2xl font-extrabold text-white font-mono">
                  {formatBRL(currentMonthlyIncome, preferences.hideValues)}
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  Meta: {formatBRL(goals.monthlyIncomeGoal, preferences.hideValues)} / mês
                </span>
              </div>
            )}

            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-xs text-slate-400 font-mono">
                <span>Progresso</span>
                <span className="text-emerald-400 font-bold">{incomeProgress.toFixed(1)}%</span>
              </div>
              <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${incomeProgress}%` }}
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 text-xs text-slate-400">
            Faltam {formatBRL(Math.max(0, goals.monthlyIncomeGoal - currentMonthlyIncome), preferences.hideValues)} por mês para a meta.
          </div>
        </div>

        {/* Meta 2: Patrimônio Total */}
        <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-4 shadow-lg flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                Patrimônio em FIIs
              </span>
              <TrendingUp className="w-4 h-4 text-blue-400" />
            </div>

            {isEditing ? (
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Meta Patrimonial Total (R$)</label>
                <input
                  type="number"
                  value={equityGoal}
                  onChange={(e) => setEquityGoal(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-blue-500 rounded-lg text-white font-mono text-sm"
                />
              </div>
            ) : (
              <div>
                <div className="text-2xl font-extrabold text-white font-mono">
                  {formatBRL(totalMarketValue, preferences.hideValues)}
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  Meta: {formatBRL(goals.totalEquityGoal, preferences.hideValues)}
                </span>
              </div>
            )}

            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-xs text-slate-400 font-mono">
                <span>Progresso</span>
                <span className="text-blue-400 font-bold">{equityProgress.toFixed(1)}%</span>
              </div>
              <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${equityProgress}%` }}
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 text-xs text-slate-400">
            Faltam {formatBRL(Math.max(0, goals.totalEquityGoal - totalMarketValue), preferences.hideValues)} para atingir o patrimônio alvo.
          </div>
        </div>

        {/* Bloco 3: Independência Financeira (FIRE) */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-[#0F172A] to-[#121E36] border border-amber-500/30 space-y-4 shadow-lg flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Flame className="w-4 h-4" />
                Meta FIRE (Viver de Renda)
              </span>
              <ShieldCheck className="w-4 h-4 text-amber-400" />
            </div>

            {isEditing ? (
              <div className="space-y-2">
                <div>
                  <label className="text-[11px] text-slate-400">Custo de Vida Mensal (R$)</label>
                  <input
                    type="number"
                    value={livingExpenses}
                    onChange={(e) => setLivingExpenses(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">DY Sustentável Estimado (% a.a.)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={fireYield}
                    onChange={(e) => setFireYield(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm"
                  />
                </div>
              </div>
            ) : (
              <div>
                <div className="text-2xl font-extrabold text-amber-300 font-mono">
                  {formatBRL(fireData.requiredEquity, preferences.hideValues)}
                </div>
                <span className="text-xs text-slate-300 font-mono">
                  Patrimônio para cobrir {formatBRL(goals.currentLivingExpenses, preferences.hideValues)}/mês
                </span>
              </div>
            )}

            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-xs text-slate-400 font-mono">
                <span>Cobertura Custo de Vida</span>
                <span className="text-amber-400 font-bold">{fireData.incomeProgressPercent.toFixed(1)}%</span>
              </div>
              <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${fireData.incomeProgressPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 text-xs text-slate-300">
            Seus proventos atuais cobrem {fireData.incomeProgressPercent.toFixed(1)}% do seu custo de vida.
          </div>
        </div>
      </div>
    </div>
  );
};
