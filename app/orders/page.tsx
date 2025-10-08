// app/orders/page.tsx
"use client";

import { useState } from "react";
import { useOrders } from "@/contexts/OrdersContext";
import { Button } from "@/components/ui/button";
import OrderModal from "@/components/order/OrderModal";

export default function OrdersPage() {
  const { orders, syncing, syncOrders } = useOrders();
  const [open, setOpen] = useState(false);

  return (
    <div className="container max-w-6xl mx-auto py-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Pedidos</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => syncOrders()} disabled={syncing}>
            {syncing ? "Sincronizando…" : "Sincronizar"}
          </Button>
          <Button onClick={() => setOpen(true)}>Nuevo pedido</Button>
        </div>
      </div>

      {/* listado simple local */}
      <div className="space-y-2">
        {orders.length === 0 && (
          <div className="text-sm text-muted-foreground">Aún no hay pedidos.</div>
        )}
        {orders.map((o) => (
          <div key={o.localId} className="border rounded-xl p-3">
            <div className="flex items-center justify-between">
              <div className="font-medium">Cliente: {o.customerId}</div>
              <div className="text-sm text-muted-foreground">
                {o.status} {o.synced ? "· sincronizado" : ""}
              </div>
            </div>
            <div className="text-sm">
              Items: {o.items.length} · Total: <strong>Q{o.total.toFixed(2)}</strong>
            </div>
            {o.lastError && <div className="text-xs text-red-600 mt-1">Error: {o.lastError}</div>}
          </div>
        ))}
      </div>

      <OrderModal open={open} onOpenChange={setOpen} />
    </div>
  );
}
