import { Play, RefreshCw, Trash2, Server, SlidersHorizontal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";
import { SERVER_TONES, type SimConfig } from "./simulation";

interface ControlPanelProps {
  config: SimConfig;
  running: boolean;
  onChange: (next: SimConfig) => void;
  onRun: () => void;
  onRefresh: () => void;
  onClear: () => void;
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label className="text-muted-foreground">{label}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function ControlPanel({
  config,
  running,
  onChange,
  onRun,
  onRefresh,
  onClear,
}: ControlPanelProps) {
  const setServerDelay = (index: number, v: number) => {
    const serverDelays = [...config.serverDelays];
    serverDelays[index] = v;
    onChange({ ...config, serverDelays });
  };

  return (
    <Card className="gap-0 overflow-hidden border-white/10 bg-white/[0.04] shadow-2xl shadow-black/20 backdrop-blur">
      <CardHeader className="border-b border-white/10 pb-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <SlidersHorizontal className="size-4" />
          <span className="text-xs uppercase tracking-[0.18em]">Kontrol</span>
        </div>
        <CardTitle className="text-lg text-white">Parameter Simulasi</CardTitle>
        <CardDescription>
          Atur delay backend lalu jalankan ulang skenario Round Robin dan Least Connection.
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-5 pt-5">
        <div className="grid gap-4">
          <NumberField
            label="Jumlah Request"
            value={config.requestCount}
            min={3}
            max={60}
            disabled={running}
            onChange={(v) => onChange({ ...config, requestCount: v })}
          />
          <NumberField
            label="Delay Request (ms)"
            value={config.baseDelay}
            min={0}
            max={10000}
            step={50}
            disabled={running}
            onChange={(v) => onChange({ ...config, baseDelay: v })}
          />
          <NumberField
            label="Jarak Antar Request (ms)"
            value={config.arrivalGap}
            min={0}
            max={5000}
            step={10}
            disabled={running}
            onChange={(v) => onChange({ ...config, arrivalGap: v })}
          />
        </div>

        <Separator />

        <div className="grid gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Server className="size-4" />
            <span className="text-xs uppercase tracking-[0.18em]">Delay Backend</span>
          </div>
          <div className="grid gap-4">
            {config.serverDelays.map((delay, i) => (
              <div key={i} className="grid gap-2">
                <Label className="flex items-center gap-2 capitalize">
                  <span className={`size-2.5 rounded-full ${SERVER_TONES[i].dot}`} />
                  {SERVER_TONES[i].name}
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={20000}
                  step={50}
                  disabled={running}
                  value={delay}
                  onChange={(e) => setServerDelay(i, Number(e.target.value))}
                />
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div className="grid gap-2.5">
          <Button onClick={onRun} disabled={running} className="w-full">
            <Play className="size-4" />
            {running ? "Menjalankan..." : "Jalankan Ulang Simulasi"}
          </Button>
          <Button variant="outline" onClick={onRefresh} disabled={running} className="w-full">
            <RefreshCw className="size-4" />
            Sinkronkan Snapshot
          </Button>
          <Button variant="ghost" onClick={onClear} disabled={running} className="w-full">
            <Trash2 className="size-4" />
            Bersihkan Log
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
