// components/order/OrderDetails.tsx
"use client";

import type { Order } from "@/lib/types";

export default function OrderDetails({ order }: { order: Order }) {
  const cliente = (order as any).codigoCliente || (order as any).customerId || ""
  const estado = (order as any).estado || (order as any).status || ""
  return (
    <div className="space-y-2">
      <div className="text-sm text-muted-foreground">Cliente: {cliente}</div>
      <div className="text-sm text-muted-foreground">Estado: {estado} {order.synced ? "· sincronizado" : ""}</div>
      <div className="border rounded-lg p-2">
        {order.items.map((it) => (
          <div key={it.id} className="flex justify-between text-sm">
            <div>{it.descripcion}</div>
            <div>
              {it.cantidad} × Q{(it.precioUnitario ?? 0).toFixed(2)} = <strong>Q{(it.subtotal ?? 0).toFixed(2)}</strong>
            </div>
          </div>
        ))}
      </div>
      <div className="text-right font-semibold">Total: Q{order.total.toFixed(2)}</div>
    </div>
  );
}
