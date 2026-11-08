import { PythonBridge } from "./bridge";

export type ViewMode = 'DASHBOARD' | 'LOGS' | 'SERVER' | 'PRUNE';

export type ContainerStatus = 'running' | 'exited' | 'restarting';

export interface Container {
  id: string;
  name: string;
  image: string;
  status: ContainerStatus;
  ports: string;
  cpu: number;
  cpuHistory: number[];
  memUsedBytes: number;
  memLimitBytes: number;
  uptimeSec: number;
  netRxKbs: number;
  netTxKbs: number;
}

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export interface LogLine {
  seq: number;
  ts: string;
  text: string;
}

export interface ActionResult {
  ok: boolean;
  message: string;
}

export interface Backend {
  containers: Container[];
  logs: Record<string, LogLine[]>;
  linkOk: boolean;
  bridge: PythonBridge;
  toggle: (id: string) => ActionResult;
  restart: (id: string) => ActionResult;
  pruneStopped: () => number;
}

export type PrunePhase = 'confirm' | 'running' | 'done';

export type ToastKind = 'ok' | 'warn' | 'err';

export interface Toast {
  text: string;
  kind: ToastKind;
}
