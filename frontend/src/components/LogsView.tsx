import { useEffect, useRef, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useSpinner } from '../hooks/useTicker.js';
import { normalizeKey } from '../lib/keys.js';
import { C } from '../theme.js';
import type { LogLine } from '../types.js';
import { Panel } from './Panel.js';
import { useServerInfo } from '../stores/ServerStore.js';

const KEYWORD = /(\bINFO\b|\bWARN(?:ING)?\b|\bERROR\b|\bFATAL\b|\bFAIL(?:ED|URE|URES|S)?\b|\bDEBUG\b)/i;

function levelColor(word: string): string {
  const w = word.toUpperCase();
  if (w === 'INFO') return C.info;
  if (w.startsWith('WARN')) return C.gold;
  if (w === 'DEBUG') return C.subtle;
  return C.error;
}

function Highlighted({ text }: { text: string }) {
  const parts = text.split(KEYWORD);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <Text key={i} color={levelColor(p)} bold>
            {p}
          </Text>
        ) : (
          <Text key={i} color={C.text}>
            {p}
          </Text>
        ),
      )}
    </>
  );
}

function LogRow({ line }: { line: LogLine }) {
  return (
    <Text wrap="truncate-end">
      <Text color={C.subtle}>{`${line.ts}  `}</Text>
      <Highlighted text={line.text} />
    </Text>
  );
}

interface LogsViewProps {
  width: number;
  height: number;
  title: string;
  lines: LogLine[];
  running?: boolean;
  onBack: () => void;
  onClear?: () => void;
}

export function LogsView({ width, height, title, lines, running = true, onBack, onClear }: LogsViewProps) {
  const spin = useSpinner(true, 80);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);

  const { linkOk } = useServerInfo();

  const visible = Math.max(1, height - 2);
  const maxOffset = Math.max(0, lines.length - visible);
  const off = Math.min(offset, maxOffset);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(t);
  }, []);

  const lastSeq = lines.length > 0 ? lines[lines.length - 1].seq : 0;
  const prevSeq = useRef(lastSeq);
  useEffect(() => {
    const delta = lastSeq - prevSeq.current;
    prevSeq.current = lastSeq;
    if (delta > 0) setOffset((o) => (o > 0 ? o + delta : 0));
  }, [lastSeq]);

  useInput((input, key) => {
    if (key.escape) {
      onBack();
      return;
    }
    const k = normalizeKey(input);
    if (key.upArrow || k === 'k') setOffset(Math.min(maxOffset, off + 1));
    else if (key.downArrow || k === 'j') setOffset(Math.max(0, off - 1));
    else if (k === 'f') setOffset(0);
    else if (k === 'c' && onClear) {
      onClear();
      setOffset(0);
    }
  });

  const endIdx = lines.length - off;
  const shown = lines.slice(Math.max(0, endIdx - visible), endIdx);

  let right: string;
  let rightColor: string;
  if (loading) {
    right = `${spin} CONNECTING`;
    rightColor = C.gold;
  } else if (!linkOk) {
    right = '○ NO LINK';
    rightColor = C.stopped;
  } else if (off > 0) {
    right = `‖ PAUSED +${off}`;
    rightColor = C.gold;
  } else if (!running) {
    right = '○ STOPPED';
    rightColor = C.stopped;
  } else {
    right = `${spin} LIVE`;
    rightColor = C.running;
  }

  return (
    <Panel width={width} height={height} title={title} right={right} rightColor={rightColor} focused>
      {loading ? (
        <Box flexGrow={1} alignItems="center" justifyContent="center">
          <Text color={C.accent} bold>
            {spin}
          </Text>
          <Text color={C.subtle}>{'  Connecting to a log flow…'}</Text>
        </Box>
      ) : (
        <Box flexDirection="column" flexGrow={1} justifyContent="flex-end">
          {shown.length === 0 ? <Text color={C.subtle}>— log is empty —</Text> : null}
          {shown.map((l) => (
            <LogRow key={l.seq} line={l} />
          ))}
        </Box>
      )}
    </Panel>
  );
}