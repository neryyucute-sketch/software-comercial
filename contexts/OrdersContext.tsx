// contexts/OrdersContext.tsx
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { db } from "@/lib/db";
import type { Order, OrderItem, OrderStatus } from "@/lib/types";
import { syncOrderToServer, getCachedOrders } from "@/services/orders";

type OrdersContextType = {
  orders: Order[];
  syncing: boolean;
  error: string | null;
  addOrder: (order: Omit<Order, "id" | "status" | "synced" | "attempts" | "createdAt">) => Promise<void>;
  cancelOrder: (localId: string) => Promise<void>;
  syncOrders: () => Promise<void>;
  loadOrdersFromDB: () => Promise<void>;
};

const OrdersContext = createContext<OrdersContextType | null>(null);

function uuid(): string {
  // uuid v4 simple sin dependencia externa
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 15) >> 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function registerBGSync() {
  try {
    if ("serviceWorker" in navigator && "SyncManager" in window) {
      const reg = await navigator.serviceWorker.ready;
      (await (reg as any).sync.register("sync-pedidos"));
    } else {
      // Fallback: pedir al SW que sincronice por mensaje
      navigator.serviceWorker?.controller?.postMessage?.("SYNC_PEDIDOS_NOW");
    }
  } catch {
    // Ignorar
  }
}

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrdersFromDB = useCallback(async () => {
    const data = await getCachedOrders();
    // Mostrar primero los más recientes
    data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    setOrders(data);
  }, []);

  useEffect(() => {
    loadOrdersFromDB();
  }, [loadOrdersFromDB]);

  // Observa reconexión para disparar sync
  useEffect(() => {
    const fn = () => {
      if (navigator.onLine) registerBGSync();
    };
    window.addEventListener("online", fn);
    return () => window.removeEventListener("online", fn);
  }, []);

  const addOrder: OrdersContextType["addOrder"] = async (o) => {
    setError(null);
    const now = Date.now();
    const localId = o.localId || uuid();

    // Recalcular total por seguridad (en caso vengan items ya armados)
    const sub = (o.items || []).reduce((acc, it) => acc + (it.subtotal || it.cantidad * it.precioUnitario), 0);
    const discount = o.discount ? Math.max(0, Math.min(100, o.discount)) : 0;
    const total = Math.round((sub * (1 - discount / 100)) * 100) / 100;

    await db.transaction("rw", db.orders, async () => {
      await db.orders.add({
        ...o,
        localId,
        createdAt: now,
        attempts: 0,
        status: "ingresado" as OrderStatus,
        synced: false,
        total,
      });
    });

    await loadOrdersFromDB();
    await registerBGSync();
  };

  const cancelOrder: OrdersContextType["cancelOrder"] = async (localId) => {
    setError(null);
    const row = await db.orders.where("localId").equals(localId).first();
    if (!row) return;
    // “Cancelar” localmente si aún no se envió
    if (!row.synced) {
      await db.orders.delete(row.id!);
    } else {
      // Si ya se envió podrías llamar a backend para anular (no implementado aquí)
      await db.orders.update(row.id!, { status: "failed" as OrderStatus, lastError: "Cancelación no implementada" });
    }
    await loadOrdersFromDB();
  };

  const syncOrders = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const pend = (await db.orders.toArray()).filter(o => !o.synced);
      for (const o of pend) {
        // evitar ráfagas
        if ((o.attempts ?? 0) > 6) continue;

        await db.orders.update(o.id!, { status: "sending" as OrderStatus, attempts: (o.attempts ?? 0) + 1 });

        const res = await syncOrderToServer(o);
        if (res.ok) {
          await db.orders.update(o.id!, {
            status: "sent" as OrderStatus,
            synced: true,
            serverId: res.serverId ?? null,
            lastError: null,
          });
        } else {
          const err = res.error ?? "error desconocido";
          await db.orders.update(o.id!, { status: "failed" as OrderStatus, lastError: err });
          // backoff simple por pedido (no bloquear todo)
          await new Promise((r) => setTimeout(r, Math.min(30000, 1000 * Math.pow(2, o.attempts ?? 0))));
        }
      }
    } catch (e: any) {
      setError(e?.message ?? "Error sync");
    } finally {
      setSyncing(false);
      await loadOrdersFromDB();
    }
  }, [loadOrdersFromDB]);

  return (
    <OrdersContext.Provider
      value={{
        orders,
        syncing,
        error,
        addOrder,
        cancelOrder,
        syncOrders,
        loadOrdersFromDB,
      }}
    >
      {children}
    </OrdersContext.Provider>
  );
}

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error("useOrders debe usarse dentro de <OrdersProvider>");
  return ctx;
}
