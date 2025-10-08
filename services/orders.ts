// services/orders.ts
import { db } from "../lib/db";
import type { Order } from "../lib/types";

const API = process.env.NEXT_PUBLIC_API_URL || ""; // ej. https://api.tu-backend.com

export async function getCachedOrders(): Promise<Order[]> {
  try {
    return await db.orders.toArray();
  } catch {
    return [];
  }
}

// Si tienes un getAccessToken() úsalo aquí. Por ahora omitimos token para no romper
async function getAccessTokenSafe(): Promise<string | null> {
  try {
    const row = await db.tokens.get("tokens");
    return row?.accessToken ?? null;
  } catch {
    return null;
  }
}

export async function syncOrderToServer(order: Order): Promise<{ ok: boolean; serverId?: string; error?: string }> {
  try {
    const token = await getAccessTokenSafe();

    // Mapea si tu backend requiere otra forma
    const payload = {
      localId: order.localId,
      customerId: order.customerId,
      discount: order.discount ?? 0,
      total: order.total,
      createdAt: order.createdAt,
      items: order.items?.map((it) => ({
        productoId: it.productoId,
        descripcion: it.descripcion,
        cantidad: it.cantidad,
        precioUnitario: it.precioUnitario,
        subtotal: it.subtotal,
        priceSource: it.priceSource ?? "base",
        comboId: it.comboId ?? null,
        kitId: it.kitId ?? null,
      })),
      notes: order.notes ?? "",
      photos: order.photos ?? [],
      location: order.location ?? null,
    };

    const res = await fetch(`${API}/pedidos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Idempotency-Key": order.localId,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, error: `${res.status} ${txt}` };
    }

    const data = await res.json().catch(() => ({}));
    return { ok: true, serverId: data?.id ?? data?.serverId ?? null };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Network error" };
  }
}
