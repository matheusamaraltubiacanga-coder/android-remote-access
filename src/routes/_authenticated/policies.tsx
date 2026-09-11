import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getPolicies, createPolicy, deletePolicy } from "@/lib/device.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Shield,
  Plus,
  Trash2,
  Loader2,
  Lock,
  Settings,
  ShoppingBag,
  Volume2,
  Smartphone,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/policies")({
  head: () => ({
    meta: [
      { title: "Políticas — KioskFleet" },
      { name: "description", content: "Defina políticas de kiosk: apps permitidos, bloqueados e restrições." },
    ],
  }),
  component: PoliciesPage,
});

function PoliciesPage() {
  const fetchPolicies = useServerFn(getPolicies);
  const create = useServerFn(createPolicy);
  const remove = useServerFn(deletePolicy);
  const queryClient = useQueryClient();

  const policiesQuery = useQuery({
    queryKey: ["policies"],
    queryFn: () => fetchPolicies(),
  });

  const [showAdd, setShowAdd] = useState(false);
  const [newPolicy, setNewPolicy] = useState({
    name: "",
    allowedApps: "",
    blockedApps: "",
    lockScreen: false,
    disableSettings: true,
    disablePlayStore: true,
    volumeLimit: 80,
  });
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function handleCreate() {
    setCreating(true);
    try {
      await create({
        data: {
          name: newPolicy.name,
          allowedApps: newPolicy.allowedApps
            ? newPolicy.allowedApps.split(",").map((s) => s.trim()).filter(Boolean)
            : [],
          blockedApps: newPolicy.blockedApps
            ? newPolicy.blockedApps.split(",").map((s) => s.trim()).filter(Boolean)
            : [],
          lockScreen: newPolicy.lockScreen,
          disableSettings: newPolicy.disableSettings,
          disablePlayStore: newPolicy.disablePlayStore,
          volumeLimit: newPolicy.volumeLimit,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["policies"] });
      setShowAdd(false);
      setNewPolicy({
        name: "",
        allowedApps: "",
        blockedApps: "",
        lockScreen: false,
        disableSettings: true,
        disablePlayStore: true,
        volumeLimit: 80,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await remove({ data: { policyId: deleteId } });
      queryClient.invalidateQueries({ queryKey: ["policies"] });
      setDeleteId(null);
    } catch (e) {
      console.error(e);
    }
  }

  const policies = policiesQuery.data ?? [];

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Políticas Kiosk</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Restrições e regras para aparelhos em modo kiosk
          </p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-1.5" />
              Nova política
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nova política kiosk</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-auto pr-1">
              <div className="space-y-2">
                <Label htmlFor="pname">Nome da política</Label>
                <Input
                  id="pname"
                  placeholder="Ex: Kiosk Padrão Loja"
                  value={newPolicy.name}
                  onChange={(e) => setNewPolicy((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pallowed">Apps permitidos (package names, separados por vírgula)</Label>
                <Input
                  id="pallowed"
                  placeholder="com.android.chrome, com.example.app"
                  value={newPolicy.allowedApps}
                  onChange={(e) => setNewPolicy((p) => ({ ...p, allowedApps: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pblocked">Apps bloqueados (package names, separados por vírgula)</Label>
                <Input
                  id="pblocked"
                  placeholder="com.android.settings, com.android.vending"
                  value={newPolicy.blockedApps}
                  onChange={(e) => setNewPolicy((p) => ({ ...p, blockedApps: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pvol">Limite de volume (%)</Label>
                <Input
                  id="pvol"
                  type="number"
                  min={0}
                  max={100}
                  value={newPolicy.volumeLimit}
                  onChange={(e) => setNewPolicy((p) => ({ ...p, volumeLimit: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-3 pt-2">
                <ToggleRow
                  icon={<Lock className="w-4 h-4" />}
                  label="Bloquear tela inicial"
                  checked={newPolicy.lockScreen}
                  onChange={(v) => setNewPolicy((p) => ({ ...p, lockScreen: v }))}
                />
                <ToggleRow
                  icon={<Settings className="w-4 h-4" />}
                  label="Bloquear Configurações"
                  checked={newPolicy.disableSettings}
                  onChange={(v) => setNewPolicy((p) => ({ ...p, disableSettings: v }))}
                />
                <ToggleRow
                  icon={<ShoppingBag className="w-4 h-4" />}
                  label="Bloquear Play Store"
                  checked={newPolicy.disablePlayStore}
                  onChange={(v) => setNewPolicy((p) => ({ ...p, disablePlayStore: v }))}
                />
              </div>
              <Button className="w-full" onClick={handleCreate} disabled={creating || !newPolicy.name}>
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar política"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* List */}
      {policiesQuery.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : policies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Shield className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="font-display text-lg font-semibold text-foreground mb-1">
            Nenhuma política criada
          </h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Crie uma política para definir quais apps e recursos são permitidos nos aparelhos.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {policies.map((policy: any) => (
            <Card key={policy.id} className="p-5 border-border hover:border-primary/30 transition-colors group">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-foreground">{policy.name}</h3>
                    <Badge variant="secondary" className="text-[10px] mt-0.5">
                      <Smartphone className="w-2.5 h-2.5 mr-0.5" />
                      {policy.devices?.[0]?.count ?? 0} aparelhos
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => setDeleteId(policy.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-2">
                {policy.allowed_apps?.length > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-success">✓ Permitidos:</span>
                    <span className="text-muted-foreground font-mono">
                      {policy.allowed_apps.length} apps
                    </span>
                  </div>
                )}
                {policy.blocked_apps?.length > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-destructive">✗ Bloqueados:</span>
                    <span className="text-muted-foreground font-mono">
                      {policy.blocked_apps.length} apps
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Volume2 className="w-3 h-3" />
                  Volume máx: {policy.volume_limit}%
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {policy.lock_screen && <Badge variant="outline" className="text-[9px]">Tela bloqueada</Badge>}
                  {policy.disable_settings && <Badge variant="outline" className="text-[9px]">Sem config</Badge>}
                  {policy.disable_play_store && <Badge variant="outline" className="text-[9px]">Sem Play Store</Badge>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir política?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Aparelhos associados ficarão sem política.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-3">
      <div className="flex items-center gap-2.5">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-sm text-foreground">{label}</span>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
