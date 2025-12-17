// services/offers.repo.ts
import { db } from "../lib/db";
import type { OfferDef } from "../lib/types.offers";
import { getAccessToken } from "./auth";

const API = process.env.NEXT_PUBLIC_API_URL || "";
const ENDPOINT = "/oferta-preventa";

const nowIso = () => new Date().toISOString();

function isOnline() {
  return typeof window !== "undefined" &&
         typeof navigator !== "undefined" &&
         navigator.onLine;
}

// 🔹 Leer ofertas DIRECTAMENTE del backend (para backoffice)
export async function getOfferDefsOnline(
  codigoEmpresa: string,
  estado?: string
): Promise<OfferDef[]> {
  if (!API || !isOnline()) {
    throw new Error("No hay conexión a internet");
  }

  const token = await getAccessToken();
  const base = API.replace(/\/$/, "");
  
  let url = `${base}${ENDPOINT}?codigoEmpresa=${encodeURIComponent(codigoEmpresa)}&page=0&size=1000`;
  if (estado) {
    url += `&estado=${encodeURIComponent(estado)}`;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };

  const res = await fetch(url, { headers });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }

  const data: any = await res.json();
  const items = data.content ?? [];

  return items.map((item: any) => mapBackendToOfferDef(item));
}

// 🔹 Crear oferta ONLINE
export async function createOfferDefOnline(draft: OfferDef): Promise<OfferDef> {
  if (!API || !isOnline()) {
    throw new Error("No hay conexión a internet");
  }

  const token = await getAccessToken();
  const base = API.replace(/\/$/, "");
  const url = `${base}${ENDPOINT}`;

  // 🔥 Preparar payload según estructura OfertaPreventa
  const payload = {
    codigoEmpresa: draft.codigoEmpresa,
    tipoOferta: draft.type,
    estado: draft.status,
    fechaDesde: new Date(draft.dates.validFrom),
    fechaHasta: new Date(draft.dates.validTo),
    ofertaDetalle: JSON.stringify({
      id: draft.id,
      codigoEmpresa: draft.codigoEmpresa,
      type: draft.type,
      name: draft.name,
      description: draft.description,
      status: draft.status,
      dates: draft.dates,
      scope: draft.scope,
      products: draft.products,
      familias: draft.familias,
      subfamilias: draft.subfamilias,
      proveedores: draft.proveedores,
      stackableWithSameProduct: draft.stackableWithSameProduct,
      discount: draft.discount,
      bonus: draft.bonus,
      pack: draft.pack,
    }),
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Error creando oferta: ${res.status} - ${errorText}`);
  }

  const data: any = await res.json();
  return mapBackendToOfferDef(data);
}

// 🔹 Actualizar oferta ONLINE
export async function updateOfferDefOnline(draft: OfferDef): Promise<OfferDef> {
  if (!API || !isOnline()) {
    throw new Error("No hay conexión a internet");
  }

  if (!draft.serverId && !draft.id) {
    throw new Error("No se puede actualizar una oferta sin serverId");
  }

  const token = await getAccessToken();
  const base = API.replace(/\/$/, "");
  const uuid = draft.serverId || draft.id;
  const url = `${base}${ENDPOINT}/${uuid}`;

  // 🔥 Preparar payload según estructura OfertaPreventa
  const payload = {
    codigoEmpresa: draft.codigoEmpresa,
    tipoOferta: draft.type,
    estado: draft.status,
    fechaDesde: new Date(draft.dates.validFrom),
    fechaHasta: new Date(draft.dates.validTo),
    ofertaDetalle: JSON.stringify({
      id: draft.id,
      codigoEmpresa: draft.codigoEmpresa,
      type: draft.type,
      name: draft.name,
      description: draft.description,
      status: draft.status,
      dates: draft.dates,
      scope: draft.scope,
      products: draft.products,
      familias: draft.familias,
      subfamilias: draft.subfamilias,
      proveedores: draft.proveedores,
      stackableWithSameProduct: draft.stackableWithSameProduct,
      discount: draft.discount,
      bonus: draft.bonus,
      pack: draft.pack,
    }),
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };

  const res = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Error actualizando oferta: ${res.status} - ${errorText}`);
  }

  const data: any = await res.json();
  return mapBackendToOfferDef(data);
}

// 🔹 Eliminar oferta ONLINE
export async function deleteOfferDefOnline(uuid: string): Promise<void> {
  if (!API || !isOnline()) {
    throw new Error("No hay conexión a internet");
  }

  const token = await getAccessToken();
  const base = API.replace(/\/$/, "");
  const url = `${base}${ENDPOINT}/${uuid}`;

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${token}`,
  };

  const res = await fetch(url, { method: "DELETE", headers });

  if (!res.ok) {
    throw new Error(`Error eliminando oferta: ${res.status}`);
  }
}

// 🔹 Mapear formato backend → OfferDef
function mapBackendToOfferDef(data: any): OfferDef {
  // El backend devuelve ofertaDetalle como string JSON
  let detalle: any = {};
  
  if (data.ofertaDetalle) {
    try {
      detalle = typeof data.ofertaDetalle === 'string' 
        ? JSON.parse(data.ofertaDetalle) 
        : data.ofertaDetalle;
    } catch (e) {
      console.error("Error parseando ofertaDetalle:", e);
    }
  }
  
  return {
    id: data.uuidOferta || detalle.id || data.idt?.toString(),
    serverId: data.uuidOferta,
    codigoEmpresa: data.codigoEmpresa || detalle.codigoEmpresa,
    type: data.tipoOferta || detalle.type || "discount",
    name: detalle.name || "",
    description: detalle.description || "",
    status: data.estado || detalle.status || "draft",
    dates: {
      validFrom: detalle.dates?.validFrom || formatDate(data.fechaDesde),
      validTo: detalle.dates?.validTo || formatDate(data.fechaHasta),
    },
    scope: detalle.scope || {},
    products: detalle.products || [],
    familias: detalle.familias || [],
    subfamilias: detalle.subfamilias || [],
    proveedores: detalle.proveedores || [],
    stackableWithSameProduct: detalle.stackableWithSameProduct ?? false,
    discount: detalle.discount,
    bonus: detalle.bonus,
    pack: detalle.pack,
    version: 1,
    updatedAt: formatDate(data.fechaModificacion) || nowIso(),
    dirty: false,
    deleted: data.eliminado || false,
  };
}

// Helper para formatear fechas
function formatDate(date: any): string {
  if (!date) return new Date().toISOString().split('T')[0];
  if (typeof date === 'string') return date.split('T')[0];
  if (date instanceof Date) return date.toISOString().split('T')[0];
  return new Date(date).toISOString().split('T')[0];
}

// 🔹 Para uso LOCAL (vendedores móviles)
export async function getOfferDefsLocal(): Promise<OfferDef[]> {
  return db.offer_defs.filter((o) => !o.deleted).toArray();
}

// Compatibility wrappers used by UI/context code
export async function getOfferDefs(): Promise<OfferDef[]> {
  return getOfferDefsLocal();
}

export async function saveOfferDef(offer: OfferDef): Promise<void> {
  // Upsert by id
  await db.offer_defs.put(offer);
}

export async function deleteOfferDef(id: string): Promise<void> {
  // delete by primary key `id`
  await db.offer_defs.where('id').equals(id).delete();
}

