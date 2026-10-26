const brlFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Converte um valor decimal em reais (ex.: vindo da Pluggy) para centavos inteiros. */
export function toCents(amount: number): number {
  if (!Number.isFinite(amount)) {
    throw new RangeError(`Valor monetário inválido: ${amount}`);
  }
  // Math.round corrige imprecisões como 0.29 * 100 = 28.999999999999996.
  const cents = Math.round(amount * 100);
  return cents === 0 ? 0 : cents; // evita -0
}

/** Soma centavos garantindo que todos sejam inteiros seguros. */
export function sumCents(values: Iterable<number>): number {
  let total = 0;
  for (const value of values) {
    if (!Number.isSafeInteger(value)) {
      throw new RangeError(`Centavos devem ser inteiros: ${value}`);
    }
    total += value;
  }
  if (!Number.isSafeInteger(total)) {
    throw new RangeError('Soma de centavos excedeu o limite seguro');
  }
  return total;
}

/** Formata centavos como "R$ 1.234,56" (com espaço comum, legível no WhatsApp). */
export function formatBRL(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`Centavos devem ser inteiros: ${cents}`);
  }
  return brlFormatter.format(cents / 100).replace(/\u00a0/g, ' ');
}
