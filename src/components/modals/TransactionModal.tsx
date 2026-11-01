import React, { useState, useEffect, useId, useMemo } from 'react';
import {
  X,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  AlertCircle,
  Check,
  ArrowRight,
  ArrowLeft,
  Edit3,
  ChevronDown,
  ChevronUp,
  Coins,
} from 'lucide-react';
import { usePortfolio } from '../../context/PortfolioContext';
import { OperationType } from '../../types/fii';
import { VERIFIED_FII_DATABASE } from '../../data/fiiDatabase';
import { calculateWeightedAveragePrice, calculateSaleResult } from '../../utils/financialMath';
import { formatBRL, formatDateBR, parseFlexibleNumber } from '../../utils/formatters';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTicker?: string;
  defaultType?: OperationType;
  onOpenAddDividend?: (ticker: string, quantity: number) => void;
}

const POPULAR_FIIS = ['ALZR11', 'MXRF11', 'HGLG11', 'KNIP11', 'XPML11', 'BTLG11'];

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  defaultTicker = '',
  defaultType = 'COMPRA',
  onOpenAddDividend,
}) => {
  const { holdings, addTransaction } = usePortfolio();
  const tickerListId = useId();

  // Etapas: 'preencher' (Etapa 1) | 'resumo' (Etapa 2 - Conferência antes de salvar)
  const [step, setStep] = useState<'preencher' | 'resumo'>('preencher');
  const [showOtherOperations, setShowOtherOperations] = useState<boolean>(false);
  const [showOptionalFields, setShowOptionalFields] = useState<boolean>(false);

  const [type, setType] = useState<OperationType>(defaultType);
  const [ticker, setTicker] = useState<string>(defaultTicker || 'ALZR11');
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [quantity, setQuantity] = useState<string>('80');
  const [price, setPrice] = useState<string>('10,86');
  const [fees, setFees] = useState<string>('0,00');
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    const cleanDefaultTicker = (defaultTicker || 'ALZR11').toUpperCase().trim();
    setStep('preencher');
    setType(defaultType);
    setShowOtherOperations(defaultType !== 'COMPRA');
    setShowOptionalFields(false);
    setTicker(cleanDefaultTicker);
    setErrorMsg(null);
    setSuccessMsg(null);

    const existing = holdings.find((h) => h.ticker.toUpperCase() === cleanDefaultTicker);
    const dbItem = VERIFIED_FII_DATABASE[cleanDefaultTicker];

    if (cleanDefaultTicker === 'ALZR11' && !existing) {
      setQuantity('80');
      setPrice((dbItem?.currentPrice || 10.86).toFixed(2).replace('.', ','));
    } else if (existing && existing.currentPrice > 0) {
      setPrice(existing.currentPrice.toFixed(2).replace('.', ','));
    } else if (dbItem && dbItem.currentPrice > 0) {
      setPrice(dbItem.currentPrice.toFixed(2).replace('.', ','));
    }
  }, [isOpen, defaultTicker, defaultType, holdings]);

  const cleanTicker = ticker.toUpperCase().trim();
  const numQty = Math.floor(parseFlexibleNumber(quantity));
  const numPrice = parseFlexibleNumber(price);
  const numFees = parseFlexibleNumber(fees);

  const currentHolding = useMemo(
    () => holdings.find((h) => h.ticker.toUpperCase() === cleanTicker),
    [holdings, cleanTicker]
  );
  const dbInfo = VERIFIED_FII_DATABASE[cleanTicker];
  const fundDisplayName =
    currentHolding?.name || dbInfo?.name || (cleanTicker ? `${cleanTicker} — Fundo Imobiliário` : '');
  const fundSegment = currentHolding?.segment || dbInfo?.segment || 'Fundo Imobiliário (B3)';

  const totalInvestedOrder = useMemo(() => {
    if (numQty <= 0 || numPrice <= 0) return 0;
    const raw =
      type === 'VENDA' ? numQty * numPrice - numFees : numQty * numPrice + numFees;
    return Number(Math.max(0, raw).toFixed(2));
  }, [numQty, numPrice, numFees, type]);

  const handleSelectTicker = (selectedTicker: string) => {
    const upper = selectedTicker.toUpperCase().trim();
    setTicker(upper);
    setErrorMsg(null);
    const existing = holdings.find((h) => h.ticker.toUpperCase() === upper);
    const dbItem = VERIFIED_FII_DATABASE[upper];
    if (existing && existing.currentPrice > 0) {
      setPrice(existing.currentPrice.toFixed(2).replace('.', ','));
    } else if (dbItem && dbItem.currentPrice > 0) {
      setPrice(dbItem.currentPrice.toFixed(2).replace('.', ','));
    }
  };

  // Simulação da posição consolidada após salvar
  const postOperationPreview = useMemo(() => {
    if (numQty <= 0 || numPrice <= 0) return null;
    if (type === 'COMPRA' || type === 'SUBSCRICAO' || type === 'AMORTIZACAO') {
      const prevQty = currentHolding?.quantity || 0;
      const prevAvg = currentHolding?.averagePrice || 0;
      try {
        const res = calculateWeightedAveragePrice(prevQty, prevAvg, numQty, numPrice, numFees);
        return {
          mode: 'COMPRA' as const,
          prevQty,
          newQuantity: res.newQuantity,
          newAveragePrice: res.newAveragePrice,
          totalCost: res.totalCost,
        };
      } catch {
        return null;
      }
    } else if (type === 'VENDA') {
      const currentQty = currentHolding?.quantity || 0;
      const currentAvg = currentHolding?.averagePrice || 0;
      if (numQty > currentQty) {
        return {
          mode: 'ERRO_VENDA' as const,
          currentQty,
        };
      }
      try {
        const res = calculateSaleResult(currentQty, currentAvg, numQty, numPrice, numFees);
        return {
          mode: 'VENDA' as const,
          remainingQuantity: res.remainingQuantity,
          realizedResult: res.realizedResult,
          averagePrice: res.averagePrice,
        };
      } catch {
        return null;
      }
    }
    return null;
  }, [numQty, numPrice, numFees, type, currentHolding]);

  const validateForm = (): boolean => {
    if (!cleanTicker || cleanTicker.length < 4) {
      setErrorMsg('Informe o código do fundo imobiliário (ex.: ALZR11).');
      return false;
    }
    if (numQty <= 0) {
      setErrorMsg('Informe a quantidade de cotas (deve ser maior que zero).');
      return false;
    }
    if (numPrice <= 0) {
      setErrorMsg('Informe o preço médio por cota em reais (deve ser maior que zero).');
      return false;
    }
    if (type === 'VENDA' && (!currentHolding || numQty > currentHolding.quantity)) {
      setErrorMsg(
        `Saldo insuficiente para venda. Você possui ${
          currentHolding ? currentHolding.quantity : 0
        } cotas de ${cleanTicker}.`
      );
      return false;
    }
    setErrorMsg(null);
    return true;
  };

  const handleGoToSummary = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setStep('resumo');
  };

  const handleSaveFund = async (andOpenDividendModal = false) => {
    if (!validateForm()) return;
    setIsSaving(true);
    try {
      const res = await addTransaction({
        ticker: cleanTicker,
        type,
        date,
        quantity: numQty,
        price: numPrice,
        fees: numFees,
        notes,
      });

      if (!res.success) {
        setErrorMsg(res.error || 'Erro ao salvar o fundo na carteira.');
        return;
      }

      if (andOpenAddDividend(andOpenDividendModal)) {
        return;
      }

      setSuccessMsg(
        `${cleanTicker} (${numQty} cotas × ${formatBRL(numPrice)} = ${formatBRL(
          totalInvestedOrder
        )}) salvo na sua carteira!`
      );
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 850);
    } finally {
      setIsSaving(false);
    }
  };

  const andOpenAddDividend = (shouldOpen: boolean): boolean => {
    if (shouldOpen && onOpenAddDividend) {
      const finalQty =
        postOperationPreview?.mode === 'COMPRA'
          ? postOperationPreview.newQuantity
          : numQty;
      onClose();
      onOpenAddDividend(cleanTicker, finalQty);
      return true;
    }
    return false;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs">
      <div className="w-full max-w-xl bg-[#0F172A] border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden max-h-[94vh] flex flex-col">
        {/* Cabeçalho Principal */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-[#090D16] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">
                {type === 'COMPRA'
                  ? 'Adicionar Fundo Imobiliário (FII)'
                  : `Registrar ${type} de FII`}
              </h2>
              <p className="text-[11px] text-slate-400">
                {step === 'preencher'
                  ? 'Passo 1 de 2 · Informe o fundo, a quantidade de cotas e o preço por cota'
                  : 'Passo 2 de 2 · Confira o resumo antes de salvar na carteira'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Fechar modal de operação"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Etapas Simples */}
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
            1. Dados do Fundo
          </button>
          <button
            type="button"
            onClick={() => {
              if (validateForm()) setStep('resumo');
            }}
            className={`py-2 px-4 text-center transition-colors cursor-pointer ${
              step === 'resumo'
                ? 'text-emerald-400 border-b-2 border-emerald-500 bg-emerald-500/5'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            2. Resumo antes de Salvar
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-3.5 flex-1">
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
            <form onSubmit={handleGoToSummary} className="space-y-3.5">
              {/* 1. CÓDIGO DO FUNDO (ex.: ALZR11) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="ticker-input" className="text-sm font-bold text-white">
                    1. Código do fundo (ex.: ALZR11)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowOtherOperations((prev) => !prev)}
                    className="text-[11px] font-semibold text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    {showOtherOperations
                      ? 'Voltar para Compra Simples'
                      : 'Quer registrar Venda ou Subscrição?'}
                  </button>
                </div>

                {showOtherOperations && (
                  <div className="grid grid-cols-4 gap-1.5 p-1.5 bg-slate-900 rounded-xl border border-slate-800">
                    {(['COMPRA', 'VENDA', 'SUBSCRICAO', 'AMORTIZACAO'] as OperationType[]).map(
                      (op) => {
                        const isActive = type === op;
                        return (
                          <button
                            key={op}
                            type="button"
                            onClick={() => setType(op)}
                            className={`py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                              isActive
                                ? op === 'VENDA'
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-emerald-600 text-white'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                          >
                            {op === 'COMPRA' && <ArrowDownRight className="w-3.5 h-3.5" />}
                            {op === 'VENDA' && <ArrowUpRight className="w-3.5 h-3.5" />}
                            <span>
                              {op === 'SUBSCRICAO'
                                ? 'Subscrição'
                                : op === 'AMORTIZACAO'
                                ? 'Amortização'
                                : op === 'COMPRA'
                                ? 'Compra'
                                : 'Venda'}
                            </span>
                          </button>
                        );
                      }
                    )}
                  </div>
                )}

                <p className="text-[11px] text-slate-400">
                  Digite as 4 letras e o número 11 do fundo imobiliário (ex.:{' '}
                  <strong className="text-slate-200">ALZR11</strong>,{' '}
                  <strong className="text-slate-200">HGLG11</strong>,{' '}
                  <strong className="text-slate-200">MXRF11</strong>) ou toque em um abaixo:
                </p>

                {/* Sugestões Rápidas */}
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_FIIS.map((item) => {
                    const isSelected = cleanTicker === item;
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => handleSelectTicker(item)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                        }`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <div className="sm:col-span-5">
                    <input
                      id="ticker-input"
                      type="text"
                      value={ticker}
                      onChange={(e) => handleSelectTicker(e.target.value)}
                      placeholder="Ex.: ALZR11"
                      list={tickerListId}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-base font-bold uppercase focus:outline-hidden focus:border-emerald-500"
                    />
                    <datalist id={tickerListId}>
                      {Object.keys(VERIFIED_FII_DATABASE).map((tick) => (
                        <option key={tick} value={tick}>
                          {VERIFIED_FII_DATABASE[tick].name}
                        </option>
                      ))}
                    </datalist>
                  </div>

                  {cleanTicker && (
                    <div className="sm:col-span-7 px-3 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs flex flex-col justify-center">
                      <span className="text-slate-200 font-bold truncate">
                        {fundDisplayName}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {fundSegment}
                        {currentHolding
                          ? ` · Na carteira: ${currentHolding.quantity} cotas`
                          : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. QUANTIDADE DE COTAS & 3. PREÇO MÉDIO DE COMPRA POR COTA */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Campo 2: Quantidade de cotas */}
                <div className="space-y-1">
                  <label htmlFor="quantity-input" className="text-sm font-bold text-white block">
                    2. Quantidade de cotas
                  </label>
                  <input
                    id="quantity-input"
                    type="number"
                    min="1"
                    step="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Ex.: 80"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-base font-bold tabular-nums focus:outline-hidden focus:border-emerald-500"
                  />
                  <div className="flex flex-wrap gap-1">
                    {[10, 50, 80, 100].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setQuantity(String(preset))}
                        className="px-2 py-0.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-slate-300 cursor-pointer"
                      >
                        {preset} cotas
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Digite quantas cotas você comprou ou possui.
                  </p>
                </div>

                {/* Campo 3: Preço médio de compra por cota */}
                <div className="space-y-1">
                  <label htmlFor="price-input" className="text-sm font-bold text-emerald-400 block">
                    3. Preço médio de compra por cota
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm font-bold">
                      R$
                    </span>
                    <input
                      id="price-input"
                      type="text"
                      inputMode="decimal"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="Ex.: 10,86"
                      required
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-900 border-2 border-emerald-500/50 rounded-xl text-white font-mono text-base font-bold tabular-nums focus:outline-hidden focus:border-emerald-400"
                    />
                  </div>
                  <p className="text-[11px] text-slate-200">
                    Informe quanto você pagou por <strong className="text-white">cada 1 cota</strong> (não digite o valor total).
                  </p>
                </div>
              </div>

              {/* 4. DATA DA COMPRA */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="date-input" className="text-sm font-bold text-white">
                    4. Data da compra
                  </label>
                  <button
                    type="button"
                    onClick={() => setDate(new Date().toISOString().split('T')[0])}
                    className="px-2.5 py-0.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 cursor-pointer"
                  >
                    Hoje
                  </button>
                </div>
                <input
                  id="date-input"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm font-mono focus:outline-hidden focus:border-emerald-500"
                />
                <p className="text-[11px] text-slate-400">
                  Dia em que a compra foi feita (ou mantenha hoje para cadastrar sua posição atual).
                </p>
              </div>

              {/* 5. VALOR TOTAL INVESTIDO, CALCULADO AUTOMATICAMENTE */}
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/30 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300 uppercase tracking-wide">
                    5. Valor total investido (Calculado automaticamente)
                  </span>
                  <span className="text-xs text-slate-300 font-mono">
                    {numQty > 0 && numPrice > 0
                      ? `${numQty} cotas × ${formatBRL(numPrice)}`
                      : 'Preencha cotas e preço'}
                  </span>
                </div>

                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-slate-300">
                    {type === 'VENDA' ? 'Valor total da venda:' : 'Total investido nesta compra:'}
                  </span>
                  <strong className="text-2xl font-extrabold text-emerald-400 font-mono tabular-nums">
                    {formatBRL(totalInvestedOrder)}
                  </strong>
                </div>

                {postOperationPreview?.mode === 'COMPRA' && postOperationPreview.prevQty > 0 && (
                  <div className="pt-1.5 border-t border-emerald-500/20 flex items-center justify-between text-xs text-slate-300">
                    <span>
                      Nova posição somada ({postOperationPreview.newQuantity} cotas):
                    </span>
                    <strong className="text-white font-mono">
                      Novo Preço Médio: {formatBRL(postOperationPreview.newAveragePrice)}
                    </strong>
                  </div>
                )}

                {postOperationPreview?.mode === 'ERRO_VENDA' && (
                  <div className="pt-1.5 border-t border-rose-500/30 text-xs text-rose-300 font-semibold">
                    Você possui apenas {postOperationPreview.currentQty} cotas disponíveis para venda.
                  </div>
                )}
              </div>

              {/* Campos opcionais recolhidos por padrão */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowOptionalFields((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  {showOptionalFields ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                  <span>
                    {showOptionalFields
                      ? 'Ocultar taxas e observações opcionais'
                      : 'Adicionar taxas de corretagem ou anotação (opcional)'}
                  </span>
                </button>

                {showOptionalFields && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                    <div>
                      <label htmlFor="fees-input" className="text-xs font-semibold text-slate-300 block mb-1">
                        Taxas / Corretagem (R$)
                      </label>
                      <input
                        id="fees-input"
                        type="text"
                        inputMode="decimal"
                        value={fees}
                        onChange={(e) => setFees(e.target.value)}
                        placeholder="0,00"
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label htmlFor="notes-input" className="text-xs font-semibold text-slate-300 block mb-1">
                        Anotação pessoal (opcional)
                      </label>
                      <input
                        id="notes-input"
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Ex.: Compra mensal"
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Botões Grandes e Fáceis de Identificar */}
              <div className="pt-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs font-bold text-slate-300 hover:text-white rounded-xl bg-slate-800/80 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleSaveFund(false)}
                  className="px-4 py-2.5 text-xs font-bold text-emerald-300 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 border border-emerald-500/30 transition-colors cursor-pointer"
                >
                  {isSaving ? 'Salvando...' : 'Salvar Direto'}
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
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
                      Confira os dados antes de confirmar
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
                    <span className="text-slate-400 block">Código do Fundo</span>
                    <strong className="text-white text-sm font-mono">{cleanTicker}</strong>
                  </div>

                  <div className="p-3 rounded-xl bg-[#0B111E] border border-slate-800/80">
                    <span className="text-slate-400 block">Quantidade de Cotas</span>
                    <strong className="text-white text-sm font-mono tabular-nums">
                      {numQty} cotas
                    </strong>
                  </div>

                  <div className="p-3 rounded-xl bg-[#0B111E] border border-slate-800/80">
                    <span className="text-slate-400 block">Preço Médio por Cota</span>
                    <strong className="text-emerald-400 text-sm font-mono tabular-nums">
                      {formatBRL(numPrice)} por cota
                    </strong>
                  </div>

                  <div className="p-3 rounded-xl bg-[#0B111E] border border-slate-800/80">
                    <span className="text-slate-400 block">Data da Compra</span>
                    <strong className="text-white text-sm font-mono">
                      {formatDateBR(date)}
                    </strong>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-emerald-300 block">
                      Valor Total Investido
                    </span>
                    <span className="text-[11px] text-slate-300 font-mono">
                      {numQty} cotas × {formatBRL(numPrice)}
                      {numFees > 0 ? ` + ${formatBRL(numFees)} taxas` : ''}
                    </span>
                  </div>
                  <strong className="text-2xl font-extrabold text-emerald-400 font-mono tabular-nums">
                    {formatBRL(totalInvestedOrder)}
                  </strong>
                </div>

                {postOperationPreview?.mode === 'COMPRA' && (
                  <div className="p-3.5 rounded-xl bg-[#0B111E] border border-slate-800 text-xs flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-300">
                      Posição final em <strong className="text-white">{cleanTicker}</strong> após salvar:
                    </span>
                    <span className="text-white font-mono font-bold">
                      {postOperationPreview.newQuantity} cotas · Preço Médio:{' '}
                      {formatBRL(postOperationPreview.newAveragePrice)}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setStep('preencher')}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar e Editar</span>
                </button>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  {onOpenAddDividend && type === 'COMPRA' && (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSaveFund(true)}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Coins className="w-4 h-4" />
                      <span>Salvar e Cadastrar Provento</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleSaveFund(false)}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isSaving ? 'Salvando...' : 'Confirmar e Salvar Fundo'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
