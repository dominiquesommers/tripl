/**
 * Parses a date-only or date+time string as UTC midnight of that calendar date,
 * discarding any time-of-day. Use for genuine date-only fields (check_in, check_out,
 * expense date, plan start_date), and also when comparing a datetime field
 * (departure_at/arrival_at) against day-granularity itinerary dates — i.e. "which
 * calendar day does this fall on", not "what time".
 */
export function parseUTCDate(dateStr: string): Date {
  return new Date(dateStr.split(/[T ]/)[0] + 'T00:00:00Z');
}

/**
 * Parses a full datetime string as an instant in UTC, preserving time-of-day.
 * Use for genuine datetime fields (departure_at/arrival_at) when actual elapsed
 * duration matters — e.g. rental day-rate math — not just which calendar day
 * something falls on. Normalizes a space separator to 'T' and assumes UTC when
 * no explicit offset/Z is present.
 */
export function parseUTCDateTime(dateTimeStr: string): Date {
  const trimmed = dateTimeStr.trim().replace(' ', 'T');
  const hasOffset = /[Zz]|[+-]\d{2}:?\d{2}$/.test(trimmed);
  return new Date(hasOffset ? trimmed : trimmed + 'Z');
}

export function daysBetween(start: Date, end: Date): number {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

export function clampDate(date: Date, min: Date, max: Date): Date {
  if (date < min) return min;
  if (date > max) return max;
  return date;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseUTCDate(date) : date;
  const day = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
  const dd  = String(d.getUTCDate()).padStart(2, '0');
  const mm  = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yy  = String(d.getUTCFullYear()).slice(2);
  return `${day} ${dd}-${mm}-'${yy}`;
}