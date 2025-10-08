// components/order/modals/ComboSelectionModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Gift, Search } from "lucide-react";
import type { OrderItem } from "@/lib/types";
import { db } from "@/lib/db";
import ProductQuantityModal from "./ProductQuantityModal";

type PackRow = {
  idt: string;
  descripcion: string;
  // items del pack (productoId, descripcion, cantidad, precioUnitario)
  items?: Array<{ productoId: string; descripcion: string; cantidad: number; precioUnitario: number }>;
};

function uuidItem(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function ComboSelectionModal({
  open,
  onOpenChange,
  onPick,
  disabled,
  customer,
  existingItems, // opcional: { [productoId]: cantidad } para marcar checks
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (items: OrderItem[]) => void;
  disabled?: boolean;
  customer: { codigoCliente: string } | null;
  existingItems?: Record<string, number>;
}) {
  const [q, setQ] = useState("");
  const [combos, setCombos] = useState<PackRow[]>([]);
  const [kits, setKits] = useState<PackRow[]>([]);
  const [active, setActive] = useState<PackRow | null>(null);

  useEffect(() => {
    if (!open || disabled) return;
    Promise.all([
      (db as any).combos?.toArray?.().catch(() => []) ?? [],
      (db as any).kits?.toArray?.().catch(() => []) ?? [],
    ]).then(([c, k]) => {
      setCombos(c || []);
      setKits(k || []);
    });
  }, [open, disabled]);

  const all = useMemo(() => {
    const list = [
      ...combos.map((x) => ({ ...x, _type: "combo" as const })),
      ...kits.map((x) => ({ ...x, _type: "kit" as const })),
    ];
    const s = q.trim().toLowerCase();
    const filtered = !s ? list : list.filter((x) => x.descripcion?.toLowerCase().includes(s));
    return filtered.slice(0, 300);
  }, [q, combos, kits]);

  const openQty = (pack: PackRow & { _type: "combo" | "kit" }) => setActive(pack);

  const confirmPack = (packsQty: number) => {
    if (!active) return;
    const out: OrderItem[] = (active.items || []).map((it) => {
      const cant = Math.max(1, packsQty) * (it.cantidad || 1);
      const subtotal = Math.round(cant * it.precioUnitario * 100) / 100;
      return {
        id: uuidItem(),
        productoId: it.productoId,
        descripcion: it.descripcion,
        cantidad: cant,
        precioUnitario: it.precioUnitario,
        subtotal,
        comboId: (active as any)._type === "combo" ? active.idt : undefined,
        kitId: (active as any)._type === "kit" ? active.idt : undefined,
        priceSource: "base",
      };
    });
    if (out.length) {
      onPick(out);
      setActive(null);
      onOpenChange(false);
    }
  };

  return (
    <>
      <Dialog open={open && !disabled} onOpenChange={onOpenChange}>
        <DialogContent
          className="
            sm:max-w-5xl w-[96vw]
            p-0 overflow-hidden
            max-h-[90dvh] md:max-h-[85vh]
          "
        >
          <div className="flex h-full max-h-[inherit] flex-col">
            <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <DialogHeader className="px-4 pt-4 pb-3">
                <DialogTitle className="flex items-center gap-2">
                  <Gift className="w-4 h-4" />
                  Agregar combos / kits
                </DialogTitle>
              </DialogHeader>
              <div className="px-4 pb-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Buscar combos o kits…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {all.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  {disabled ? "Este cliente no califica para combos/kits." : "No hay combos/kits en la base local."}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {all.map((x: any) => {
                  // considerar "seleccionado" si todos los productos del pack tienen qty > 0 en existingItems (indicio visual)
                  const selectedHint = (x.items || []).every(
                    (it: any) => (existingItems?.[it.productoId] ?? 0) > 0
                  );

                  return (
                    <Card
                      key={`${x._type}-${x.idt}`}
                      className={[
                        "relative cursor-pointer border transition hover:shadow-md",
                        selectedHint ? "border-green-500" : "hover:border-primary",
                      ].join(" ")}
                      onClick={() => openQty(x)}
                    >
                      {selectedHint && (
                        <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1 shadow-md">
                          <Check className="w-4 h-4" />
                        </div>
                      )}

                      <div className="p-3">
                        <div className="font-medium">{x.descripcion}</div>
                        <div className="text-xs text-muted-foreground">{x._type.toUpperCase()} · {x.idt}</div>
                        <div className="mt-2 text-xs text-muted-foreground line-clamp-2">
                          {(x.items || []).slice(0, 3).map((it: any) => it.descripcion).join(", ")}
                          {(x.items || []).length > 3 ? "…" : ""}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* qty de packs */}
      {active && (
        <ProductQuantityModal
          open={!!active}
          onOpenChange={(v) => !v && setActive(null)}
          title={`${(active as any)._type === "combo" ? "Combo" : "Kit"} · ${active.descripcion}`}
          price={
            // precio referencial: sumatoria del unitario de los items (visual)
            Math.round(((active.items || []).reduce((acc, it) => acc + it.precioUnitario, 0)) * 100) / 100
          }
          initialQty={1}
          onConfirm={confirmPack}
        />
      )}
    </>
  );
}
