import {
  ALGORITHM_LABELS,
  buildAlgorithmResult,
  type AlgorithmKey,
  type AlgorithmResult,
  type AssignedRequest,
  type ClusterServerSnapshot,
  type SimConfig,
} from "./simulation";

const BACKEND_KEYS = ["server-1", "server-2", "server-3"] as const;

interface StatusEnvelope {
  ok: boolean;
  status: ClusterServerSnapshot;
}

interface BackendRequestResponse {
  ok: boolean;
  requestId: number;
  algorithm: string;
  serverName: string;
  serverColor: string;
  serverIndex: number;
  hostname: string;
  processingMs: number;
  queueDepth: number;
  startedAt: number;
  finishedAt: number;
  activeConnections: number;
  totalRequests: number;
}

function abortError() {
  return new DOMException("Simulation aborted", "AbortError");
}

async function readError(response: Response) {
  const fallback = `HTTP ${response.status}`;
  const contentType = response.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      const payload = await response.json();
      return payload.error || payload.message || fallback;
    }

    const text = await response.text();
    return text || fallback;
  } catch {
    return fallback;
  }
}

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as T;
}

function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }

    const timeoutId = window.setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      window.clearTimeout(timeoutId);
      cleanup();
      reject(abortError());
    };

    const cleanup = () => {
      signal?.removeEventListener("abort", onAbort);
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function fetchClusterStatus(signal?: AbortSignal) {
  return Promise.all(
    BACKEND_KEYS.map((backendKey) =>
      requestJson<ClusterServerSnapshot>(`/api/backends/${backendKey}/status`, { signal }),
    ),
  );
}

export async function resetCluster(signal?: AbortSignal) {
  await Promise.all(
    BACKEND_KEYS.map((backendKey) =>
      requestJson<StatusEnvelope>(`/api/backends/${backendKey}/reset`, {
        method: "POST",
        signal,
      }),
    ),
  );

  return fetchClusterStatus(signal);
}

export async function configureCluster(config: SimConfig, signal?: AbortSignal) {
  await Promise.all(
    BACKEND_KEYS.map((backendKey, index) =>
      requestJson<StatusEnvelope>(`/api/backends/${backendKey}/config`, {
        method: "POST",
        body: JSON.stringify({
          baseDelayMs: config.baseDelay,
          extraDelayMs: config.serverDelays[index],
        }),
        signal,
      }),
    ),
  );

  return fetchClusterStatus(signal);
}

export async function runLiveAlgorithm(
  key: AlgorithmKey,
  config: SimConfig,
  options?: {
    signal?: AbortSignal;
    onRequestResolved?: (requestId: number) => void;
  },
): Promise<{ result: AlgorithmResult; cluster: ClusterServerSnapshot[] }> {
  const runStartedAt = performance.now();

  const requests = Array.from({ length: config.requestCount }, (_, index) => {
    const requestId = index + 1;
    const arrival = index * config.arrivalGap;

    return (async (): Promise<AssignedRequest> => {
      await wait(arrival, options?.signal);

      if (options?.signal?.aborted) {
        throw abortError();
      }

      const start = performance.now() - runStartedAt;
      const payload = await requestJson<BackendRequestResponse>(
        `/api/${key}/request?requestId=${requestId}&algorithm=${key}`,
        { signal: options?.signal },
      );
      const finish = performance.now() - runStartedAt;

      options?.onRequestResolved?.(requestId);

      return {
        id: requestId,
        server: payload.serverIndex,
        arrival,
        start,
        finish,
        latency: finish - start,
        processingMs: payload.processingMs,
        queueDepth: payload.queueDepth,
        hostname: payload.hostname,
        serverName: payload.serverName,
      };
    })();
  });

  const completedRequests = await Promise.all(requests);
  const cluster = await fetchClusterStatus(options?.signal);

  return {
    result: buildAlgorithmResult(key, ALGORITHM_LABELS[key], completedRequests, cluster),
    cluster,
  };
}