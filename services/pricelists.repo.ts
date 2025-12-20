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
  const toSearchText = () => {
    if (typeof rawDetalle === "string") return rawDetalle
    try {
      return JSON.stringify(rawDetalle ?? data ?? {})
    } catch {
      return ""
    }
  }

  if (rawDetalle) {
    try {
      detalle = typeof rawDetalle === "string" ? JSON.parse(rawDetalle) : rawDetalle
      // Si viene anidado como listaPrecioDetalle dentro del detalle, lo aplanamos
      if (detalle && detalle.listaPrecioDetalle) {
        const innerRaw = detalle.listaPrecioDetalle
        const inner = typeof innerRaw === "string" ? JSON.parse(innerRaw) : innerRaw
        detalle = { ...detalle, ...inner }
      }
    } catch (e) {
      console.error("Error parseando listaPrecioDetalle:", e)
    }
  }

  const products = detalle.products || (detalle.listaPrecioDetalle && detalle.listaPrecioDetalle.products) || data.products || {}
  const code = data.codigoListaPrecio || detalle.codigoListaPrecio || undefined
  const inferredTier = () => {
    const fromCode = Number.isFinite(Number(code)) ? Number(code) : undefined
    return detalle.tier ?? data.tier ?? fromCode ?? 0
  }
  const tier = inferredTier()
  const name =
    detalle.name ||
    data.name ||
    data.descripcion ||
    (tier === 0 ? "Lista precio default" : `Lista precio ${tier}`)
  const companyId = detalle.codigoEmpresa || data.codigoEmpresa || "general"
  const isActive = (data.estado || detalle.status || data.status || "active").toLowerCase() === "active"
  const serverIdTopRaw = data.uuidListaPrecio || data.uuid_lista_precio || data.uuid || data.id || data.idt?.toString()
  const serverIdDetailRaw = detalle.uuidListaPrecio || detalle.id
  const serverIdTop = serverIdTopRaw && serverIdTopRaw !== code ? serverIdTopRaw : undefined
  const serverIdDetail = serverIdDetailRaw && serverIdDetailRaw !== code ? serverIdDetailRaw : undefined
  let serverId = serverIdTop || serverIdDetail || undefined
  if (!serverId) {
    // Busca un UUID v4 en cualquier parte del payload/JSON recibido
    const text = toSearchText()
    const match = text.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/)
    if (match) serverId = match[0]
  }
  const id = serverId || data.idt?.toString() || code || name

  return {
    id,
    serverId,
    name,
    companyId,
    tier,
    products,
    isActive,
    createdAt: new Date(detalle.createdAt || data.fechaCreacion || data.fechaModificacion || nowIso()),
    code,
  }
}

function buildPayload(list: PriceList) {
  const codigoListaPrecio = (list as any).code || ((list.tier ?? 0) === 0 ? "default" : String(list.tier ?? 0))
  const uuidListaPrecio = (list as any).serverId || undefined
  const detalle = {
    id: uuidListaPrecio,
    codigoListaPrecio,
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
    codigoListaPrecio,
    ...(uuidListaPrecio ? { uuidListaPrecio } : {}),
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

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "x-codigo-empresa": codigoEmpresa,
  }

  // Solo intentamos llamadas GET; el POST se reservaba para crear listas y provocaba inserciones accidentales en la consulta.
  const attempts: Array<{ url: string; init?: RequestInit }> = [
    { url: `${base}${ENDPOINT}?codigoEmpresa=${company}&page=0&size=500`, init: { method: "GET", headers } },
    { url: `${base}${ENDPOINT}/${company}?page=0&size=500`, init: { method: "GET", headers } },
  ]

  let res: Response | null = null
  const errors: string[] = []

  for (const attempt of attempts) {
    try {
      res = await fetch(attempt.url, attempt.init)
      if (res.ok) break
      errors.push(`HTTP ${res.status} (${attempt.init?.method || "GET"}) ${attempt.url}`)
    } catch (e: any) {
      errors.push(`${attempt.init?.method || "GET"} ${attempt.url}: ${e?.message || e}`)
    }
  }

  if (!res || !res.ok) {
    const last = res ? `HTTP ${res.status}: ${await res.text()}` : "Sin respuesta"
    const detail = errors.length ? ` | intentos: ${errors.join("; ")}` : ""
    throw new Error(`${last}${detail}`)
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
  const uuidRaw = (draft as any).serverId
  if (!uuidRaw) {
    throw new Error("No se encontró uuidListaPrecio. Sincroniza listas y vuelve a intentar.")
  }

  const uuid = encodeURIComponent(uuidRaw)
  const payload = JSON.stringify(buildPayload(draft))

  const res = await fetch(`${base}${ENDPOINT}/${uuid}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "x-codigo-empresa": draft.companyId || "",
    },
    body: payload,
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
  try {
    const remote = await getPriceListsOnline(codigoEmpresa)
    if (remote.length) {
      await replacePriceListsLocal(remote)
      return remote
    }
    console.warn("Sync devolvió vacío; se conserva cache local")
    return getPriceListsLocal()
  } catch (err) {
    console.warn("Fallo al sincronizar listas; se mantiene cache local", err)
    return getPriceListsLocal()
  }
}

