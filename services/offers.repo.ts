// services/offers.repo.ts
import { db } from "../lib/db";
import type { OfferDef } from "../lib/types.offers";
import { pickReferenceCode } from "../lib/utils";
import { getAccessToken } from "./auth";

const API = process.env.NEXT_PUBLIC_API_URL || "";
const ENDPOINT = "/oferta-preventa";

const nowIso = () => new Date().toISOString();

const generateTempId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `offer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const sanitizeUser = (value?: string | null, fallback: string | undefined = "webapp") => {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : fallback;
};

const ensureIsoString = (value?: string | Date | null, fallback?: string): string => {
  if (value instanceof Date) {
    if (!Number.isNaN(value.getTime())) return value.toISOString();
    return fallback ?? nowIso();
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    const trimmed = value.trim();
    if (trimmed) {
      const retry = new Date(trimmed);
      if (!Number.isNaN(retry.getTime())) return retry.toISOString();
    }
    return fallback ?? nowIso();
  }
  if (value != null) {
    const parsed = new Date(value as any);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return fallback ?? nowIso();
};

const toDateObject = (value?: string | Date | null): Date => {
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (value != null) {
    const parsed = new Date(value as any);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
};

function isOnline() {
  return typeof window !== "undefined" &&
         typeof navigator !== "undefined" &&
         navigator.onLine;
}

// 🔹 Leer ofertas DIRECTAMENTE del backend (para backoffice)
export async function getOfferDefsOnline(
  codigoEmpresa: string,
  estado?: string,
  page: number = 0,
  size: number = 50
): Promise<{ items: OfferDef[]; totalPages: number; totalElements: number; page: number; size: number }> {
  if (!API || !isOnline()) {
    throw new Error("No hay conexión a internet");
  }

  const token = await getAccessToken();
  const base = API.replace(/\/$/, "");
  
  let url = `${base}${ENDPOINT}?codigoEmpresa=${encodeURIComponent(codigoEmpresa)}&page=${page}&size=${size}`;
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
  const totalPages = data.totalPages ?? 1;
  const totalElements = data.totalElements ?? items.length;

  return {
    items: items.map((item: any) => mapBackendToOfferDef(item)),
    totalPages,
    totalElements,
    page,
    size
  };
}

// 🔹 Crear oferta ONLINE
export async function createOfferDefOnline(draft: OfferDef, actorUsername?: string): Promise<OfferDef> {
  if (!API || !isOnline()) {
    throw new Error("No hay conexión a internet");
  }

  const token = await getAccessToken();
  const base = API.replace(/\/$/, "");
  const url = `${base}${ENDPOINT}`;

  const serverUuid = draft.serverId || draft.id;
  const normalizedReferenceCode = draft.referenceCode ? draft.referenceCode.trim().toUpperCase() : undefined;
  const actor = sanitizeUser(actorUsername ?? draft.createdBy, "webapp") ?? "webapp";
  const timestampIso = nowIso();
  const createdAtIso = timestampIso;
  const updatedAtIso = timestampIso;
  const createdBy = actor;
  const updatedBy = actor;
  const codigoOferta = normalizedReferenceCode ?? draft.codigoOferta ?? draft.referenceCode ?? undefined;

  // 🔥 Preparar payload según estructura OfertaPreventa
  const payload = {
    uuidOferta: serverUuid,
    codigoEmpresa: draft.codigoEmpresa,
    tipoOferta: draft.type,
    estado: draft.status,
    fechaDesde: toDateObject(draft.dates.validFrom),
    fechaHasta: toDateObject(draft.dates.validTo),
    ofertaDetalle: JSON.stringify({
      id: draft.id,
      codigoEmpresa: draft.codigoEmpresa,
      type: draft.type,
      name: draft.name,
      description: draft.description,
      referenceCode: normalizedReferenceCode,
      codigoOferta,
      status: draft.status,
      dates: draft.dates,
      scope: draft.scope,
      products: draft.products,
      familias: draft.familias,
      subfamilias: draft.subfamilias,
      proveedores: draft.proveedores,
      stackableWithSameProduct: draft.stackableWithSameProduct,
      priority: draft.priority ?? 5,
      discount: draft.discount,
      bonus: draft.bonus,
      pack: draft.pack,
      priceList: draft.priceList,
      createdAt: createdAtIso,
      createdBy,
      updatedAt: updatedAtIso,
      updatedBy,
      deleted: draft.deleted ?? false,
    }),
    eliminado: Boolean(draft.deleted),
    fechaCreacion: toDateObject(createdAtIso),
    fechaModificacion: toDateObject(updatedAtIso),
    usuario: createdBy,
    usuarioModificacion: updatedBy,
    codigoOferta,
    codigo_oferta: codigoOferta,
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
export async function updateOfferDefOnline(draft: OfferDef, actorUsername?: string): Promise<OfferDef> {
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

  const serverUuid = draft.serverId || draft.id;
  const normalizedReferenceCode = draft.referenceCode ? draft.referenceCode.trim().toUpperCase() : undefined;
  const nowTimestamp = nowIso();
  const createdAtIso = ensureIsoString(draft.createdAt, draft.updatedAt ?? nowTimestamp);
  const createdBy = sanitizeUser(draft.createdBy, "webapp") ?? "webapp";
  const actor = sanitizeUser(actorUsername ?? draft.updatedBy ?? draft.createdBy, createdBy) ?? createdBy;
  const updatedAtIso = nowTimestamp;
  const updatedBy = actor;
  const codigoOferta = normalizedReferenceCode ?? draft.codigoOferta ?? draft.referenceCode ?? undefined;

  // 🔥 Preparar payload según estructura OfertaPreventa
  const payload = {
    uuidOferta: serverUuid,
    codigoEmpresa: draft.codigoEmpresa,
    tipoOferta: draft.type,
    estado: draft.status,
    fechaDesde: toDateObject(draft.dates.validFrom),
    fechaHasta: toDateObject(draft.dates.validTo),
    ofertaDetalle: JSON.stringify({
      id: draft.id,
      codigoEmpresa: draft.codigoEmpresa,
      type: draft.type,
      name: draft.name,
      description: draft.description,
      referenceCode: normalizedReferenceCode,
      codigoOferta,
      status: draft.status,
      dates: draft.dates,
      scope: draft.scope,
      products: draft.products,
      familias: draft.familias,
      subfamilias: draft.subfamilias,
      proveedores: draft.proveedores,
      stackableWithSameProduct: draft.stackableWithSameProduct,
      priority: draft.priority ?? 5,
      discount: draft.discount,
      bonus: draft.bonus,
      pack: draft.pack,
      priceList: draft.priceList,
      createdAt: createdAtIso,
      createdBy,
      updatedAt: updatedAtIso,
      updatedBy,
      deleted: draft.deleted ?? false,
    }),
    eliminado: Boolean(draft.deleted),
    fechaCreacion: toDateObject(createdAtIso),
    fechaModificacion: toDateObject(updatedAtIso),
    usuario: createdBy,
    usuarioModificacion: updatedBy,
    codigoOferta,
    codigo_oferta: codigoOferta,
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
export function mapBackendToOfferDef(data: any): OfferDef {
  // El backend devuelve ofertaDetalle como string JSON
  let detalle: any = {};
  
  const rawDetail = data?.ofertaDetalle ?? data?.oferta_detalle ?? data?.detalle;

  if (rawDetail) {
    try {
      detalle = typeof rawDetail === 'string' 
        ? JSON.parse(rawDetail) 
        : rawDetail;
    } catch (e) {
      console.error("Error parseando ofertaDetalle:", e);
    }
  }

  const resolvedReference = pickReferenceCode(
    detalle.referenceCode,
    detalle.reference_code,
    detalle.codigoReferencia,
    detalle.codigo,
    detalle.code,
    detalle.codigoOferta,
    detalle.comboCode,
    detalle?.pack?.codigo,
    data.codigoReferencia,
    data.codigo_oferta,
    data.codigoOferta,
    data.codigo
  );
  const codigoOferta = resolvedReference ?? pickReferenceCode(
    data.codigoOferta,
    data.codigo_oferta,
    detalle.codigoOferta,
    detalle.referenceCode,
    detalle?.pack?.codigo,
    data.codigo
  );
  const referenceCode = codigoOferta ?? resolvedReference;

  const createdAtIso = ensureIsoString(data.fechaCreacion ?? data.fecha_creacion ?? detalle.createdAt);
  const updatedAtIso = ensureIsoString(data.fechaModificacion ?? data.fecha_modificacion ?? detalle.updatedAt, createdAtIso);
  const createdBy = sanitizeUser(detalle.createdBy ?? data.usuario ?? data.usuarioCreacion ?? null, undefined);
  const updatedBy = sanitizeUser(detalle.updatedBy ?? data.usuarioModificacion ?? data.usuario ?? null, undefined);
  const status = (data.estado ?? detalle.status ?? "draft") as OfferDef["status"];
  const type = (data.tipoOferta ?? detalle.type ?? "discount") as OfferDef["type"];
  const scope = detalle.scope || {};
  const serverId = typeof data.uuidOferta === "string" && data.uuidOferta.trim().length
    ? data.uuidOferta.trim()
    : undefined;
  const localId = typeof detalle.id === "string" && detalle.id.trim().length
    ? detalle.id.trim()
    : undefined;
  const fallbackId =
    data.idt != null
      ? String(data.idt)
      : typeof data.id === "string" && data.id.trim().length
        ? data.id.trim()
        : undefined;
  const resolvedId = serverId || localId || fallbackId || generateTempId();
  
  return {
    id: resolvedId,
    serverId,
    codigoEmpresa: data.codigoEmpresa || detalle.codigoEmpresa,
    type,
    name: detalle.name || data.nombre || "",
    referenceCode,
    codigoOferta,
    description: detalle.description || "",
    status,
    dates: {
      validFrom: detalle.dates?.validFrom || formatDate(data.fechaDesde),
      validTo: detalle.dates?.validTo || formatDate(data.fechaHasta),
    },
    scope,
    products: detalle.products || [],
    familias: detalle.familias || [],
    subfamilias: detalle.subfamilias || [],
    proveedores: detalle.proveedores || [],
    stackableWithSameProduct: detalle.stackableWithSameProduct ?? false,
    priority: (() => {
      const raw = detalle.priority ?? data.priority ?? data.prioridad ?? null;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : 5;
    })(),
    discount: detalle.discount,
    bonus: detalle.bonus,
    pack: detalle.pack,
    priceList:
      type === "pricelist"
        ? { products: detalle.priceList?.products ?? [] }
        : detalle.priceList
        ? { products: detalle.priceList.products ?? [] }
        : undefined,
    version: detalle.version ?? data.version ?? 1,
    createdAt: createdAtIso,
    createdBy,
    updatedAt: updatedAtIso,
    updatedBy,
    dirty: false,
    deleted: Boolean(data.eliminado ?? detalle.deleted),
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

