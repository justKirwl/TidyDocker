import { useCallback, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { Analytics } from './components/Analytics.js';
import { ContainerList } from './components/ContainerList.js';
import { Footer, type Hint } from './components/Footer.js';
import { Header } from './components/Header.js';
import { LogsView } from './components/LogsView.js';
import { PruneView } from './components/PruneView.js';
import { MIN_COLS, MIN_ROWS } from './config.js';
import { useBackend } from './hooks/useBackend.js';
import { useServerLogs } from './hooks/useServerLogs.js';
import { useTerminalSize } from './hooks/useTerminalSize.js';
import { useToast } from './hooks/useToast.js';
import { clamp } from './lib/format.js';
import { normalizeKey } from './lib/keys.js';
import { C } from './theme.js';
import type { Container, PrunePhase, ViewMode } from './types.js';

const DASHBOARD_HINTS: readonly Hint[] = [
  ['↑↓', 'Navigation'],
  ['S', 'Start/Stop'],
  ['R', 'Restart'],
  ['L', 'Logs'],
  ['B', 'Server'],
  ['P', 'Prune drive'],
  ['Esc', 'Quit'],
];

const LOGS_HINTS: readonly Hint[] = [
  ['↑↓', 'Scroll'],
  ['F', 'To the end (follow)'],
  ['Esc', 'Go back'],
];

const SERVER_HINTS: readonly Hint[] = [
  ['↑↓', 'Scroll'],
  ['F', 'To the end (follow)'],
  ['C', 'Clear'],
  ['Esc', 'Go back'],
];

export default function App() {
  const { exit } = useApp();
  const { cols, rows } = useTerminalSize();
  const backend = useBackend();
  const { toast, notify } = useToast();

  const [mode, setMode] = useState<ViewMode>('DASHBOARD');
  const [selected, setSelected] = useState(0);
  const [prunePhase, setPrunePhase] = useState<PrunePhase>('confirm');

  const { containers, logs: containerLogs, linkOk } = backend;
  const { serverLogs, clearServerLogs } = useServerLogs();
  const sel = clamp(selected, 0, Math.max(0, containers.length - 1));
  const current: Container | undefined = containers[sel];

  const requireLink = (): boolean => {
    if (linkOk) return true;
    notify('No signal with server — action canceled', 'err');
    return false;
  };

  useInput(
    (input, key) => {
      if (key.escape) {
        exit();
        return;
      }
      if (key.ctrl || key.meta) return;

      const k = normalizeKey(input);

      if (key.upArrow || k === 'k') {
        setSelected(Math.max(0, sel - 1));
      } else if (key.downArrow || k === 'j') {
        setSelected(Math.min(containers.length - 1, sel + 1));
      } else if (k === 's' && current) {
        if (!requireLink()) return;
        const r = backend.toggle(current.id);
        notify(r.message, r.ok ? 'ok' : 'warn');
      } else if (k === 'r' && current) {
        if (!requireLink()) return;
        const r = backend.restart(current.id);
        notify(r.message, r.ok ? 'ok' : 'warn');
      } else if (k === 'l' && current) {
        setMode('LOGS');
      } else if (k === 'b') {
        setMode('SERVER');
      } else if (k === 'p') {
        if (requireLink()) setMode('PRUNE');
      }
    },
    { isActive: mode === 'DASHBOARD' },
  );

  const handlePruneApply = useCallback(
    (freedGb: number) => {
      const removed = backend.pruneStopped();
      notify(`✓ Prune is completed: cleared ${freedGb.toFixed(1)} GB (containers deleted: ${removed})`, 'ok');
    },
    [backend.pruneStopped, notify],
  );
  const closeOverlay = useCallback(() => setMode('DASHBOARD'), []);

  if (cols < MIN_COLS || rows < MIN_ROWS) {
    return (
      <Box width={cols} height={Math.max(1, rows - 1)} alignItems="center" justifyContent="center" flexDirection="column">
        <Text color={C.accent} bold>
          ◈ TidyDocker
        </Text>
        <Text color={C.text}>{`Enlarge the terminal window: minimum ${MIN_COLS}×${MIN_ROWS}`}</Text>
        <Text color={C.subtle}>{`now ${cols}×${rows}`}</Text>
      </Box>
    );
  }

  const height = rows - 1;
  const mainH = height - 3 - 3;
  const leftW = Math.floor(cols / 3);
  const rightW = cols - leftW;

  let hints: readonly Hint[] = DASHBOARD_HINTS;
  let note: string | undefined;
  if (mode === 'LOGS') hints = LOGS_HINTS;
  if (mode === 'SERVER') hints = SERVER_HINTS;
  if (mode === 'PRUNE') {
    if (prunePhase === 'confirm') hints = [['Y', 'Confirm'], ['N / Esc', 'Cancel']];
    else if (prunePhase === 'done') hints = [['Enter', 'Go back']];
    else {
      hints = [];
      note = 'Disk cleanup in progress — input is blocked until completion…';
    }
  }

  return (
    <Box flexDirection="column" width={cols} height={height}>
      <Header width={cols} toast={toast} />

      <Box height={mainH}>
        {mode === 'DASHBOARD' || (mode === 'LOGS' && !current) ? (
          <>
            <ContainerList width={leftW} height={mainH} containers={containers} selected={sel} />
            <Analytics width={rightW} height={mainH} container={current} />
          </>
        ) : null}

        {mode === 'LOGS' && current ? (
          <LogsView
            width={cols}
            height={mainH}
            title={`LOGS · ${current.name}`}
            lines={containerLogs[current.id] ?? []}
            running={current.status === 'running'}
            onBack={closeOverlay}
          />
        ) : null}

        {mode === 'SERVER' ? (
          <LogsView
            width={cols}
            height={mainH}
            title="LOGS OF SERVER · tidydocker-api"
            lines={serverLogs}
            onBack={closeOverlay}
            onClear={clearServerLogs}
          />
        ) : null}

        {mode === 'PRUNE' ? (
          <Box width={cols} height={mainH} alignItems="center" justifyContent="center">
            <PruneView
              width={cols}
              height={mainH}
              stoppedCount={containers.filter((c) => c.status === 'exited').length}
              onPhase={setPrunePhase}
              onApply={handlePruneApply}
              onClose={closeOverlay}
            />
          </Box>
        ) : null}
      </Box>

      <Footer width={cols} hints={hints} note={note} />
    </Box>
  );
}