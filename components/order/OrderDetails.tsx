// components/order/OrderDetails.tsx
"use client";

import type { Order } from "@/lib/types";

export default function OrderDetails({ order }: { order: Order }) {
  return (
    <div className="space-y-2">
      <div className="text-sm text-muted-foreground">Cliente: {order.customerId}</div>
      <div className="text-sm text-muted-foreground">Estado: {order.status} {order.synced ? "· sincronizado" : ""}</div>
      <div className="border rounded-lg p-2">
        {order.items.map((it) => (
          <div key={it.id} className="flex justify-between text-sm">
            <div>{it.descripcion}</div>
            <div>
              {it.cantidad} × Q{it.precioUnitario.toFixed(2)} = <strong>Q{it.subtotal.toFixed(2)}</strong>
            </div>
          </div>
        ))}
      </div>
      <div className="text-right font-semibold">Total: Q{order.total.toFixed(2)}</div>
    </div>
  );
}
