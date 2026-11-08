import type { ContainerStatus } from './types.ts';

export const C = {
  bg: '#0B0C10',
  text: '#E0E0E0',
  muted: '#414868',
  subtle: '#8089AE',
  accent: '#00F5D4',
  onAccent: '#0B0C10',
  running: '#73DACA',
  stopped: '#F7768E',
  restarting: '#E0AF68',
  info: '#7AA2F7',
  gold: '#FFD166',
  error: '#FF2E63',
  errorDim: '#5A2433',
} as const;

export const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const;

export const CHART_GRADIENT = ['#00F5D4', '#2AC3DE', '#7AA2F7', '#BB9AF7', '#F7768E'] as const;

export function statusColor(s: ContainerStatus): string {
  switch (s) {
    case 'running':
      return C.running;
    case 'restarting':
      return C.restarting;
    default:
      return C.stopped;
  }
}

export function statusLabel(s: ContainerStatus): string {
  switch (s) {
    case 'running':
      return 'RUNNING';
    case 'restarting':
      return 'RESTARTING';
    default:
      return 'EXITED';
  }
}

export function statusGlyph(s: ContainerStatus): string {
  switch (s) {
    case 'running':
      return '●';
    case 'restarting':
      return '◐';
    default:
      return '○';
  }
}
