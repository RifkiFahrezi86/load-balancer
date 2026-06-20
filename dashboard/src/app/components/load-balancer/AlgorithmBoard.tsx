import { motion } from "motion/react";
import { Gauge, Timer, Activity, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Badge } from "../ui/badge";
import { SERVER_TONES, type AlgorithmResult } from "./simulation";

function fmtMs(ms: number) {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${Math.round(ms)} ms`;
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/40 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[0.7rem] uppercase tracking-[0.12em]">{label}</span>
      </div>
      <p className="mt-1 tabular-nums">{value}</p>
    </div>
  );
}

interface AlgorithmBoardProps {
  result: AlgorithmResult;
  total: number;
  isBest: boolean;
  visibleRequestIds: number[];
}

export function AlgorithmBoard({ result, total, isBest, visibleRequestIds }: AlgorithmBoardProps) {
  const maxHandled = Math.max(1, ...result.servers.map((s) => s.handled));
  const visibleSet = new Set(visibleRequestIds);

  return (
    <Card className="gap-0 overflow-hidden border-white/10 bg-white/[0.04] shadow-2xl shadow-black/20 backdrop-blur">
      <CardHeader className="border-b border-white/10 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h3 className="capitalize text-white">{result.label}</h3>
            {isBest && total > 0 && (
              <Badge className="bg-emerald-600 hover:bg-emerald-600">
                <Trophy className="size-3" />
                Tercepat
              </Badge>
            )}
          </div>
          <Badge variant="secondary" className="border-white/10 bg-white/10 tabular-nums text-white">
            {visibleRequestIds.length} / {total} request
          </Badge>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2.5">
          <Stat icon={<Timer className="size-3.5" />} label="Total Waktu" value={fmtMs(result.makespan)} />
          <Stat icon={<Gauge className="size-3.5" />} label="Rata Latensi" value={fmtMs(result.avgLatency)} />
          <Stat icon={<Activity className="size-3.5" />} label="P95 Latensi" value={fmtMs(result.p95Latency)} />
        </div>
      </CardHeader>

      <CardContent className="grid gap-4 pt-5 md:grid-cols-3">
        {result.servers.map((server) => {
          const tone = SERVER_TONES[server.index];
          const requests = result.requests
            .filter((request) => request.server === server.index)
            .filter((request) => visibleSet.has(request.id));
          const shownRequests = requests.slice(0, 10);
          const hiddenCount = Math.max(0, requests.length - shownRequests.length);

          return (
            <div
              key={server.index}
              className={`flex flex-col gap-3 rounded-xl border ${tone.border} ${tone.bg} p-4 shadow-lg shadow-black/10`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`size-2.5 rounded-full ${tone.dot}`} />
                  <span className={`capitalize ${tone.text}`}>{tone.name}</span>
                </div>
                <span className="tabular-nums text-white/65">{server.handled}x</span>
              </div>

              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className={`h-full rounded-full ${tone.bar}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${(server.handled / maxHandled) * 100}%` }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-white/60">
                <div className="rounded-md border border-white/10 bg-black/20 px-2 py-1.5">
                  <p className="text-[0.7rem] uppercase tracking-[0.1em]">Latensi</p>
                  <p className="tabular-nums text-white">{fmtMs(server.avgLatency)}</p>
                </div>
                <div className="rounded-md border border-white/10 bg-black/20 px-2 py-1.5">
                  <p className="text-[0.7rem] uppercase tracking-[0.1em]">Busy</p>
                  <p className="tabular-nums text-white">{fmtMs(server.busyTime)}</p>
                </div>
              </div>

              <div className="grid gap-1 rounded-lg border border-white/10 bg-black/15 px-3 py-2 text-xs text-white/65">
                <div className="flex items-center justify-between gap-3">
                  <span>Delay ekstra</span>
                  <span className="tabular-nums text-white">{fmtMs(server.extraDelayMs)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Queue puncak</span>
                  <span className="tabular-nums text-white">{server.peakQueueDepth}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Host</span>
                  <span className="truncate text-white">{server.hostname}</span>
                </div>
              </div>

              <div className="grid min-h-20 gap-2">
                {requests.length === 0 && (
                  <div className="rounded-lg border border-dashed border-white/10 bg-black/10 px-3 py-2 text-sm text-white/45">
                    Belum ada request masuk.
                  </div>
                )}
                {shownRequests.map((request) => (
                  <motion.div
                    key={request.id}
                    initial={{ scale: 0.96, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 24 }}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
                  >
                    <div className="min-w-0">
                      <p className="font-medium tracking-[0.02em]">Req {String(request.id).padStart(2, "0")}</p>
                      <p className="truncate text-xs text-white/55">
                        Antrean {request.queueDepth} • selesai {fmtMs(request.latency)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-xs tabular-nums text-white/85">
                      {fmtMs(request.processingMs)}
                    </span>
                  </motion.div>
                ))}
                {hiddenCount > 0 && (
                  <Badge variant="outline" className="w-fit border-white/10 bg-white/5 text-white/75">
                    +{hiddenCount} lainnya
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
