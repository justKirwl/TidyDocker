import { useEffect, useState } from 'react';
import { SPINNER } from '../theme.js';

export function useTicker(ms: number, active = true): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setN((v) => v + 1), ms);
    return () => clearInterval(id);
  }, [ms, active]);
  return n;
}

export function useSpinner(active = true, ms = 80): string {
  const n = useTicker(ms, active);
  return SPINNER[n % SPINNER.length];
}
