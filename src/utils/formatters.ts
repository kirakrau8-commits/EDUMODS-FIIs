export function formatBRL(
  value: number | undefined | null,
  hide = false,
  showSign = false
): string {
  if (hide) {
    return 'R$ ••••••';
  }
  if (value === undefined || value === null || isNaN(value)) {
    return 'R$ 0,00';
  }

  const sign = showSign && value > 0 ? '+' : '';
  const absVal = Math.abs(value);
  const rounded4 = Math.round(value * 10000) / 10000;
  const rounded2 = Math.round(value * 100) / 100;

  // Preserva até 3 ou 4 casas decimais para proventos unitários fracionados (ex: R$ 0,084 por cota)
  // mantendo 2 casas decimais para todos os valores inteiros/totais (ex: R$ 6,72)
  const hasSubCentPrecision =
    absVal > 0 && absVal < 10 && Math.abs(rounded4 - rounded2) > 0.0001;

  const formatted = (hasSubCentPrecision ? rounded4 : value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: hasSubCentPrecision ? 4 : 2,
  });

  return `${sign}${formatted}`;
}

/**
 * Converte texto digitado pelo usuário com vírgula ou ponto (ex: "0,084", "10,86", "R$ 0,084")
 * em número ponto-flutuante válido.
 */
export function parseFlexibleNumber(raw: string | number | undefined | null): number {
  if (typeof raw === 'number') {
    return isNaN(raw) ? 0 : raw;
  }
  if (!raw || typeof raw !== 'string') return 0;
  const cleaned = raw.replace(/[^\d.,-]/g, '').trim();
  if (!cleaned) return 0;

  // Se tiver tanto ponto quanto vírgula (ex: "1.250,50"), remove pontos de milhar e troca vírgula por ponto
  if (cleaned.includes('.') && cleaned.includes(',')) {
    const normalized = cleaned.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
  }

  // Se tiver apenas vírgula (ex: "0,084" ou "10,86"), troca por ponto
  if (cleaned.includes(',')) {
    const parsed = parseFloat(cleaned.replace(',', '.'));
    return isNaN(parsed) ? 0 : parsed;
  }

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

export function formatPercent(
  value: number | undefined | null,
  showSign = true,
  digits = 2
): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '0,00%';
  }
  const sign = showSign && value > 0 ? '+' : '';
  const formatted = value.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${sign}${formatted}%`;
}

export function formatDateBR(dateStr?: string): string {
  if (!dateStr) return '--/--/----';
  // Handles YYYY-MM-DD
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export function formatNumberBR(value: number, decimals = 0): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
