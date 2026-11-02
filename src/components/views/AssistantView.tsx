import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Bot,
  User,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Coins,
  FileText,
  X,
  Loader2,
  Sliders,
  Check,
} from 'lucide-react';
import { usePortfolio } from '../../context/PortfolioContext';
import { formatBRL, formatDateBR } from '../../utils/formatters';

export type Personality = 'analista' | 'direto' | 'mentor';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  personality?: Personality;
  draftAction?: {
    type: 'TRANSACTION' | 'DIVIDEND';
    data: any;
    label: string;
  };
  actionStatus?: 'pending' | 'saved' | 'cancelled';
}

interface AssistantViewProps {
  onOpenTransactionModal?: (ticker?: string, type?: any) => void;
  onOpenAddDividendModal?: (ticker?: string, quantity?: number) => void;
}

export const AssistantView: React.FC<AssistantViewProps> = ({
  onOpenTransactionModal,
  onOpenAddDividendModal,
}) => {
  const {
    holdings,
    totalMarketValue,
    totalInvested,
    totalUnrealizedGain,
    monthlyDividendsReceived,
    addTransaction,
    addManualDividend,
  } = usePortfolio();

  const [personality, setPersonality] = useState<Personality>('analista');
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Olá! Sou seu assistente de inteligência financeira no **EDUMODS FIIs**, especializado no mercado de Fundos Imobiliários da B3.\n\nPosso te ajudar a analisar sua carteira, esclarecer fundamentos e múltiplos (P/VP, Yield on Cost, vacância), ou registrar operações automaticamente a partir de texto ou prints de notas de corretagem. Em que posso te apoiar hoje?',
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      personality: 'analista',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachedImage, setAttachedImage] = useState<{ base64: string; mimeType: string; fileName: string } | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione uma imagem (PNG, JPG ou JPEG) da sua nota de corretagem ou extrato.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setAttachedImage({
        base64,
        mimeType: file.type,
        fileName: file.name,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query && !attachedImage) return;

    const userMsgId = `user_${Date.now()}`;
    const newMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      text: query || 'Analise a nota de corretagem / extrato anexado.',
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText('');
    const currentAttachment = attachedImage;
    setAttachedImage(null);
    setIsLoading(true);

    // Contexto resumido da carteira
    const topHoldings = holdings.slice(0, 8).map((h) => ({
      ticker: h.ticker,
      quantity: h.quantity,
      averagePrice: h.averagePrice,
      currentPrice: h.currentPrice,
      marketValue: h.marketValue,
      pvp: h.pvp,
      segment: h.segment,
    }));

    const portfolioSummary = {
      totalInvested,
      totalMarketValue,
      totalUnrealizedGain,
      monthlyDividends: monthlyDividendsReceived,
      holdingsCount: holdings.length,
      topHoldings,
    };

    // Histórico recente dos últimos 6 turnos para continuidade
    const history = messages.slice(-6).map((m) => ({
      role: m.role === 'user' ? ('user' as const) : ('model' as const),
      text: m.text,
    }));

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query || 'Interprete a imagem anexada da nota de corretagem ou provento.',
          personality,
          portfolioSummary,
          history,
          imageBase64: currentAttachment ? currentAttachment.base64 : undefined,
          imageMimeType: currentAttachment ? currentAttachment.mimeType : undefined,
        }),
      });

      if (!res.ok) {
        throw new Error(`Falha no servidor (${res.status})`);
      }

      const data = await res.json();
      const assistantMsg: ChatMessage = {
        id: `ast_${Date.now()}`,
        role: 'assistant',
        text: data.reply || 'Processamento concluído.',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        personality: data.personality || personality,
        draftAction: data.draftAction,
        actionStatus: data.draftAction ? 'pending' : undefined,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error('Erro ao chamar assistente:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          text: 'Ocorreu uma instabilidade na comunicação com o assistente. Suas ações e dados locais permanecem 100% seguros.',
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          personality,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmAction = async (msgId: string, draft: ChatMessage['draftAction']) => {
    if (!draft) return;

    try {
      if (draft.type === 'TRANSACTION') {
        const t = draft.data;
        const res = await addTransaction({
          ticker: t.ticker.toUpperCase().trim(),
          type: t.operation || 'COMPRA',
          quantity: Number(t.quantity),
          price: t.price != null ? Number(t.price) : null,
          fees: 0,
          date: t.date || new Date().toISOString().split('T')[0],
          notes: 'Registrado via Assistente EDUMODS',
        });

        if (res.success) {
          setActionFeedback(`Operação de ${t.ticker} confirmada e salva na sua carteira!`);
          setMessages((prev) =>
            prev.map((m) => (m.id === msgId ? { ...m, actionStatus: 'saved' } : m))
          );
        } else {
          alert(res.error || 'Erro ao salvar operação.');
        }
      } else if (draft.type === 'DIVIDEND') {
        const d = draft.data;
        await addManualDividend({
          ticker: d.ticker.toUpperCase().trim(),
          quantityEligible: Number(d.quantityEligible || 50),
          ratePerShare: Number(d.ratePerShare || 0.084),
          dataCom: d.dataCom || new Date().toISOString().split('T')[0],
          paymentDate: d.paymentDate || new Date().toISOString().split('T')[0],
          status: 'RECEBIDO',
        });

        setActionFeedback(`Provento de ${d.ticker} registrado com sucesso!`);
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, actionStatus: 'saved' } : m))
        );
      }
    } catch (err) {
      console.error('Falha ao confirmar ação:', err);
    }

    setTimeout(() => setActionFeedback(null), 3500);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[550px] max-w-5xl mx-auto bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
      {/* Topo do Assistente: Título e Seletor de Personalidade */}
      <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-900/30">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-1.5">
              <span>Assistente EDUMODS FIIs</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono">
                Gemini 3.8 Flash
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">
              Especialista em fundos imobiliários, valuation e gestão de patrimônio
            </p>
          </div>
        </div>

        {/* 3 Personalidades */}
        <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setPersonality('analista')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              personality === 'analista'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Analista</span>
          </button>
          <button
            type="button"
            onClick={() => setPersonality('direto')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              personality === 'direto'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>Direto</span>
          </button>
          <button
            type="button"
            onClick={() => setPersonality('mentor')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              personality === 'mentor'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Mentor</span>
          </button>
        </div>
      </div>

      {actionFeedback && (
        <div className="p-3 bg-emerald-500/20 border-b border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2 px-4 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Área de Mensagens / Chat */}
      <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-4">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={m.id}
              className={`flex gap-3 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold shadow-md ${
                  isUser
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-emerald-400 border border-slate-700'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div className="space-y-2 max-w-2xl">
                <div
                  className={`p-4 rounded-2xl text-xs md:text-sm leading-relaxed whitespace-pre-wrap ${
                    isUser
                      ? 'bg-emerald-600 text-white rounded-tr-none'
                      : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-none shadow-md'
                  }`}
                >
                  {m.text}
                </div>

                {/* Card de Rascunho de Ação Interativo (Confirmação antes de salvar) */}
                {m.draftAction && (
                  <div className="p-3.5 rounded-xl bg-slate-950 border-2 border-emerald-500/40 shadow-lg space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Rascunho de Operação Detectado</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">Requer sua aprovação</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono space-y-1">
                      <div className="text-white font-bold">{m.draftAction.label}</div>
                      {m.draftAction.data.date && (
                        <div className="text-[11px] text-slate-400">
                          Data: {formatDateBR(m.draftAction.data.date)}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      {m.actionStatus === 'saved' ? (
                        <div className="w-full py-2 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5">
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span>Salvo na sua carteira!</span>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleConfirmAction(m.id, m.draftAction)}
                            className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Confirmar e Salvar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (m.draftAction?.type === 'TRANSACTION' && onOpenTransactionModal) {
                                onOpenTransactionModal(
                                  m.draftAction.data.ticker,
                                  m.draftAction.data.operation || 'COMPRA'
                                );
                              } else if (m.draftAction?.type === 'DIVIDEND' && onOpenAddDividendModal) {
                                onOpenAddDividendModal(
                                  m.draftAction.data.ticker,
                                  m.draftAction.data.quantityEligible
                                );
                              }
                            }}
                            className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all cursor-pointer"
                          >
                            Editar Detalhes
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="text-[10px] text-slate-500 px-1">{m.timestamp}</div>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex gap-3 max-w-xl mr-auto">
            <div className="w-8 h-8 rounded-full bg-slate-800 text-emerald-400 border border-slate-700 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-slate-400 text-xs flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
              <span>Analisando fundamentos e consultando dados dos FIIs...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Sugestões Rápidas (Chips) */}
      <div className="px-4 py-2 bg-slate-950/70 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto text-xs no-scrollbar">
        <span className="text-[11px] text-slate-500 shrink-0">Perguntas rápidas:</span>
        {[
          'Analisar minha carteira',
          'Comprei 50 cotas de MXRF11 a R$ 10,50',
          'Quais são meus próximos proventos?',
          'Explicar o que é Yield on Cost',
        ].map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => handleSendMessage(chip)}
            className="px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs whitespace-nowrap transition-colors border border-slate-700/60 cursor-pointer shrink-0"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Imagem Anexada em Prévia */}
      {attachedImage && (
        <div className="px-4 py-2 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-emerald-400 font-mono">
            <FileText className="w-4 h-4" />
            <span className="truncate max-w-xs">{attachedImage.fileName}</span>
            <span className="text-[10px] text-slate-500 font-sans">(Nota de corretagem pronta para OCR)</span>
          </div>
          <button
            type="button"
            onClick={() => setAttachedImage(null)}
            className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Barra de Entrada / Digitação */}
      <div className="p-3 md:p-4 bg-slate-950 border-t border-slate-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Anexar imagem de nota de corretagem ou extrato (OCR com Gemini)"
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 border border-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Pergunte sobre FIIs ou digite: 'Comprei 50 MXRF11 a R$ 10,50'..."
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs md:text-sm focus:outline-hidden focus:border-emerald-500 placeholder:text-slate-500"
          />

          <button
            type="submit"
            disabled={isLoading || (!inputText.trim() && !attachedImage)}
            className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-lg shadow-emerald-900/30 transition-all cursor-pointer shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};
