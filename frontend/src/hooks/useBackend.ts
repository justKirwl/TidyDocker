import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HISTORY_LEN, LOG_BUFFER, SIMULATE_LINK_DROPS } from '../config.js';
import { clamp, clockTime } from '../lib/format.js';
import type { ActionResult, Backend, Container, LogLevel, LogLine } from '../types.js';
import { useServerActions, useServerInfo } from '../stores/ServerStore.js';
import { PythonBridge } from '../bridge.js';
import { useContainersActions, useContainersState } from '../stores/ContainersStore.js';

type LogKind = 'proxy' | 'auth' | 'db' | 'cache' | 'worker' | 'ml' | 'metrics' | 'cron';
type Gen = () => string;

const n = (a: number, b: number): number => Math.floor(a + Math.random() * (b - a + 1));
const hex = (len: number): string =>
  Array.from({ length: len }, () => n(0, 15).toString(16)).join('');

const POOLS: Record<LogKind, { info: Gen[]; warn: Gen[]; error: Gen[] }> = {
  proxy: {
    info: [
      () => `GET /api/v1/users 200 ${n(2, 40)}ms`,
      () => `POST /api/v1/orders 201 ${n(20, 120)}ms`,
      () => `GET /static/app.${hex(6)}.js 304 ${n(1, 6)}ms`,
      () => 'GET /health 200 1ms',
    ],
    warn: [
      () => `upstream auth-service responded slowly: ${n(900, 2400)}ms`,
      () => `rate limit reached for client 10.0.${n(0, 9)}.${n(2, 250)}`,
    ],
    error: [
      () => 'upstream timed out (110) while reading response header',
      () => 'connect() failed (111: Connection refused) to 10.0.2.14:3000',
    ],
  },
  auth: {
    info: [
      () => `token issued for user_${n(1000, 9999)}`,
      () => 'session refreshed (ttl=3600s)',
      () => `GET /v1/me 200 ${n(3, 30)}ms`,
    ],
    warn: [
      () => `login attempt throttled for user_${n(1000, 9999)}`,
      () => 'jwks cache miss, refetching signing keys',
    ],
    error: [
      () => 'token verification FAILED: signature mismatch',
      () => 'ECONNRESET while talking to postgres-main',
    ],
  },
  db: {
    info: [
      () => `checkpoint complete: wrote ${n(100, 900)} buffers (${n(1, 6)}.${n(0, 9)}%)`,
      () => `connection received: host=10.0.1.${n(2, 40)} port=${n(40000, 60000)}`,
      () => `duration: ${n(1, 60)}.${n(0, 9)} ms  statement: SELECT * FROM orders`,
    ],
    warn: [
      () => `autovacuum: table "orders" dead tuples=${n(1000, 9000)}`,
      () => 'checkpoints are occurring too frequently (12 seconds apart)',
    ],
    error: [
      () => 'FATAL: too many connections for role "app"',
      () => 'ERROR: deadlock detected, process aborted',
    ],
  },
  cache: {
    info: [
      () => `${n(100, 900)} changes in 300 seconds. Saving...`,
      () => 'Background saving terminated with success',
      () => `DB 0: ${n(1000, 9000)} keys (${n(10, 400)} volatile) in 8192 slots`,
    ],
    warn: [
      () => `memory usage above ${n(70, 85)}% of maxmemory`,
      () => `slow command: KEYS * took ${n(20, 120)}ms`,
    ],
    error: [() => 'Background saving FAILED: no space left on device'],
  },
  worker: {
    info: [
      () => `job #${n(10000, 99999)} processed in ${n(40, 900)}ms`,
      () => `queue depth=${n(0, 40)}`,
      () => 'heartbeat ok',
    ],
    warn: [
      () => `job #${n(10000, 99999)} retry ${n(1, 3)}/5`,
      () => `queue depth high: ${n(200, 600)}`,
    ],
    error: [
      () => `job #${n(10000, 99999)} FAILED: TimeoutError after 30s`,
      () => 'ValueError: invalid payload schema',
    ],
  },
  ml: {
    info: [
      () => `batch ${n(1, 500)} inference ${n(20, 180)}ms`,
      () => 'model loaded: resnet50-v2',
    ],
    warn: [() => `GPU memory fragmentation ${n(10, 30)}%`],
    error: [() => 'CUDA error: out of memory — FAIL to allocate tensor'],
  },
  metrics: {
    info: [
      () => `Request Completed method=GET path=/api/ds/query status=200 duration=${n(5, 90)}ms`,
      () => 'plugin healthy: prometheus',
    ],
    warn: [() => `datasource slow: ${n(800, 1900)}ms`],
    error: [() => 'failed to render panel: query timeout'],
  },
  cron: {
    info: [() => 'cron job cleanup-tmp finished', () => 'next run scheduled in 15m'],
    warn: [() => 'disk usage on /var/backups above 80%'],
    error: [() => 'backup job FAILED with exit code 1'],
  },
};

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function makeMessage(kind: LogKind): { level: LogLevel; msg: string } {
  const roll = Math.random();
  const pool = POOLS[kind];
  if (roll < 0.74) return { level: 'INFO', msg: pick(pool.info)() };
  if (roll < 0.92) return { level: 'WARN', msg: pick(pool.warn)() };
  return { level: 'ERROR', msg: pick(pool.error)() };
}

const formatLine = (seq: number, level: LogLevel, msg: string, at: Date = new Date()): LogLine => ({
  seq,
  ts: clockTime(at),
  text: `${level.padEnd(5)}  ${msg}`,
});

interface Profile {
  kind: LogKind;
  baseCpu: number;
  baseMem: number;
}

interface Seed extends Profile {
  id: string;
  name: string;
  image: string;
  ports: string;
  running: boolean;
  memLimit: number;
  uptimeSec: number;
}

const SEEDS: Seed[] = [
  { id: '3f9a2c1b7d4e', name: 'api-gateway', image: 'nginx:1.27-alpine', ports: '80→80  443→443', kind: 'proxy', running: true, baseCpu: 24, baseMem: 180, memLimit: 512, uptimeSec: 3 * 86400 + 15132 },
  { id: '8c21e0aa56b9', name: 'auth-service', image: 'node:22-slim', ports: '3000→3000', kind: 'auth', running: true, baseCpu: 38, baseMem: 420, memLimit: 1024, uptimeSec: 86400 + 4021 },
  { id: 'b47d19f3c2a0', name: 'postgres-main', image: 'postgres:16', ports: '5432→5432', kind: 'db', running: true, baseCpu: 17, baseMem: 1380, memLimit: 2048, uptimeSec: 12 * 86400 + 777 },
  { id: '5e0a8d7714cc', name: 'redis-cache', image: 'redis:7.4-alpine', ports: '6379→6379', kind: 'cache', running: true, baseCpu: 8, baseMem: 96, memLimit: 256, uptimeSec: 12 * 86400 + 760 },
  { id: 'd91c6b38e5f2', name: 'worker-queue', image: 'python:3.12-slim', ports: '—', kind: 'worker', running: true, baseCpu: 62, baseMem: 610, memLimit: 1024, uptimeSec: 7 * 3600 + 2210 },
  { id: '1a7f43c09d8b', name: 'grafana', image: 'grafana/grafana:11.2', ports: '3001→3000', kind: 'metrics', running: true, baseCpu: 14, baseMem: 240, memLimit: 512, uptimeSec: 5 * 86400 + 9930 },
  { id: '6b2e90d5a3f7', name: 'ml-inference', image: 'pytorch/pytorch:2.4', ports: '8501→8501', kind: 'ml', running: false, baseCpu: 71, baseMem: 3100, memLimit: 4096, uptimeSec: 0 },
  { id: 'c05d78e1b4a6', name: 'legacy-cron', image: 'alpine:3.19', ports: '—', kind: 'cron', running: false, baseCpu: 3, baseMem: 24, memLimit: 128, uptimeSec: 0 },
];

const PROFILES = new Map<string, Profile>(SEEDS.map((s) => [s.id, { kind: s.kind, baseCpu: s.baseCpu, baseMem: s.baseMem }]));

const rnd = (min: number, max: number): number => min + Math.random() * (max - min);

const INITIAL_LINES = 45;

function createLogs(containers: Container[], seq: Record<string, number>): Record<string, LogLine[]> {
  const out: Record<string, LogLine[]> = {};
  for (const c of containers) {
    const kind = PROFILES.get(c.id)?.kind ?? 'proxy';
    const lines: LogLine[] = [];
    for (let i = 0; i < INITIAL_LINES; i++) {
      const { level, msg } = makeMessage(kind);
      lines.push(formatLine(i + 1, level, msg, new Date(Date.now() - (INITIAL_LINES - i) * 1500)));
    }
    let next = INITIAL_LINES;
    if (c.status === 'exited') {
      lines.push(formatLine(++next, 'WARN', 'received SIGTERM, shutting down'));
      lines.push(formatLine(++next, 'ERROR', 'container exited with code 137'));
    }
    seq[c.id] = next;
    out[c.id] = lines;
  }
  return out;
}

export function useBackend(): Backend {
  const seqRef = useRef<Record<string, number>>({});  
  const { linkOk } = useServerInfo();
  const { setLinkOk, setServerLogs } = useServerActions();

  const containers = useContainersState();
  const { setContainers } = useContainersActions();

  const [logs, setLogs] = useState<Record<string, LogLine[]>>(() => createLogs(containers, seqRef.current));

  const bridge = useMemo(() => {
    return new PythonBridge((packet) => {
      switch (packet.type) {
        case "pong":
          setLinkOk(true);
          break
        case "serverLog":
          setServerLogs([{
            seq: Math.random() * 1000,
            ts: clockTime(),
            text: `${packet.data.level.padEnd(5)}  ${packet.data.msg}`,
          }].slice(-LOG_BUFFER));
          break
        case "containers":
          setContainers(packet.data);
          break
        case "container.metrics":
          setContainers([packet.data])
          break
      }
    })
  }, [])

  const containersRef = useRef(containers);
  containersRef.current = containers;
  const linkRef = useRef(true);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  const pushLog = useCallback((id: string, level: LogLevel, msg: string) => {
    const seq = (seqRef.current[id] = (seqRef.current[id] ?? 0) + 1);
    const line = formatLine(seq, level, msg);
    setLogs((prev) => ({ ...prev, [id]: [...(prev[id] ?? []), line].slice(-LOG_BUFFER) }));
  }, []);

  useEffect(() => {
    bridge.start();

    bridge.sendCommand("ping");
    bridge.sendCommand("containers.list");
    bridge.sendCommand("containers.metrics")
    const pingInterval = setInterval(() => {
      bridge.sendCommand("ping");
    }, 2000)

    return () => {
      clearInterval(pingInterval);
      bridge.stop();
    }
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      if (!linkRef.current) return;
      const additions: Record<string, LogLine[]> = {};
      for (const c of containersRef.current) {
        if (c.status !== 'running' || Math.random() > 0.6) continue;
        const kind = PROFILES.get(c.id)?.kind ?? 'proxy';
        const count = Math.random() < 0.25 ? 2 : 1;
        const lines: LogLine[] = [];
        for (let i = 0; i < count; i++) {
          const seq = (seqRef.current[c.id] = (seqRef.current[c.id] ?? 0) + 1);
          const { level, msg } = makeMessage(kind);
          lines.push(formatLine(seq, level, msg));
        }
        additions[c.id] = lines;
      }
      if (Object.keys(additions).length === 0) return;
      setLogs((prev) => {
        const next = { ...prev };
        for (const [cid, lines] of Object.entries(additions)) {
          next[cid] = [...(next[cid] ?? []), ...lines].slice(-LOG_BUFFER);
        }
        return next;
      });
    }, 700);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!SIMULATE_LINK_DROPS) return;
    let t = 0;
    const id = setInterval(() => {
      t = (t + 1) % 60;
      const ok = !(t >= 40 && t < 44);
      linkRef.current = ok;
      setLinkOk(ok);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const set = timers.current;
    return () => {
      set.forEach(clearTimeout);
      set.clear();
    };
  }, []);

  const toggle = useCallback(
    (id: string): ActionResult => {
      const c = containersRef.current.find((x) => x.id === id);
      if (!c) return { ok: false, message: 'Container not found' };
      if (c.status === 'restarting') return { ok: false, message: `${c.name}: is restarting` };

      if (c.status === 'running') {
        setContainers(
          containers.map((x) => (x.id === id ? { ...x, status: 'exited', cpu: 0, memUsedMb: 0, netRxKbs: 0, netTxKbs: 0 } : x)),
        );
        pushLog(id, 'WARN', 'received SIGTERM, shutting down gracefully');
        pushLog(id, 'INFO', 'container stopped');
        return { ok: true, message: `■ ${c.name} is stopped` };
      }

      const base = PROFILES.get(id)?.baseMem ?? 100;
      setContainers(
        containers.map((x) => (x.id === id ? { ...x, status: 'running', uptimeSec: 0, memUsedMb: base * 0.6 } : x)),
      );
      pushLog(id, 'INFO', 'container started');
      return { ok: true, message: `► ${c.name} is started` };
    },
    [pushLog],
  );

  const restart = useCallback(
    (id: string): ActionResult => {
      const c = containersRef.current.find((x) => x.id === id);
      if (!c) return { ok: false, message: 'Container not found' };
      if (c.status === 'restarting') return { ok: false, message: `${c.name}: is already restarting` };

      setContainers(containers.map((x) => (x.id === id ? { ...x, status: 'restarting' } : x)));
      pushLog(id, 'WARN', 'restart requested');

      const t = setTimeout(() => {
        timers.current.delete(t);
        const base = PROFILES.get(id)?.baseMem ?? 100;
        setContainers(
          containers.map((x) => (x.id === id ? { ...x, status: 'running', uptimeSec: 0, memUsedMb: base * 0.7 } : x)),
        );
        pushLog(id, 'INFO', 'container started');
      }, 2200);
      timers.current.add(t);
      return { ok: true, message: `↻ ${c.name} is restarting…` };
    },
    [pushLog],
  );

  const pruneStopped = useCallback((): number => {
    const stopped = containersRef.current.filter((c) => c.status === 'exited');
    if (stopped.length === 0) return 0;
    const ids = new Set(stopped.map((c) => c.id));
    setContainers(containers.filter((c) => !ids.has(c.id)));
    setLogs((prev) => Object.fromEntries(Object.entries(prev).filter(([cid]) => !ids.has(cid))));
    return stopped.length;
  }, []);

  return { containers, logs, linkOk, bridge, toggle, restart, pruneStopped };
}
