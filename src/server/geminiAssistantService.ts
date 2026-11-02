import { GoogleGenAI } from '@google/genai';
import { VERIFIED_FII_DATABASE } from '../data/fiiDatabase';

export type AssistantPersonality = 'analista' | 'direto' | 'mentor';

export interface AssistantChatRequest {
  message: string;
  personality?: AssistantPersonality;
  portfolioSummary?: {
    totalInvested: number;
    totalMarketValue: number;
    totalUnrealizedGain: number;
    monthlyDividends: number;
    holdingsCount: number;
    topHoldings: Array<{
      ticker: string;
      quantity: number;
      averagePrice?: number | null;
      currentPrice: number;
      marketValue: number;
      pvp: number;
      segment: string;
    }>;
  };
  imageBase64?: string;
  imageMimeType?: string;
  history?: Array<{ role: 'user' | 'model'; text: string }>;
}

export interface AssistantChatResponse {
  reply: string;
  personality: AssistantPersonality;
  draftAction?: {
    type: 'TRANSACTION' | 'DIVIDEND';
    data: any;
    label: string;
  };
  source: 'gemini' | 'rule-based-fallback';
}

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey.startsWith('your-') || apiKey === 'undefined') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
  });
}

function getSystemInstruction(
  personality: AssistantPersonality,
  portfolioSummary?: AssistantChatRequest['portfolioSummary']
): string {
  let personaInstruction = '';
  if (personality === 'direto') {
    personaInstruction = `Você é o Assistente Executivo do EDUMODS FIIs com o estilo "Direto ao Ponto".
- Seja extremamente direto, conciso e objetivo.
- Vá direto aos números e à resposta prática, sem introduções prolixas ou enrolação.
- Use tópicos curtos e destaque métricas-chave em negrito.`;
  } else if (personality === 'mentor') {
    personaInstruction = `Você é o Mentor Educador do EDUMODS FIIs.
- Seja didático, paciente, acessível e encorajador para o investidor pessoa física.
- Explique o "porquê" dos conceitos (o que significa P/VP alto ou baixo, por que reinvestir dividendos acelera a bola de neve, o que é vacância e risco de crédito).
- Ajude a desenvolver uma mentalidade de longo prazo e independência financeira.`;
  } else {
    // analista
    personaInstruction = `Você é o Analista Chefe do EDUMODS FIIs, especializado exclusivamente em Fundos Imobiliários da B3 (Tijolo, Papel, FOFs, Híbridos e Fiagros).
- Seu tom é analítico, técnico, fundamentado e prudente.
- Avalie sempre múltiplos de valuation (P/VP, Dividend Yield anualizado, Cap Rate estimado), indexadores (IPCA vs CDI) e qualidade dos ativos.
- Alerte sobre riscos de concentração excessiva (>20% no mesmo ticker ou segmento).`;
  }

  let portfolioContext = '';
  if (portfolioSummary) {
    portfolioContext = `
DADOS DA CARTEIRA ATUAL DO INVESTIDOR:
- Patrimônio Total: R$ ${portfolioSummary.totalMarketValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Custo Total Investido (onde conhecido): R$ ${portfolioSummary.totalInvested.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Lucro/Prejuízo no Papel: R$ ${portfolioSummary.totalUnrealizedGain.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Proventos Mensais Atuais: R$ ${portfolioSummary.monthlyDividends.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Posições Ativas: ${portfolioSummary.holdingsCount} fundos
- Fundos em Carteira: ${portfolioSummary.topHoldings
      .map(
        (h) =>
          `${h.ticker} (${h.quantity} cotas, Cotação: R$ ${h.currentPrice.toFixed(2)}, PM: ${
            h.averagePrice != null ? `R$ ${h.averagePrice.toFixed(2)}` : 'Não informado'
          }, P/VP: ${h.pvp.toFixed(2)}, Segmento: ${h.segment})`
      )
      .join(', ')}
`;
  }

  return `${personaInstruction}

${portfolioContext}

REGRA CRUCIAL SOBRE AÇÕES DE CADASTRO (DRAFT ACTIONS):
Quando o usuário relatar uma operação financeira (ex: "Comprei 50 cotas de MXRF11 a R$ 10,50", "Vendi 20 HGLG11 a R$ 160", "Recebi R$ 5,04 do ALZR11" ou uma nota de corretagem enviada em print/imagem), forneça sua resposta analítica normal e, AO FINAL DE TUDO, adicione EXATAMENTE um bloco JSON demarcado como:

\`\`\`json:action_draft
{
  "type": "TRANSACTION",
  "ticker": "MXRF11",
  "operation": "COMPRA",
  "quantity": 50,
  "price": 10.50,
  "date": "2026-11-01"
}
\`\`\`

Ou para proventos recebidos:
\`\`\`json:action_draft
{
  "type": "DIVIDEND",
  "ticker": "ALZR11",
  "quantityEligible": 60,
  "ratePerShare": 0.084,
  "totalAmount": 5.04,
  "paymentDate": "2026-11-15"
}
\`\`\`

O sistema lerá esse bloco para apresentar um card interativo com botão para o usuário revisar e aprovar o cadastro com 1 clique.
Se o preço não for conhecido na compra, informe "price": null.
Não inclua o bloco json:action_draft se o usuário estiver apenas tirando dúvidas gerais sem relatar operações para registrar.`;
}

function extractDraftAction(text: string): {
  cleanText: string;
  draftAction?: AssistantChatResponse['draftAction'];
} {
  const match = text.match(/```json:action_draft\s*([\s\S]*?)\s*```/);
  if (!match) {
    return { cleanText: text };
  }

  try {
    const rawJson = match[1].trim();
    const parsed = JSON.parse(rawJson);
    const cleanText = text.replace(match[0], '').trim();

    if (parsed.type === 'TRANSACTION') {
      const isKnownPrice = parsed.price != null && Number(parsed.price) > 0;
      const label = `${parsed.operation || 'COMPRA'} de ${parsed.quantity} cotas de ${parsed.ticker}${
        isKnownPrice ? ` a R$ ${Number(parsed.price).toFixed(2)}` : ' (preço não informado)'
      }`;
      return {
        cleanText,
        draftAction: {
          type: 'TRANSACTION',
          data: parsed,
          label,
        },
      };
    }

    if (parsed.type === 'DIVIDEND') {
      const label = `Provento de ${parsed.ticker} — ${parsed.quantityEligible || 0} cotas × R$ ${Number(
        parsed.ratePerShare || 0
      ).toFixed(3)}`;
      return {
        cleanText,
        draftAction: {
          type: 'DIVIDEND',
          data: parsed,
          label,
        },
      };
    }
  } catch (err) {
    console.warn('Falha ao parsear bloco action_draft do Gemini:', err);
  }

  return { cleanText: text };
}

/**
 * Fallback inteligente determinístico caso o GEMINI_API_KEY não esteja configurado no ambiente
 */
function generateRuleBasedFallback(
  req: AssistantChatRequest,
  personality: AssistantPersonality
): AssistantChatResponse {
  const lower = req.message.toLowerCase();
  const summary = req.portfolioSummary;

  // 1. Detectar padrão de compra: "comprei 50 mxrf11 a 10,50"
  const buyMatch = req.message.match(/comprei\s+(\d+)\s*(?:cotas\s*(?:de\s*)?)?([a-zA-Z]{4}\d{2})\b(?:\s*a\s*(?:r\$\s*)?([\d,.]+))?/i);
  if (buyMatch) {
    const qty = parseInt(buyMatch[1], 10);
    const ticker = buyMatch[2].toUpperCase();
    const priceStr = buyMatch[3];
    const price = priceStr ? parseFloat(priceStr.replace(',', '.')) : null;

    const dbInfo = VERIFIED_FII_DATABASE[ticker];
    const today = new Date().toISOString().split('T')[0];

    const reply =
      personality === 'direto'
        ? `Operação identificada: **Compra de ${qty} cotas de ${ticker}**${
            price ? ` a **R$ ${price.toFixed(2)}**` : ' com preço a confirmar'
          }. Confira os dados no card abaixo para adicionar à sua carteira.`
        : personality === 'mentor'
        ? `Parabéns pelo aporte! Registrar suas compras com precisão é fundamental para acompanhar o crescimento da sua bola de neve. Identifiquei a compra de **${qty} cotas de ${ticker}**${
            price ? ` por R$ ${price.toFixed(2)} cada` : ''
          }. Clique em "Confirmar e Salvar" no card abaixo para atualizar sua carteira!`
        : `Identifiquei o registro de compra de **${qty} cotas de ${ticker}** (${dbInfo?.name || 'FII B3'})${
            price ? ` ao preço unitário de R$ ${price.toFixed(2)}` : ''
          }. Criei o rascunho de operação abaixo para sua conferência antes de persistir no banco.`;

    return {
      reply,
      personality,
      source: 'rule-based-fallback',
      draftAction: {
        type: 'TRANSACTION',
        data: {
          ticker,
          operation: 'COMPRA',
          quantity: qty,
          price,
          date: today,
        },
        label: `Adicionar Compra: ${qty} cotas de ${ticker}${price ? ` a R$ ${price.toFixed(2)}` : ''}`,
      },
    };
  }

  // 2. Análise geral da carteira
  if (lower.includes('analis') || lower.includes('carteira') || lower.includes('como está') || lower.includes('patrimonio')) {
    if (!summary || summary.holdingsCount === 0) {
      return {
        reply:
          'Sua carteira ainda está sem posições cadastradas. Cadastre seu primeiro fundo (como ALZR11 ou MXRF11) pelo botão "Novo Fundo" ou me diga por aqui o que você comprou!',
        personality,
        source: 'rule-based-fallback',
      };
    }

    const totalEquity = summary.totalMarketValue;
    const monthlyDiv = summary.monthlyDividends;
    const top = summary.topHoldings;

    if (personality === 'direto') {
      return {
        reply: `**Resumo Executivo da Carteira:**
- **Patrimônio Atual:** R$ ${totalEquity.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- **Renda Mensal:** R$ ${monthlyDiv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês
- **Fundos Ativos:** ${summary.holdingsCount} FIIs
- **Maior Posição:** ${top[0]?.ticker || 'N/A'} (R$ ${top[0]?.marketValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'})
- **Status:** Carteira monitorada com alertas automáticos de cotação e proventos ativos.`,
        personality,
        source: 'rule-based-fallback',
      };
    }

    return {
      reply: `Análise da sua carteira EDUMODS FIIs:
Seu patrimônio acumulado está em **R$ ${totalEquity.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}**, gerando uma renda mensal média de **R$ ${monthlyDiv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}** livre de imposto de renda.
Você possui **${summary.holdingsCount} fundos**, com destaque para **${top.map((t) => t.ticker).join(', ')}**.
Dica de gestão de risco: mantenha seus aportes diversificados entre fundos de Tijolo (Logística, Shoppings) e Recebíveis (Papel IPCA/CDI) para blindar seu fluxo de caixa contra a volatilidade da taxa Selic.`,
      personality,
      source: 'rule-based-fallback',
    };
  }

  // Resposta padrão caso nenhuma intenção específica coincida
  return {
    reply:
      personality === 'direto'
        ? 'Estou pronto. Pergunte sobre fundamentos de FIIs, análise de carteira, proventos ou me informe compras/vendas para registrar (ex: "Comprei 80 ALZR11 a R$ 10,86").'
        : 'Olá! Sou o assistente de inteligência financeira do EDUMODS FIIs. Posso analisar sua carteira, esclarecer dúvidas sobre proventos e P/VP, ou preparar rascunhos de operações a partir das suas mensagens ou notas de corretagem. Em que posso te apoiar hoje?',
    personality,
    source: 'rule-based-fallback',
  };
}

/**
 * Função principal que processa mensagens com o Gemini API (gemini-3.8-flash) no servidor
 */
export async function processAssistantChatMessage(
  req: AssistantChatRequest
): Promise<AssistantChatResponse> {
  const personality = req.personality || 'analista';
  const ai = getGenAIClient();

  if (!ai) {
    return generateRuleBasedFallback(req, personality);
  }

  try {
    const systemInstruction = getSystemInstruction(personality, req.portfolioSummary);

    const contents: any[] = [];

    // Inclui histórico de turnos anteriores se houver
    if (req.history && req.history.length > 0) {
      req.history.forEach((h) => {
        contents.push({
          role: h.role,
          parts: [{ text: h.text }],
        });
      });
    }

    // Turno atual do usuário
    const currentParts: any[] = [{ text: req.message }];

    // Se houver imagem (OCR / nota de corretagem)
    if (req.imageBase64) {
      const rawBase64 = req.imageBase64.includes(',')
        ? req.imageBase64.split(',')[1]
        : req.imageBase64;
      currentParts.push({
        inlineData: {
          data: rawBase64,
          mimeType: req.imageMimeType || 'image/png',
        },
      });
    }

    contents.push({
      role: 'user',
      parts: currentParts,
    });

    const generatePromise = ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction,
        temperature: 0.3,
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Tempo limite de resposta do modelo Gemini excedido (8s).')),
        8000
      )
    );

    const response = await Promise.race([generatePromise, timeoutPromise]);

    const textOutput = response.text || '';
    const { cleanText, draftAction } = extractDraftAction(textOutput);

    return {
      reply: cleanText,
      personality,
      draftAction,
      source: 'gemini',
    };
  } catch (err) {
    console.warn('Erro ao chamar Gemini API no servidor, acionando fallback:', err);
    return generateRuleBasedFallback(req, personality);
  }
}
