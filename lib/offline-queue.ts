"use client"

import { db } from "./db"

interface QueueItem {
  id: string
  type: "order" | "customer" | "product"
  data: any
  timestamp: Date
  retries: number
}

class OfflineQueue {
  private queue: QueueItem[] = []
  private processing = false
  private maxRetries = 3

  async addToQueue(type: QueueItem["type"], data: any) {
    const item: QueueItem = {
      id: crypto.randomUUID(), // 🔒 Seguridad: UUID seguro
      type,
      data,
      timestamp: new Date(),
      retries: 0,
    }

    this.queue.push(item)
    await this.saveQueue() // 🔒 Seguridad: usar IndexedDB

    // Try to process immediately if online
    if (navigator.onLine) {
      this.processQueue()
    }
  }

  // 🔒 Seguridad: Guardar en IndexedDB en lugar de localStorage
  private async saveQueue() {
    try {
      // Usar tabla temporal en IndexedDB
      const queueData = { id: "syncQueue", items: this.queue };
      await db.table("auth").put(queueData);
    } catch (error) {
      console.error("Error guardando cola de sincronización:", error);
    }
  }

  private async loadQueue() {
    try {
      const saved = await db.table("auth").get("syncQueue");
      if (saved && saved.items) {
        this.queue = saved.items;
      }
    } catch (error) {
      console.error("Error cargando cola de sincronización:", error);
      this.queue = [];
    }
  }

  async processQueue() {
    if (this.processing || !navigator.onLine) return

    this.processing = true
    this.loadQueue()

    const itemsToProcess = [...this.queue]

    for (const item of itemsToProcess) {
      try {
        await this.processItem(item)
        this.removeFromQueue(item.id)
      } catch (error) {
        console.error(`Error processing queue item ${item.id}:`, error)
        item.retries++

        if (item.retries >= this.maxRetries) {
          console.error(`Max retries reached for item ${item.id}, removing from queue`)
          this.removeFromQueue(item.id)
        }
      }
    }

    this.saveQueue()
    this.processing = false
  }

  private async processItem(item: QueueItem) {
    // Simulate API call
    const delay = Math.random() * 1000 + 500 // 500-1500ms
    await new Promise((resolve) => setTimeout(resolve, delay))

    switch (item.type) {
      case "order":
        console.log("📤 Enviando pedido al servidor:", item.data)
        // Simulate order upload
        if (Math.random() > 0.1) {
          // 90% success rate
          return { success: true, orderId: item.data.id }
        } else {
          throw new Error("Server error")
        }

      case "customer":
        console.log("📤 Enviando cliente al servidor:", item.data)
        return { success: true }

      case "product":
        console.log("📤 Enviando producto al servidor:", item.data)
        return { success: true }

      default:
        throw new Error(`Unknown queue item type: ${item.type}`)
    }
  }

  private removeFromQueue(id: string) {
    this.queue = this.queue.filter((item) => item.id !== id)
  }

  getQueueLength() {
    this.loadQueue()
    return this.queue.length
  }

  clearQueue() {
    this.queue = []
    this.saveQueue()
  }
}

// Singleton instance
const offlineQueue = new OfflineQueue()

// Auto-process queue when online
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    offlineQueue.processQueue()
  })
}

export const syncOfflineQueue = () => offlineQueue.processQueue()
export const addToOfflineQueue = (type: QueueItem["type"], data: any) => offlineQueue.addToQueue(type, data)
export const getOfflineQueueLength = () => offlineQueue.getQueueLength()
export const clearOfflineQueue = () => offlineQueue.clearQueue()
