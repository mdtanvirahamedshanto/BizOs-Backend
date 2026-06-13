/**
 * Date and timezone utilities.
 * All dates in BizOS are stored and transmitted as UTC ISO 8601 strings.
 */

/**
 * Get the current UTC timestamp as a Date object.
 */
export function utcNow(): Date {
  return new Date();
}

/**
 * Check if a date has passed (is in the past relative to now).
 */
export function isExpired(date: Date): boolean {
  return date.getTime() < Date.now();
}

/**
 * Add a duration to a date.
 * Supports ms, s, m, h, d suffixes.
 */
export function addDuration(date: Date, duration: string): Date {
  const match = duration.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}. Use format: 15m, 7d, 24h, etc.`);
  }

  const value = parseInt(match[1]!, 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  const result = new Date(date.getTime() + value * (multipliers[unit!] ?? 0));
  return result;
}

/**
 * Format a date for display (ISO 8601 UTC).
 */
export function formatISO(date: Date): string {
  return date.toISOString();
}
