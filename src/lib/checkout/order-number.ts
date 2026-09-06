export function formatOrderNumber(sequence: number): string {
  return `CF-${String(sequence).padStart(5, '0')}`;
}

export function normalizeOrderNumber(input: string): string {
  return input.trim().toUpperCase();
}

export function isOrderNumber(input: string): boolean {
  return /^CF-\d{5,}$/.test(normalizeOrderNumber(input));
}
