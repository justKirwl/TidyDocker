import { Box, Text } from 'ink';
import { VERSION } from '../config.js';
import { useTicker } from '../hooks/useTicker.js';
import { C } from '../theme.js';
import type { Toast } from '../types.js';
import { useServerInfo } from '../stores/ServerStore.js';

const TOAST_COLOR = { ok: C.running, warn: C.gold, err: C.stopped } as const;

function LinkBadge({ ok }: { ok: boolean }) {
  const tick = useTicker(500, !ok);
  if (ok) {
    return (
      <Text color={C.running} bold>
        [ LINK OK ]
      </Text>
    );
  }
  return (
    <Text color={tick % 2 === 0 ? C.error : C.errorDim} bold>
      [ LINK LOST ]
    </Text>
  );
}

interface HeaderProps {
  width: number;
  toast: Toast | null;
}

export function Header({ width, toast }: HeaderProps) {
  const { linkOk } = useServerInfo();

  return (
    <Box
      borderStyle="round"
      borderColor={C.muted}
      width={width}
      height={3}
      paddingX={1}
      justifyContent="space-between"
    >
      <Box flexShrink={0}>
        <Text color={C.accent} bold>
          ◈ TIDY
        </Text>
        <Text color={C.text} bold>
          DOCKER
        </Text>
        <Text color={C.muted}> │ </Text>
        <Text color={C.subtle}>v{VERSION}</Text>
      </Box>

      <Box flexGrow={1} flexShrink={1} justifyContent="center" paddingX={2}>
        {toast ? (
          <Text color={TOAST_COLOR[toast.kind]} wrap="truncate-end">
            {toast.text}
          </Text>
        ) : null}
      </Box>

      <Box flexShrink={0}>
        <Text color={C.subtle}>SERVER </Text>
        <LinkBadge ok={linkOk} />
      </Box>
    </Box>
  );
}
