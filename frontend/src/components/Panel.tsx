import type { ReactNode } from 'react';
import { Box, Text } from 'ink';
import { C } from '../theme.js';

interface PanelProps {
  width: number;
  height: number;
  title: string;
  right?: string;
  rightColor?: string;
  focused?: boolean;
  children: ReactNode;
}

export function Panel({ width, height, title, right, rightColor, focused = false, children }: PanelProps) {
  const border = focused ? C.accent : C.muted;
  const titleText = ` ${title} `;
  const rightText = right ? ` ${right} ` : '';
  const fill = Math.max(0, width - 3 - titleText.length - rightText.length - (right ? 1 : 0));

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Text wrap="truncate-end">
        <Text color={border}>╭─</Text>
        <Text color={focused ? C.accent : C.text} bold>
          {titleText}
        </Text>
        <Text color={border}>{'─'.repeat(fill)}</Text>
        {right ? (
          <Text color={rightColor ?? C.subtle} bold>
            {rightText}
          </Text>
        ) : null}
        <Text color={border}>{right ? '─╮' : '╮'}</Text>
      </Text>
      <Box
        borderStyle="round"
        borderTop={false}
        borderColor={border}
        flexDirection="column"
        flexGrow={1}
        paddingX={1}
        overflow="hidden"
      >
        {children}
      </Box>
    </Box>
  );
}
