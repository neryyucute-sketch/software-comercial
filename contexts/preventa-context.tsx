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
} from "@/lib/types"
import { db } from "@/lib/db"

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

/* --------------------------------- Contexto -------------------------------- */

const PreventaContext = createContext<PreventaContextType | undefined>(undefined)

export function PreventaProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Cliente[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [offers, setOffers] = useState<Offer[]>([])
  const [combos, setCombos] = useState<Combo[]>([])
  const [kits, setKits] = useState<Kit[]>([])
  const [priceLists, setPriceLists] = useState<PriceList[]>([])
  const [vendedor, setVendedor] = useState<Vendedor[]>([])

  console.log("🔄 PreventaProvider montado");

  /* ------------------------- Carga inicial desde Dexie ------------------------ */
  useEffect(() => {
    const loadData = async () => {
      const [p, c, o, co, k, pl, v] = await Promise.all([
        db.products.toArray(),
        db.clientes.toArray(),
        db.orders.toArray(),
        db.combos.toArray(),
        db.kits.toArray(),
        db.priceLists.toArray(),
        db.vendedor.toArray(),
      ])
      console.log("✅ Productos:", p.length, "Clientes:", c.length, "Pedidos:", o.length)
      setProducts(p || [])
      setCustomers(c || [])
      setOrders(normalizeOrders(o || []))
      setCombos(normalizeCombos(co || []))
      setKits(normalizeKits(k || []))
      setPriceLists(pl || [])
      setVendedor(v || [])
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
    const newPriceList: PriceList = { ...priceListData, id: generateId(), createdAt: new Date() }
    await db.priceLists.add(newPriceList)
    setPriceLists((prev) => [...prev, newPriceList])
  }

  const updatePriceList = async (id: string, priceListData: Partial<PriceList>) => {
    await db.priceLists.update(id, priceListData)
    setPriceLists((prev) => prev.map((pl) => (pl.id === id ? { ...pl, ...priceListData } : pl)))
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

    vendedor,
    addVendedor,
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
  addPriceList: (priceList: Omit<PriceList, "id" | "createdAt">) => void
  updatePriceList: (id: string, priceList: Partial<PriceList>) => void

  vendedor: Vendedor[]
  addVendedor: (vendedor: Omit<Vendedor, "idt" | "createdAt">) => void
}
