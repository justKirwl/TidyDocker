import { Box, Text } from 'ink';
import { C } from '../theme.js';

interface ButtonProps {
  k: string;
  label: string;
  disabled?: boolean;
  borderColor?: string;
}

export function Button({ k, label, disabled = false, borderColor = C.subtle }: ButtonProps) {
  return (
    <Box borderStyle="round" borderColor={disabled ? C.muted : borderColor} paddingX={1}>
      <Text color={disabled ? C.muted : C.accent} bold>
        {`[${k}]`}
      </Text>
      <Text color={disabled ? C.muted : C.text}>{` ${label}`}</Text>
    </Box>
  );
}
