export const SERVER_COUNT = 3;

export type AlgorithmKey = "round-robin" | "least-conn";

export const ALGORITHM_LABELS: Record<AlgorithmKey, string> = {
  "round-robin": "Round Robin",
  "least-conn": "Least Connection",
};

export interface SimConfig {
  requestCount: number;
  baseDelay: number;
  arrivalGap: number;
  serverDelays: number[];
}

export interface AssignedRequest {
  id: number;
  server: number;
  arrival: number;
  start: number;
  finish: number;
  latency: number;
  processingMs: number;
  queueDepth: number;
  hostname: string;
  serverName: string;
}

export interface ClusterRequestSnapshot {
  requestId: number;
  algorithm: string;
  processingMs: number;
  queueDepth: number;
  startedAt: number;
  finishedAt: number;
}

export interface ClusterServerSnapshot {
  serverName: string;
  serverColor: string;
  serverIndex: number;
  hostname: string;
  activeConnections: number;
  totalRequests: number;
  completedRequests: number;
  peakActiveConnections: number;
  baseDelayMs: number;
  extraDelayMs: number;
  averageProcessingMs: number;
  lastRequest: ClusterRequestSnapshot | null;
  history: ClusterRequestSnapshot[];
}

export interface ServerResult {
  index: number;
  handled: number;
  busyTime: number;
  avgLatency: number;
  avgProcessingMs: number;
  peakQueueDepth: number;
  hostname: string;
  extraDelayMs: number;
  activeConnections: number;
  totalRequests: number;
}

export interface AlgorithmResult {
  key: AlgorithmKey;
  label: string;
  requests: AssignedRequest[];
  servers: ServerResult[];
  makespan: number;
  avgLatency: number;
  p95Latency: number;
}

export function buildAlgorithmResult(
  key: AlgorithmKey,
  label: string,
  requests: AssignedRequest[],
  cluster: ClusterServerSnapshot[],
): AlgorithmResult {
  const snapshotByIndex = new Map(cluster.map((server) => [server.serverIndex, server]));

  const servers: ServerResult[] = Array.from({ length: SERVER_COUNT }, (_, index) => {
    const own = requests.filter((request) => request.server === index);
    const snapshot = snapshotByIndex.get(index);
    const busyTime = own.reduce((sum, request) => sum + request.processingMs, 0);
    const avgLatency = own.length
      ? own.reduce((sum, request) => sum + request.latency, 0) / own.length
      : 0;

    return {
      index,
      handled: own.length,
      busyTime,
      avgLatency,
      avgProcessingMs: own.length ? busyTime / own.length : snapshot?.averageProcessingMs || 0,
      peakQueueDepth: own.reduce((max, request) => Math.max(max, request.queueDepth), 0),
      hostname: snapshot?.hostname || own[0]?.hostname || "-",
      extraDelayMs: snapshot?.extraDelayMs || 0,
      activeConnections: snapshot?.activeConnections || 0,
      totalRequests: snapshot?.totalRequests || own.length,
    };
  });

  const latencies = requests.map((request) => request.latency).sort((a, b) => a - b);
  const makespan = requests.reduce((max, request) => Math.max(max, request.finish), 0);
  const avgLatency = latencies.length
    ? latencies.reduce((sum, value) => sum + value, 0) / latencies.length
    : 0;
  const p95Index = Math.max(0, Math.ceil(latencies.length * 0.95) - 1);
  const p95Latency = latencies.length ? latencies[p95Index] : 0;

  return { key, label, requests, servers, makespan, avgLatency, p95Latency };
}

export const SERVER_TONES = [
  {
    name: "server 1",
    text: "text-orange-100",
    bg: "bg-orange-500/10",
    border: "border-orange-400/25",
    bar: "bg-orange-500",
    dot: "bg-orange-500",
  },
  {
    name: "server 2",
    text: "text-sky-100",
    bg: "bg-sky-500/10",
    border: "border-sky-400/25",
    bar: "bg-blue-500",
    dot: "bg-blue-500",
  },
  {
    name: "server 3",
    text: "text-amber-100",
    bg: "bg-amber-500/10",
    border: "border-amber-400/25",
    bar: "bg-amber-500",
    dot: "bg-amber-500",
  },
] as const;
