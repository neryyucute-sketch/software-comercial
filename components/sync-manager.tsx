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
import { useAuth } from "@/contexts/AuthContext"
import { /*syncOfertasPreventa,*/ } from "@/services/ofertas"
import { materializeOffer } from "@/services/offers.materializer"
import { getTokens } from "@/services/auth"
import { mapBackendToOfferDef } from "@/services/offers.repo"

interface SyncStatus {
  isOnline: boolean
  lastSync: Date | null
  pendingOrders: number
  syncing: boolean
  progress: number
}

export function SyncManager() {
  const { user } = useAuth()
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    lastSync: null,
    pendingOrders: 0,
    syncing: false,
    progress: 0,
  })

  const { getOfflineOrders, clearOfflineOrders } = useOfflineStorage()

  useEffect(() => {
    const handleOnline = () => setSyncStatus((prev) => ({ ...prev, isOnline: true }))
    const handleOffline = () => setSyncStatus((prev) => ({ ...prev, isOnline: false }))

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    const checkPendingOrders = async () => {
      const orders = await getOfflineOrders()
      setSyncStatus((prev) => ({ ...prev, pendingOrders: orders.length }))
    }

    checkPendingOrders()

    if (navigator.onLine) {
      autoSync()
    }

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const autoSync = async () => {
    if (syncStatus.syncing) return

    const tokens = await getTokens();
    if (!tokens) {
      console.warn("[sync-manager] sync skipped: no active session");
      setSyncStatus((prev) => ({ ...prev, syncing: false }));
      return;
    }

    setSyncStatus((prev) => ({ ...prev, syncing: true, progress: 0 }))

    try {
      // DEV: opcionalmente limpiar caches que empiecen con 'preventa' para evitar respuestas stale
      try {
        if ((process.env.NEXT_PUBLIC_FORCE_CACHE_CLEAR === "1") && typeof caches !== "undefined") {
          const keys = await caches.keys();
          await Promise.all(keys.filter(k => k.includes("preventa")).map(k => caches.delete(k)));
          console.debug("[sync-manager] cleared caches before sync (DEV_FORCE)");
        }
      } catch (e) {
        console.debug("[sync-manager] cache clear skipped/error:", e);
      }
      // Datos de empresa/vendedor
      const vendedorConf = user?.usuarioConfiguracion.find(
        (item: any) => item.configuracion === "CODIGO_VENDEDOR"
      )
      const codigoEmpresa = vendedorConf?.codigoEmpresa ?? ""
      const codigoVendedor = vendedorConf?.valor ?? ""
      const params: Record<string, string> = { codigoEmpresa, codigoVendedor }

      // 1) Productos
      const rawProductos = await syncData("catalogo-productos/porVendedor", "Productos", 20, params)
      const productos = (rawProductos ?? []) as Product[]
      await saveData("products", productos)
      setSyncStatus((prev) => ({ ...prev, progress: 20 }))

      // 2) Clientes
      const rawClientes = await syncData("catalogo-clientes/porEmpresaVendedorRuta", "Clientes", 40, params)
      const clientes = (rawClientes ?? []) as Cliente[]
      await saveData("clientes", clientes)
      setSyncStatus((prev) => ({ ...prev, progress: 40 }))

      // 3) Ofertas preventa (se consultan en línea y se guardan local para uso offline)
      const rawOfertas = await syncData("oferta-preventa", "Ofertas Preventa", 20, params)
      const ofertas = (rawOfertas ?? []).map((item: any) => {
        const parseDetalle = (src: any) => {
          try {
            if (!src) return null;
            if (typeof src === "string") return JSON.parse(src);
            return src;
          } catch (e) {
            console.warn("[sync-manager] ofertaDetalle parse failed", e, src);
            return null;
          }
        };

        const detalle = parseDetalle(item.ofertaDetalle) || parseDetalle(item.detalle) || null;
        const normalized = mapBackendToOfferDef({ ...item, ofertaDetalle: detalle ?? item.ofertaDetalle });
        return {
          ...normalized,
          dirty: false,
          // Guardar el payload crudo para inspección/debug (ya con detalle parseado si existía)
          raw: { ...item, ofertaDetalle: detalle ?? item.ofertaDetalle },
        } as any;
      })

      await saveData("offer_defs", ofertas)
      console.debug('[sync-manager] saved ofertas:', ofertas.length, ofertas[0]?.raw ? ofertas[0].raw : ofertas[0]);
      // Notificar a la UI que las ofertas fueron sincronizadas (para recargar sin recargar la página)
      try {
        window.dispatchEvent(new CustomEvent("offers:synced", { detail: { count: ofertas.length } }));
      } catch (e) {
        console.debug("[sync-manager] cannot dispatch offers:synced event:", e);
      }
      // Materializar para crear offer_targets y pack_items
      for (const ofe of ofertas) {
        try {
          await materializeOffer(ofe.id)
        } catch (e) {
          console.warn("[sync-manager] materializeOffer failed for", ofe.id, e)
        }
      }

      // Notificar UI
      try {
        window.dispatchEvent(new CustomEvent("offers:synced", { detail: { count: ofertas.length } }));
      } catch (e) {
        console.debug("[sync-manager] cannot dispatch offers:synced event:", e);
      }

      setSyncStatus((prev) => ({ ...prev, progress: 60 }))

      // 4) Subir pedidos pendientes
      if (syncStatus.pendingOrders > 0) {
        await syncOfflineQueue()
        await clearOfflineOrders()
      }
      setSyncStatus((prev) => ({ ...prev, progress: 80 }))

      // 5) (Opcional) Estadísticas u otros recursos
      // await syncData("stats", "Estadísticas", 100, params)

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
        {/* Progreso */}
        {syncStatus.syncing && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-sm">Sincronizando...</span>
            </div>
            <Progress value={syncStatus.progress} className="w-full" />
          </div>
        )}

        {/* Pedidos pendientes */}
        {syncStatus.pendingOrders > 0 && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg">
            <Clock className="w-4 h-4 text-yellow-600" />
            <span className="text-sm text-yellow-800">
              {syncStatus.pendingOrders} pedidos pendientes de envío
            </span>
          </div>
        )}

        {/* Última sync */}
        {syncStatus.lastSync && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span>Última sincronización: {syncStatus.lastSync.toLocaleTimeString()}</span>
          </div>
        )}

        {/* Botón de sync */}
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

        {/* Aviso offline */}
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