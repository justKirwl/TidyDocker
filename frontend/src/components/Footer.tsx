import { Box, Text } from 'ink';
import { C } from '../theme.js';

export type Hint = readonly [key: string, label: string];

interface FooterProps {
  width: number;
  hints: readonly Hint[];
  note?: string;
}

export function Footer({ width, hints, note }: FooterProps) {
  return (
    <Box borderStyle="round" borderColor={C.muted} width={width} height={3} paddingX={1}>
      <Text wrap="truncate-end">
        {hints.map(([key, label], i) => (
          <Text key={key}>
            {i > 0 ? '  ' : ''}
            <Text color={C.accent} bold>
              {`[${key}]`}
            </Text>
            <Text color={C.text}>{` ${label}`}</Text>
          </Text>
        ))}
        {note ? <Text color={C.subtle}>{`${hints.length > 0 ? '  ' : ''}${note}`}</Text> : null}
      </Text>
    </Box>
  );
}
