"use client"

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
      id: Date.now().toString(),
      type,
      data,
      timestamp: new Date(),
      retries: 0,
    }

    this.queue.push(item)
    this.saveQueue()

    // Try to process immediately if online
    if (navigator.onLine) {
      this.processQueue()
    }
  }

  private saveQueue() {
    localStorage.setItem("syncQueue", JSON.stringify(this.queue))
  }

  private loadQueue() {
    const saved = localStorage.getItem("syncQueue")
    if (saved) {
      this.queue = JSON.parse(saved)
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
