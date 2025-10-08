"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Wifi, WifiOff, RefreshCw, CheckCircle, AlertCircle, Clock } from "lucide-react"
import { useOfflineStorage } from "@/hooks/use-offline-storage"
import { syncOfflineQueue } from "@/lib/offline-queue"
import { syncData } from "@/services/sync"
import { saveData } from "@/lib/db"
import { Product, Cliente } from "@/lib/types"
import { useAuth } from "@/contexts/AuthContext"  // 👈 importa el context

interface SyncStatus {
  isOnline: boolean
  lastSync: Date | null
  pendingOrders: number
  syncing: boolean
  progress: number
}

export function SyncManager() {
  const { user } = useAuth(); // 👈 obtenemos el usuario actual del contexto
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    lastSync: null,
    pendingOrders: 0,
    syncing: false,
    progress: 0,
  })

  const { getOfflineOrders, clearOfflineOrders } = useOfflineStorage()

  useEffect(() => {
    // Monitor online status
    const handleOnline = () => setSyncStatus((prev) => ({ ...prev, isOnline: true }))
    const handleOffline = () => setSyncStatus((prev) => ({ ...prev, isOnline: false }))

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    // Check pending orders
    const checkPendingOrders = async () => {
      const orders = await getOfflineOrders()
      setSyncStatus((prev) => ({ ...prev, pendingOrders: orders.length }))
    }

    checkPendingOrders()

    // Auto-sync when online
    if (navigator.onLine) {
      autoSync()
    }

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  const autoSync = async () => {
    if (syncStatus.syncing) return

    setSyncStatus((prev) => ({ ...prev, syncing: true, progress: 0 }))

    try {
      // 1. Sync products
      const vendedorConf = user?.usuarioConfiguracion.find(
        (item: any) => item.configuracion === "CODIGO_VENDEDOR"
      );
      const codigoEmpresa = vendedorConf?.codigoEmpresa??"";
      const codigoVendedor = vendedorConf?.valor??"";
      const params: Record<string, string> = {  codigoEmpresa:codigoEmpresa, codigoVendedor: codigoVendedor };
      let resultsProductos: Product[] = []
      const rawProductos = await syncData("catalogo-productos/porVendedor", "products", 20, params);
      resultsProductos = (rawProductos ?? []) as Product[]
      await saveData("products", resultsProductos);
      // 2. Sync customers
      const rawClientes = await syncData("catalogo-clientes/porEmpresaVendedorRuta", "products", 20, params);
      let resultsClientes = (rawClientes ?? []) as Cliente[]
      await saveData("clientes", resultsClientes);

      // 3. Sync offers
      await syncData("customers", "customers", 60)

      // 4. Upload pending orders
      if (syncStatus.pendingOrders > 0) {
        await syncOfflineQueue()
        await clearOfflineOrders()
      }
      await syncData("orders", "orders", 80)

      // 5. Sync stats
      await syncData("stats", "stats", 100)

      setSyncStatus((prev) => ({
        ...prev,
        syncing: false,
        progress: 100,
        lastSync: new Date(),
        pendingOrders: 0,
      }))

      setTimeout(() => {
        setSyncStatus((prev) => ({ ...prev, progress: 0 }))
      }, 2000)
    } catch (error) {
      console.error("Error en sincronización:", error)
      setSyncStatus((prev) => ({ ...prev, syncing: false, progress: 0 }))
    }
  }

  const manualSync = () => {
    if (!syncStatus.isOnline) {
      alert("No hay conexión a internet")
      return
    }
    autoSync()
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Sincronización</CardTitle>
          <div className="flex items-center gap-2">
            {syncStatus.isOnline ? (
              <Wifi className="w-4 h-4 text-green-600" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-600" />
            )}
            <Badge variant={syncStatus.isOnline ? "default" : "destructive"}>
              {syncStatus.isOnline ? "Online" : "Offline"}
            </Badge>
          </div>
        </div>
        <CardDescription>Estado de sincronización con el servidor</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Sync Progress */}
        {syncStatus.syncing && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-sm">Sincronizando...</span>
            </div>
            <Progress value={syncStatus.progress} className="w-full" />
          </div>
        )}

        {/* Pending Orders */}
        {syncStatus.pendingOrders > 0 && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg">
            <Clock className="w-4 h-4 text-yellow-600" />
            <span className="text-sm text-yellow-800">{syncStatus.pendingOrders} pedidos pendientes de envío</span>
          </div>
        )}

        {/* Last Sync */}
        {syncStatus.lastSync && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span>Última sincronización: {syncStatus.lastSync.toLocaleTimeString()}</span>
          </div>
        )}

        {/* Sync Button */}
        <Button onClick={manualSync} disabled={syncStatus.syncing || !syncStatus.isOnline} className="w-full">
          {syncStatus.syncing ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Sincronizando...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Sincronizar Ahora
            </>
          )}
        </Button>

        {/* Offline Notice */}
        {!syncStatus.isOnline && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
            <AlertCircle className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-blue-800">
              Trabajando offline. Los pedidos se sincronizarán automáticamente cuando haya conexión.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
