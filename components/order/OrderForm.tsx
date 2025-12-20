// components/order/OrderForm.tsx
"use client";

import { useMemo, useState } from "react";
import type { Order, OrderItem } from "@/lib/types";
import { OrderCustomer } from "./components/OrderCustomer";
import { OrderItemsList } from "./components/OrderItemsList";
import { OrderSummary } from "./components/OrderSummary";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProductSelectionModal } from "./modals/ProductSelectionModal";
import { useOrders } from "@/contexts/OrdersContext";

// 🔒 Seguridad: Usar crypto.randomUUID() nativo para IDs seguros
function uuidSimple(): string {
  return crypto.randomUUID();
}

export default function OrderForm() {
  const { addOrder, syncOrders } = useOrders();

  const [customerId, setCustomerId] = useState<string>("");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");

  const [openProductModal, setOpenProductModal] = useState(false);

  const itemsTotal = useMemo(() => items.reduce((acc, it) => acc + it.subtotal, 0), [items]);
  const total = useMemo(() => Math.round(itemsTotal * (1 - Math.max(0, Math.min(100, discount)) / 100) * 100) / 100, [itemsTotal, discount]);

  const onPickProducts = (newItems: OrderItem[]) => {
    // merge por productoId si ya existe
    const next = [...items];
    for (const ni of newItems) {
      const idx = next.findIndex((x) => x.productoId === ni.productoId && !x.comboId && !x.kitId);
      if (idx >= 0) {
        const unit = Number.isFinite(ni.precioUnitario) ? ni.precioUnitario : next[idx].precioUnitario;
        const bruto = Math.round(ni.cantidad * unit * 100) / 100;
        next[idx] = {
          ...next[idx],
          ...ni,
          id: next[idx].id,
          cantidad: ni.cantidad,
          precioUnitario: unit,
          subtotal: bruto,
        };
      } else {
        next.push(ni);
      }
    }
    setItems(next);
  };

  const canSave = customerId && items.length > 0;

  const onConfirm = async () => {
    if (!canSave) return;
    const localId = uuidSimple();
    const payload: Omit<Order, "id" | "status" | "synced" | "attempts" | "createdAt"> = {
      localId,
      serverId: null,
      customerId,
      items,
      discount,
      total,
      notes,
      photos: [],
      location: null,
    };
    await addOrder(payload);
    // intenta sincronizar ya (si hay internet se envía; si no, queda para BG Sync)
    await syncOrders();

    // reset UI
    setCustomerId("");
    setItems([]);
    setDiscount(0);
    setNotes("");
  };

  return (
    <Card className="p-4 space-y-4">
      <OrderCustomer value={customerId} onChange={setCustomerId} />

      <div className="flex items-center justify-between">
        <div className="font-semibold">Productos</div>
        <Button variant="secondary" onClick={() => setOpenProductModal(true)}>
          Agregar producto
        </Button>
      </div>

      <OrderItemsList items={items} onChange={setItems} />

      <OrderSummary discount={discount} onDiscountChange={setDiscount} itemsTotal={itemsTotal} />

      <div className="grid gap-2">
        <textarea
          className="border rounded-lg p-2 min-h-24"
          placeholder="Notas del pedido (opcional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
        />
        <span className="text-xs text-gray-500">{notes.length}/500 caracteres</span>
      </div>

      <div className="text-right">
        <Button disabled={!canSave} onClick={onConfirm}>
          Confirmar pedido (Q{total.toFixed(2)})
        </Button>
      </div>

      <ProductSelectionModal
        open={openProductModal}
        onOpenChange={setOpenProductModal}
        onPick={onPickProducts}
      />
    </Card>
  );
}
