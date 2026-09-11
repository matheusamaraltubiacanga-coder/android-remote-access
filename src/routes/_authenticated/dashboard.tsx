import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getDevices,
  getDashboardStats,
  registerDevice,
} from "@/lib/device.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Smartphone,
  Battery,
  BatteryLow,
  Wifi,
  WifiOff,
  Lock,
  Plus,
  Monitor,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  MapPin,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — KioskFleet" },
      { name: "description", content: "Visão geral dos aparelhos Android gerenciados." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const fetchDevices = useServerFn(getDevices);
  const fetchStats = useServerFn(getDashboardStats);
  const register = useServerFn(registerDevice);
  const queryClient = useQueryClient();

  const devicesQuery = useQuery({
    queryKey: ["devices"],
    queryFn: () => fetchDevices(),
  });
  const statsQuery = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => fetchStats(),
  });

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel("devices-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "devices" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["devices"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const [showAdd, setShowAdd] = useState(false);
  const [newDevice, setNewDevice] = useState({
    deviceName: "",
    model: "",
    serialNumber: "",
  });
  const [createdDevice, setCreatedDevice] = useState<{
    id: string;
    api_key: string;
    device_name: string;
  } | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleRegister() {
    setCreating(true);
    try {
      const device = await register({
        data: {
          deviceName: newDevice.deviceName,
          model: newDevice.model || undefined,
          serialNumber: newDevice.serialNumber || undefined,
        },
      });
      setCreatedDevice(device);
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (e) {
      // toast
    } finally {
      setCreating(false);
    }
  }

  const stats = statsQuery.data;
  const devices = devicesQuery.data ?? [];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Visão geral dos aparelhos gerenciados
          </p>
        </div>
        <Dialog open={showAdd} onOpenChange={(open) => {
          setShowAdd(open);
          if (!open) {
            setCreatedDevice(null);
            setNewDevice({ deviceName: "", model: "", serialNumber: "" });
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-1.5" />
              Adicionar aparelho
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {createdDevice ? "Aparelho registrado" : "Novo aparelho"}
              </DialogTitle>
            </DialogHeader>
            {createdDevice ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-success/30 bg-success/10 p-4">
                  <p className="text-sm text-foreground mb-2">
                    Aparelho <strong>{createdDevice.device_name}</strong> registrado com sucesso!
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    Chave de API (use no app Android):
                  </p>
                  <code className="block font-mono text-xs bg-background/50 rounded-md p-3 break-all border border-border">
                    {createdDevice.api_key}
                  </code>
                </div>
                <p className="text-xs text-muted-foreground">
                  Instale o app KioskFleet no aparelho Android e insira esta chave para conectá-lo ao painel.
                </p>
                <Button className="w-full" onClick={() => {
                  setShowAdd(false);
                  setCreatedDevice(null);
                  setNewDevice({ deviceName: "", model: "", serialNumber: "" });
                }}>
                  Concluir
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="dname">Nome do aparelho</Label>
                  <Input
                    id="dname"
                    placeholder="Ex: Kiosk Loja Centro 01"
                    value={newDevice.deviceName}
                    onChange={(e) =>
                      setNewDevice((p) => ({ ...p, deviceName: e.target.value }))
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="dmodel">Modelo (opcional)</Label>
                    <Input
                      id="dmodel"
                      placeholder="Ex: Samsung Galaxy A14"
                      value={newDevice.model}
                      onChange={(e) =>
                        setNewDevice((p) => ({ ...p, model: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dserial">Nº de série (opcional)</Label>
                    <Input
                      id="dserial"
                      placeholder="RZ8..."
                      value={newDevice.serialNumber}
                      onChange={(e) =>
                        setNewDevice((p) => ({ ...p, serialNumber: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <Button className="w-full" onClick={handleRegister} disabled={creating || !newDevice.deviceName}>
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Registrar aparelho"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<Smartphone className="w-5 h-5" />}
          label="Total"
          value={stats?.total ?? 0}
          color="text-primary"
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5" />}
          label="Online"
          value={stats?.online ?? 0}
          color="text-success"
        />
        <StatCard
          icon={<XCircle className="w-5 h-5" />}
          label="Offline"
          value={stats?.offline ?? 0}
          color="text-destructive"
        />
        <StatCard
          icon={<Lock className="w-5 h-5" />}
          label="Modo Kiosk"
          value={stats?.kiosk ?? 0}
          color="text-warning"
        />
      </div>

      {/* Device list */}
      <Card className="overflow-hidden border-border">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-display text-lg font-semibold text-foreground">Aparelhos</h2>
          <Badge variant="secondary" className="font-mono text-xs">
            {devices.length} dispositivos
          </Badge>
        </div>
        {devicesQuery.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Monitor className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="font-display text-lg font-semibold text-foreground mb-1">
              Nenhum aparelho cadastrado
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Adicione um aparelho e instale o app KioskFleet nele para começar a gerenciar remotamente.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {devices.map((device) => (
              <DeviceRow key={device.id} device={device} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Card className="p-4 border-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
        <span className={color}>{icon}</span>
      </div>
      <p className="font-display text-3xl font-bold text-foreground">{value}</p>
    </Card>
  );
}

function DeviceRow({
  device,
}: {
  device: {
    id: string;
    device_name: string;
    model: string | null;
    status: string;
    last_seen_at: string | null;
    battery_level: number | null;
    current_app: string | null;
    kiosk_mode: boolean;
    stores: { id: string; name: string } | null;
    kiosk_policies: { id: string; name: string } | null;
  };
}) {
  const isOnline = device.status === "online";
  const lastSeen = device.last_seen_at
    ? new Date(device.last_seen_at).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <Link
      to="/device/$deviceId"
      params={{ deviceId: device.id }}
      className="flex items-center gap-4 p-4 hover:bg-accent/30 transition-colors cursor-pointer"
    >
      {/* Status dot */}
      <div className="relative flex-shrink-0">
        <div
          className={`w-2.5 h-2.5 rounded-full ${
            isOnline ? "bg-success animate-pulse-dot" : "bg-muted-foreground/40"
          }`}
        />
      </div>

      {/* Device info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground truncate">{device.device_name}</span>
          {device.kiosk_mode && (
            <Badge variant="outline" className="text-warning border-warning/40 text-[10px] py-0">
              <Lock className="w-2.5 h-2.5 mr-0.5" />
              KIOSK
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
          {device.model && <span className="truncate">{device.model}</span>}
          {device.stores && (
            <span className="flex items-center gap-0.5">
              <MapPin className="w-3 h-3" />
              {device.stores.name}
            </span>
          )}
        </div>
      </div>

      {/* Right metrics */}
      <div className="hidden sm:flex items-center gap-4 flex-shrink-0">
        {/* Battery */}
        {device.battery_level != null && (
          <div className="flex items-center gap-1.5 text-xs">
            {device.battery_level < 20 ? (
              <BatteryLow className="w-4 h-4 text-destructive" />
            ) : (
              <Battery className="w-4 h-4 text-muted-foreground" />
            )}
            <span className="font-mono text-muted-foreground">{device.battery_level}%</span>
          </div>
        )}

        {/* Network */}
        <div className="flex items-center gap-1 text-xs">
          {isOnline ? (
            <Wifi className="w-4 h-4 text-success" />
          ) : (
            <WifiOff className="w-4 h-4 text-muted-foreground/50" />
          )}
        </div>

        {/* Last seen */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          {isOnline ? "Agora" : lastSeen ?? "—"}
        </div>
      </div>
    </Link>
  );
}
