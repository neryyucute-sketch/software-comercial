"use client"

import { createContext, useContext, type ReactNode, useEffect, useState } from "react"
import type {
  Product,
  Cliente,
  Order,
  Offer,
  PriceList,
  Combo,
  Kit,
  Vendedor,
  OrderTracking,
  OrderStatus,
  Visita,
} from "@/lib/types"
import { db } from "@/lib/db"
import {
  createPriceListOnline,
  updatePriceListOnline,
  deletePriceListOnline,
  syncPriceListsFromBackend,
} from "@/services/pricelists.repo"


/* ---------------------------- Helpers de soporte --------------------------- */

const generateId = () => {
  if (typeof crypto !== "undefined" && (crypto as any).randomUUID) {
    return (crypto as any).randomUUID()
  }
  return "id-" + Math.random().toString(36).slice(2) + "-" + Date.now().toString(36)
}

const asDate = (v: any): Date => (v instanceof Date ? v : new Date(v))

const normalizeOrders = (orders: Order[]): Order[] =>
  orders.map((o) => ({
    ...o,
    createdAt: asDate(o.createdAt),
    modifiedAt: o.modifiedAt ? asDate(o.modifiedAt) : undefined,
    tracking: Array.isArray(o.tracking)
      ? o.tracking.map((t) => ({ ...t, timestamp: asDate(t.timestamp) }))
      : [],
  }))


const normalizeCombos = (items: Combo[]): Combo[] =>
  items.map((c) => ({
    ...c,
    validFrom: asDate(c.validFrom),
    validTo: asDate(c.validTo),
    createdAt: asDate(c.createdAt),
  }))

const normalizeKits = (items: Kit[]): Kit[] =>
  items.map((k) => ({
    ...k,
    validFrom: asDate(k.validFrom),
    validTo: asDate(k.validTo),
    createdAt: asDate(k.createdAt),
  }))

const normalizePriceLists = (items: PriceList[]): PriceList[] =>
  items.map((pl) => {
    const companyId = (pl as any).companyId || (pl as any).codigoEmpresa || "general"
    const isBaseByName = typeof pl.name === "string" && /base/i.test(pl.name)
    const parsedTier = Number.parseInt((pl.name.match(/(\d+)/)?.[1] ?? "").trim(), 10)
    const tier =
      typeof pl.tier === "number"
        ? pl.tier
        : Number.isFinite(parsedTier)
          ? parsedTier
          : isBaseByName
            ? 0
            : 0

    const idFromStore = (pl as any).id || (pl as any).idt || generateId()
    const name = pl.name || (pl as any).descripcion || "Lista sin nombre"

    return {
      ...pl,
      id: idFromStore,
      name,
      companyId,
      tier,
      createdAt: asDate((pl as any).createdAt ?? new Date()),
    }
  })

/* --------------------------------- Contexto -------------------------------- */

const PreventaContext = createContext<PreventaContextType | undefined>(undefined)

export function PreventaProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Cliente[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [visits, setVisits] = useState<Visita[]>([])
  const [offers, setOffers] = useState<Offer[]>([])
  const [combos, setCombos] = useState<Combo[]>([])
  const [kits, setKits] = useState<Kit[]>([])
  const [priceLists, setPriceLists] = useState<PriceList[]>([])
  const [vendedor, setVendedor] = useState<Vendedor[]>([])

  console.log("🔄 PreventaProvider montado");

  /* ------------------------- Carga inicial desde Dexie ------------------------ */
  useEffect(() => {
    const loadData = async () => {
      const [p, c, o, co, k, pl, v, vs] = await Promise.all([
        db.products.toArray(),
        db.clientes.toArray(),
        db.orders.toArray(),
        db.combos.toArray(),
        db.kits.toArray(),
        db.priceLists.toArray(),
        db.vendedor.toArray(),
        db.visits.toArray(),
      ])
      console.log("✅ Productos:", p.length, "Clientes:", c.length, "Pedidos:", o.length)
      setProducts(p || [])
      setCustomers(c || [])
      setOrders(normalizeOrders(o || []))
      setCombos(normalizeCombos(co || []))
      setKits(normalizeKits(k || []))
      setPriceLists(normalizePriceLists(pl || []))
      setVendedor(v || [])
      setVisits(vs || [])
    }
    loadData()
  }, [])

  /* ------------------------------- Productos -------------------------------- */
  const addProduct = async (productData: Omit<Product, "idt" | "createdAt">) => {
    const newProduct: Product = { ...productData, idt: generateId() }
    await db.products.add(newProduct)
    setProducts((prev) => [...prev, newProduct])
  }

  const updateProduct = async (idt: string, productData: Partial<Product>) => {
    await db.products.update(idt, productData)
    setProducts((prev) => prev.map((p) => (p.idt === idt ? { ...p, ...productData } : p)))
  }

  const deleteProduct = async (idt: string) => {
    await db.products.delete(idt)
    setProducts((prev) => prev.filter((p) => p.idt !== idt))
  }

  /* -------------------------------- Clientes -------------------------------- */
  const addCustomer = async (customerData: Omit<Cliente, "idt" | "createdAt">) => {
    const newCustomer: Cliente = { ...customerData, idt: generateId() }
    await db.clientes.add(newCustomer)
    setCustomers((prev) => [...prev, newCustomer])
  }

  const updateCustomer = async (idt: string, customerData: Partial<Cliente>) => {
    await db.clientes.update(idt, customerData)
    setCustomers((prev) => prev.map((c) => (c.idt === idt ? { ...c, ...customerData } : c)))
  }

  /* --------------------------------- Pedidos -------------------------------- */
  const addOrder = async (orderData: Omit<Order, "id" | "createdAt">) => {
    const newOrder: Order = {
      ...orderData,
      id: generateId(),
      createdAt: new Date(),
      tracking: Array.isArray(orderData.tracking)
        ? orderData.tracking.map((t) => ({ ...t, timestamp: asDate(t.timestamp) }))
        : [],
    }
    await db.orders.add(newOrder)
    setOrders((prev) => [...prev, newOrder])
  }

  const updateOrder = async (id: string, orderData: Partial<Order>) => {
    await db.orders.update(id, { ...orderData, modifiedAt: new Date() })
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id
          ? {
              ...o,
              ...orderData,
              createdAt: orderData.createdAt ? asDate(orderData.createdAt) : o.createdAt,
              modifiedAt: new Date(),
              tracking: Array.isArray(orderData.tracking)
                ? orderData.tracking.map((t) => ({ ...t, timestamp: asDate(t.timestamp) }))
                : o.tracking,
            }
          : o
      )
    )
  }

  const cancelOrder = async (id: string) => {
    const order = orders.find((o) => o.id === id)
    if (!order) return
    const trackingEntry: OrderTracking = {
      id: generateId(),
      orderId: order.id,
      status: "rechazado" as OrderStatus,
      timestamp: new Date(),
      userId: "system",
      userName: "Sistema",
      notes: "Pedido cancelado por el usuario",
    }
    await db.orders.update(id, {
      status: "rechazado",
      modifiedAt: new Date(),
      tracking: [...(order.tracking || []), trackingEntry],
    })
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id
          ? { ...o, status: "rechazado", modifiedAt: new Date(), tracking: [...o.tracking, trackingEntry] }
          : o
      )
    )
  }

  /* ---------------------------------- Ofertas -------------------------------- */
  const addOffer = async (offerData: Omit<Offer, "id">) => {
    const newOffer: Offer = { ...offerData, id: generateId() }
    await db.offers.add(newOffer)
    setOffers((prev) => [...prev, newOffer])
  }

  const updateOffer = async (id: string, offerData: Partial<Offer>) => {
    await db.offers.update(id, offerData)
    setOffers((prev) => prev.map((o) => (o.id === id ? { ...o, ...offerData } : o)))
  }

  /* ---------------------------------- Combos --------------------------------- */
  const addCombo = async (comboData: Omit<Combo, "id" | "createdAt">) => {
    const newCombo: Combo = { ...comboData, id: generateId(), createdAt: new Date() }
    await db.combos.add(newCombo)
    setCombos((prev) => [...prev, newCombo])
  }

  const updateCombo = async (id: string, comboData: Partial<Combo>) => {
    await db.combos.update(id, comboData)
    setCombos((prev) => prev.map((c) => (c.id === id ? { ...c, ...comboData } : c)))
  }

  const deleteCombo = async (id: string) => {
    await db.combos.delete(id)
    setCombos((prev) => prev.filter((c) => c.id !== id))
  }

  /* -------------------------------- Visitas -------------------------------- */
  const addVisit = async (visit: Omit<Visita, "id" | "createdAt">) => {
    const nuevo: Visita = {
      ...visit,
      id: generateId(),
      createdAt: new Date().toISOString(),
      synced: false,
    }
    await db.visits.add(nuevo)
    setVisits((prev) => [...prev, nuevo])
  }

  /* ----------------------------------- Kits ---------------------------------- */
  const addKit = async (kitData: Omit<Kit, "id" | "createdAt">) => {
    const newKit: Kit = { ...kitData, id: generateId(), createdAt: new Date() }
    await db.kits.add(newKit)
    setKits((prev) => [...prev, newKit])
  }

  const updateKit = async (id: string, kitData: Partial<Kit>) => {
    await db.kits.update(id, kitData)
    setKits((prev) => prev.map((k) => (k.id === id ? { ...k, ...kitData } : k)))
  }

  const deleteKit = async (id: string) => {
    await db.kits.delete(id)
    setKits((prev) => prev.filter((k) => k.id !== id))
  }

  /* ------------------------------ Listas de Precio --------------------------- */
  const addPriceList = async (priceListData: Omit<PriceList, "id" | "createdAt">) => {
    const shortId = Math.random().toString(36).slice(2, 10)
    const created = await createPriceListOnline({
      ...priceListData,
      companyId: priceListData.companyId || "general",
      tier: typeof priceListData.tier === "number" ? priceListData.tier : 0,
      createdAt: new Date(),
      id: shortId,
    } as PriceList)
    const normalized = normalizePriceLists([created])[0]
    setPriceLists((prev) => [...prev, normalized])
  }

  const updatePriceList = async (id: string, priceListData: Partial<PriceList>) => {
    const current = priceLists.find((pl) => pl.id === id)
    if (!current) return

    const payload: PriceList = {
      ...current,
      ...priceListData,
      companyId: priceListData.companyId || priceListData.companyId === "" ? priceListData.companyId : current.companyId,
    }

    const updated = await updatePriceListOnline(payload)
    const normalized = normalizePriceLists([updated])[0]

    setPriceLists((prev) => prev.map((pl) => (pl.id === id ? normalized : pl)))
  }

  const deletePriceList = async (id: string) => {
    await deletePriceListOnline(id)
    setPriceLists((prev) => prev.filter((pl) => pl.id !== id))
  }

  const syncPriceLists = async (companyId: string) => {
    const remote = await syncPriceListsFromBackend(companyId)
    const normalized = normalizePriceLists(remote)
    setPriceLists(normalized)
    return normalized
  }

  /* --------------------------------- Vendedores ------------------------------ */
  const addVendedor = async (vendedorData: Omit<Vendedor, "idt" | "createdAt">) => {
    const newVendedor: Vendedor = { ...vendedorData, idt: generateId() }
    await db.vendedor.add(newVendedor)
    setVendedor((prev) => [...prev, newVendedor])
  }

  /* ---------------------------------- Value ---------------------------------- */
  const value: PreventaContextType = {
    products,
    addProduct,
    updateProduct,
    deleteProduct,

    customers,
    addCustomer,
    updateCustomer,

    orders,
    addOrder,
    updateOrder,
    cancelOrder,

    offers,
    addOffer,
    updateOffer,

    combos,
    addCombo,
    updateCombo,
    deleteCombo,

    kits,
    addKit,
    updateKit,
    deleteKit,

    priceLists,
    addPriceList,
    updatePriceList,
    deletePriceList,
    syncPriceLists,

    vendedor,
    addVendedor,

    visits,
    addVisit,
  }

  return <PreventaContext.Provider value={value}>{children}</PreventaContext.Provider>
}

export function usePreventa() {
  const context = useContext(PreventaContext)
  if (context === undefined) throw new Error("usePreventa must be used within a PreventaProvider")
  return context
}

/* ----------------------------- Tipado del Contexto ----------------------------- */
interface PreventaContextType {
  products: Product[]
  addProduct: (product: Omit<Product, "idt" | "createdAt">) => void
  updateProduct: (idt: string, product: Partial<Product>) => void
  deleteProduct: (idt: string) => void

  customers: Cliente[]
  addCustomer: (customer: Omit<Cliente, "idt" | "createdAt">) => void
  updateCustomer: (idt: string, customer: Partial<Cliente>) => void

  orders: Order[]
  addOrder: (order: Omit<Order, "id" | "createdAt">) => void
  updateOrder: (id: string, order: Partial<Order>) => void
  cancelOrder: (id: string) => void

  offers: Offer[]
  addOffer: (offer: Omit<Offer, "id">) => void
  updateOffer: (id: string, offer: Partial<Offer>) => void

  combos: Combo[]
  addCombo: (combo: Omit<Combo, "id" | "createdAt">) => void
  updateCombo: (id: string, combo: Partial<Combo>) => void
  deleteCombo: (id: string) => void

  kits: Kit[]
  addKit: (kit: Omit<Kit, "id" | "createdAt">) => void
  updateKit: (id: string, kit: Partial<Kit>) => void
  deleteKit: (id: string) => void

  priceLists: PriceList[]
  addPriceList: (priceList: Omit<PriceList, "id" | "createdAt">) => Promise<void>
  updatePriceList: (id: string, priceList: Partial<PriceList>) => Promise<void>
  deletePriceList: (id: string) => Promise<void>
  syncPriceLists: (companyId: string) => Promise<PriceList[]>

  vendedor: Vendedor[]
  addVendedor: (vendedor: Omit<Vendedor, "idt" | "createdAt">) => void
  visits: Visita[]
  addVisit: (visit: Omit<Visita, "id" | "createdAt">) => Promise<void>
}
