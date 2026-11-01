import React, { useState, useMemo, useId } from 'react';
import {
  Calculator,
  TrendingUp,
  Percent,
  Coins,
  Scale,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Flame,
  Calendar,
  Clock,
  Plus,
  Minus,
  CheckCircle2,
  Wand2,
} from 'lucide-react';
import {
  calculateBazinCeilingPrice,
  calculateGordonPrice,
  calculatePVP,
  calculateSardinhaProjection,
  calculateWeightedAveragePrice,
  calculateFIREProgress,
} from '../../utils/financialMath';
import { formatBRL, formatPercent } from '../../utils/formatters';
import { VERIFIED_FII_DATABASE } from '../../data/fiiDatabase';
import { usePortfolio } from '../../context/PortfolioContext';
import { InfoTooltip, TabGuideBanner } from '../common/InfoTooltip';

type CalcType =
  | 'sardinha'
  | 'bazin'
  | 'pvp'
  | 'preco_medio'
  | 'renda_passiva'
  | 'fire'
  | 'gordon';

interface CalcMeta {
  id: CalcType;
  label: string;
  shortTitle: string;
  icon: React.FC<{ className?: string }>;
  purpose: string;
  requiredInputsSummary: string[];
  whereDataComesFrom: string;
}

const CALCULATORS_METADATA: CalcMeta[] = [
  {
    id: 'sardinha',
    label: 'Bola de Neve (Juros Compostos)',
    shortTitle: 'Simulador Bola de Neve (Sardinha)',
    icon: Coins,
    purpose:
      'Descubra quanto seu patrimônio e sua renda mensal vão crescer ao reinvestir todos os dividendos recebidos junto com novos aportes mensais.',
    requiredInputsSummary: [
      'Patrimônio inicial que você já tem (ou R$ 0 se estiver começando)',
      'Valor que pretende investir por mês (Aporte Mensal)',
      'Rentabilidade anual média em dividendos (DY % a.a.)',
      'Prazo de acumulação em anos e/ou meses',
    ],
    whereDataComesFrom:
      'Você pode clicar em "Preencher com Minha Carteira" para usar seu patrimônio atual automaticamente.',
  },
  {
    id: 'bazin',
    label: 'Preço-Teto (Método Bazin)',
    shortTitle: 'Calculadora de Preço-Teto (Bazin)',
    icon: Calculator,
    purpose:
      'Calcula o preço máximo que você pode pagar por uma cota para garantir a taxa de dividendos anual mínima que você exige.',
    requiredInputsSummary: [
      'Dividendo anual pago por 1 cota (R$/ano)',
      'Taxa mínima de retorno que você deseja receber (% ao ano)',
      'Cotação atual do fundo na Bolsa (R$) para comparar a margem de segurança',
    ],
    whereDataComesFrom:
      'Selecione qualquer FII nos botões rápidos abaixo para preencher o dividendo anual e a cotação automaticamente.',
  },
  {
    id: 'pvp',
    label: 'P/VP (Desconto ou Ágio)',
    shortTitle: 'Avaliador de P/VP (Cota Barata ou Cara)',
    icon: Percent,
    purpose:
      'Descubra se um Fundo Imobiliário está sendo vendido com desconto (abaixo do valor real dos imóveis/títulos) ou com ágio (mais caro que o patrimônio).',
    requiredInputsSummary: [
      'Cotação atual de mercado da cota na B3 (R$)',
      'Valor Patrimonial por Cota (VPA em R$) divulgado no relatório gerencial',
    ],
    whereDataComesFrom:
      'Clique em um dos FIIs abaixo para carregar a Cotação e o VPA oficiais da base B3.',
  },
  {
    id: 'preco_medio',
    label: 'Preço Médio Ponderado',
    shortTitle: 'Simulador de Novo Preço Médio',
    icon: Scale,
    purpose:
      'Simule como ficará seu Preço Médio e sua quantidade total de cotas antes de fazer uma nova compra na corretora.',
    requiredInputsSummary: [
      'Quantidade de cotas que você já possui hoje',
      'Seu Preço Médio atual (R$)',
      'Quantidade de novas cotas que vai comprar e o preço pago',
    ],
    whereDataComesFrom:
      'Clique em um fundo da sua carteira para carregar sua posição atual automaticamente.',
  },
  {
    id: 'renda_passiva',
    label: 'Meta de Renda Mensal',
    shortTitle: 'Quanto Investir para Ganhar R$ X/mês',
    icon: Sparkles,
    purpose:
      'Descubra exatamente quanto patrimônio acumulado você precisa ter em FIIs para receber o salário mensal de dividendos dos seus sonhos.',
    requiredInputsSummary: [
      'Renda mensal em dividendos que você deseja receber (R$/mês)',
      'Dividend Yield anual médio esperado da carteira (% ao ano)',
    ],
    whereDataComesFrom:
      'Use sua Meta de Renda configurada na aba Metas ou teste valores como R$ 1.000, R$ 3.000 ou R$ 5.000/mês.',
  },
  {
    id: 'fire',
    label: 'Independência Financeira (FIRE)',
    shortTitle: 'Calculadora Viver de Renda (FIRE)',
    icon: Flame,
    purpose:
      'Calcule quanto falta para que os aluguéis mensais dos seus FIIs paguem 100% do seu custo de vida mensal.',
    requiredInputsSummary: [
      'Seu custo de vida mensal (despesas mensais em R$)',
      'Rentabilidade anual segura de dividendos (% a.a.)',
      'Seu patrimônio atual investido em FIIs (R$)',
    ],
    whereDataComesFrom:
      'Preencha com os dados reais da sua carteira com 1 clique no botão rápido.',
  },
  {
    id: 'gordon',
    label: 'Modelo de Gordon (Valor Justo)',
    shortTitle: 'Valuation pelo Modelo de Gordon',
    icon: TrendingUp,
    purpose:
      'Estima o preço justo de longo prazo de um FII de Tijolo considerando o crescimento anual dos aluguéis (reajuste por inflação/IPCA).',
    requiredInputsSummary: [
      'Dividendo anual esperado para os próximos 12 meses (D1 em R$)',
      'Taxa de retorno total exigida por você (k em % a.a.)',
      'Taxa de crescimento anual estimada dos aluguéis (g em % a.a.)',
    ],
    whereDataComesFrom:
      'ImportANTE: A taxa exigida (k) deve ser sempre maior que a taxa de crescimento (g).',
  },
];

export const CalculatorsView: React.FC = () => {
  const { holdings, totalMarketValue, goals } = usePortfolio();

  const [activeCalc, setActiveCalc] = useState<CalcType>('sardinha');
  const [showHowToUse, setShowHowToUse] = useState<boolean>(true);
  const [presetFeedback, setPresetFeedback] = useState<string | null>(null);

  // Estados: Calculadora Bazin
  const [bazinAnnualDiv, setBazinAnnualDiv] = useState<string>('13.20');
  const [bazinRequiredYield, setBazinRequiredYield] = useState<string>('8.5');
  const [bazinCurrentPrice, setBazinCurrentPrice] = useState<string>('158.45');

  // Estados: Modelo de Gordon
  const [gordonNextDiv, setGordonNextDiv] = useState<string>('13.20');
  const [gordonDiscountRate, setGordonDiscountRate] = useState<string>('11.0');
  const [gordonGrowthRate, setGordonGrowthRate] = useState<string>('3.0');

  // Estados: P/VP e Ágio/Desconto
  const [pvpPrice, setPvpPrice] = useState<string>('158.45');
  const [pvpVPA, setPvpVPA] = useState<string>('155.10');

  // Estados: Calculadora Sardinha
  const [sardinhaInitial, setSardinhaInitial] = useState<string>('32000');
  const [sardinhaContribution, setSardinhaContribution] = useState<string>('1000');
  const [sardinhaAnnualRate, setSardinhaAnnualRate] = useState<string>('10.5');
  const [sardinhaTimeMode, setSardinhaTimeMode] = useState<'ano_mes' | 'anos' | 'meses'>('ano_mes');
  const [sardinhaYears, setSardinhaYears] = useState<string>('5');
  const [sardinhaExtraMonths, setSardinhaExtraMonths] = useState<string>('0');
  const [sardinhaMonthsOnly, setSardinhaMonthsOnly] = useState<string>('60');
  const [sardinhaViewMode, setSardinhaViewMode] = useState<'yearly' | 'monthly'>('yearly');
  const [showSardinhaTable, setShowSardinhaTable] = useState<boolean>(true);

  // Estados: Preço Médio Ponderado
  const [pmCurrentQty, setPmCurrentQty] = useState<string>('50');
  const [pmCurrentAvg, setPmCurrentAvg] = useState<string>('154.50');
  const [pmNewQty, setPmNewQty] = useState<string>('20');
  const [pmNewPrice, setPmNewPrice] = useState<string>('158.45');
  const [pmFees, setPmFees] = useState<string>('0.00');

  // Estados: Renda Passiva
  const [targetIncome, setTargetIncome] = useState<string>('3000');
  const [expectedDY, setExpectedDY] = useState<string>('10.0');

  // Estados: FIRE
  const [fireExpenses, setFireExpenses] = useState<string>('4500');
  const [fireYield, setFireYield] = useState<string>('9.5');
  const [fireCurrentEquit, setFireCurrentEquit] = useState<string>('33500');

  const currentMeta = useMemo(
    () => CALCULATORS_METADATA.find((c) => c.id === activeCalc) || CALCULATORS_METADATA[0],
    [activeCalc]
  );

  // Cálculo reativo do total de meses na Sardinha
  const sardinhaTotalMonths = useMemo(() => {
    if (sardinhaTimeMode === 'anos') {
      const y = Math.max(0, parseFloat(sardinhaYears) || 0);
      return Math.max(1, Math.round(y * 12));
    }
    if (sardinhaTimeMode === 'meses') {
      const m = Math.max(1, parseInt(sardinhaMonthsOnly, 10) || 1);
      return m;
    }
    const y = Math.max(0, parseInt(sardinhaYears, 10) || 0);
    const m = Math.max(0, parseInt(sardinhaExtraMonths, 10) || 0);
    const total = y * 12 + m;
    return Math.max(1, total);
  }, [sardinhaTimeMode, sardinhaYears, sardinhaExtraMonths, sardinhaMonthsOnly]);

  const handleTimeModeChange = (newMode: 'ano_mes' | 'anos' | 'meses') => {
    const currentTotal = sardinhaTotalMonths;
    if (newMode === 'anos') {
      const y = Math.max(1, Math.round(currentTotal / 12));
      setSardinhaYears(String(y));
    } else if (newMode === 'meses') {
      setSardinhaMonthsOnly(String(currentTotal));
    } else if (newMode === 'ano_mes') {
      const y = Math.floor(currentTotal / 12);
      const m = currentTotal % 12;
      setSardinhaYears(String(y));
      setSardinhaExtraMonths(String(m));
    }
    setSardinhaTimeMode(newMode);
  };

  // Função para carregar dados reais de um FII ou da carteira
  const handleApplyQuickPreset = (ticker?: string) => {
    if (ticker) {
      const holding = holdings.find((h) => h.ticker === ticker);
      const db = VERIFIED_FII_DATABASE[ticker];
      const curPrice = holding?.currentPrice ?? db?.currentPrice ?? 100;
      const vpa = holding?.vpa ?? db?.vpa ?? 100;
      const monthlyDiv = holding?.monthlyYieldPerShare ?? db?.lastDividend ?? 0.9;
      const annualDiv = Number((monthlyDiv * 12).toFixed(2));

      if (activeCalc === 'bazin') {
        setBazinAnnualDiv(annualDiv.toFixed(2));
        setBazinCurrentPrice(curPrice.toFixed(2));
      } else if (activeCalc === 'pvp') {
        setPvpPrice(curPrice.toFixed(2));
        setPvpVPA(vpa.toFixed(2));
      } else if (activeCalc === 'preco_medio') {
        setPmCurrentQty(String(holding?.quantity ?? 50));
        setPmCurrentAvg((holding?.averagePrice ?? curPrice).toFixed(2));
        setPmNewPrice(curPrice.toFixed(2));
      } else if (activeCalc === 'gordon') {
        setGordonNextDiv(annualDiv.toFixed(2));
      }
      setPresetFeedback(`Dados reais de ${ticker} carregados nos campos!`);
    } else {
      // Carregar dados gerais da carteira do usuário
      const eq = Math.round(totalMarketValue || 33500);
      if (activeCalc === 'sardinha') {
        setSardinhaInitial(String(eq));
      } else if (activeCalc === 'renda_passiva') {
        setTargetIncome(String(goals.monthlyIncomeGoal || 5000));
      } else if (activeCalc === 'fire') {
        setFireExpenses(String(goals.currentLivingExpenses || 4500));
        setFireYield(String(goals.fireSafeYieldPercent || 9.5));
        setFireCurrentEquit(String(eq));
      }
      setPresetFeedback('Dados da sua carteira carregados com sucesso!');
    }
    setTimeout(() => setPresetFeedback(null), 3000);
  };

  // Cálculos Dinâmicos
  const bazinRes = (() => {
    try {
      const d = parseFloat(bazinAnnualDiv) || 0;
      const y = parseFloat(bazinRequiredYield) || 0;
      const cur = parseFloat(bazinCurrentPrice) || 0;
      if (d <= 0 || y <= 0) return null;
      const res = calculateBazinCeilingPrice(d, y);
      const safetyMargin = cur > 0 ? ((res.ceilingPrice - cur) / res.ceilingPrice) * 100 : 0;
      return { ...res, safetyMargin: Number(safetyMargin.toFixed(2)), currentPrice: cur };
    } catch {
      return null;
    }
  })();

  const gordonRes = (() => {
    try {
      const d = parseFloat(gordonNextDiv) || 0;
      const k = parseFloat(gordonDiscountRate) || 0;
      const g = parseFloat(gordonGrowthRate) || 0;
      return calculateGordonPrice(d, k, g);
    } catch {
      return null;
    }
  })();

  const pvpRes = (() => {
    const p = parseFloat(pvpPrice) || 0;
    const v = parseFloat(pvpVPA) || 0;
    return calculatePVP(p, v);
  })();

  const sardinhaRes = (() => {
    const init = parseFloat(sardinhaInitial) || 0;
    const contrib = parseFloat(sardinhaContribution) || 0;
    const rate = parseFloat(sardinhaAnnualRate) || 0;
    return calculateSardinhaProjection(init, contrib, rate, sardinhaTotalMonths);
  })();

  const pmRes = (() => {
    try {
      const cQty = parseFloat(pmCurrentQty) || 0;
      const cAvg = parseFloat(pmCurrentAvg) || 0;
      const nQty = parseFloat(pmNewQty) || 0;
      const nPrice = parseFloat(pmNewPrice) || 0;
      const fees = parseFloat(pmFees) || 0;
      return calculateWeightedAveragePrice(cQty, cAvg, nQty, nPrice, fees);
    } catch {
      return null;
    }
  })();

  const incomeRes = (() => {
    const target = parseFloat(targetIncome) || 0;
    const dy = parseFloat(expectedDY) || 0;
    if (target <= 0 || dy <= 0) return null;
    const annualTarget = target * 12;
    const requiredEquity = annualTarget / (dy / 100);
    const missingEquity = Math.max(0, requiredEquity - totalMarketValue);
    return { requiredEquity, annualTarget, missingEquity };
  })();

  const fireRes = (() => {
    const exp = parseFloat(fireExpenses) || 0;
    const y = parseFloat(fireYield) || 0;
    const eq = parseFloat(fireCurrentEquit) || 0;
    return calculateFIREProgress(exp, y, eq, (eq * (y / 100)) / 12);
  })();

  const bazinAnnualDivId = useId();
  const bazinRequiredYieldId = useId();
  const bazinCurrentPriceId = useId();
  const gordonNextDivId = useId();
  const gordonDiscountRateId = useId();
  const gordonGrowthRateId = useId();
  const pvpPriceId = useId();
  const pvpVPAId = useId();
  const sardinhaInitialId = useId();
  const sardinhaContributionId = useId();
  const sardinhaAnnualRateId = useId();
  const sardinhaYearsId = useId();
  const sardinhaExtraMonthsId = useId();
  const sardinhaMonthsOnlyId = useId();
  const pmCurrentQtyId = useId();
  const pmCurrentAvgId = useId();
  const pmNewQtyId = useId();
  const pmNewPriceId = useId();
  const pmFeesId = useId();
  const targetIncomeId = useId();
  const expectedDYId = useId();
  const fireExpensesId = useId();
  const fireYieldId = useId();
  const fireCurrentEquitId = useId();

  const quickTickers = ['HGLG11', 'MXRF11', 'KNIP11', 'XPML11', 'BTLG11'];

  return (
    <div className="space-y-6 pb-12">
      {/* Banner Principal */}
      <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 shadow-xl space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            Simuladores & Valuation Passo a Passo
          </span>
          <span className="text-xs text-slate-400">7 modelos matemáticos explicados</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-white">
          Calculadoras Financeiras para FIIs
        </h1>
        <p className="text-xs text-slate-400 max-w-2xl">
          Simule juros compostos (efeito bola de neve), descubra o preço-teto para não comprar cota cara, calcule seu novo preço médio e planeje sua meta de renda mensal.
        </p>
      </div>

      {/* Guia Explicativo da Aba */}
      <TabGuideBanner
        title="Não sabe qual calculadora escolher? Veja o resumo:"
        subtitle="Clique para entender quando usar cada simulador no seu dia a dia"
        items={[
          {
            term: 'Quero saber quanto vou acumular no futuro',
            meaning:
              'Use a "Bola de Neve (Juros Compostos)" ou "Meta de Renda Mensal". Elas mostram o poder de reinvestir os dividendos todo mês.',
          },
          {
            term: 'Quero saber se um FII está barato para comprar',
            meaning:
              'Use "Preço-Teto (Método Bazin)" ou "P/VP (Desconto ou Ágio)". Elas mostram o valor justo da cota.',
          },
          {
            term: 'Vou comprar mais cotas de um FII que já tenho',
            meaning:
              'Use "Preço Médio Ponderado" para ver exatamente como ficará seu novo preço médio após a compra.',
          },
        ]}
      />

      {/* Menu Superior de Seleção de Calculadora */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {CALCULATORS_METADATA.map((item) => {
          const Icon = item.icon;
          const isActive = activeCalc === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveCalc(item.id)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                  : 'bg-[#0F172A] text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Painel de Orientação da Calculadora Selecionada: O que faz + Dados Necessários + Atalhos */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#0B1221] border border-slate-800/90 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Para que serve esta calculadora
            </span>
            <p className="text-xs sm:text-sm text-slate-200 font-medium leading-relaxed">
              {currentMeta.purpose}
            </p>
          </div>

          {/* Botões de Preenchimento Rápido com 1 Clique */}
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {['bazin', 'pvp', 'preco_medio', 'gordon'].includes(activeCalc) ? (
              <>
                <span className="text-[11px] text-slate-400 mr-1 flex items-center gap-1">
                  <Wand2 className="w-3.5 h-3.5 text-emerald-400" />
                  Preencher com FII:
                </span>
                {quickTickers.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleApplyQuickPreset(t)}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-emerald-600/20 text-slate-300 hover:text-emerald-300 border border-slate-700 hover:border-emerald-500/40 text-xs font-mono font-bold transition-colors"
                  >
                    {t}
                  </button>
                ))}
              </>
            ) : (
              <button
                type="button"
                onClick={() => handleApplyQuickPreset()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-colors"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Preencher com Dados da Minha Carteira</span>
              </button>
            )}
          </div>
        </div>

        {presetFeedback && (
          <div className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>{presetFeedback}</span>
          </div>
        )}

        {/* Lista clara dos dados necessários */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
          <strong className="text-slate-300">O que você precisa preencher:</strong>
          {currentMeta.requiredInputsSummary.map((req, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              <span className="w-4 h-4 rounded-full bg-slate-800 text-emerald-400 font-mono text-[10px] font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <span>{req}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Corpo da Calculadora Selecionada */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LADO ESQUERDO: Entradas de Dados Passo a Passo (5 Colunas) */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-4 shadow-lg">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white">{currentMeta.shortTitle}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Preencha os campos abaixo na ordem numerada. O resultado atualiza automaticamente.
            </p>
          </div>

          {/* FORMULÁRIO 1: Calculadora Sardinha */}
          {activeCalc === 'sardinha' && (
            <div className="space-y-3.5 text-xs">
              <div>
                <label
                  htmlFor={sardinhaInitialId}
                  className="text-slate-200 font-semibold flex items-center justify-between mb-1"
                >
                  <span>1. Patrimônio Inicial já Investido (R$)</span>
                  <InfoTooltip
                    title="Patrimônio Inicial"
                    description="Quanto você já tem investido hoje para começar a simulação. Se estiver começando do zero, pode digitar 0."
                    example="R$ 32.000,00 (valor atual da sua carteira)."
                  />
                </label>
                <input
                  id={sardinhaInitialId}
                  type="number"
                  min="0"
                  step="500"
                  value={sardinhaInitial}
                  onChange={(e) => setSardinhaInitial(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  Ex: R$ 5.000 ou o valor atual da sua carteira ({formatBRL(totalMarketValue)}).
                </span>
              </div>

              <div>
                <label
                  htmlFor={sardinhaContributionId}
                  className="text-slate-200 font-semibold flex items-center justify-between mb-1"
                >
                  <span>2. Aporte Mensal do Seu Bolso (R$/mês)</span>
                  <InfoTooltip
                    title="Aporte Mensal"
                    description="Quanto dinheiro novo você pretende investir todos os meses além de reinvestir os dividendos."
                    example="R$ 500,00 ou R$ 1.000,00 por mês."
                  />
                </label>
                <input
                  id={sardinhaContributionId}
                  type="number"
                  min="0"
                  step="100"
                  value={sardinhaContribution}
                  onChange={(e) => setSardinhaContribution(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>

              <div>
                <label
                  htmlFor={sardinhaAnnualRateId}
                  className="text-slate-200 font-semibold flex items-center justify-between mb-1"
                >
                  <span>3. Dividend Yield Médio Anual (% ao ano)</span>
                  <InfoTooltip
                    title="Taxa de Rendimento (% a.a.)"
                    description="Percentual médio de dividendos que sua carteira paga por ano. Em FIIs, a média histórica costuma ficar entre 9% e 11% ao ano."
                    example="10,5% ao ano (equivale a cerca de 0,83% ao mês isento de IR)."
                  />
                </label>
                <input
                  id={sardinhaAnnualRateId}
                  type="number"
                  min="1"
                  step="0.5"
                  value={sardinhaAnnualRate}
                  onChange={(e) => setSardinhaAnnualRate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>

              {/* Prazo da Projeção Flexível */}
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-slate-200 font-semibold">4. Prazo da Simulação</span>
                  <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    Total: {sardinhaTotalMonths} {sardinhaTotalMonths === 1 ? 'mês' : 'meses'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950/70 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleTimeModeChange('ano_mes')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                      sardinhaTimeMode === 'ano_mes'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Ano e Mês
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTimeModeChange('anos')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                      sardinhaTimeMode === 'anos'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Apenas Anos
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTimeModeChange('meses')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                      sardinhaTimeMode === 'meses'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Apenas Meses
                  </button>
                </div>

                {sardinhaTimeMode === 'ano_mes' && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between gap-1.5">
                        <div className="flex flex-col">
                          <label
                            htmlFor={sardinhaYearsId}
                            className="text-[10px] uppercase font-bold tracking-wider text-slate-400"
                          >
                            Anos
                          </label>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {(parseInt(sardinhaYears, 10) || 0) * 12}m
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setSardinhaYears(
                                String(Math.max(0, (parseInt(sardinhaYears, 10) || 0) - 1))
                              )
                            }
                            className="w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
                            aria-label="Diminuir ano"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <div className="flex items-center gap-1 px-1.5 py-1 bg-slate-950 border border-slate-700 rounded-lg">
                            <input
                              id={sardinhaYearsId}
                              type="number"
                              min="0"
                              max="60"
                              value={sardinhaYears}
                              onChange={(e) => setSardinhaYears(e.target.value)}
                              className="w-10 bg-transparent text-white font-mono text-center font-bold text-sm focus:outline-none"
                            />
                            <span className="text-[11px] font-bold text-emerald-400 select-none">
                              {parseInt(sardinhaYears, 10) === 1 ? 'Ano' : 'Anos'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setSardinhaYears(String((parseInt(sardinhaYears, 10) || 0) + 1))
                            }
                            className="w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
                            aria-label="Aumentar ano"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between gap-1.5">
                        <div className="flex flex-col">
                          <label
                            htmlFor={sardinhaExtraMonthsId}
                            className="text-[10px] uppercase font-bold tracking-wider text-slate-400"
                          >
                            Meses
                          </label>
                          <span className="text-[10px] text-slate-500 font-mono">0 a 11</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setSardinhaExtraMonths(
                                String(Math.max(0, (parseInt(sardinhaExtraMonths, 10) || 0) - 1))
                              )
                            }
                            className="w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
                            aria-label="Diminuir mês adicional"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <div className="flex items-center gap-1 px-1.5 py-1 bg-slate-950 border border-slate-700 rounded-lg">
                            <input
                              id={sardinhaExtraMonthsId}
                              type="number"
                              min="0"
                              max="11"
                              value={sardinhaExtraMonths}
                              onChange={(e) => setSardinhaExtraMonths(e.target.value)}
                              className="w-10 bg-transparent text-white font-mono text-center font-bold text-sm focus:outline-none"
                            />
                            <span className="text-[11px] font-bold text-emerald-400 select-none">
                              {parseInt(sardinhaExtraMonths, 10) === 1 ? 'Mês' : 'Meses'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setSardinhaExtraMonths(
                                String(Math.min(11, (parseInt(sardinhaExtraMonths, 10) || 0) + 1))
                              )
                            }
                            className="w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
                            aria-label="Aumentar mês adicional"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                      {[
                        { y: '1', m: '0', label: '1 ano' },
                        { y: '2', m: '0', label: '2 anos' },
                        { y: '3', m: '0', label: '3 anos' },
                        { y: '5', m: '0', label: '5 anos' },
                        { y: '10', m: '0', label: '10 anos' },
                        { y: '15', m: '0', label: '15 anos' },
                        { y: '20', m: '0', label: '20 anos' },
                        { y: '30', m: '0', label: '30 anos' },
                      ].map((preset, idx) => {
                        const isSel =
                          sardinhaYears === preset.y && sardinhaExtraMonths === preset.m;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setSardinhaYears(preset.y);
                              setSardinhaExtraMonths(preset.m);
                            }}
                            className={`py-1 rounded-lg font-mono text-[11px] font-medium transition-colors ${
                              isSel
                                ? 'bg-emerald-600 text-white font-bold'
                                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {sardinhaTimeMode === 'anos' && (
                  <div className="space-y-2">
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
                      <label htmlFor={sardinhaYearsId} className="text-xs font-semibold text-slate-300">
                        Quantidade de Anos ({sardinhaTotalMonths} meses)
                      </label>
                      <input
                        id={sardinhaYearsId}
                        type="number"
                        min="1"
                        max="60"
                        value={sardinhaYears}
                        onChange={(e) => setSardinhaYears(e.target.value)}
                        className="w-20 px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-center font-bold text-sm"
                      />
                    </div>
                  </div>
                )}

                {sardinhaTimeMode === 'meses' && (
                  <div className="space-y-2">
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
                      <label htmlFor={sardinhaMonthsOnlyId} className="text-xs font-semibold text-slate-300">
                        Quantidade de Meses
                      </label>
                      <input
                        id={sardinhaMonthsOnlyId}
                        type="number"
                        min="1"
                        max="720"
                        value={sardinhaMonthsOnly}
                        onChange={(e) => setSardinhaMonthsOnly(e.target.value)}
                        className="w-24 px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-center font-bold text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* FORMULÁRIO 2: Preço Teto Bazin */}
          {activeCalc === 'bazin' && (
            <div className="space-y-3.5 text-xs">
              <div>
                <label
                  htmlFor={bazinAnnualDivId}
                  className="text-slate-200 font-semibold flex items-center justify-between mb-1"
                >
                  <span>1. Dividendo Anual por Cota (R$/ano)</span>
                  <InfoTooltip
                    title="Dividendo Anual por Cota"
                    description="Soma dos proventos pagos por 1 única cota nos últimos 12 meses (ou multiplique o rendimento mensal médio por 12)."
                    example="Se o fundo paga R$ 1,10 por mês, em 12 meses ele paga R$ 13,20."
                  />
                </label>
                <input
                  id={bazinAnnualDivId}
                  type="number"
                  step="0.05"
                  value={bazinAnnualDiv}
                  onChange={(e) => setBazinAnnualDiv(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Dica: Multiplique o dividendo mensal por 12 (ex: R$ 1,10 × 12 = R$ 13,20).
                </span>
              </div>

              <div>
                <label
                  htmlFor={bazinRequiredYieldId}
                  className="text-slate-200 font-semibold flex items-center justify-between mb-1"
                >
                  <span>2. Retorno Mínimo que Você Exige (% ao ano)</span>
                  <InfoTooltip
                    title="Taxa Mínima Exigida"
                    description="Qual é o Dividend Yield anual mínimo que faz valer a pena comprar este fundo?"
                    example="Para FIIs de Tijolo costuma-se exigir 8% a 9% a.a.; para FIIs de Papel, 10% a 11% a.a."
                  />
                </label>
                <input
                  id={bazinRequiredYieldId}
                  type="number"
                  step="0.5"
                  value={bazinRequiredYield}
                  onChange={(e) => setBazinRequiredYield(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>

              <div>
                <label
                  htmlFor={bazinCurrentPriceId}
                  className="text-slate-200 font-semibold flex items-center justify-between mb-1"
                >
                  <span>3. Cotação Atual do FII na Bolsa (R$)</span>
                  <InfoTooltip
                    title="Cotação Atual"
                    description="Preço pelo qual a cota está sendo negociada hoje na B3. Serve para comparar se o preço atual está abaixo ou acima do seu Preço-Teto."
                  />
                </label>
                <input
                  id={bazinCurrentPriceId}
                  type="number"
                  step="0.10"
                  value={bazinCurrentPrice}
                  onChange={(e) => setBazinCurrentPrice(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>
            </div>
          )}

          {/* FORMULÁRIO 3: P/VP e Ágio/Desconto */}
          {activeCalc === 'pvp' && (
            <div className="space-y-3.5 text-xs">
              <div>
                <label
                  htmlFor={pvpPriceId}
                  className="text-slate-200 font-semibold flex items-center justify-between mb-1"
                >
                  <span>1. Cotação Atual na Bolsa (R$)</span>
                  <InfoTooltip
                    title="Cotação Atual de Mercado"
                    description="Preço que você paga hoje para comprar 1 cota na corretora."
                  />
                </label>
                <input
                  id={pvpPriceId}
                  type="number"
                  step="0.10"
                  value={pvpPrice}
                  onChange={(e) => setPvpPrice(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>
              <div>
                <label
                  htmlFor={pvpVPAId}
                  className="text-slate-200 font-semibold flex items-center justify-between mb-1"
                >
                  <span>2. Valor Patrimonial por Cota — VPA (R$)</span>
                  <InfoTooltip
                    title="O que é o VPA?"
                    description="É quanto vale o patrimônio real do fundo (imóveis, galpões, shoppings e caixa) dividido pelo número de cotas."
                    example="Se o VPA é R$ 155,10 e a cota custa R$ 150,00, você está comprando imóveis com desconto!"
                  />
                </label>
                <input
                  id={pvpVPAId}
                  type="number"
                  step="0.10"
                  value={pvpVPA}
                  onChange={(e) => setPvpVPA(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>
            </div>
          )}

          {/* FORMULÁRIO 4: Preço Médio Ponderado */}
          {activeCalc === 'preco_medio' && (
            <div className="space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2.5">
                <span className="text-[11px] font-bold uppercase text-slate-400 block">
                  Passo A: Sua Posição Atual Antes da Compra
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label htmlFor={pmCurrentQtyId} className="text-slate-300 font-medium block mb-1">
                      1. Cotas Atuais
                    </label>
                    <input
                      id={pmCurrentQtyId}
                      type="number"
                      value={pmCurrentQty}
                      onChange={(e) => setPmCurrentQty(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                    />
                  </div>
                  <div>
                    <label htmlFor={pmCurrentAvgId} className="text-slate-300 font-medium block mb-1">
                      2. Preço Médio Atual (R$)
                    </label>
                    <input
                      id={pmCurrentAvgId}
                      type="number"
                      step="0.01"
                      value={pmCurrentAvg}
                      onChange={(e) => setPmCurrentAvg(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2.5">
                <span className="text-[11px] font-bold uppercase text-emerald-400 block">
                  Passo B: Dados da Nova Compra
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label htmlFor={pmNewQtyId} className="text-slate-300 font-medium block mb-1">
                      3. Novas Cotas
                    </label>
                    <input
                      id={pmNewQtyId}
                      type="number"
                      value={pmNewQty}
                      onChange={(e) => setPmNewQty(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                    />
                  </div>
                  <div>
                    <label htmlFor={pmNewPriceId} className="text-slate-300 font-medium block mb-1">
                      4. Preço Pago (R$)
                    </label>
                    <input
                      id={pmNewPriceId}
                      type="number"
                      step="0.01"
                      value={pmNewPrice}
                      onChange={(e) => setPmNewPrice(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                    />
                  </div>
                  <div>
                    <label htmlFor={pmFeesId} className="text-slate-300 font-medium block mb-1">
                      5. Taxas B3 (R$)
                    </label>
                    <input
                      id={pmFeesId}
                      type="number"
                      step="0.01"
                      value={pmFees}
                      onChange={(e) => setPmFees(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FORMULÁRIO 5: Renda Passiva */}
          {activeCalc === 'renda_passiva' && (
            <div className="space-y-3.5 text-xs">
              <div>
                <label
                  htmlFor={targetIncomeId}
                  className="text-slate-200 font-semibold flex items-center justify-between mb-1"
                >
                  <span>1. Renda Mensal que Você Quer Receber (R$/mês)</span>
                  <InfoTooltip
                    title="Meta de Renda Mensal"
                    description="Quanto você gostaria que caísse na sua conta todos os meses em dividendos isentos de Imposto de Renda."
                  />
                </label>
                <input
                  id={targetIncomeId}
                  type="number"
                  step="500"
                  value={targetIncome}
                  onChange={(e) => setTargetIncome(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>
              <div>
                <label
                  htmlFor={expectedDYId}
                  className="text-slate-200 font-semibold flex items-center justify-between mb-1"
                >
                  <span>2. Dividend Yield Anual Médio da Carteira (% a.a.)</span>
                  <InfoTooltip
                    title="Dividend Yield Esperado"
                    description="Rendimento percentual anual médio pago pelos seus FIIs. Uma carteira equilibrada entre Tijolo e Papel costuma pagar entre 9% e 10,5% ao ano."
                  />
                </label>
                <input
                  id={expectedDYId}
                  type="number"
                  step="0.5"
                  value={expectedDY}
                  onChange={(e) => setExpectedDY(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>
            </div>
          )}

          {/* FORMULÁRIO 6: FIRE */}
          {activeCalc === 'fire' && (
            <div className="space-y-3.5 text-xs">
              <div>
                <label
                  htmlFor={fireExpensesId}
                  className="text-slate-200 font-semibold flex items-center justify-between mb-1"
                >
                  <span>1. Seu Custo de Vida Mensal (R$/mês)</span>
                  <InfoTooltip
                    title="Custo de Vida Mensal"
                    description="Soma das suas despesas mensais (moradia, alimentação, saúde, lazer) que você deseja cobrir com os dividendos dos seus FIIs."
                  />
                </label>
                <input
                  id={fireExpensesId}
                  type="number"
                  step="500"
                  value={fireExpenses}
                  onChange={(e) => setFireExpenses(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>
              <div>
                <label
                  htmlFor={fireYieldId}
                  className="text-slate-200 font-semibold flex items-center justify-between mb-1"
                >
                  <span>2. DY Anual Seguro para Retirada (% a.a.)</span>
                  <InfoTooltip
                    title="Taxa Segura de Retirada"
                    description="Percentual anual de dividendos que você pode gastar mantendo o poder de compra do seu patrimônio protegido da inflação."
                    example="Entre 8% e 9,5% ao ano é considerado prudente para carteiras diversificadas."
                  />
                </label>
                <input
                  id={fireYieldId}
                  type="number"
                  step="0.5"
                  value={fireYield}
                  onChange={(e) => setFireYield(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>
              <div>
                <label
                  htmlFor={fireCurrentEquitId}
                  className="text-slate-200 font-semibold flex items-center justify-between mb-1"
                >
                  <span>3. Seu Patrimônio Atual em FIIs (R$)</span>
                  <InfoTooltip
                    title="Patrimônio Atual"
                    description="Valor atual da sua carteira de FIIs para calcular quantos % do caminho até a Independência Financeira você já percorreu."
                  />
                </label>
                <input
                  id={fireCurrentEquitId}
                  type="number"
                  step="1000"
                  value={fireCurrentEquit}
                  onChange={(e) => setFireCurrentEquit(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>
            </div>
          )}

          {/* FORMULÁRIO 7: Modelo de Gordon */}
          {activeCalc === 'gordon' && (
            <div className="space-y-3.5 text-xs">
              <div>
                <label
                  htmlFor={gordonNextDivId}
                  className="text-slate-200 font-semibold flex items-center justify-between mb-1"
                >
                  <span>1. Próximo Dividendo Anual por Cota — D1 (R$)</span>
                  <InfoTooltip
                    title="Dividendo Anual Projetado (D1)"
                    description="Soma dos dividendos esperados para 1 cota nos próximos 12 meses."
                  />
                </label>
                <input
                  id={gordonNextDivId}
                  type="number"
                  step="0.10"
                  value={gordonNextDiv}
                  onChange={(e) => setGordonNextDiv(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>

              <div>
                <label
                  htmlFor={gordonDiscountRateId}
                  className="text-slate-200 font-semibold flex items-center justify-between mb-1"
                >
                  <span>2. Taxa de Retorno Exigida — k (% a.a.)</span>
                  <InfoTooltip
                    title="Taxa de Desconto (k)"
                    description="Retorno total anual que você exige para investir no fundo (soma do prêmio de risco + juros reais)."
                    example="11% ao ano."
                  />
                </label>
                <input
                  id={gordonDiscountRateId}
                  type="number"
                  step="0.5"
                  value={gordonDiscountRate}
                  onChange={(e) => setGordonDiscountRate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>

              <div>
                <label
                  htmlFor={gordonGrowthRateId}
                  className="text-slate-200 font-semibold flex items-center justify-between mb-1"
                >
                  <span>3. Crescimento Anual dos Aluguéis — g (% a.a.)</span>
                  <InfoTooltip
                    title="Taxa de Crescimento (g)"
                    description="Quanto você espera que os aluguéis do fundo cresçam por ano no longo prazo (sempre menor que a taxa k)."
                    example="2,5% a 3,5% ao ano."
                  />
                </label>
                <input
                  id={gordonGrowthRateId}
                  type="number"
                  step="0.5"
                  value={gordonGrowthRate}
                  onChange={(e) => setGordonGrowthRate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* LADO DIREITO: Resultado Principal em Destaque & Interpretação Prática (7 Colunas) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-5 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Resultado Principal & Diagnóstico Prático
              </span>
              <span className="text-[11px] text-slate-400 font-mono">Cálculo instantâneo</span>
            </div>

            {/* RESULTADO 1: SARDINHA */}
            {activeCalc === 'sardinha' && (
              <div className="space-y-4">
                {/* Destaque Principal */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-900 border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold uppercase text-emerald-300 block">
                      Patrimônio Acumulado ao Final do Prazo
                    </span>
                    <strong className="text-2xl sm:text-3xl font-extrabold text-white font-mono block mt-1 tabular-nums">
                      {formatBRL(sardinhaRes.finalPortfolio)}
                    </strong>
                    <span className="text-xs text-slate-300 mt-1 block">
                      Em {Math.floor(sardinhaTotalMonths / 12)} ano(s)
                      {sardinhaTotalMonths % 12 > 0 ? ` e ${sardinhaTotalMonths % 12} mês(es)` : ''} (
                      {sardinhaTotalMonths} meses)
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-emerald-500/30 text-left sm:text-right">
                    <span className="text-[11px] text-slate-400 uppercase font-semibold block">
                      Renda Mensal Passiva no Fim
                    </span>
                    <strong className="text-xl font-extrabold text-emerald-400 font-mono tabular-nums">
                      {formatBRL(
                        sardinhaRes.timeline[sardinhaRes.timeline.length - 1]?.monthlyYield || 0
                      )}
                      /mês
                    </strong>
                  </div>
                </div>

                {/* Detalhamento Secundário */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[11px] text-slate-400">Total Tirado do Seu Bolso</span>
                    <strong className="text-lg font-bold text-slate-200 font-mono block mt-0.5 tabular-nums">
                      {formatBRL(sardinhaRes.totalContributed)}
                    </strong>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[11px] text-slate-400">
                      Ganho Só com Dividendos Reinvestidos
                    </span>
                    <strong className="text-lg font-bold text-emerald-400 font-mono block mt-0.5 tabular-nums">
                      +{formatBRL(sardinhaRes.totalYieldEarned)}
                    </strong>
                  </div>
                </div>

                {/* Barra de Proporção */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>
                      Do seu bolso:{' '}
                      {((sardinhaRes.totalContributed / sardinhaRes.finalPortfolio) * 100).toFixed(1)}%
                    </span>
                    <span className="text-emerald-400 font-semibold">
                      Juros Compostos (Bola de Neve):{' '}
                      {((sardinhaRes.totalYieldEarned / sardinhaRes.finalPortfolio) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex">
                    <div
                      className="bg-blue-500 h-full"
                      style={{
                        width: `${(sardinhaRes.totalContributed / sardinhaRes.finalPortfolio) * 100}%`,
                      }}
                    />
                    <div
                      className="bg-emerald-500 h-full"
                      style={{
                        width: `${(sardinhaRes.totalYieldEarned / sardinhaRes.finalPortfolio) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Tabela de Evolução */}
                <div className="pt-2">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-emerald-400" />
                      Tabela de Evolução Passo a Passo
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setSardinhaViewMode('yearly')}
                          className={`px-2 py-0.5 rounded-md font-medium ${
                            sardinhaViewMode === 'yearly'
                              ? 'bg-emerald-600 text-white'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Por Ano
                        </button>
                        <button
                          type="button"
                          onClick={() => setSardinhaViewMode('monthly')}
                          className={`px-2 py-0.5 rounded-md font-medium ${
                            sardinhaViewMode === 'monthly'
                              ? 'bg-emerald-600 text-white'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Mês a Mês
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowSardinhaTable(!showSardinhaTable)}
                        className="text-[11px] text-slate-400 hover:text-white underline"
                      >
                        {showSardinhaTable ? 'Ocultar' : 'Mostrar'}
                      </button>
                    </div>
                  </div>

                  {showSardinhaTable && (
                    <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-slate-800/80">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-slate-900 text-[10px] uppercase font-semibold text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="py-2 px-3">Período</th>
                            <th className="py-2 px-3 text-right">Tirado do Bolso</th>
                            <th className="py-2 px-3 text-right">Aluguel no Mês</th>
                            <th className="py-2 px-3 text-right">Patrimônio Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                          {sardinhaRes.timeline
                            .filter((row) =>
                              sardinhaViewMode === 'monthly'
                                ? true
                                : row.month % 12 === 0 || row.month === sardinhaTotalMonths
                            )
                            .map((row) => {
                              const isLast = row.month === sardinhaTotalMonths;
                              const isYearMark = row.month % 12 === 0;
                              return (
                                <tr
                                  key={row.month}
                                  className={isLast ? 'bg-emerald-500/10 font-bold' : ''}
                                >
                                  <td className="py-1.5 px-3 text-slate-300">
                                    {isYearMark
                                      ? `Ano ${row.month / 12} (${row.month}m)`
                                      : `Mês ${row.month}`}
                                  </td>
                                  <td className="py-1.5 px-3 text-right text-slate-400">
                                    {formatBRL(row.totalContributed)}
                                  </td>
                                  <td className="py-1.5 px-3 text-right text-emerald-400">
                                    +{formatBRL(row.monthlyYield)}
                                  </td>
                                  <td className="py-1.5 px-3 text-right text-white font-semibold">
                                    {formatBRL(row.totalPortfolio)}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* RESULTADO 2: BAZIN */}
            {activeCalc === 'bazin' && bazinRes && (
              <div className="space-y-4">
                <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-900 border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold uppercase text-emerald-300 block">
                      Preço-Teto Máximo de Compra (Bazin)
                    </span>
                    <strong className="text-3xl font-extrabold text-emerald-400 font-mono block mt-1 tabular-nums">
                      {formatBRL(bazinRes.ceilingPrice)}
                    </strong>
                    <span className="text-xs text-slate-300 mt-1 block">
                      Para garantir pelo menos {bazinRequiredYield}% ao ano de dividendos
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-left sm:text-right">
                    <span className="text-[11px] text-slate-400 uppercase font-semibold block">
                      Margem de Segurança vs. Cotação ({formatBRL(bazinRes.currentPrice)})
                    </span>
                    <strong
                      className={`text-xl font-extrabold font-mono tabular-nums ${
                        bazinRes.safetyMargin >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {formatPercent(bazinRes.safetyMargin, true)}
                    </strong>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                  <strong className="text-white block mb-1">Como interpretar este resultado:</strong>
                  {bazinRes.safetyMargin >= 0 ? (
                    <span>
                      A cotação atual (<strong className="text-white">{formatBRL(bazinRes.currentPrice)}</strong>) está{' '}
                      <strong className="text-emerald-400">abaixo do seu Preço-Teto</strong> de{' '}
                      {formatBRL(bazinRes.ceilingPrice)}. Isso significa que comprando hoje você recebe um rendimento anual acima da sua meta de {bazinRequiredYield}% a.a.
                    </span>
                  ) : (
                    <span>
                      A cotação atual (<strong className="text-white">{formatBRL(bazinRes.currentPrice)}</strong>) está{' '}
                      <strong className="text-rose-400">acima do seu Preço-Teto</strong> de{' '}
                      {formatBRL(bazinRes.ceilingPrice)}. Comprar nesse preço pagará menos do que os {bazinRequiredYield}% a.a. que você exigiu. Você pode cadastrar um alerta de Preço-Teto na aba Alertas!
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* RESULTADO 3: P/VP */}
            {activeCalc === 'pvp' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-5 rounded-2xl bg-slate-900 border border-emerald-500/30">
                    <span className="text-xs text-slate-400 uppercase font-bold">
                      Indicador P/VP Calculado
                    </span>
                    <strong
                      className={`text-3xl font-extrabold font-mono block mt-1 tabular-nums ${
                        pvpRes.pvp <= 1.0 ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {pvpRes.pvp.toFixed(2)}
                    </strong>
                    <span className="text-xs text-slate-400 mt-1 block">
                      1,00 = Preço exatamente igual ao valor patrimonial
                    </span>
                  </div>

                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                    <span className="text-xs text-slate-400 uppercase font-bold">
                      Situação da Cota Hoje
                    </span>
                    <strong
                      className={`text-2xl font-extrabold font-mono block mt-1 tabular-nums ${
                        pvpRes.discountOrPremiumPercent <= 0 ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {pvpRes.discountOrPremiumPercent < 0
                        ? `${Math.abs(pvpRes.discountOrPremiumPercent)}% de Desconto`
                        : pvpRes.discountOrPremiumPercent === 0
                        ? 'No Valor Justo (Par)'
                        : `${pvpRes.discountOrPremiumPercent}% de Ágio (Mais Caro)`}
                    </strong>
                    <span className="text-xs text-slate-400 mt-1 block">
                      Diferença por cota: {formatBRL(parseFloat(pvpPrice) - parseFloat(pvpVPA), false, true)}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                  <strong className="text-white block mb-1">Como interpretar este resultado:</strong>
                  {pvpRes.pvp < 1.0 ? (
                    <span>
                      Com P/VP de <strong className="text-emerald-400">{pvpRes.pvp.toFixed(2)}</strong>, você está pagando{' '}
                      <strong className="text-white">{formatBRL(parseFloat(pvpPrice) || 0)}</strong> por uma fração de imóveis/ativos avaliada em{' '}
                      <strong className="text-white">{formatBRL(parseFloat(pvpVPA) || 0)}</strong>. É uma compra com desconto patrimonial.
                    </span>
                  ) : (
                    <span>
                      Com P/VP de <strong className="text-amber-400">{pvpRes.pvp.toFixed(2)}</strong>, o mercado está cobrando um prêmio acima do valor contábil dos imóveis. Verifique se a qualidade dos contratos justifica esse ágio.
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* RESULTADO 4: PREÇO MÉDIO */}
            {activeCalc === 'preco_medio' && pmRes && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/60 to-slate-900 border border-emerald-500/40">
                    <span className="text-[11px] text-emerald-300 uppercase font-bold">
                      Seu Novo Preço Médio
                    </span>
                    <strong className="text-2xl font-extrabold text-white font-mono block mt-1 tabular-nums">
                      {formatBRL(pmRes.newAveragePrice)}
                    </strong>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Antes: {formatBRL(parseFloat(pmCurrentAvg) || 0)}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                    <span className="text-[11px] text-slate-400 uppercase font-bold">
                      Nova Quantidade Total
                    </span>
                    <strong className="text-2xl font-extrabold text-emerald-400 font-mono block mt-1 tabular-nums">
                      {pmRes.newQuantity} cotas
                    </strong>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      +{pmNewQty} novas cotas adicionadas
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                    <span className="text-[11px] text-slate-400 uppercase font-bold">
                      Custo Total Acumulado
                    </span>
                    <strong className="text-xl font-bold text-slate-200 font-mono block mt-1 tabular-nums">
                      {formatBRL(pmRes.totalCost)}
                    </strong>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Inclui taxas informadas
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                  <strong className="text-white block mb-1">Como interpretar este resultado:</strong>
                  O Preço Médio é usado para calcular seu lucro ou prejuízo e para declarar seus FIIs no Imposto de Renda anual. Comprando abaixo do seu preço médio atual, você reduz seu custo por cota!
                </div>
              </div>
            )}

            {/* RESULTADO 5: RENDA PASSIVA */}
            {activeCalc === 'renda_passiva' && incomeRes && (
              <div className="space-y-4">
                <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-900 border border-emerald-500/40">
                  <span className="text-xs font-bold uppercase text-emerald-300 block">
                    Patrimônio Necessário para Ganhar {formatBRL(parseFloat(targetIncome) || 0)}/mês
                  </span>
                  <strong className="text-3xl font-extrabold text-white font-mono block mt-1 tabular-nums">
                    {formatBRL(incomeRes.requiredEquity)}
                  </strong>
                  <span className="text-xs text-slate-300 mt-1 block">
                    Gerando {formatBRL(incomeRes.annualTarget)} por ano isentos de IR (com DY de{' '}
                    {expectedDY}% a.a.)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[11px] text-slate-400 uppercase font-semibold">
                      Seu Patrimônio Atual na Carteira
                    </span>
                    <strong className="text-lg font-bold text-emerald-400 font-mono block mt-0.5 tabular-nums">
                      {formatBRL(totalMarketValue)}
                    </strong>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[11px] text-slate-400 uppercase font-semibold">
                      Quanto Falta Acumular
                    </span>
                    <strong className="text-lg font-bold text-slate-200 font-mono block mt-0.5 tabular-nums">
                      {formatBRL(incomeRes.missingEquity)}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* RESULTADO 6: FIRE */}
            {activeCalc === 'fire' && fireRes && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-5 rounded-2xl bg-slate-900 border border-amber-500/40">
                    <span className="text-xs text-amber-300 uppercase font-bold">
                      Patrimônio da Liberdade Financeira (FIRE)
                    </span>
                    <strong className="text-2xl sm:text-3xl font-extrabold text-white font-mono block mt-1 tabular-nums">
                      {formatBRL(fireRes.requiredEquity)}
                    </strong>
                    <span className="text-xs text-slate-400 mt-1 block">
                      Para pagar {formatBRL(parseFloat(fireExpenses) || 0)}/mês de custo de vida
                    </span>
                  </div>

                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                    <span className="text-xs text-slate-400 uppercase font-bold">
                      Cobertura Atual das Suas Despesas
                    </span>
                    <strong className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono block mt-1 tabular-nums">
                      {formatPercent(fireRes.equityProgressPercent, false)}
                    </strong>
                    <span className="text-xs text-slate-400 mt-1 block">
                      Faltam {formatBRL(fireRes.monthlyShortfall)}/mês em proventos
                    </span>
                  </div>
                </div>

                <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full transition-all"
                    style={{ width: `${fireRes.equityProgressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* RESULTADO 7: GORDON */}
            {activeCalc === 'gordon' && gordonRes && (
              <div className="space-y-4">
                {gordonRes.isValid ? (
                  <>
                    <div className="p-5 rounded-2xl bg-slate-900 border border-emerald-500/40">
                      <span className="text-xs text-emerald-300 uppercase font-bold">
                        Preço Justo Estimado pelo Modelo de Gordon (P0)
                      </span>
                      <strong className="text-3xl font-extrabold text-emerald-400 font-mono block mt-1 tabular-nums">
                        {formatBRL(gordonRes.intrinsicValue)}
                      </strong>
                      <span className="text-xs text-slate-400 mt-1 block font-mono">
                        Fórmula: P0 = R$ {gordonNextDiv} ÷ ({gordonDiscountRate}% - {gordonGrowthRate}%)
                      </span>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                      <strong className="text-white block mb-1">Como interpretar este resultado:</strong>
                      Se a cotação na Bolsa estiver menor que <strong className="text-emerald-400">{formatBRL(gordonRes.intrinsicValue)}</strong>, o fundo oferece uma margem de segurança atrativa para as premissas de retorno ({gordonDiscountRate}%) e crescimento ({gordonGrowthRate}%) escolhidas.
                    </div>
                  </>
                ) : (
                  <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>{gordonRes.message}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Painel Expansível: Fórmulas e Limitações */}
          <div className="p-4 rounded-xl bg-[#0F172A] border border-slate-800">
            <button
              onClick={() => setShowHowToUse(!showHowToUse)}
              className="w-full flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-white"
            >
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-emerald-400" />
                <span>Dica de Ouro para Iniciantes & Boas Práticas</span>
              </div>
              {showHowToUse ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showHowToUse && (
              <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-400 space-y-2 leading-relaxed">
                <p>
                  <strong className="text-white">Onde encontro esses dados na prática?</strong> Na própria aba{' '}
                  <strong className="text-emerald-400">Explorar FIIs</strong> ou na sua{' '}
                  <strong className="text-emerald-400">Carteira</strong> você já tem a Cotação, o VPA, o P/VP e o DY Anual de cada fundo prontos para consulta — ou basta clicar nos botões de preenchimento rápido acima!
                </p>
                <p>
                  <strong className="text-white">Lembrete importante:</strong> Cálculos matemáticos ajudam a evitar pagar caro, mas nunca deixe de diversificar entre vários fundos e setores.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
