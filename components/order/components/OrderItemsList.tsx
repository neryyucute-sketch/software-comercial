// components/order/components/OrderItemsList.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import type { OrderItem, Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

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

  const removeItem = (id: string) => onChange(items.filter((it) => it.id !== id));

  return (
    <div className="space-y-3">
      <Label>Items del pedido</Label>
      {items.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay productos agregados.</p>}

      <div className="space-y-2">
        {items.map((it) => {
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
