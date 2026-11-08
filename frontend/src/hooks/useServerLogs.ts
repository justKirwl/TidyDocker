import type { LogLine } from '../types.js';
import { useServerActions, useServerStoreLogs } from '../stores/ServerStore.js';

export interface ServerLogs {
  serverLogs: LogLine[];
  setServerLogs: (loglines: LogLine[]) => void;
  clearServerLogs: () => void;
}

export function useServerLogs(): ServerLogs {
  const serverLogs = useServerStoreLogs();
  const { setServerLogs, clearServerLogs } = useServerActions();

  return { serverLogs, setServerLogs, clearServerLogs };
}