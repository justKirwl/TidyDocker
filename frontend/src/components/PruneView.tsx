import { useEffect, useRef, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useSpinner } from '../hooks/useTicker.js';
import { barParts } from '../lib/format.js';
import { normalizeKey } from '../lib/keys.js';
import { C } from '../theme.js';
import type { PrunePhase } from '../types.js';
import { Button } from './Button.js';
import { Panel } from './Panel.js';

interface Step {
  label: string;
  detail: string;
  gb: number;
  ms: number;
}

const fmtGb = (gb: number): string => `${gb.toFixed(1)} GB`;
const TICK_MS = 80;

function StepRow(props: {
  icon: string;
  iconColor: string;
  label: string;
  labelColor: string;
  detail: string;
  size: string;
  sizeColor: string;
  innerW: number;
}) {
  return (
    <Box width={props.innerW}>
      <Box width={2}>
        <Text color={props.iconColor} bold>
          {props.icon}
        </Text>
      </Box>
      <Box flexGrow={1}>
        <Text color={props.labelColor} wrap="truncate-end">
          {props.label}
        </Text>
      </Box>
      <Box width={9}>
        <Text color={C.subtle}>{props.detail}</Text>
      </Box>
      <Box width={11} justifyContent="flex-end">
        <Text color={props.sizeColor}>{props.size}</Text>
      </Box>
    </Box>
  );
}

interface PruneViewProps {
  width: number;
  height: number;
  stoppedCount: number;
  onPhase: (p: PrunePhase) => void;
  onApply: (freedGb: number) => void;
  onClose: () => void;
}

export function PruneView({ width, height, stoppedCount, onPhase, onApply, onClose }: PruneViewProps) {
  const [phase, setPhase] = useState<PrunePhase>('confirm');
  const [elapsed, setElapsed] = useState(0);
  const spin = useSpinner(phase === 'running', TICK_MS);
  const applied = useRef(false);

  const panelW = Math.min(78, width - 2);
  const panelH = Math.min(height, 14);
  const innerW = panelW - 4;

  const [steps] = useState<Step[]>(() => [
    { label: 'Stopped containers', detail: `${stoppedCount} pcs.`, gb: stoppedCount * 0.15, ms: 1300 },
    { label: 'Dangling-образы', detail: '7 pcs.', gb: 1.8, ms: 1800 },
    { label: 'Неиспользуемые тома', detail: '3 pcs.', gb: 0.9, ms: 1300 },
    { label: 'Кэш сборки (build cache)', detail: '—', gb: 2.1, ms: 1900 },
  ]);
  const totalMs = steps.reduce((a, s) => a + s.ms, 0);
  const totalGb = steps.reduce((a, s) => a + s.gb, 0);

  useEffect(() => {
    onPhase(phase);
  }, [phase, onPhase]);

  useEffect(() => {
    if (phase !== 'running') return;
    const id = setInterval(() => setElapsed((e) => e + TICK_MS), TICK_MS);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase === 'running' && elapsed >= totalMs) {
      setPhase('done');
      if (!applied.current) {
        applied.current = true;
        onApply(totalGb);
      }
    }
  }, [phase, elapsed, totalMs, totalGb, onApply]);

  useInput((input, key) => {
    const k = normalizeKey(input);
    if (phase === 'confirm') {
      if (k === 'y' || key.return) setPhase('running');
      else if (k === 'n' || key.escape) onClose();
    } else if (phase === 'done') {
      if (key.return || key.escape || input === ' ') onClose();
    }
  });

  let acc = 0;
  const bounds = steps.map((s) => {
    const from = acc;
    acc += s.ms;
    return { from, to: acc };
  });

  const pct = phase === 'done' ? 1 : Math.min(1, elapsed / totalMs);
  const [fill, empty] = barParts(pct, Math.max(10, innerW - 6));

  return (
    <Panel
      width={panelW}
      height={panelH}
      title="PRUNE DRIVE"
      right={phase === 'running' ? `${spin} PRUNE` : phase === 'done' ? '✓ DONE' : 'CONFIRM'}
      rightColor={phase === 'done' ? C.running : phase === 'running' ? C.accent : C.gold}
      focused
    >
      {phase === 'confirm' && (
        <Text>
          <Text color={C.gold} bold>
            ▲ WARNING{'  '}
          </Text>
          <Text color={C.text}>Unused Docker resources will be removed.</Text>
        </Text>
      )}
      {phase === 'running' && (
        <Text>
          <Text color={C.accent} bold>
            {spin}{' '}
          </Text>
          <Text color={C.text}>Cleaning is in progress — please wait…</Text>
        </Text>
      )}
      {phase === 'done' && (
        <Text>
          <Text color={C.running} bold>
            ✓ PRUNE COMPLETED{'  '}
          </Text>
          <Text color={C.text}>Released </Text>
          <Text color={C.accent} bold>
            {fmtGb(totalGb)}
          </Text>
        </Text>
      )}

      <Box marginTop={1} flexDirection="column">
        {steps.map((s, i) => {
          const b = bounds[i];
          const done = phase === 'done' || (phase === 'running' && elapsed >= b.to);
          const active = phase === 'running' && !done && elapsed >= b.from;
          return (
            <StepRow
              key={s.label}
              innerW={innerW}
              icon={done ? '✓' : active ? spin : '◦'}
              iconColor={done ? C.running : active ? C.accent : C.muted}
              label={s.label}
              labelColor={done || active || phase === 'confirm' ? C.text : C.subtle}
              detail={s.detail}
              size={done ? `-${fmtGb(s.gb)}` : active ? '…' : `≈ ${fmtGb(s.gb)}`}
              sizeColor={done ? C.running : active ? C.accent : C.subtle}
            />
          );
        })}
      </Box>

      {phase === 'confirm' && (
        <>
          <Text color={C.muted}>{'─'.repeat(innerW)}</Text>
          <Box justifyContent="space-between">
            <Text color={C.text} bold>
              OVERALL
            </Text>
            <Text color={C.accent} bold>{`≈ ${fmtGb(totalGb)}`}</Text>
          </Box>
        </>
      )}

      {phase === 'running' && (
        <Box marginTop={1}>
          <Text color={C.accent}>{fill}</Text>
          <Text color={C.muted}>{empty}</Text>
          <Text color={C.text} bold>{` ${String(Math.round(pct * 100)).padStart(3)}%`}</Text>
        </Box>
      )}

      <Box flexGrow={1} />
      <Box columnGap={1}>
        {phase === 'confirm' && (
          <>
            <Button k="Y" label="Confirm" borderColor={C.accent} />
            <Button k="N" label="Cancel" />
          </>
        )}
        {phase === 'done' && <Button k="Enter" label="Go back" borderColor={C.accent} />}
      </Box>
    </Panel>
  );
}
