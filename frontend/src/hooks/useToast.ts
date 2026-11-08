import { useCallback, useEffect, useRef, useState } from 'react';
import type { Toast, ToastKind } from '../types.js';

export function useToast(): { toast: Toast | null; notify: (text: string, kind?: ToastKind) => void } {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const notify = useCallback((text: string, kind: ToastKind = 'ok') => {
    setToast({ text, kind });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { toast, notify };
}
