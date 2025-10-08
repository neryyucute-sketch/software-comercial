"use client"

import { useState, useEffect } from "react"

interface OfflineOrder {
  id: string
  customerId: string
  items: any[]
  total: number
  createdAt: Date
  synced: boolean
}

export function useOfflineStorage() {
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    setIsSupported(
      typeof window !== "undefined" &&
        "indexedDB" in window &&
        indexedDB !== null &&
        typeof indexedDB.open === "function",
    )
  }, [])

  const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      if (!isSupported) {
        reject(new Error("IndexedDB not supported"))
        return
      }

      const request = indexedDB.open("PreventaDB", 1)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Orders store
        if (!db.objectStoreNames.contains("orders")) {
          const ordersStore = db.createObjectStore("orders", { keyPath: "id" })
          ordersStore.createIndex("synced", "synced", { unique: false })
        }

        // Products store
        if (!db.objectStoreNames.contains("products")) {
          db.createObjectStore("products", { keyPath: "id" })
        }

        // Customers store
        if (!db.objectStoreNames.contains("customers")) {
          db.createObjectStore("customers", { keyPath: "id" })
        }

        // Offers store
        if (!db.objectStoreNames.contains("offers")) {
          db.createObjectStore("offers", { keyPath: "id" })
        }
      }
    })
  }

  const saveOfflineOrder = async (order: Omit<OfflineOrder, "id" | "createdAt" | "synced">) => {
    if (!isSupported) {
      console.warn("IndexedDB not supported, using localStorage fallback")
      if (typeof localStorage === "undefined") {
        throw new Error("Neither IndexedDB nor localStorage are supported")
      }

      const orders = JSON.parse(localStorage.getItem("offlineOrders") || "[]")
      const newOrder = {
        ...order,
        id: Date.now().toString(),
        createdAt: new Date(),
        synced: false,
      }
      orders.push(newOrder)
      localStorage.setItem("offlineOrders", JSON.stringify(orders))
      return newOrder.id
    }

    try {
      const db = await openDB()
      const transaction = db.transaction(["orders"], "readwrite")
      const store = transaction.objectStore("orders")

      const newOrder: OfflineOrder = {
        ...order,
        id: Date.now().toString(),
        createdAt: new Date(),
        synced: false,
      }

      await store.add(newOrder)
      return newOrder.id
    } catch (error) {
      console.error("Error saving offline order:", error)
      throw error
    }
  }

  const getOfflineOrders = async (): Promise<OfflineOrder[]> => {
    if (!isSupported) {
      if (typeof localStorage === "undefined") {
        return []
      }
      return JSON.parse(localStorage.getItem("offlineOrders") || "[]")
    }

    try {
      const db = await openDB()
      const transaction = db.transaction(["orders"], "readonly")
      const store = transaction.objectStore("orders")
      const index = store.index("synced")

      return new Promise((resolve, reject) => {
        const request = index.getAll(false) // Get unsynced orders
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error("Error getting offline orders:", error)
      return []
    }
  }

  const markOrderAsSynced = async (orderId: string) => {
    if (!isSupported) {
      if (typeof localStorage === "undefined") {
        return
      }
      const orders = JSON.parse(localStorage.getItem("offlineOrders") || "[]")
      const updatedOrders = orders.map((order: OfflineOrder) =>
        order.id === orderId ? { ...order, synced: true } : order,
      )
      localStorage.setItem("offlineOrders", JSON.stringify(updatedOrders))
      return
    }

    try {
      const db = await openDB()
      const transaction = db.transaction(["orders"], "readwrite")
      const store = transaction.objectStore("orders")

      const order = await store.get(orderId)
      if (order) {
        order.synced = true
        await store.put(order)
      }
    } catch (error) {
      console.error("Error marking order as synced:", error)
    }
  }

  const clearOfflineOrders = async () => {
    if (!isSupported) {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem("offlineOrders")
      }
      return
    }

    try {
      const db = await openDB()
      const transaction = db.transaction(["orders"], "readwrite")
      const store = transaction.objectStore("orders")
      await store.clear()
    } catch (error) {
      console.error("Error clearing offline orders:", error)
    }
  }

  const saveToCache = async (storeName: string, data: any[]) => {
    if (!isSupported) {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(`cache_${storeName}`, JSON.stringify(data))
      }
      return
    }

    try {
      const db = await openDB()
      const transaction = db.transaction([storeName], "readwrite")
      const store = transaction.objectStore("store")

      await store.clear()
      for (const item of data) {
        await store.add(item)
      }
    } catch (error) {
      console.error(`Error caching ${storeName}:`, error)
    }
  }

  const getFromCache = async (storeName: string): Promise<any[]> => {
    if (!isSupported) {
      if (typeof localStorage === "undefined") {
        return []
      }
      return JSON.parse(localStorage.getItem(`cache_${storeName}`) || "[]")
    }

    try {
      const db = await openDB()
      const transaction = db.transaction([storeName], "readonly")
      const store = transaction.objectStore("store")

      return new Promise((resolve, reject) => {
        const request = store.getAll()
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error(`Error getting ${storeName} from cache:`, error)
      return []
    }
  }

  return {
    isSupported,
    saveOfflineOrder,
    getOfflineOrders,
    markOrderAsSynced,
    clearOfflineOrders,
    saveToCache,
    getFromCache,
  }
}
