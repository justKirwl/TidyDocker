import { useEffect, useState } from 'react';
import { useStdout } from 'ink';

export interface TerminalSize {
  cols: number;
  rows: number;
}

export function useTerminalSize(): TerminalSize {
  const { stdout } = useStdout();
  const read = (): TerminalSize => ({ cols: stdout.columns || 100, rows: stdout.rows || 30 });
  const [size, setSize] = useState<TerminalSize>(read);

  useEffect(() => {
    const onResize = () => setSize({ cols: stdout.columns || 100, rows: stdout.rows || 30 });
    stdout.on('resize', onResize);
    return () => {
      stdout.off('resize', onResize);
    };
  }, [stdout]);

  return size;
}
