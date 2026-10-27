export function dayKey(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function ordinalSuffix(day: number): string {
  if (!Number.isInteger(day) || day < 1 || day > 31) throw Error('Invalid day of month.');
  if (day >= 11 && day <= 13) return 'th';
  return ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[day % 10] ?? 'th';
}
export function dateBannerParts(now: number | Date) {
  const date = new Date(now);
  const day = date.getDate();
  return {
    day,
    suffix: ordinalSuffix(day),
    month: new Intl.DateTimeFormat('en', { month: 'long' }).format(date),
    key: dayKey(date),
  };
}
export function parseDay(key: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw Error('Invalid local date.');
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(y, m - 1, d);
  date.setHours(12, 0, 0, 0);
  if (dayKey(date) !== key) throw Error('Invalid local date.');
  return date;
}
export function addDays(key: string, count: number): string {
  const date = parseDay(key);
  date.setDate(date.getDate() + count);
  return dayKey(date);
}
export function monthGrid(year: number, month: number, weekStartsOn: 0 | 1): string[] {
  const first = new Date(0);
  first.setFullYear(year, month, 1);
  first.setHours(12, 0, 0, 0);
  const offset = (first.getDay() - weekStartsOn + 7) % 7;
  return Array.from({ length: 42 }, (_, i) => addDays(dayKey(first), i - offset));
}
