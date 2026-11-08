import { render } from 'ink';
import App from './App';
import { C } from './theme';

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error('TidyDocker UI требует интерактивный терминал (TTY).');
  process.exit(1);
}

const out = process.stdout;
const paintBg = process.env.TIDY_NO_BG !== '1';

out.write('\x1b[?1049h\x1b[2J\x1b[H');
if (paintBg) out.write(`\x1b]11;${C.bg}\x07`);

process.on('exit', () => {
  if (paintBg) out.write('\x1b]111\x07');
  out.write('\x1b[?1049l\x1b[?25h');
});
for (const sig of ['SIGTERM', 'SIGHUP'] as const) {
  process.on(sig, () => process.exit(0));
}

const app = render(<App />, { exitOnCtrlC: true });
await app.waitUntilExit();