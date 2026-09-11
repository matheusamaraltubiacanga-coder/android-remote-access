import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getStores, createStore, deleteStore } from "@/lib/device.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Store as StoreIcon,
  Plus,
  MapPin,
  Trash2,
  Loader2,
  Smartphone,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/stores")({
  head: () => ({
    meta: [
      { title: "Lojas — KioskFleet" },
      { name: "description", content: "Gerenciar lojas e locais onde os aparelhos estão instalados." },
    ],
  }),
  component: StoresPage,
});

function StoresPage() {
  const fetchStores = useServerFn(getStores);
  const create = useServerFn(createStore);
  const remove = useServerFn(deleteStore);
  const queryClient = useQueryClient();

  const storesQuery = useQuery({
    queryKey: ["stores"],
    queryFn: () => fetchStores(),
  });

  const [showAdd, setShowAdd] = useState(false);
  const [newStore, setNewStore] = useState({ name: "", address: "" });
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function handleCreate() {
    setCreating(true);
    try {
      await create({ data: { name: newStore.name, address: newStore.address || undefined } });
      queryClient.invalidateQueries({ queryKey: ["stores"] });
      setShowAdd(false);
      setNewStore({ name: "", address: "" });
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await remove({ data: { storeId: deleteId } });
      queryClient.invalidateQueries({ queryKey: ["stores"] });
      setDeleteId(null);
    } catch (e) {
      console.error(e);
    }
  }

  const stores = storesQuery.data ?? [];

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Lojas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Locais onde os aparelhos estão instalados
          </p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-1.5" />
              Nova loja
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova loja</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sname">Nome</Label>
                <Input
                  id="sname"
                  placeholder="Ex: Loja Centro"
                  value={newStore.name}
                  onChange={(e) => setNewStore((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="saddr">Endereço (opcional)</Label>
                <Input
                  id="saddr"
                  placeholder="Rua, número, cidade"
                  value={newStore.address}
                  onChange={(e) => setNewStore((p) => ({ ...p, address: e.target.value }))}
                />
              </div>
              <Button className="w-full" onClick={handleCreate} disabled={creating || !newStore.name}>
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar loja"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* List */}
      {storesQuery.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : stores.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <StoreIcon className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="font-display text-lg font-semibold text-foreground mb-1">
            Nenhuma loja cadastrada
          </h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Crie uma loja para agrupar aparelhos por local.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stores.map((store: any) => (
            <Card key={store.id} className="p-5 border-border hover:border-primary/30 transition-colors group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <StoreIcon className="w-5 h-5 text-primary" />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => setDeleteId(store.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <h3 className="font-display font-semibold text-foreground mb-1">{store.name}</h3>
              {store.address && (
                <p className="text-xs text-muted-foreground flex items-start gap-1 mb-3">
                  <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  {store.address}
                </p>
              )}
              <Badge variant="secondary" className="text-[10px]">
                <Smartphone className="w-2.5 h-2.5 mr-0.5" />
                {store.devices?.[0]?.count ?? 0} aparelhos
              </Badge>
            </Card>
          ))}
        </div>
      )}

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir loja?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Os aparelhos associados não serão excluídos, apenas ficarão sem loja.
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
