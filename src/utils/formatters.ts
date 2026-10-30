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
  const formatted = value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${sign}${formatted}`;
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
