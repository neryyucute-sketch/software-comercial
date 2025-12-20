"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Users, Check } from "lucide-react";
import { X } from "lucide-react";

// PickerCarousel reutilizado
function PickerCarousel({
  title,
  items,
  selected,
  onSelect,
}: {
  title: string;
  items: { id: string; label: string; count?: number; badgeClass?: string }[];
  selected?: string | null; // ✅ ← antes era string | undefined
  onSelect: (id: string | null) => void;
}) {
  return (
    <div className="w-full">
      <div className="text-sm font-semibold mb-1 px-4">{title}</div>
      <div className="relative overflow-x-auto flex gap-2 px-4 pb-2 scrollbar-none">
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => onSelect(selected === it.id ? null : it.id)}
            className={[
              "whitespace-nowrap px-3 py-1.5 rounded-full border text-sm transition-all",
              selected === it.id
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground border-border",
            ].join(" ")}
          >
            {it.label}
            {typeof it.count === "number" && (
              <span className="ml-1 text-xs text-muted-foreground/70">({it.count})</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

type ClienteRow = {
  codigoCliente: string;
  nombreCliente: string;
  rutaVenta?: string;
  nit?: string;
  tipoCliente?: string;
  telefono?: string;
  correo?: string;
  zona?: string;
  clasificacionPrecios?: number | string | null;
};

export default function CustomerSelectionModal({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (c: ClienteRow) => void;
}) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<ClienteRow[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    db.clientes.toArray().then((r) => {
      r.sort((a, b) => (a.nombreCliente || "").localeCompare(b.nombreCliente || ""));
      setRows(r as any);
    });
  }, [open]);

  const routes = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of rows) {
      if (c.rutaVenta) map.set(c.rutaVenta, (map.get(c.rutaVenta) || 0) + 1);
    }
    return Array.from(map.entries()).map(([id, count]) => ({ id, label: id, count }));
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (selectedRoute) list = list.filter((c) => c.rutaVenta === selectedRoute);
    const s = q.trim().toLowerCase();
    if (s)
      list = list.filter(
        (c) =>
          c.codigoCliente.toLowerCase().includes(s) ||
          (c.nombreCliente || "").toLowerCase().includes(s) ||
          (c.nit || "").toLowerCase().includes(s)
      );
    return list.slice(0, 300);
  }, [q, rows, selectedRoute]);

  const pick = (c: ClienteRow) => {
    onPick(c);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          sm:max-w-5xl w-[96vw]
          p-0 overflow-hidden
        "
      >
        <div className="flex flex-col h-[85dvh] md:h-[80vh]">
            {/* Header sticky (título + carrusel + buscador) */}
            <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">

            <DialogHeader className="px-4 pt-4 pb-3 flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-primary">
                <Users className="w-5 h-5 text-primary" />
                Seleccionar cliente
              </DialogTitle>

{/* Botón flotante Cerrar */}
  <Button
    size="icon"
    variant="secondary"
    onClick={() => onOpenChange(false)}
    className="
      absolute top-3 right-3 z-50
      rounded-full shadow-md
      bg-primary text-primary-foreground
      hover:bg-primary/90
      transition-transform hover:rotate-90
    "
    title="Cerrar"
  >
    <X className="w-4 h-4" />
  </Button>

            </DialogHeader>

            <div className="pb-2">
              <PickerCarousel
                title="Ruta de venta"
                items={routes}
                selected={selectedRoute}
                onSelect={setSelectedRoute}
              />
            </div>

            <div className="px-4 pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Buscar por nombre, código o NIT…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>
          </div>

    <div
      className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {filtered.length === 0 && (
        <div className="text-sm text-muted-foreground">No hay clientes que coincidan.</div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
    {filtered.map((c) => {
      const selected = selectedClientId === c.codigoCliente;
      return (
<Card
  key={c.codigoCliente}
  className={[
    "relative border transition cursor-pointer hover:shadow-md hover:-translate-y-[1px]",
    selected
      ? "border-green-500 bg-green-50/40 dark:bg-green-900/10"
      : "border-border bg-muted/50 hover:border-primary/60",
  ].join(" ")}
  onClick={() => {
    setSelectedClientId(c.codigoCliente);
    pick(c);
  }}
>

          {selected && (
            <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1 shadow-md">
              <Check className="w-4 h-4" />
            </div>
          )}

          <div className="font-medium truncate">{c.nombreCliente}</div>
          <div className="text-xs text-muted-foreground truncate">
            {c.codigoCliente} {c.nit ? `· NIT ${c.nit}` : ""}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            {c.tipoCliente && <div className="text-muted-foreground">Tipo: {c.tipoCliente}</div>}
            {c.rutaVenta && <div className="text-muted-foreground">Ruta: {c.rutaVenta}</div>}
            {c.telefono && <div className="text-muted-foreground">Tel: {c.telefono}</div>}
            {c.correo && (
              <div className="text-muted-foreground col-span-2 truncate">{c.correo}</div>
            )}
          </div>
          <div className="mt-3 text-right">
            <Button size="sm" variant="secondary">
              Elegir
            </Button>
          </div>
        </Card>
      );
    })}
  </div>
</div>


          
        </div>
      </DialogContent>
    </Dialog>
  );
}
