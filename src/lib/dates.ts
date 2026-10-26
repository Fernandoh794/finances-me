import { TZDate } from '@date-fns/tz';

export const APP_TIME_ZONE = 'America/Sao_Paulo';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface DateRange {
  start: Date; // início do dia inicial (inclusivo)
  end: Date; // último milissegundo do dia final (inclusivo)
}

function parseIsoDate(value: string): { year: number; month: number; day: number } {
  const match = ISO_DATE.exec(value);
  if (!match) {
    throw new RangeError(`Data inválida "${value}": use o formato YYYY-MM-DD`);
  }
  const [year, month, day] = match.slice(1).map(Number) as [number, number, number];

  // Rejeita datas inexistentes como 2026-02-30 (que o Date "rolaria" para março).
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    throw new RangeError(`Data inexistente "${value}"`);
  }
  return { year, month, day };
}

/** Converte "YYYY-MM-DD" em [início do dia, fim do dia] no fuso da aplicação. */
export function dayRange(startDate: string, endDate: string, timeZone = APP_TIME_ZONE): DateRange {
  const s = parseIsoDate(startDate);
  const e = parseIsoDate(endDate);

  const start = new TZDate(s.year, s.month - 1, s.day, 0, 0, 0, 0, timeZone);
  const end = new TZDate(e.year, e.month - 1, e.day, 23, 59, 59, 999, timeZone);

  if (start.getTime() > end.getTime()) {
    throw new RangeError(`startDate (${startDate}) é posterior a endDate (${endDate})`);
  }
  return { start: new Date(start.getTime()), end: new Date(end.getTime()) };
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Soma (ou subtrai) dias de uma data "YYYY-MM-DD". */
export function addDaysIso(iso: string, days: number): string {
  const { year, month, day } = parseIsoDate(iso);
  return toIso(new Date(Date.UTC(year, month - 1, day + days)));
}

/** Segunda-feira da semana de uma data "YYYY-MM-DD". */
export function startOfWeekIso(iso: string): string {
  const { year, month, day } = parseIsoDate(iso);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0 = domingo
  return addDaysIso(iso, -((weekday + 6) % 7));
}

export function startOfMonthIso(iso: string): string {
  parseIsoDate(iso);
  return `${iso.slice(0, 7)}-01`;
}

export function endOfMonthIso(iso: string): string {
  const { year, month } = parseIsoDate(iso);
  return toIso(new Date(Date.UTC(year, month, 0)));
}

/** Data de hoje como "YYYY-MM-DD" no fuso da aplicação. */
export function todayIso(now: Date = new Date(), timeZone = APP_TIME_ZONE): string {
  // en-CA formata como YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
}

/** "26/10/2026" */
export function formatDateBR(date: Date, timeZone = APP_TIME_ZONE): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone, dateStyle: 'short' }).format(date);
}

/** "segunda-feira, 26/10/2026 16:30" — usado no system prompt do agente. */
export function formatDateTimeBR(date: Date, timeZone = APP_TIME_ZONE): string {
  const weekday = new Intl.DateTimeFormat('pt-BR', { timeZone, weekday: 'long' }).format(date);
  const time = new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  return `${weekday}, ${formatDateBR(date, timeZone)} ${time}`;
}
