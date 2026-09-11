import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getDevice, sendCommand, updateDevice } from "@/lib/device.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  ArrowLeft,
  Lock,
  Unlock,
  RotateCcw,
  Camera,
  MessageSquare,
  Trash2,
  Volume2,
  Smartphone,
  Battery,
  BatteryLow,
  Cpu,
  HardDrive,
  Wifi,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Monitor,
  MapPin,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/device/$deviceId")({
  head: ({ params }) => ({
    meta: [
      { title: `Aparelho — KioskFleet` },
      { name: "description", content: "Detalhes e controle remoto do aparelho." },
    ],
  }),
  component: DeviceDetailPage,
});

function DeviceDetailPage() {
  const { deviceId } = Route.useParams();
  const fetchDevice = useServerFn(getDevice);
  const sendCmd = useServerFn(sendCommand);
  const update = useServerFn(updateDevice);
  const queryClient = useQueryClient();

  const deviceQuery = useQuery({
    queryKey: ["device", deviceId],
    queryFn: () => fetchDevice({ data: { deviceId } }),
  });

  // Realtime for screenshots and status
  useEffect(() => {
    const channel = supabase
      .channel(`device-${deviceId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "device_screenshots",
          filter: `device_id=eq.${deviceId}`,
        },
        () => queryClient.invalidateQueries({ queryKey: ["device", deviceId] }),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "devices",
          filter: `id=eq.${deviceId}`,
        },
        () => queryClient.invalidateQueries({ queryKey: ["device", deviceId] }),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "device_commands",
          filter: `device_id=eq.${deviceId}`,
        },
        () => queryClient.invalidateQueries({ queryKey: ["device", deviceId] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [deviceId, queryClient]);

  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);

  // Get signed URL for screenshot
  useEffect(() => {
    const path = deviceQuery.data?.latestScreenshot?.storage_path;
    if (!path) {
      setScreenshotUrl(null);
      return;
    }
    supabase.storage
      .from("device-screenshots")
      .createSignedUrl(path, 120)
      .then(({ data }) => {
        if (data?.signedUrl) setScreenshotUrl(data.signedUrl);
      });
  }, [deviceQuery.data?.latestScreenshot?.storage_path]);

  const handleCommand = useCallback(
    async (commandType: string, payload: Record<string, unknown> = {}) => {
      setSending(commandType);
      try {
        await sendCmd({ data: { deviceId, commandType, payload } });
        queryClient.invalidateQueries({ queryKey: ["device", deviceId] });
      } catch (e) {
        console.error(e);
      } finally {
        setSending(null);
      }
    },
    [deviceId, sendCmd, queryClient],
  );

  const handleToggleKiosk = useCallback(async () => {
    const current = deviceQuery.data?.device?.kiosk_mode ?? false;
    try {
      await update({ data: { deviceId, kioskMode: !current } });
      queryClient.invalidateQueries({ queryKey: ["device", deviceId] });
    } catch (e) {
      console.error(e);
    }
  }, [deviceId, update, deviceQuery.data?.device?.kiosk_mode, queryClient]);

  if (deviceQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (deviceQuery.isError || !deviceQuery.data?.device) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Aparelho não encontrado.</p>
        <Link to="/dashboard" className="text-primary text-sm mt-2 inline-block">
          ← Voltar ao dashboard
        </Link>
      </div>
    );
  }

  const { device, telemetry, latestScreenshot, commands } = deviceQuery.data;
  const isOnline = device.status === "online";

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Back */}
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-xl border flex items-center justify-center ${
              isOnline
                ? "bg-success/10 border-success/30 glow-success"
                : "bg-muted border-border"
            }`}
          >
            <Smartphone className={`w-6 h-6 ${isOnline ? "text-success" : "text-muted-foreground"}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-foreground">{device.device_name}</h1>
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  isOnline ? "bg-success animate-pulse-dot" : "bg-muted-foreground/40"
                }`}
              />
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              {device.model && <span>{device.model}</span>}
              {device.stores && (
                <span className="flex items-center gap-0.5">
                  <MapPin className="w-3 h-3" />
                  {device.stores.name}
                </span>
              )}
              {device.android_version && <span>Android {device.android_version}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={device.kiosk_mode ? "default" : "outline"}
            size="sm"
            onClick={handleToggleKiosk}
          >
            <Lock className="w-4 h-4 mr-1.5" />
            {device.kiosk_mode ? "Kiosk ATIVO" : "Ativar Kiosk"}
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Screen view */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="overflow-hidden border-border">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-primary" />
                <h2 className="font-display text-sm font-semibold text-foreground">Tela remota</h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCommand("screenshot")}
                disabled={sending === "screenshot" || !isOnline}
              >
                {sending === "screenshot" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Camera className="w-3.5 h-3.5 mr-1" />
                )}
                Capturar tela
              </Button>
            </div>

            <div className="aspect-[9/16] max-h-[600px] bg-background/50 flex items-center justify-center scan-line relative grid-bg">
              {screenshotUrl ? (
                <img
                  src={screenshotUrl}
                  alt="Tela do aparelho"
                  className={`max-w-full max-h-full object-contain select-none ${isOnline ? "cursor-crosshair" : ""}`}
                  draggable={false}
                  onMouseDown={(e) => {
                    if (!isOnline) return;
                    const img = e.currentTarget;
                    const rect = img.getBoundingClientRect();
                    const natW = img.naturalWidth || latestScreenshot?.width || 0;
                    const natH = img.naturalHeight || latestScreenshot?.height || 0;
                    if (!natW || !natH) return;
                    const toDevice = (cx: number, cy: number) => ({
                      x: Math.round(((cx - rect.left) / rect.width) * natW),
                      y: Math.round(((cy - rect.top) / rect.height) * natH),
                    });
                    const start = toDevice(e.clientX, e.clientY);
                    const t0 = Date.now();
                    const onUp = (ev: MouseEvent) => {
                      window.removeEventListener("mouseup", onUp);
                      const end = toDevice(ev.clientX, ev.clientY);
                      const dist = Math.hypot(end.x - start.x, end.y - start.y);
                      const duration = Date.now() - t0;
                      if (dist < 10) {
                        handleCommand(duration > 500 ? "long_press" : "tap", { x: start.x, y: start.y, duration });
                      } else {
                        handleCommand("swipe", { x: start.x, y: start.y, end_x: end.x, end_y: end.y, duration: Math.max(150, duration) });
                      }
                    };
                    window.addEventListener("mouseup", onUp);
                  }}
                />
              ) : (
                <div className="text-center">
                  <Monitor className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {isOnline
                      ? "Nenhuma captura. Clique em \"Capturar tela\"."
                      : "Aparelho offline."}
                  </p>
                </div>
              )}
              {latestScreenshot && (
                <div className="absolute bottom-3 right-3">
                  <Badge variant="secondary" className="text-[10px] font-mono bg-background/80 backdrop-blur-sm">
                    {new Date(latestScreenshot.created_at).toLocaleTimeString("pt-BR")}
                  </Badge>
                </div>
              )}
            </div>
            {screenshotUrl && isOnline && (
              <div className="px-4 py-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground gap-2 flex-wrap">
                <span>Clique = toque · arraste = deslizar · segurar = pressionar longo</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => handleCommand("key", { key: "back" })}>Voltar</Button>
                  <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => handleCommand("key", { key: "home" })}>Home</Button>
                  <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => handleCommand("key", { key: "recents" })}>Recentes</Button>
                </div>
              </div>
            )}
          </Card>

          {/* Commands */}
          <Card className="p-4 border-border">
            <h2 className="font-display text-sm font-semibold text-foreground mb-4">Comandos remotos</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <CmdButton
                icon={<Lock className="w-4 h-4" />}
                label="Bloquear"
                onClick={() => handleCommand("lock")}
                disabled={!isOnline || sending === "lock"}
                loading={sending === "lock"}
              />
              <CmdButton
                icon={<Unlock className="w-4 h-4" />}
                label="Desbloquear"
                onClick={() => handleCommand("unlock")}
                disabled={!isOnline || sending === "unlock"}
                loading={sending === "unlock"}
              />
              <CmdButton
                icon={<RotateCcw className="w-4 h-4" />}
                label="Reiniciar"
                onClick={() => handleCommand("reboot")}
                disabled={!isOnline || sending === "reboot"}
                loading={sending === "reboot"}
                variant="destructive"
              />
              <CmdButton
                icon={<Camera className="w-4 h-4" />}
                label="Screenshot"
                onClick={() => handleCommand("screenshot")}
                disabled={!isOnline || sending === "screenshot"}
                loading={sending === "screenshot"}
              />
              <CmdButton
                icon={<Volume2 className="w-4 h-4" />}
                label="Volume"
                onClick={() => handleCommand("set_volume", { level: 50 })}
                disabled={!isOnline || sending === "set_volume"}
                loading={sending === "set_volume"}
              />
              <CmdButton
                icon={<MessageSquare className="w-4 h-4" />}
                label="Mensagem"
                onClick={() => handleCommand("send_message", { text: "Mensagem do painel" })}
                disabled={!isOnline || sending === "send_message"}
                loading={sending === "send_message"}
              />
              <CmdButton
                icon={<Trash2 className="w-4 h-4" />}
                label="Limpar cache"
                onClick={() => handleCommand("clear_cache")}
                disabled={!isOnline || sending === "clear_cache"}
                loading={sending === "clear_cache"}
              />
              <CmdButton
                icon={<RefreshCw className="w-4 h-4" />}
                label="Abrir app"
                onClick={() => handleCommand("open_app", { package: "com.android.chrome" })}
                disabled={!isOnline || sending === "open_app"}
                loading={sending === "open_app"}
              />
            </div>
          </Card>

          {/* Command history */}
          <Card className="border-border">
            <div className="p-4 border-b border-border">
              <h2 className="font-display text-sm font-semibold text-foreground">Histórico de comandos</h2>
            </div>
            <div className="divide-y divide-border max-h-64 overflow-auto">
              {commands.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center">
                  Nenhum comando enviado ainda.
                </p>
              ) : (
                commands.map((cmd) => (
                  <div key={cmd.id} className="flex items-center gap-3 p-3 text-sm">
                    <div className="flex-shrink-0">
                      {cmd.status === "completed" && <CheckCircle2 className="w-4 h-4 text-success" />}
                      {cmd.status === "failed" && <XCircle className="w-4 h-4 text-destructive" />}
                      {cmd.status === "pending" && <Clock className="w-4 h-4 text-warning" />}
                      {(cmd.status === "delivered" || cmd.status === "executing") && (
                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                      )}
                    </div>
                    <span className="font-mono text-xs text-foreground flex-1">{cmd.command_type}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(cmd.created_at).toLocaleTimeString("pt-BR")}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar: telemetry + info */}
        <div className="space-y-6">
          {/* API key */}
          <Card className="p-4 border-border">
            <h3 className="font-display text-sm font-semibold text-foreground mb-3">Chave de API</h3>
            <code className="block font-mono text-[11px] bg-background/50 rounded-md p-2.5 break-all border border-border text-muted-foreground">
              {device.api_key}
            </code>
            <p className="text-[10px] text-muted-foreground mt-2">
              Use esta chave no app Android KioskFleet para conectar o aparelho.
            </p>
          </Card>

          {/* Telemetry */}
          <Card className="p-4 border-border">
            <h3 className="font-display text-sm font-semibold text-foreground mb-4">Telemetria</h3>
            <div className="space-y-3">
              <TelemetryRow
                icon={
                  telemetry?.battery_level != null && telemetry.battery_level < 20 ? (
                    <BatteryLow className="w-4 h-4 text-destructive" />
                  ) : (
                    <Battery className="w-4 h-4 text-muted-foreground" />
                  )
                }
                label="Bateria"
                value={
                  telemetry?.battery_level != null
                    ? `${telemetry.battery_level}%${telemetry.battery_charging ? " ⚡" : ""}`
                    : "—"
                }
              />
              <TelemetryRow
                icon={<Cpu className="w-4 h-4 text-muted-foreground" />}
                label="CPU"
                value={telemetry?.cpu_usage != null ? `${telemetry.cpu_usage.toFixed(1)}%` : "—"}
              />
              <TelemetryRow
                icon={<HardDrive className="w-4 h-4 text-muted-foreground" />}
                label="Memória"
                value={
                  telemetry?.memory_used_mb != null
                    ? `${telemetry.memory_used_mb}/${telemetry.memory_total_mb} MB`
                    : "—"
                }
              />
              <TelemetryRow
                icon={<HardDrive className="w-4 h-4 text-muted-foreground" />}
                label="Armazenamento"
                value={
                  telemetry?.storage_used_mb != null && telemetry?.storage_total_mb != null
                    ? `${(telemetry.storage_used_mb / 1024).toFixed(1)}/${(telemetry.storage_total_mb / 1024).toFixed(1)} GB`
                    : "—"
                }
              />
              <TelemetryRow
                icon={<Wifi className="w-4 h-4 text-muted-foreground" />}
                label="Rede"
                value={
                  telemetry
                    ? `${telemetry.network_type ?? "—"}${telemetry.wifi_strength != null ? ` (${telemetry.wifi_strength}dBm)` : ""}`
                    : "—"
                }
              />
              <TelemetryRow
                icon={<Smartphone className="w-4 h-4 text-muted-foreground" />}
                label="App atual"
                value={telemetry?.current_app ?? device.current_app ?? "—"}
              />
              <TelemetryRow
                icon={<Clock className="w-4 h-4 text-muted-foreground" />}
                label="Uptime"
                value={
                  telemetry?.uptime_seconds != null
                    ? `${Math.floor(telemetry.uptime_seconds / 3600)}h ${Math.floor((telemetry.uptime_seconds % 3600) / 60)}m`
                    : "—"
                }
              />
            </div>
          </Card>

          {/* Device info */}
          <Card className="p-4 border-border">
            <h3 className="font-display text-sm font-semibold text-foreground mb-4">Informações</h3>
            <div className="space-y-3 text-sm">
              <InfoRow label="Status" value={isOnline ? "Online" : "Offline"} />
              <InfoRow label="Serial" value={device.serial_number ?? "—"} />
              <InfoRow label="Android" value={device.android_version ?? "—"} />
              <InfoRow
                label="Política"
                value={device.kiosk_policies?.name ?? "Nenhuma"}
              />
              <InfoRow
                label="Última conexão"
                value={
                  device.last_seen_at
                    ? new Date(device.last_seen_at).toLocaleString("pt-BR")
                    : "—"
                }
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function CmdButton({
  icon,
  label,
  onClick,
  disabled,
  loading,
  variant,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "default" | "destructive";
}) {
  return (
    <Button
      variant={variant === "destructive" ? "destructive" : "outline"}
      size="sm"
      className="flex-col h-auto py-3 gap-1.5"
      onClick={onClick}
      disabled={disabled}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      <span className="text-xs">{label}</span>
    </Button>
  );
}

function TelemetryRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-shrink-0">{icon}</div>
      <span className="text-xs text-muted-foreground flex-1">{label}</span>
      <span className="text-xs font-mono text-foreground text-right">{value}</span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground text-right truncate ml-2">{value}</span>
    </div>
  );
}
