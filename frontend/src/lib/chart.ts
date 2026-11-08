/** 8 уровней высоты: пробел + ▂…█ (любое значение > 0 даёт минимум ▂ — без «провалов»). */
const BLOCKS = [' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'] as const;

/** Полный набор восьмых долей — для многострочного графика. */
const EIGHTHS = [' ', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'] as const;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/**
 * Превращает массив замеров (обычно последние 10–15 значений CPU, %)
 * в строку Unicode-блоков разной высоты.
 *
 * @param history значения от 0 до `max`
 * @param max     значение, соответствующее полной высоте (по умолчанию 100 %)
 */
export function renderChart(history: number[], max = 100): string {
  const top = BLOCKS.length - 1;
  return history
    .map((v) => {
      if (!Number.isFinite(v) || v <= 0) return BLOCKS[0];
      const idx = Math.max(1, Math.round(clamp01(v / max) * top));
      return BLOCKS[idx];
    })
    .join('');
}

/** Линейная интерполяция ряда до нужной ширины — график получается плавным, а не «лесенкой». */
export function resample(values: number[], width: number): number[] {
  if (width <= 0) return [];
  if (values.length === 0) return Array<number>(width).fill(0);
  if (values.length === 1) return Array<number>(width).fill(values[0]);

  const out: number[] = [];
  const last = values.length - 1;
  for (let i = 0; i < width; i++) {
    const pos = (i / Math.max(1, width - 1)) * last;
    const lo = Math.floor(pos);
    const hi = Math.min(last, lo + 1);
    const t = pos - lo;
    out.push(values[lo] * (1 - t) + values[hi] * t);
  }
  return out;
}

/**
 * Многострочный area-график. Возвращает `rows` строк сверху вниз,
 * каждая шириной `width`; вертикальное разрешение — rows × 8 уровней.
 */
export function renderAreaChart(history: number[], width: number, rows: number, max = 100): string[] {
  const data = resample(history, width);
  const lines: string[] = [];
  for (let r = rows - 1; r >= 0; r--) {
    let line = '';
    for (const v of data) {
      const raw = clamp01(v / max) * rows * 8;
      const units = v > 0 ? Math.max(1, Math.round(raw)) : 0;
      const fill = Math.min(8, Math.max(0, units - r * 8));
      line += EIGHTHS[fill];
    }
    lines.push(line);
  }
  return lines;
}
