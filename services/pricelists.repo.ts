import { db } from "@/lib/db"
import type { PriceList } from "@/lib/types"
import { getAccessToken } from "./auth"

const API = process.env.NEXT_PUBLIC_API_URL || ""
// Usa endpoint sin prefijo api para evitar duplicar si NEXT_PUBLIC_API_URL ya lo trae
const ENDPOINT = "/lista-precios"

const nowIso = () => new Date().toISOString()
const generateId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)

const normalizeLocalPriceList = (pl: Partial<PriceList>): (PriceList & { idt: string }) => {
  const createdAt = pl.createdAt ? new Date(pl.createdAt) : new Date()
  const id = (pl as any).idt || pl.id || generateId()
  return {
    id,
    idt: id,
    name: pl.name || "Lista sin nombre",
    companyId: pl.companyId || "general",
    tier: typeof pl.tier === "number" ? pl.tier : 0,
    products: pl.products || {},
    isActive: pl.isActive ?? true,
    createdAt,
  }
}

export async function getPriceListsLocal(): Promise<PriceList[]> {
  const rows = await db.priceLists.toArray()
  return rows.map((pl) => normalizeLocalPriceList(pl))
}

export async function upsertPriceListLocal(list: Partial<PriceList>): Promise<PriceList> {
  const record = normalizeLocalPriceList(list)
  await db.priceLists.put(record as any)
  return record
}

export async function replacePriceListsLocal(lists: PriceList[]): Promise<PriceList[]> {
  const normalized = lists.map((pl) => normalizeLocalPriceList(pl))
  await db.priceLists.clear()
  if (normalized.length) await db.priceLists.bulkPut(normalized as any)
  return normalized
}

export async function deletePriceListLocal(id: string): Promise<void> {
  await db.priceLists.delete(id)
}
const plusYears = (years: number) => {
  const d = new Date()
  d.setFullYear(d.getFullYear() + years)
  return d.toISOString()
}

const isOnline = () =>
  typeof window !== "undefined" && typeof navigator !== "undefined" && navigator.onLine

function mapBackendToPriceList(data: any): PriceList | null {
  let detalle: any = {}
  const rawDetalle = data.listaPrecioDetalle || data.ofertaDetalle

  if (rawDetalle) {
    try {
      detalle = typeof rawDetalle === "string" ? JSON.parse(rawDetalle) : rawDetalle
    } catch (e) {
      console.error("Error parseando listaPrecioDetalle:", e)
    }
  }

  const products = detalle.products || data.products || {}
  const tier = detalle.tier ?? data.tier ?? 0
  const name = detalle.name || data.name || data.descripcion || "Lista precio"
  const companyId = detalle.codigoEmpresa || data.codigoEmpresa || "general"
  const isActive = (data.estado || detalle.status || data.status || "active").toLowerCase() === "active"

  return {
    id: data.codigoListaPrecio || detalle.id || data.uuidListaPrecio || data.idt?.toString() || name,
    name,
    companyId,
    tier,
    products,
    isActive,
    createdAt: new Date(detalle.createdAt || data.fechaCreacion || data.fechaModificacion || nowIso()),
  }
}

function buildPayload(list: PriceList) {
  const detalle = {
    id: list.id,
    codigoEmpresa: list.companyId,
    type: "lista-precio",
    name: list.name,
    tier: list.tier ?? 0,
    products: list.products,
    status: list.isActive ? "active" : "inactive",
    createdAt: list.createdAt ?? new Date(),
  }

  return {
    codigoEmpresa: list.companyId,
    codigoListaPrecio: list.id,
    estado: list.isActive ? "active" : "inactive",
    fechaCreacion: nowIso(),
    fechaModificacion: nowIso(),
    listaPrecioDetalle: JSON.stringify(detalle),
  }
}

export async function getPriceListsOnline(codigoEmpresa: string): Promise<PriceList[]> {
  if (!API || !isOnline()) throw new Error("No hay conexión a internet")

  const token = await getAccessToken()
  const base = API.replace(/\/$/, "")
  const company = encodeURIComponent(codigoEmpresa || "")
  // Solo GET para evitar inserciones accidentales; probamos dos rutas de lectura.
  const urls = [
    `${base}${ENDPOINT}?codigoEmpresa=${company}&page=0&size=500`,
    `${base}${ENDPOINT}/${company}?page=0&size=500`,
  ]

  let res: Response | null = null
  for (const url of urls) {
    res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "x-codigo-empresa": codigoEmpresa,
      },
    })
    if (res.ok) break
  }

  if (!res || !res.ok) {
    const last = res ? `HTTP ${res.status}: ${await res.text()}` : "Sin respuesta"
    throw new Error(last)
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  }

  const data: any = await res.json().catch(() => ({}))
  const raw = data?.content ?? data?.data ?? data ?? []
  const items = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.items)
      ? raw.items
      : raw
        ? [raw]
        : []

  const mapped = items
    .map((item: any) => mapBackendToPriceList(item))
    .filter(Boolean) as PriceList[]
  return mapped
}

export async function createPriceListOnline(draft: PriceList): Promise<PriceList> {
  if (!API || !isOnline()) throw new Error("No hay conexión a internet")

  const token = await getAccessToken()
  const base = API.replace(/\/$/, "")
  const url = `${base}${ENDPOINT}`

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(buildPayload(draft)),
  })

  if (!res.ok) {
    throw new Error(`Error creando lista de precios: ${res.status} - ${await res.text()}`)
  }

  const data: any = await res.json()
  const mapped = mapBackendToPriceList(data)
  if (!mapped) throw new Error("La respuesta no es una lista de precios válida")
  return mapped
}

export async function updatePriceListOnline(draft: PriceList): Promise<PriceList> {
  if (!API || !isOnline()) throw new Error("No hay conexión a internet")

  const token = await getAccessToken()
  const base = API.replace(/\/$/, "")
  const uuid = encodeURIComponent((draft as any).serverId || draft.id)
  const company = encodeURIComponent(draft.companyId || "")
  const url = `${base}${ENDPOINT}/${company}/${uuid}`

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "x-codigo-empresa": draft.companyId || "",
    },
    body: JSON.stringify(buildPayload(draft)),
  })

  if (!res.ok) {
    throw new Error(`Error actualizando lista de precios: ${res.status} - ${await res.text()}`)
  }

  const data: any = await res.json()
  const mapped = mapBackendToPriceList(data)
  if (!mapped) throw new Error("La respuesta no es una lista de precios válida")
  return mapped
}

export async function deletePriceListOnline(uuid: string): Promise<void> {
  if (!API || !isOnline()) throw new Error("No hay conexión a internet")

  const token = await getAccessToken()
  const base = API.replace(/\/$/, "")
  const url = `${base}${ENDPOINT}/${uuid}`

  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    throw new Error(`Error eliminando lista de precios: ${res.status} - ${await res.text()}`)
  }
}

export async function syncPriceListsFromBackend(codigoEmpresa: string): Promise<PriceList[]> {
  const remote = await getPriceListsOnline(codigoEmpresa)
  await replacePriceListsLocal(remote)
  return remote
}

