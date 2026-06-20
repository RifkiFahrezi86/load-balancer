import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Network,
  CheckCircle2,
  Loader2,
  ScrollText,
  Boxes,
  Cpu,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Badge } from "./components/ui/badge";
import { ControlPanel } from "./components/load-balancer/ControlPanel";
import { AlgorithmBoard } from "./components/load-balancer/AlgorithmBoard";
import {
  SERVER_TONES,
  type SimConfig,
  type AlgorithmKey,
  type AlgorithmResult,
  type ClusterServerSnapshot,
} from "./components/load-balancer/simulation";
import {
  configureCluster,
  fetchClusterStatus,
  resetCluster,
  runLiveAlgorithm,
} from "./components/load-balancer/api";

interface LogEntry {
  id: string;
  time: string;
  message: string;
  tone: "info" | "success" | "danger";
}

const DEFAULT_CONFIG: SimConfig = {
  requestCount: 30,
  baseDelay: 450,
  arrivalGap: 70,
  serverDelays: [1600, 0, 0],
};

type Status = { label: string; tone: "idle" | "running" | "success" };

const EMPTY_VISIBLE_REQUESTS: Record<AlgorithmKey, number[]> = {
  "round-robin": [],
  "least-conn": [],
};

function fmtMs(ms: number) {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${Math.round(ms)} ms`;
}

export default function App() {
  const [config, setConfig] = useState<SimConfig>(DEFAULT_CONFIG);
  const [results, setResults] = useState<AlgorithmResult[]>([]);
  const [cluster, setCluster] = useState<ClusterServerSnapshot[]>([]);
  const [visibleRequestIds, setVisibleRequestIds] = useState<Record<AlgorithmKey, number[]>>(
    EMPTY_VISIBLE_REQUESTS,
  );
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<Status>({ label: "Siap dijalankan", tone: "idle" });
  const [log, setLog] = useState<LogEntry[]>([]);
  const activeRun = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  const total = config.requestCount;

  const bestKey = useMemo(() => {
    if (results.length < 2) return null;
    return results.reduce((best, r) => (r.makespan < best.makespan ? r : best)).key;
  }, [results]);

  const pushLog = (message: string, tone: LogEntry["tone"] = "info") => {
    const time = new Date().toLocaleTimeString("id-ID");
    setLog((prev) => [
      { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, time, message, tone },
      ...prev,
    ].slice(0, 40));
  };

  const cancelActiveRun = () => {
    if (activeRun.current) {
      activeRun.current.abort();
      activeRun.current = null;
    }
  };

  const revealRequest = (key: AlgorithmKey, requestId: number) => {
    setVisibleRequestIds((prev) => {
      if (prev[key].includes(requestId)) {
        return prev;
      }

      return {
        ...prev,
        [key]: [...prev[key], requestId].sort((a, b) => a - b),
      };
    });
  };

  const runAll = async () => {
    cancelActiveRun();

    const controller = new AbortController();
    activeRun.current = controller;

    setRunning(true);
    setResults([]);
    setVisibleRequestIds(EMPTY_VISIBLE_REQUESTS);
    setStatus({ label: "Menyiapkan cluster backend...", tone: "running" });
    pushLog(`Menyiapkan ${config.requestCount} request untuk dua algoritma.`, "info");

    try {
      const preparedCluster = await configureCluster(config, controller.signal);
      if (controller.signal.aborted || !mounted.current) return;

      setCluster(preparedCluster);
      pushLog("Delay backend berhasil diperbarui.", "success");

      const cleanCluster = await resetCluster(controller.signal);
      if (controller.signal.aborted || !mounted.current) return;

      setCluster(cleanCluster);
      pushLog("Counter backend direset. Memulai Round Robin.", "info");
      setStatus({ label: "Menjalankan Round Robin...", tone: "running" });

      const roundRobinRun = await runLiveAlgorithm("round-robin", config, {
        signal: controller.signal,
        onRequestResolved: (requestId) => revealRequest("round-robin", requestId),
      });

      if (controller.signal.aborted || !mounted.current) return;

      setResults([roundRobinRun.result]);
      setCluster(roundRobinRun.cluster);
      pushLog(
        `Round Robin selesai dalam ${fmtMs(roundRobinRun.result.makespan)} dengan rata-rata latensi ${fmtMs(roundRobinRun.result.avgLatency)}.`,
        "success",
      );

      await resetCluster(controller.signal);
      if (controller.signal.aborted || !mounted.current) return;

      pushLog("Counter backend direset. Memulai Least Connection.", "info");
      setStatus({ label: "Menjalankan Least Connection...", tone: "running" });

      const leastConnRun = await runLiveAlgorithm("least-conn", config, {
        signal: controller.signal,
        onRequestResolved: (requestId) => revealRequest("least-conn", requestId),
      });

      if (controller.signal.aborted || !mounted.current) return;

      const nextResults = [roundRobinRun.result, leastConnRun.result];
      const winner = nextResults.reduce((best, entry) =>
        entry.makespan < best.makespan ? entry : best,
      );

      setResults(nextResults);
      setCluster(leastConnRun.cluster);
      setStatus({ label: `Selesai - ${winner.label} tercepat`, tone: "success" });
      pushLog(
        `Least Connection selesai dalam ${fmtMs(leastConnRun.result.makespan)}. Pemenang akhir: ${winner.label}.`,
        "success",
      );
    } catch (error) {
      if (controller.signal.aborted || !mounted.current) {
        return;
      }

      const message = error instanceof Error ? error.message : "Terjadi kesalahan saat menjalankan simulasi.";
      setStatus({ label: "Simulasi gagal", tone: "idle" });
      pushLog(message, "danger");
    } finally {
      if (activeRun.current === controller) {
        activeRun.current = null;
      }

      if (mounted.current) {
        setRunning(false);
      }
    }
  };

  const refreshCluster = async () => {
    setStatus({ label: "Mengambil snapshot cluster...", tone: "running" });

    try {
      const snapshot = await fetchClusterStatus();
      if (!mounted.current) return;

      setCluster(snapshot);
      setStatus({ label: "Snapshot cluster diperbarui", tone: "idle" });
      pushLog("Snapshot cluster terbaru berhasil diambil.", "info");
    } catch (error) {
      if (!mounted.current) return;

      const message = error instanceof Error ? error.message : "Gagal mengambil snapshot cluster.";
      setStatus({ label: "Gagal mengambil snapshot", tone: "idle" });
      pushLog(message, "danger");
    }
  };

  const clearLog = () => {
    setLog([]);
  };

  const statusStyles: Record<Status["tone"], string> = {
    idle: "border-white/10 bg-white/5 text-white/70",
    running: "border-cyan-400/30 bg-cyan-500/10 text-cyan-100",
    success: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
  };

  useEffect(() => {
    void runAll();

    return () => {
      mounted.current = false;
      cancelActiveRun();
    };
  }, []);

  return (
    <div className="dark min-h-screen w-full bg-[#08111f] text-foreground">
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(251,191,36,0.14),_transparent_26%),linear-gradient(180deg,_#08111f_0%,_#0d1728_100%)]">
        <div className="mx-auto w-full max-w-[1480px] px-4 py-8 sm:px-6">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl border border-white/10 bg-white/8 text-white shadow-lg shadow-cyan-900/30 backdrop-blur">
              <Network className="size-6" />
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/70">
                Load Balancer Simulation
              </p>
              <h1 className="leading-tight text-white">Load Balancer Dashboard</h1>
              <p className="mt-1 max-w-2xl text-sm text-white/60">
                Gateway Nginx membandingkan distribusi Round Robin dan Least Connection ke tiga backend Node.js di dalam Docker.
              </p>
            </div>
          </div>

          <div
            className={`flex min-h-12 items-center gap-2 rounded-2xl border px-4 shadow-lg shadow-black/10 backdrop-blur ${statusStyles[status.tone]}`}
          >
            {status.tone === "running" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : status.tone === "success" ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <span className="size-2.5 rounded-full bg-current opacity-60" />
            )}
            <span>{status.label}</span>
          </div>
        </header>

        {/* Body */}
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[360px_1fr]">
          <ControlPanel
            config={config}
            running={running}
            onChange={setConfig}
            onRun={runAll}
            onRefresh={refreshCluster}
            onClear={clearLog}
          />

          <div className="grid gap-6">
            <Card className="gap-0 overflow-hidden border-white/10 bg-white/[0.04] shadow-2xl shadow-black/20 backdrop-blur">
              <CardHeader className="border-b border-white/10 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-white/60">
                      <Boxes className="size-4" />
                      <span className="text-xs uppercase tracking-[0.18em]">Cluster Snapshot</span>
                    </div>
                    <CardTitle className="mt-2 text-lg text-white">Status Backend Terakhir</CardTitle>
                  </div>
                  <Badge variant="outline" className="border-white/10 bg-white/5 text-white/70">
                    {cluster.length} backend aktif
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 pt-5 md:grid-cols-3">
                {cluster.map((server) => {
                  const tone = SERVER_TONES[server.serverIndex];

                  return (
                    <div
                      key={server.serverName}
                      className={`rounded-2xl border ${tone.border} ${tone.bg} p-4`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className={`capitalize ${tone.text}`}>{server.serverName}</p>
                          <p className="text-xs text-white/50">{server.hostname}</p>
                        </div>
                        <span className="rounded-full border border-white/10 bg-black/15 px-2 py-1 text-xs text-white/70">
                          +{server.extraDelayMs} ms
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-white/65">
                        <div className="rounded-xl border border-white/10 bg-black/15 px-3 py-2">
                          <p className="text-[0.7rem] uppercase tracking-[0.12em]">Aktif</p>
                          <p className="tabular-nums text-white">{server.activeConnections}</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/15 px-3 py-2">
                          <p className="text-[0.7rem] uppercase tracking-[0.12em]">Total</p>
                          <p className="tabular-nums text-white">{server.totalRequests}</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/15 px-3 py-2">
                          <p className="text-[0.7rem] uppercase tracking-[0.12em]">Peak</p>
                          <p className="tabular-nums text-white">{server.peakActiveConnections}</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/15 px-3 py-2">
                          <p className="text-[0.7rem] uppercase tracking-[0.12em]">Avg Proc</p>
                          <p className="tabular-nums text-white">{fmtMs(server.averageProcessingMs)}</p>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-xs text-white/60">
                        <span className="inline-flex items-center gap-2">
                          <Cpu className="size-3.5" />
                          Request terakhir
                        </span>
                        <span className="tabular-nums text-white">
                          {server.lastRequest ? `#${server.lastRequest.requestId}` : "-"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {results.length === 0 ? (
              <Card className="border-dashed border-white/10 bg-white/[0.03]">
                <CardContent className="grid place-items-center gap-3 py-20 text-center">
                  <span className="grid size-14 place-items-center rounded-full border border-white/10 bg-white/5 text-white/60">
                    <Network className="size-7" />
                  </span>
                  <div>
                    <p className="text-white">Belum ada hasil simulasi.</p>
                    <p className="text-white/55">
                      Dashboard akan menjalankan simulasi otomatis saat halaman terbuka atau ketika tombol dijalankan ulang ditekan.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              results.map((result) => (
                <AlgorithmBoard
                  key={result.key}
                  result={result}
                  total={total}
                  isBest={result.key === bestKey}
                  visibleRequestIds={visibleRequestIds[result.key]}
                />
              ))
            )}

            {/* Activity log */}
            <Card className="gap-0 overflow-hidden border-white/10 bg-white/[0.04] shadow-2xl shadow-black/20 backdrop-blur">
              <CardHeader className="border-b border-white/10 pb-4">
                <div className="flex items-center gap-2 text-white/60">
                  <ScrollText className="size-4" />
                  <span className="text-xs uppercase tracking-[0.18em]">Log</span>
                </div>
                <CardTitle className="text-lg text-white">Aktivitas</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {log.length === 0 ? (
                  <p className="py-6 text-center text-white/50">Log masih kosong.</p>
                ) : (
                  <div className="grid gap-2">
                    <AnimatePresence initial={false}>
                      {log.map((entry) => (
                        <motion.div
                          key={entry.id}
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${
                            entry.tone === "success"
                              ? "border-emerald-400/20 bg-emerald-500/10"
                              : entry.tone === "danger"
                                ? "border-orange-400/20 bg-orange-500/10"
                                : "border-white/10 bg-white/[0.03]"
                          }`}
                        >
                          <span className="mt-0.5 shrink-0 tabular-nums text-xs text-white/45">
                            {entry.time}
                          </span>
                          <span className="text-white/85">{entry.message}</span>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
