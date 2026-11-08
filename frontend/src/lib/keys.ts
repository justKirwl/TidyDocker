/**
 * Горячие клавиши работают и в русской раскладке (ЙЦУКЕН):
 * s↔ы, r↔к, l↔д, p↔з, y↔н, n↔т, f↔а, k↔л, j↔о.
 */
const RU_TO_EN: Record<string, string> = {
  ы: 's',
  к: 'r',
  д: 'l',
  з: 'p',
  н: 'y',
  т: 'n',
  а: 'f',
  л: 'k',
  о: 'j',
};

/** Приводит ввод к нижнему регистру латиницы. */
export function normalizeKey(input: string): string {
  const ch = input.toLowerCase();
  return RU_TO_EN[ch] ?? ch;
}
