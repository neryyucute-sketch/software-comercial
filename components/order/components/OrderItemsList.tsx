// components/order/components/OrderItemsList.tsx
"use client";


import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import type { OrderItem, Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { groupOrderComboItems, OrderComboGroup } from "@/lib/order-helpers";
import { pickReferenceCode } from "@/lib/utils";

export function OrderItemsList({
  items,
  onChange,
}: {
  items: OrderItem[];
  onChange: (items: OrderItem[]) => void;
}) {
  const [products, setProducts] = useState<Record<string, Product>>({});

  useEffect(() => {
    db.products.toArray().then((rows) => {
      const map: Record<string, Product> = {};
      rows.forEach((p) => (map[p.codigoProducto] = p));
      setProducts(map);
    });
  }, []);


  // Separate combo/kit items and normal items
  const comboItems = items.filter((it) => it.comboId || it.kitId);
  const normalItems = items.filter((it) => !it.comboId && !it.kitId);

  // Group combos/kits
  const comboGroups = useMemo(() => groupOrderComboItems(comboItems), [comboItems]);

  const total = useMemo(() => items.reduce((acc, it) => acc + it.subtotal, 0), [items]);


  const updateQty = (id: string, qty: number) => {
    const next = items.map((it) =>
      it.id === id
        ? {
            ...it,
            cantidad: qty,
            subtotal: Math.round(qty * it.precioUnitario * 100) / 100,
          }
        : it
    );
    onChange(next);
  };

  // Remove a single item (for normal lines)
  const removeItem = (id: string) => onChange(items.filter((it) => it.id !== id));

  // Remove all items in a combo/kit group
  const removeComboGroup = (group: OrderComboGroup) => {
    const idsToRemove = new Set(group.items.map((it) => it.id));
    onChange(items.filter((it) => !idsToRemove.has(it.id)));
  };

  // Collapsible state for combo/kit groups
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const toggleGroup = (key: string) => setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-3">
      <Label>Items del pedido</Label>
      {items.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay productos agregados.</p>}

      <div className="space-y-2">
        {/* Render combo/kit groups */}
        {comboGroups.map((group) => {
          const qty = group.packsQty ?? group.items[0]?.cantidad ?? 0;
          const unitPrice = group.packPrice ?? group.items[0]?.precioUnitario ?? 0;
          const displayCode = pickReferenceCode(
            group.offerCode,
            group.comboCode,
            group.items[0]?.ofertaCodigo,
            group.items[0]?.comboCode
          ) ?? "-";
          return (
            <div key={group.key} className="border rounded-lg p-3 bg-muted/20">
              <div className="grid grid-cols-12 gap-2 items-center text-sm">
                <div className="col-span-2 font-mono text-xs">{displayCode}</div>
                <div className="col-span-4 font-medium">{group.comboName || "Combo/Kit"}</div>
                <div className="col-span-2 text-center">{qty}</div>
                <div className="col-span-2 text-right">Q{unitPrice.toFixed(2)}</div>
                <div className="col-span-2 text-right font-semibold">Q{group.totalPrice.toFixed(2)}</div>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => toggleGroup(group.key)}>
                  {openGroups[group.key] ? "Ocultar detalle" : "Mostrar detalle"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => removeComboGroup(group)}>
                  Quitar
                </Button>
              </div>
              {openGroups[group.key] && (
                <div className="mt-3 border-l-2 border-muted pl-4 space-y-1">
                  {group.items.map((it) => {
                    const p = products[it.productoId];
                    return (
                      <div key={it.id} className="grid grid-cols-12 gap-2 items-center text-xs text-muted-foreground">
                        <div className="col-span-2 font-mono">{it.productoId}</div>
                        <div className="col-span-8">{it.descripcion || p?.descripcion || it.productoId}</div>
                        <div className="col-span-2 text-center">{it.cantidad}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Render normal (non-combo/kit) items */}
        {normalItems.map((it) => {
          const p = products[it.productoId];
          return (
            <div key={it.id} className="grid grid-cols-12 gap-2 items-center border rounded-lg p-2">
              <div className="col-span-6">
                <div className="font-medium">{it.descripcion || p?.descripcion || it.productoId}</div>
                <div className="text-xs text-muted-foreground">Q{it.precioUnitario.toFixed(2)}</div>
              </div>
              <div className="col-span-3">
                <Input
                  type="number"
                  min={1}
                  value={it.cantidad}
                  onChange={(e) => updateQty(it.id, Math.max(1, Number(e.target.value || 1)))}
                />
              </div>
              <div className="col-span-2 text-right font-semibold">Q{it.subtotal.toFixed(2)}</div>
              <div className="col-span-1 text-right">
                <Button variant="ghost" size="sm" onClick={() => removeItem(it.id)}>
                  ✕
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-right text-sm text-muted-foreground">Sub-total: Q{total.toFixed(2)}</div>
    </div>
  );
}
