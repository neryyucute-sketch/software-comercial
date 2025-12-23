// contexts/OrdersContext.tsx
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Table } from "dexie";
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

type StoredOrder = Omit<Order, "id"> & {
  id?: number | string; // Dexie primary key (auto) or fallback string
  status?: OrderStatus; // legacy field indexed in Dexie
  lastError?: string | null;
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
    if (!("serviceWorker" in navigator)) return;

    // Espera control del SW sólo un tiempo para no colgar la promesa cuando no está registrado.
    const ready = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
    ]);

    if (!ready) return; // sin SW activo, no bloquear

    if ("SyncManager" in window) {
      await (ready as any).sync.register("sync-pedidos");
    } else {
      // Fallback: pedir al SW que sincronice por mensaje
      navigator.serviceWorker?.controller?.postMessage?.("SYNC_PEDIDOS_NOW");
    }
  } catch {
    // Ignorar
  }
}

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const ordersTable = db.orders as unknown as Table<StoredOrder, number>;
  const [orders, setOrders] = useState<Order[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrdersFromDB = useCallback(async () => {
    const data = (await getCachedOrders()) as unknown as StoredOrder[];
    const normalized = data.map((order) => {
      if (!Array.isArray(order.items) || order.items.length === 0) {
        const id = typeof order.id === "string" ? order.id : order.localId ?? String(order.serverId ?? order.createdAt ?? "");
        return { ...order, id } as Order;
      }
      const sortedItems = [...order.items].sort((a, b) => {
        const aNum = a?.lineNumber ?? Number.POSITIVE_INFINITY;
        const bNum = b?.lineNumber ?? Number.POSITIVE_INFINITY;
        if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
        if (Number.isFinite(aNum)) return -1;
        if (Number.isFinite(bNum)) return 1;
        return 0;
      });
      const id = typeof order.id === "string" ? order.id : order.localId ?? String(order.serverId ?? order.createdAt ?? "");
      return { ...order, id, items: sortedItems } as Order;
    });
    // Mostrar primero los más recientes
    normalized.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    setOrders(normalized);
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

    const stored: StoredOrder = {
      ...o,
      id: undefined,
      localId,
      createdAt: now,
      attempts: 0,
      status: "ingresado" as OrderStatus,
      estado: o.estado ?? "ingresado",
      synced: false,
      total,
    };

    await db.transaction("rw", ordersTable, async () => {
      await ordersTable.add(stored);
    });

    await loadOrdersFromDB();
    await registerBGSync();
  };

  const cancelOrder: OrdersContextType["cancelOrder"] = async (localId) => {
    setError(null);
    const row = (await ordersTable.where("localId").equals(localId).first()) as StoredOrder | undefined;
    if (!row || row.id === undefined || row.id === null) return;
    const key = typeof row.id === "number" ? row.id : Number(row.id);
    if (!Number.isFinite(key)) return;
    // “Cancelar” localmente si aún no se envió
    if (!row.synced) {
      await ordersTable.delete(key);
    } else {
      // Si ya se envió podrías llamar a backend para anular (no implementado aquí)
      await ordersTable.update(key, { estado: "failed" as OrderStatus, status: "failed" as OrderStatus, lastError: "Cancelación no implementada" });
    }
    await loadOrdersFromDB();
  };

  const syncOrders = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const pend = (await ordersTable.toArray()) as StoredOrder[];
      const pending = pend.filter(o => !o.synced);
      for (const o of pending) {
        // evitar ráfagas
        if ((o.attempts ?? 0) > 6) continue;

        const keyRaw = o.id;
        if (keyRaw === undefined || keyRaw === null) continue;
        const key = typeof keyRaw === "number" ? keyRaw : Number(keyRaw);
        if (!Number.isFinite(key)) continue;

        await ordersTable.update(key, { estado: "sending" as OrderStatus, status: "sending" as OrderStatus, attempts: (o.attempts ?? 0) + 1 });

        const sendable: Order = {
          ...o,
          id: typeof o.id === "string" ? o.id : o.localId ?? String(o.serverId ?? o.createdAt ?? ""),
        };

        const res = await syncOrderToServer(sendable);
        if (res.ok) {
          await ordersTable.update(key, {
            estado: "sent" as OrderStatus,
            status: "sent" as OrderStatus,
            synced: true,
            serverId: res.serverId ?? null,
            lastError: null,
          });
        } else {
          const err = res.error ?? "error desconocido";
          await ordersTable.update(key, { estado: "failed" as OrderStatus, status: "failed" as OrderStatus, lastError: err });
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
