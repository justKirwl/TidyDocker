export function fit(s: string, w: number): string {
  if (w <= 0) return '';
  if (s.length > w) return s.slice(0, Math.max(0, w - 1)) + '…';
  return s.padEnd(w);
}

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

const pad2 = (n: number): string => String(n).padStart(2, '0');

export function formatUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const hms = `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  return d > 0 ? `${d}d ${hms}` : hms;
}

export function formatRate(kbs: number): string {
  return kbs >= 1024 ? `${(kbs / 1024).toFixed(1)} MB/s` : `${Math.round(kbs)} KB/s`;
}

const SIZE_QUANTITIES = ["B", "KB", "MB", "GB", "TB"]

export function formatBytes(bytes: number, round?: boolean): string {
  let i = 0;
  while (bytes >= 1024 && i < (SIZE_QUANTITIES.length - 1)) {
    bytes /= 1024;
    i++;
  }

  return `${round ? Math.round(bytes) : bytes.toFixed(1)} ${SIZE_QUANTITIES[i]}`
}

export function barParts(ratio: number, width: number): [string, string] {
  const filled = Math.round(clamp(ratio, 0, 1) * width);
  return ['█'.repeat(filled), '░'.repeat(Math.max(0, width - filled))];
}

export function clockTime(d: Date = new Date()): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}
