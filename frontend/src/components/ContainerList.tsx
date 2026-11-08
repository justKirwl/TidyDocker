import { Box, Text } from 'ink';
import { clamp, fit, formatBytes } from '../lib/format.js';
import { C, statusColor, statusGlyph } from '../theme.js';
import type { Container } from '../types.js';
import { Panel } from './Panel.js';

interface ContainerListProps {
  width: number;
  height: number;
  containers: Container[];
  selected: number;
}

function rightCell(c: Container): string {
  if (c.status === 'running') return `${Math.round(c.cpu)}%`.padStart(5);
  if (c.status === 'restarting') return '    ↻';
  return '    —';
}

function Row({ c, focused, innerW }: { c: Container; focused: boolean; innerW: number }) {
  const nameW = Math.max(4, innerW - 10);
  const name = fit(c.name, nameW);
  const glyph = statusGlyph(c.status);
  const right = rightCell(c);

  if (focused) {
    return (
      <Text backgroundColor={C.accent} color={C.onAccent} bold wrap="truncate-end">
        {`► ${glyph} ${name} ${right}`}
      </Text>
    );
  }

  return (
    <Text wrap="truncate-end">
      <Text>{'  '}</Text>
      <Text color={statusColor(c.status)}>{`${glyph} `}</Text>
      <Text color={c.status === 'exited' ? C.subtle : C.text}>{name}</Text>
      <Text color={C.subtle}>{` ${right}`}</Text>
    </Text>
  );
}

export function ContainerList({ width, height, containers, selected }: ContainerListProps) {
  const innerW = width - 4;
  const bodyH = height - 2;
  const SUMMARY_ROWS = 3;
  const visible = Math.max(1, bodyH - SUMMARY_ROWS);
  const start = clamp(selected - Math.floor(visible / 2), 0, Math.max(0, containers.length - visible));
  const slice = containers.slice(start, start + visible);

  const up = containers.filter((c) => c.status === 'running').length;
  const restarting = containers.filter((c) => c.status === 'restarting').length;
  const down = containers.length - up - restarting;
  const totalCpu = containers.reduce((a, c) => a + c.cpu, 0);
  const totalMem = containers.reduce((a, c) => a + c.memUsedBytes, 0);

  return (
    <Panel
      width={width}
      height={height}
      title="CONTAINERS"
      right={containers.length > 0 ? `${selected + 1}/${containers.length}` : '0/0'}
      focused
    >
      <Box flexDirection="column" flexGrow={1}>
        {slice.length === 0 ? (
          <Text color={C.subtle}>No containers</Text>
        ) : (
          slice.map((c) => <Row key={c.id} c={c} focused={containers[selected]?.id === c.id} innerW={innerW} />)
        )}
      </Box>

      <Text color={C.muted}>{'─'.repeat(innerW)}</Text>
      <Text wrap="truncate-end">
        <Text color={C.running}>{`● ${up} up`}</Text>
        <Text color={C.stopped}>{`   ○ ${down} down`}</Text>
        {restarting > 0 ? <Text color={C.restarting}>{`   ◐ ${restarting}`}</Text> : null}
      </Text>
      <Text color={C.subtle} wrap="truncate-end">{`Σ CPU ${Math.round(totalCpu)}%   RAM ${formatBytes(totalMem)}`}</Text>
    </Panel>
  );
}
