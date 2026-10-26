/** Parses a Swedish money string into exact integer öre. Returns null when invalid. */
export function parseSekToOre(input: string): number | null {
  const cleaned = input
    .trim()
    .replace(/\s/g, '')
    .replace(/kr|SEK/gi, '')
    .replace(/,/g, '.');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ''] = cleaned.split('.') as [string, string?];
  const wholeNumber = Number.parseInt(whole, 10);
  const ore = Number.parseInt(fraction.padEnd(2, '0') || '0', 10);
  if (!Number.isSafeInteger(wholeNumber)) return null;
  return wholeNumber * 100 + ore;
}

export function formatSek(ore: number, options: { compact?: boolean; signed?: boolean } = {}): string {
  const negative = ore < 0;
  const abs = Math.abs(ore);
  const kronor = Math.floor(abs / 100);
  const rest = abs % 100;
  const grouped = kronor.toLocaleString('sv-SE');
  const fraction = rest === 0 ? '' : `,${String(rest).padStart(2, '0')}`;
  const sign = negative ? '−' : options.signed ? '+' : '';
  if (options.compact && kronor >= 1_000_000) {
    return `${sign}${(abs / 100 / 1_000_000).toFixed(1).replace('.', ',')} mkr`;
  }
  return `${sign}${grouped}${fraction} kr`;
}

export function formatOreInput(ore: number): string {
  return (ore / 100).toFixed(2).replace('.', ',');
}

export function formatPercent(bps: number): string {
  return `${Math.round(bps / 100)} %`;
}

export function formatScore(centi: number): string {
  return (centi / 100).toFixed(1).replace('.', ',');
}

export function formatDate(iso: string, timezone = 'Europe/Stockholm'): string {
  return new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: timezone })
    .format(new Date(iso))
    .replace('.', '');
}

export function formatShortDate(iso: string, timezone = 'Europe/Stockholm'): string {
  return new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short', timeZone: timezone })
    .format(new Date(iso))
    .replace('.', '');
}

export function formatDateTime(iso: string, timezone = 'Europe/Stockholm'): string {
  return new Intl.DateTimeFormat('sv-SE', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  }).format(new Date(iso));
}

export function toDateInput(iso: string, timezone = 'Europe/Stockholm'): string {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timezone,
  }).format(new Date(iso));
  return parts.split(' ')[0] ?? '';
}

export function fromDateInput(date: string): string {
  return new Date(`${date}T12:00:00`).toISOString();
}

export function daysLeft(endsAt: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((Date.parse(endsAt) - now) / 86_400_000));
}

export function timeLeft(endsAt: string, now = Date.now()): string {
  const ms = Date.parse(endsAt) - now;
  if (ms <= 0) return 'Avslutad';
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days > 0) return `${days} d ${hours} h kvar`;
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours} h ${minutes} min kvar`;
}

export function greeting(date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat('sv-SE', { hour: 'numeric', hour12: false, timeZone: 'Europe/Stockholm' }).format(date),
  );
  if (hour < 5) return 'God natt';
  if (hour < 10) return 'God morgon';
  if (hour < 18) return 'Hej';
  return 'God kväll';
}

export function initials(alias: string): string {
  const cleaned = alias.replace(/[^a-zA-ZåäöÅÄÖ0-9]/g, ' ').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'S';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
}
