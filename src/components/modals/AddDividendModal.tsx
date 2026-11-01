import React, { useState, useEffect, useId, useMemo } from 'react';
import {
  X,
  Coins,
  Calendar,
  Check,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Sparkles,
  Edit3,
  HelpCircle,
} from 'lucide-react';
import { usePortfolio } from '../../context/PortfolioContext';
import { DividendStatus } from '../../types/fii';
import { VERIFIED_FII_DATABASE } from '../../data/fiiDatabase';
import { formatBRL, formatDateBR, parseFlexibleNumber } from '../../utils/formatters';

interface AddDividendModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTicker?: string;
  defaultQuantity?: number;
}

export const AddDividendModal: React.FC<AddDividendModalProps> = ({
  isOpen,
  onClose,
  defaultTicker = 'ALZR11',
  defaultQuantity,
}) => {
  const { holdings, addManualDividend } = usePortfolio();
  const tickerDatalistId = useId();

  // Etapas: 'preencher' (Etapa 1) | 'resumo' (Etapa 2 - Conferência antes de salvar)
  const [step, setStep] = useState<'preencher' | 'resumo'>('preencher');

  const [ticker, setTicker] = useState<string>('ALZR11');
  const [quantityEligible, setQuantityEligible] = useState<string>('80');
  const [ratePerShare, setRatePerShare] = useState<string>('0,084');
  const [dataCom, setDataCom] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [paymentDate, setPaymentDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toISOString().split('T')[0];
  });
  const [status, setStatus] = useState<DividendStatus>('PREVISTO');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    setStep('preencher');
    setErrorMsg(null);
    setSuccessMsg(null);

    const initialTicker = (defaultTicker || 'ALZR11').toUpperCase().trim();
    setTicker(initialTicker);

    const existingHolding = holdings.find((h) => h.ticker.toUpperCase() === initialTicker);
    const dbItem = VERIFIED_FII_DATABASE[initialTicker];

    if (defaultQuantity && defaultQuantity > 0) {
      setQuantityEligible(String(defaultQuantity));
    } else if (existingHolding && existingHolding.quantity > 0) {
      setQuantityEligible(String(existingHolding.quantity));
    } else if (initialTicker === 'ALZR11') {
      setQuantityEligible('80');
    } else {
      setQuantityEligible('50');
    }

    if (initialTicker === 'ALZR11') {
      setRatePerShare('0,084');
    } else if (existingHolding && existingHolding.monthlyYieldPerShare > 0) {
      setRatePerShare(
        existingHolding.monthlyYieldPerShare.toString().replace('.', ',')
      );
    } else if (dbItem && dbItem.lastDividend > 0) {
      setRatePerShare(dbItem.lastDividend.toString().replace('.', ','));
    } else {
      setRatePerShare('0,85');
    }
  }, [isOpen, defaultTicker, defaultQuantity, holdings]);

  const cleanTicker = ticker.toUpperCase().trim();
  const matchedHolding = useMemo(
    () => holdings.find((h) => h.ticker.toUpperCase() === cleanTicker),
    [holdings, cleanTicker]
  );
  const matchedDbInfo = VERIFIED_FII_DATABASE[cleanTicker];
  const fundDisplayName =
    matchedHolding?.name || matchedDbInfo?.name || (cleanTicker ? `${cleanTicker} — Fundo Imobiliário` : '');

  const parsedQty = Math.floor(parseFlexibleNumber(quantityEligible));
  const parsedRate = parseFlexibleNumber(ratePerShare);
  const calculatedTotal = useMemo(() => {
    if (parsedQty <= 0 || parsedRate <= 0) return 0;
    return Number((parsedQty * parsedRate).toFixed(2));
  }, [parsedQty, parsedRate]);

  // Alerta amigável caso o usuário pareça ter digitado o valor total no lugar do valor por cota
  const possibleTotalMistake = useMemo(() => {
    if (parsedQty <= 1 || parsedRate <= 0) return false;
    const refPrice = matchedHolding?.currentPrice || matchedDbInfo?.currentPrice || 100;
    // Um provento mensal de FII normalmente é ~0.5% a 1.5% da cota. Se for > 15% do preço da cota, avisa amigavelmente.
    return parsedRate > refPrice * 0.15 && parsedRate > 2.5;
  }, [parsedQty, parsedRate, matchedHolding, matchedDbInfo]);

  const handleSelectFund = (selectedTicker: string) => {
    const upper = selectedTicker.toUpperCase().trim();
    setTicker(upper);
    setErrorMsg(null);

    const h = holdings.find((item) => item.ticker.toUpperCase() === upper);
    const db = VERIFIED_FII_DATABASE[upper];

    if (h && h.quantity > 0) {
      setQuantityEligible(String(h.quantity));
    } else if (upper === 'ALZR11') {
      setQuantityEligible('80');
    }

    if (upper === 'ALZR11') {
      setRatePerShare('0,084');
    } else if (h && h.monthlyYieldPerShare > 0) {
      setRatePerShare(String(h.monthlyYieldPerShare).replace('.', ','));
    } else if (db && db.lastDividend > 0) {
      setRatePerShare(String(db.lastDividend).replace('.', ','));
    }
  };

  const handleFillAlzrExample = () => {
    setTicker('ALZR11');
    setQuantityEligible('80');
    setRatePerShare('0,084');
    setErrorMsg(null);
  };

  const validateFields = (): boolean => {
    if (!cleanTicker || cleanTicker.length < 4) {
      setErrorMsg('Informe o código do fundo imobiliário (ex.: ALZR11).');
      return false;
    }
    if (parsedQty <= 0) {
      setErrorMsg('Informe a quantidade de cotas que têm direito ao pagamento (ex.: 80).');
      return false;
    }
    if (parsedRate <= 0) {
      setErrorMsg('Informe o valor do provento pago por cada cota (ex.: 0,084).');
      return false;
    }
    if (!dataCom || !paymentDate) {
      setErrorMsg('Informe a Data-com e a Data de pagamento.');
      return false;
    }
    setErrorMsg(null);
    return true;
  };

  const handleAdvanceToSummary = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateFields()) return;
    setStep('resumo');
  };

  const handleConfirmAndSave = async () => {
    if (!validateFields()) return;
    setIsSaving(true);
    try {
      await addManualDividend({
        ticker: cleanTicker,
        dataCom,
        paymentDate,
        quantityEligible: parsedQty,
        ratePerShare: parsedRate,
        status,
      });

      setSuccessMsg(
        `Provento de ${cleanTicker} (${parsedQty} cotas × ${formatBRL(parsedRate)} = ${formatBRL(
          calculatedTotal
        )}) salvo com sucesso!`
      );
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 900);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  // Lista rápida: fundos da carteira + ALZR11 garantido
  const quickPortfolioTickers = Array.from(
    new Set(['ALZR11', ...holdings.map((h) => h.ticker.toUpperCase())])
  ).slice(0, 6);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs">
      <div className="w-full max-w-xl bg-[#0F172A] border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden max-h-[94vh] flex flex-col">
        {/* Cabeçalho com Indicador de Etapa */}
        <div className="px-5 py-3.5 border-b border-slate-800 bg-[#090D16] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">
                Registrar Dividendo / Provento
              </h2>
              <p className="text-[11px] text-slate-400">
                {step === 'preencher'
                  ? 'Passo 1 de 2 · Preencha quanto o fundo paga por cota'
                  : 'Passo 2 de 2 · Confira o resumo antes de salvar'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Fechar cadastro de provento"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Progresso Simples */}
        <div className="grid grid-cols-2 bg-[#0B111E] border-b border-slate-800 text-xs font-semibold shrink-0">
          <button
            type="button"
            onClick={() => setStep('preencher')}
            className={`py-2 px-4 text-center transition-colors cursor-pointer ${
              step === 'preencher'
                ? 'text-emerald-400 border-b-2 border-emerald-500 bg-emerald-500/5'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            1. Dados do Provento
          </button>
          <button
            type="button"
            onClick={() => {
              if (validateFields()) setStep('resumo');
            }}
            className={`py-2 px-4 text-center transition-colors cursor-pointer ${
              step === 'resumo'
                ? 'text-emerald-400 border-b-2 border-emerald-500 bg-emerald-500/5'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            2. Resumo e Confirmação
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-3 flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold">{successMsg}</span>
            </div>
          )}

          {step === 'preencher' ? (
            <form onSubmit={handleAdvanceToSummary} className="space-y-3">
              {/* Exemplo Didático Obrigatório: ALZR11 80 cotas x R$ 0,084 = R$ 6,72 */}
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Exemplo de preenchimento (valor por cota):
                  </span>
                  <button
                    type="button"
                    onClick={handleFillAlzrExample}
                    className="px-2.5 py-0.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    Usar exemplo ALZR11 (80 × R$ 0,084)
                  </button>
                </div>
                <p className="text-xs text-slate-200 leading-snug">
                  Se o usuário possui <strong className="text-white">80 cotas</strong> de{' '}
                  <strong className="text-white font-mono">ALZR11</strong> e o provento é de{' '}
                  <strong className="text-emerald-300 font-mono">R$ 0,084 por cota</strong>:{' '}
                  <strong className="text-white font-mono">80 × R$ 0,084 = R$ 6,72</strong>.
                </p>
                <p className="text-[11px] text-slate-400">
                  Você informa apenas <strong className="text-emerald-300">R$ 0,084</strong> (valor
                  de 1 cota) e <strong className="text-white">não R$ 6,72</strong>.
                </p>
              </div>

              {/* 1. FUNDO: ALZR11 */}
              <div className="space-y-1.5">
                <label
                  htmlFor="div-fund-input"
                  className="text-sm font-bold text-white block"
                >
                  1. Fundo: {cleanTicker || 'ALZR11'}
                </label>

                <div className="flex flex-wrap gap-1.5">
                  {quickPortfolioTickers.map((t) => {
                    const h = holdings.find((item) => item.ticker.toUpperCase() === t);
                    const isSelected = cleanTicker === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => handleSelectFund(t)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                        }`}
                      >
                        {t}
                        {h ? ` (${h.quantity} cotas)` : ''}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <div className="sm:col-span-5">
                    <input
                      id="div-fund-input"
                      type="text"
                      value={ticker}
                      onChange={(e) => handleSelectFund(e.target.value)}
                      placeholder="Ex.: ALZR11"
                      list={tickerDatalistId}
                      required
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-base font-bold uppercase focus:outline-hidden focus:border-emerald-500"
                    />
                    <datalist id={tickerDatalistId}>
                      {Object.keys(VERIFIED_FII_DATABASE).map((t) => (
                        <option key={t} value={t}>
                          {VERIFIED_FII_DATABASE[t].name}
                        </option>
                      ))}
                    </datalist>
                  </div>

                  {cleanTicker && (
                    <div className="sm:col-span-7 px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-xs flex items-center justify-between">
                      <strong className="text-white truncate">{fundDisplayName}</strong>
                      {matchedHolding && (
                        <span className="text-emerald-400 font-mono shrink-0 ml-2">
                          {matchedHolding.quantity} cotas
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 2. QUANTIDADE DE COTAS QUE TÊM DIREITO AO PAGAMENTO & 3. VALOR DO PROVENTO POR COTA */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Campo 2: Quantidade de cotas */}
                <div className="space-y-1">
                  <label
                    htmlFor="div-qty-input"
                    className="text-sm font-bold text-white block"
                  >
                    2. Quantidade de cotas que têm direito ao pagamento
                  </label>
                  <input
                    id="div-qty-input"
                    type="number"
                    min="1"
                    step="1"
                    value={quantityEligible}
                    onChange={(e) => setQuantityEligible(e.target.value)}
                    placeholder="Ex.: 80"
                    required
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-base font-bold tabular-nums focus:outline-hidden focus:border-emerald-500"
                  />
                  <p className="text-[11px] text-slate-400">
                    Quantas cotas de <strong className="text-slate-200">{cleanTicker || 'ALZR11'}</strong> você tinha na Data-com (ex.: 80 cotas).
                  </p>
                </div>

                {/* Campo 3: Valor do provento POR COTA */}
                <div className="space-y-1">
                  <label
                    htmlFor="div-rate-input"
                    className="text-sm font-bold text-emerald-400 block"
                  >
                    3. Valor do provento POR COTA
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm font-bold">
                      R$
                    </span>
                    <input
                      id="div-rate-input"
                      type="text"
                      inputMode="decimal"
                      value={ratePerShare}
                      onChange={(e) => setRatePerShare(e.target.value)}
                      placeholder="0,084"
                      required
                      className="w-full pl-10 pr-3.5 py-2 bg-slate-900 border-2 border-emerald-500/50 rounded-xl text-white font-mono text-base font-bold tabular-nums focus:outline-hidden focus:border-emerald-400"
                    />
                  </div>
                  <p className="text-[11px] text-emerald-300 font-medium leading-snug">
                    Informe quanto o fundo paga por cada cota. O total será calculado automaticamente.
                  </p>
                </div>
              </div>

              {possibleTotalMistake && (
                <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-xs text-amber-200 flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white">
                      Atenção: você digitou {formatBRL(parsedRate)} por cota.{' '}
                    </strong>
                    <span>
                      Se {formatBRL(parsedRate)} for o total das {parsedQty} cotas, o valor por cota correto é{' '}
                      <strong className="text-emerald-300 font-mono">
                        {formatBRL(parsedRate / parsedQty)}
                      </strong>
                      .
                    </span>
                  </div>
                </div>
              )}

              {/* 4. DATA-COM & 5. DATA DE PAGAMENTO & STATUS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="div-datacom-input"
                    className="text-xs font-bold text-white flex items-center gap-1"
                  >
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    <span>4. Data-com</span>
                  </label>
                  <input
                    id="div-datacom-input"
                    type="date"
                    value={dataCom}
                    onChange={(e) => setDataCom(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-mono focus:outline-hidden focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-slate-400">
                    Data limite para ter direito.
                  </p>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="div-payment-input"
                    className="text-xs font-bold text-white flex items-center gap-1"
                  >
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    <span>5. Data de pagamento</span>
                  </label>
                  <input
                    id="div-payment-input"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-mono focus:outline-hidden focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-slate-400">
                    Dia em que o valor cai na conta.
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-bold text-white block">
                    Situação
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setStatus('PREVISTO')}
                      className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                        status === 'PREVISTO'
                          ? 'bg-blue-600/20 border-blue-500 text-blue-200'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Previsto
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus('RECEBIDO')}
                      className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                        status === 'RECEBIDO'
                          ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Recebido
                    </button>
                  </div>
                </div>
              </div>

              {/* 6. VALOR TOTAL A RECEBER, CALCULADO AUTOMATICAMENTE */}
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/30 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300 uppercase tracking-wide">
                    6. Valor total a receber (Calculado automaticamente)
                  </span>
                  <span className="text-xs text-white font-mono font-bold">
                    {parsedQty > 0 && parsedRate > 0
                      ? `${parsedQty} × ${formatBRL(parsedRate)} = ${formatBRL(calculatedTotal)}`
                      : 'Preencha cotas e valor'}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <p className="text-xs text-slate-300">
                    Total líquido isento de Imposto de Renda:
                  </p>
                  <strong className="text-2xl font-extrabold text-emerald-400 font-mono tabular-nums">
                    {formatBRL(calculatedTotal)}
                  </strong>
                </div>
              </div>

              {/* Botões Grandes de Ação */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleConfirmAndSave}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-colors cursor-pointer"
                >
                  {isSaving ? 'Salvando...' : 'Salvar Direto'}
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <span>Revisar Resumo Antes de Salvar</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          ) : (
            /* ETAPA 2: RESUMO ANTES DE SALVAR */
            <div className="space-y-5">
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-xs text-emerald-400 font-semibold">
                      Confira os dados antes de salvar
                    </span>
                    <h3 className="text-lg font-extrabold text-white mt-0.5">
                      {cleanTicker} · {fundDisplayName}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep('preencher')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Corrigir dados</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-[#0B111E] border border-slate-800/80">
                    <span className="text-slate-400 block">Fundo Imobiliário</span>
                    <strong className="text-white text-sm font-mono">{cleanTicker}</strong>
                  </div>

                  <div className="p-3 rounded-xl bg-[#0B111E] border border-slate-800/80">
                    <span className="text-slate-400 block">
                      Quantidade de cotas com direito
                    </span>
                    <strong className="text-white text-sm font-mono tabular-nums">
                      {parsedQty} cotas
                    </strong>
                  </div>

                  <div className="p-3 rounded-xl bg-[#0B111E] border border-slate-800/80">
                    <span className="text-slate-400 block">Valor do provento POR COTA</span>
                    <strong className="text-emerald-400 text-sm font-mono tabular-nums">
                      {formatBRL(parsedRate)} por cota
                    </strong>
                  </div>

                  <div className="p-3 rounded-xl bg-[#0B111E] border border-slate-800/80">
                    <span className="text-slate-400 block">Fórmula do cálculo</span>
                    <strong className="text-white text-sm font-mono tabular-nums">
                      {parsedQty} × {formatBRL(parsedRate)} = {formatBRL(calculatedTotal)}
                    </strong>
                  </div>

                  <div className="p-3 rounded-xl bg-[#0B111E] border border-slate-800/80">
                    <span className="text-slate-400 block">Data-com (Direito)</span>
                    <strong className="text-white text-sm font-mono">
                      {formatDateBR(dataCom)}
                    </strong>
                  </div>

                  <div className="p-3 rounded-xl bg-[#0B111E] border border-slate-800/80">
                    <span className="text-slate-400 block">Data de pagamento</span>
                    <strong className="text-white text-sm font-mono">
                      {formatDateBR(paymentDate)} ({status === 'RECEBIDO' ? 'Já recebido' : 'Previsto'})
                    </strong>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-emerald-300 block">
                      Valor Total a Receber
                    </span>
                    <span className="text-[11px] text-slate-300">
                      Calculado automaticamente ({parsedQty} cotas × {formatBRL(parsedRate)})
                    </span>
                  </div>
                  <strong className="text-2xl font-extrabold text-emerald-400 font-mono tabular-nums">
                    {formatBRL(calculatedTotal)}
                  </strong>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setStep('preencher')}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar e Editar Dados</span>
                </button>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleConfirmAndSave}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSaving ? 'Salvando...' : 'Confirmar e Salvar Provento'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
