import { Box, Text } from 'ink';
import { renderAreaChart, renderChart } from '../lib/chart.js';
import { barParts, clamp, formatBytes, formatRate, formatUptime } from '../lib/format.js';
import { C, CHART_GRADIENT, statusColor, statusGlyph, statusLabel } from '../theme.js';
import type { Container } from '../types.js';
import { Button } from './Button.js';
import { Panel } from './Panel.js';
import { useServerInfo } from '../stores/ServerStore.js';

interface AnalyticsProps {
  width: number;
  height: number;
  container: Container | undefined;
}

const Label = ({ children }: { children: string }) => <Text color={C.subtle}>{children}</Text>;

export function Analytics({ width, height, container: c }: AnalyticsProps) {
  const { linkOk } = useServerInfo();

  const innerW = width - 4;
  const bodyH = height - 2;
  const rightText = linkOk ? '● LIVE' : '○ STALE';
  const rightColor = linkOk ? C.running : C.stopped;

  if (!c) {
    return (
      <Panel width={width} height={height} title="TELEMETRY" right={rightText} rightColor={rightColor}>
        <Box flexGrow={1} alignItems="center" justifyContent="center">
          <Text color={C.subtle}>No container selected</Text>
        </Box>
      </Panel>
    );
  }

  const running = c.status === 'running';
  const busy = c.status === 'restarting';
  const hist = c.cpuHistory;
  const min = Math.min(...hist);
  const max = Math.max(...hist);
  const avg = hist.reduce((a, b) => a + b, 0) / Math.max(1, hist.length);

  const ramPct = c.memLimitBytes > 0 ? (c.memUsedBytes / c.memLimitBytes) * 100 : 0;
  const ramColor = !running ? C.muted : ramPct >= 85 ? C.stopped : ramPct >= 60 ? C.gold : C.accent;
  const [ramFill, ramEmpty] = barParts(ramPct / 100, innerW);

  const chartRows = clamp(bodyH - 12, 2, 8);
  const axisW = 4;
  const chartW = Math.max(10, innerW - axisW);
  const area = renderAreaChart(hist, chartW, chartRows);

  const labels = Array.from({ length: chartRows }, () => '   ');
  labels[0] = '100';
  labels[chartRows - 1] = '  0';
  if (chartRows >= 3) labels[Math.floor((chartRows - 1) / 2)] = ' 50';

  const rowColor = (i: number): string => {
    if (!running) return C.muted;
    const fromBottom = chartRows - 1 - i;
    const idx = Math.min(CHART_GRADIENT.length - 1, Math.floor((fromBottom / chartRows) * CHART_GRADIENT.length));
    return CHART_GRADIENT[idx];
  };

  return (
    <Panel width={width} height={height} title="TELEMETRY" right={rightText} rightColor={rightColor}>
      <Box justifyContent="space-between">
        <Text>
          <Text color={statusColor(c.status)} bold>{`${statusGlyph(c.status)} ${statusLabel(c.status)}`}</Text>
          <Text color={C.text} bold>{`  ${c.name}`}</Text>
        </Text>
        <Text>
          <Label>UP </Label>
          <Text color={C.text}>{running ? formatUptime(c.uptimeSec) : '—'}</Text>
        </Text>
      </Box>
      <Box justifyContent="space-between">
        <Text>
          <Label>IMAGE </Label>
          <Text color={C.text}>{c.image}</Text>
        </Text>
        <Text>
          <Label>ID </Label>
          <Text color={C.text}>{c.id.slice(0, 12)}</Text>
        </Text>
      </Box>
      {c.ports ? <Box justifyContent="space-between">
        <Text>
          <Label>PORTS </Label>
          <Text color={C.text}>{c.ports}</Text>
        </Text>
        <Text>
          <Label>NET </Label>
          <Text color={C.accent}>{`↓ ${running ? formatRate(c.netRxKbs) : '—'}`}</Text>
          <Text color={CHART_GRADIENT[3]}>{`  ↑ ${running ? formatRate(c.netTxKbs) : '—'}`}</Text>
        </Text>
      </Box> : (
        <Box justifyContent='flex-end'>
          <Text>
            <Label>NET </Label>
            <Text color={C.accent}>{`↓ ${running ? formatRate(c.netRxKbs) : '—'}`}</Text>
            <Text color={CHART_GRADIENT[3]}>{`  ↑ ${running ? formatRate(c.netTxKbs) : '—'}`}</Text>
          </Text>
        </Box>
      )}

      <Text color={C.muted}>{'─'.repeat(innerW)}</Text>

      <Box justifyContent="space-between">
        <Text>
          <Text color={C.accent} bold>
            CPU{' '}
          </Text>
          <Text color={C.text} bold>
            {running ? `${c.cpu.toFixed(1)}%`.padStart(6) : '     —'}
          </Text>
          <Text color={C.accent}>{`  ${renderChart(hist)}`}</Text>
        </Text>
        {c.cpuHistory.length > 0 && <Text color={C.subtle}>{`MIN ${Math.round(min)}  AVG ${Math.round(avg)}  MAX ${Math.round(max)}`}</Text>}
      </Box>
      <Box flexDirection="column">
        {area.map((line, i) => (
          <Text key={i} wrap="truncate-end">
            <Text color={C.muted}>{`${labels[i]}│`}</Text>
            <Text color={rowColor(i)}>{line}</Text>
          </Text>
        ))}
      </Box>

      <Text color={C.muted}>{'─'.repeat(innerW)}</Text>

      <Box justifyContent="space-between">
        <Text>
          <Text color={C.accent} bold>
            RAM{' '}
          </Text>
          <Text color={C.text} bold>
            {running ? `${formatBytes(c.memUsedBytes, true)} / ${formatBytes(c.memLimitBytes)}` : `— / ${formatBytes(c.memLimitBytes)}`}
          </Text>
          <Text color={ramColor}>{running ? `  (${ramPct.toFixed(1)}%)` : ''}</Text>
        </Text>
        <Text color={C.subtle}>{running ? `FREE ${formatBytes(c.memLimitBytes - c.memUsedBytes)}` : ''}</Text>
      </Box>
      <Text>
        <Text color={ramColor}>{ramFill}</Text>
        <Text color={C.muted}>{ramEmpty}</Text>
      </Text>

      <Box flexGrow={1} />
      <Box columnGap={1}>
        <Button k="S" label={running || busy ? 'Stop' : 'Run'} disabled={busy} />
        <Button k="R" label="Restart" disabled={busy} />
        <Button k="L" label="Logs" />
      </Box>
    </Panel>
  );
}
