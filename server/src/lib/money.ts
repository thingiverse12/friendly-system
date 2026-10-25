/**
 * Financial amounts are stored as integer öre (1 SEK = 100 öre).
 * No floating point arithmetic is used for balances, ledgers or scoring.
 */

export const MAX_AMOUNT_ORE = 1_000_000_000_00; // 1 billion SEK, protects integer math

/** Accepts "1299", "1299,50", "1 299.50", "1,299.50 kr" and returns integer öre. */
export function parseAmountToOre(input: string | number): number | null {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return null;
    input = String(input);
  }
  const cleaned = input
    .trim()
    .replace(/\s|kr|SEK/gi, '')
    .replace(/,/g, '.');
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const negative = cleaned.startsWith('-');
  const [wholeRaw, fracRaw = ''] = cleaned.replace('-', '').split('.') as [string, string?];
  const whole = Number.parseInt(wholeRaw, 10);
  const frac = Number.parseInt(fracRaw.padEnd(2, '0'), 10);
  if (!Number.isSafeInteger(whole)) return null;
  const ore = whole * 100 + frac;
  return negative ? -ore : ore;
}

export function isValidPositiveAmount(ore: number): boolean {
  return Number.isSafeInteger(ore) && ore > 0 && ore <= MAX_AMOUNT_ORE;
}

/**
 * Competition score in "centi-points" (1/100 of a point) so scores are stored as exact integers.
 * score = 100 * (current_balance - starting_balance) / locked_target_amount
 */
export function scoreCenti(currentOre: number, startingOre: number, lockedTargetOre: number): number {
  if (lockedTargetOre <= 0) throw new Error('locked target must be positive');
  return Math.round((10000 * (currentOre - startingOre)) / lockedTargetOre);
}

/** Renders centi-points as a number with two decimals, e.g. 1050 -> 10.5 */
export function centiToPoints(centi: number): number {
  return Math.round(centi) / 100;
}

export function formatPoints(centi: number): string {
  return centiToPoints(centi).toFixed(1).replace('.', ',');
}

/** Progress in basis points (10000 = 100.00%). exact integer maths. */
export function progressBps(balanceOre: number, targetOre: number): number {
  if (targetOre <= 0) return 0;
  return Math.floor((balanceOre * 10000) / targetOre);
}

export function formatSek(ore: number): string {
  const negative = ore < 0;
  const abs = Math.abs(ore);
  const kronor = Math.floor(abs / 100);
  const öre = abs % 100;
  const grouped = kronor.toLocaleString('sv-SE');
  const fraction = öre === 0 ? '' : `,${String(öre).padStart(2, '0')}`;
  return `${negative ? '−' : ''}${grouped}${fraction} kr`;
}

/** Competition class bucket: improves comparability, does not guarantee equal circumstances. */
export function competitionClass(lockedTargetOre: number, startingOre: number): string {
  const targetBand =
    lockedTargetOre < 5_000_00 ? 'A' : lockedTargetOre < 20_000_00 ? 'B' : lockedTargetOre < 50_000_00 ? 'C' : 'D';
  const startPct = progressBps(startingOre, lockedTargetOre);
  const startBand = startPct < 1000 ? '1' : startPct < 2500 ? '2' : startPct < 5000 ? '3' : '4';
  return `${targetBand}${startBand}`;
}

export function competitionClassLabel(code: string | null | undefined): string {
  if (!code) return 'Okänd klass';
  const targetLabels: Record<string, string> = {
    A: 'mål under 5 000 kr',
    B: 'mål 5 000–20 000 kr',
    C: 'mål 20 000–50 000 kr',
    D: 'mål över 50 000 kr',
  };
  const startLabels: Record<string, string> = {
    '1': 'start under 10 %',
    '2': 'start 10–25 %',
    '3': 'start 25–50 %',
    '4': 'start över 50 %',
  };
  return `Klass ${code} · ${targetLabels[code[0] ?? ''] ?? 'okänd'} · ${startLabels[code[1] ?? ''] ?? ''}`.trim();
}
