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

    // 🔒 Seguridad: Limitar longitud de notas
    const sanitizedNotes = (order.notes ?? "").substring(0, 500);

    // Mapea si tu backend requiere otra forma
    const payload = {
      localId: order.localId,
      customerId: order.codigoCliente,
      discount: Math.max(0, Math.min(100, order.discount ?? 0)), // 0-100%
      total: order.total,
      createdAt: order.createdAt,
      items: order.items?.map((it) => ({
        productoId: it.productoId,
        descripcion: it.descripcion.substring(0, 200),
        cantidad: Math.max(0, it.cantidad),
        precioUnitario: Math.max(0, it.precioUnitario),
        subtotal: Math.max(0, it.subtotal),
        priceSource: it.priceSource ?? "base",
        priceListId: it.priceListId ?? null,
        priceListCode: it.priceListCode ?? null,
        priceListName: it.priceListName ?? null,
        codigoProveedor: it.codigoProveedor ?? null,
        nombreProveedor: it.nombreProveedor ?? null,
        codigoLinea: it.codigoLinea ?? null,
        nombreLinea: it.nombreLinea ?? null,
        comboId: it.comboId ?? null,
        kitId: it.kitId ?? null,
        comboGroupId: it.comboGroupId ?? null,
        comboCode: it.comboCode ?? null,
        comboName: it.comboName ?? null,
        comboPackPrice: it.comboPackPrice ?? null,
        comboPacksQty: it.comboPacksQty ?? null,
        comboType: it.comboType ?? null,
        esBonificacion: it.esBonificacion ?? false,
        promoBonificacionId: it.promoBonificacionId ?? null,
        ofertaIdAplicada: it.ofertaIdAplicada ?? null,
        ofertaNombre: it.ofertaNombre ?? null,
        ofertaCodigo: it.ofertaCodigo ?? null,
        tipoOferta: it.tipoOferta ?? null,
        parentItemId: it.parentItemId ?? null,
        relatedItemIds: it.relatedItemIds ?? null,
        lineNumber: it.lineNumber ?? null,
      })),
      notes: sanitizedNotes,
      photos: (order.photos ?? []).slice(0, 10), // 🔒 Máximo 10 fotos
      location: order.location ?? null,
    };

    // 🔒 Seguridad: Timeout de 30 segundos
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const res = await fetch(`${API}/pedidos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(order.localId ? { "Idempotency-Key": order.localId } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, error: `${res.status} ${txt}` };
    }

    const data = await res.json().catch(() => ({}));
    return { ok: true, serverId: data?.id ?? data?.serverId ?? null };
  } catch (e: any) {
    // 🔒 Seguridad: Detectar timeout
    if (e?.name === 'AbortError') {
      return { ok: false, error: "Timeout: La petición tardó más de 30 segundos" };
    }
    return { ok: false, error: e?.message ?? "Network error" };
  }
}
