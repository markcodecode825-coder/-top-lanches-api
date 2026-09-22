export const MAX_MONEY_IN_CENTS = 2_147_483_647;

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2
});

function normalizeCurrencySpacing(value: string): string {
  return value.replace(/[\u00a0\u202f]/g, ' ');
}

export function centsToApi(cents: number): { price: number; priceInCents: number; priceFormatted: string } {
  return {
    price: Number((cents / 100).toFixed(2)),
    priceInCents: cents,
    priceFormatted: normalizeCurrencySpacing(brlFormatter.format(cents / 100))
  };
}

export function formatCents(cents: number): string {
  return normalizeCurrencySpacing(brlFormatter.format(cents / 100));
}

export function decimalInputToCents(value: number | string): number {
  const text = String(value).trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
    throw new Error('Valor monetário inválido');
  }

  const [whole = '0', decimals = ''] = text.split('.');
  const padded = `${decimals}00`.slice(0, 2);
  const wholeNumber = Number(whole);
  const cents = wholeNumber * 100 + Number(padded);

  if (!Number.isSafeInteger(cents) || cents < 0 || cents > MAX_MONEY_IN_CENTS) {
    throw new Error('Valor monetário fora do limite suportado');
  }

  return cents;
}
