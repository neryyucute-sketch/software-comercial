"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { usePreventa } from "@/contexts/preventa-context"
import { ShoppingCart, Package, Users, TrendingUp, ArrowLeftRight, DollarSign, Info } from "lucide-react"

type PeriodKey = "current" | "previous"
type BarDatum = { label: string; value: number; helper?: string }

export default function HomePage() {
  const { products, customers, orders, visits } = usePreventa()
  const [period, setPeriod] = useState<PeriodKey>("current")
  const [motivos, setMotivos] = useState<string[]>([])

  // Evita hydration mismatch: no renderices números reales hasta que el componente monte en el cliente
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const safe = (n: number) => (mounted ? n : 0)

  // Límites de fecha para mes actual y anterior
  const { currentStart, currentEnd, prevStart, prevEnd } = useMemo(() => {
    const now = new Date()
    const cs = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    const ce = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    const ps = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0)
    const pe = new Date(cs.getTime() - 1)
    return { currentStart: cs, currentEnd: ce, prevStart: ps, prevEnd: pe }
  }, [])

  const netNoIVA = (total: number) => total / 1.12

  useEffect(() => {
    const loadMotivos = async () => {
      try {
        const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10931/preventa/api/v1"
        const res = await fetch(`${base}/catalogos-generales/E01/registro_visita`)
        if (!res.ok) return
        const data = await res.json()
        if (Array.isArray(data)) {
          setMotivos(data.map((m: any) => m.descripcion || m.codigo || ""))
        }
      } catch (e) {
        // silenciar errores de catálogo opcional
      }
    }
    loadMotivos()
  }, [])

  const catalogs = useMemo(() => {
    const prov = new Map<string, string>()
    const line = new Map<string, string>()

    products.forEach((p) => {
      const provCode = p.codigoProveedor?.toString().trim()
      const provDesc = p.proveedor?.toString().trim()
      if (provCode) prov.set(provCode, provDesc || provCode)

      const lineaCode = (p.codigoLinea || p.codigoFiltroVenta || p.linea)?.toString().trim()
      const lineaDesc = (p.linea || p.filtroVenta || p.subfamilia || p.familia)?.toString().trim()
      if (lineaCode) line.set(lineaCode, lineaDesc || lineaCode)
    })

    return { prov, line }
  }, [products])

  const aggregatePeriod = useMemo(() => {
    const productIndex = new Map<string, (typeof products)[number]>()
    products.forEach((p) => productIndex.set(p.codigoProducto, p))

    const resolveProvLabel = (code?: string | null) => {
      const clean = code?.toString().trim()
      if (!clean) return "Sin proveedor"
      return catalogs.prov.get(clean) || clean
    }

    const resolveLineaLabel = (code?: string | null) => {
      const clean = code?.toString().trim()
      if (!clean) return "Sin línea"
      return catalogs.line.get(clean) || clean
    }

    const build = (start: Date, end: Date) => {
      const inRange = orders.filter((o) => {
        const t = new Date(o.createdAt ?? 0).getTime()
        return t >= start.getTime() && t <= end.getTime()
      })

      const totalPedidos = inRange.length
      const clientesUnicosPedido = new Set(inRange.map((o) => o.codigoCliente)).size
      const totalClientes = customers.length || 0

      const visitasEnRango = visits.filter((v) => {
        const t = new Date(v.createdAt ?? v.fecha ?? 0).getTime()
        return t >= start.getTime() && t <= end.getTime()
      })
      const totalVisitas = visitasEnRango.length
      const clientesVisitados = new Set(visitasEnRango.map((v) => v.clienteId || v.clienteCodigo)).size

      const cobertura = totalClientes > 0 ? clientesVisitados / totalClientes : 0
      const eficiencia = totalVisitas > 0 ? totalPedidos / totalVisitas : 0
      const eficacia = clientesVisitados > 0 ? clientesUnicosPedido / clientesVisitados : 0

      let totalBruto = 0
      const porProveedor = new Map<string, number>()
      const porLinea = new Map<string, number>()
      const porProducto = new Map<string, { qty: number; amount: number; name: string }>()

      inRange.forEach((o) => {
        const orderTotal = netNoIVA(Number(o.total) || 0)
        totalBruto += orderTotal
        ;(o.items || []).forEach((it) => {
          const prod = productIndex.get(it.productoId)
          const keyProv = prod?.codigoProveedor || "Sin proveedor"
          const keyLinea = prod?.codigoLinea || prod?.codigoFiltroVenta || prod?.linea || "Sin línea"
          const lineAmount = netNoIVA(it.subtotal ?? it.cantidad * it.precioUnitario)
          porProveedor.set(keyProv, (porProveedor.get(keyProv) || 0) + lineAmount)
          porLinea.set(keyLinea, (porLinea.get(keyLinea) || 0) + lineAmount)
          const agg = porProducto.get(it.productoId) || { qty: 0, amount: 0, name: it.descripcion }
          agg.qty += it.cantidad
          agg.amount += lineAmount
          porProducto.set(it.productoId, agg)
        })
      })

      const toBar = (map: Map<string, number>, labelResolver?: (code: string) => string): BarDatum[] => {
        const arr = Array.from(map.entries()).map(([code, value]) => {
          const label = labelResolver ? labelResolver(code) : code
          const helper = label !== code ? code : undefined
          return { label, value, helper }
        })
        arr.sort((a, b) => b.value - a.value)
        return arr.slice(0, 8)
      }

      const productosOrdenados = Array.from(porProducto.entries()).sort((a, b) => b[1].qty - a[1].qty)
      const top10: BarDatum[] = productosOrdenados.slice(0, 10).map(([id, info]) => ({ label: info.name || id, value: info.qty }))
      const bottom10: BarDatum[] = productosOrdenados.slice(-10).map(([id, info]) => ({ label: info.name || id, value: info.qty }))

      return {
        totalPedidos,
        clientesUnicos: clientesVisitados,
        totalClientes,
        totalVisitas,
        clientesUnicosPedido,
        cobertura,
        eficiencia,
        eficacia,
        totalNeto: totalBruto,
        ticketPromedio: totalPedidos > 0 ? totalBruto / totalPedidos : 0,
        porProveedor: toBar(porProveedor, resolveProvLabel),
        porLinea: toBar(porLinea, resolveLineaLabel),
        top10,
        bottom10,
      }
    }

    return {
      current: build(currentStart, currentEnd),
      previous: build(prevStart, prevEnd),
    }
  }, [orders, products, customers, visits, catalogs, currentStart, currentEnd, prevStart, prevEnd])

  const display = period === "current" ? aggregatePeriod.current : aggregatePeriod.previous

  const stats = useMemo(
    () => [
      { title: "Pedidos", value: safe(display.totalPedidos), icon: ShoppingCart, href: "/orders", color: "text-purple-600" },
      { title: "Clientes atendidos", value: safe(display.clientesUnicos), icon: Users, href: "/customers", color: "text-green-600" },
      { title: "Cartera clientes", value: safe(display.totalClientes), icon: Users, href: "/customers", color: "text-sky-600" },
      { title: "Total neto (sin IVA)", value: `Q${safe(display.totalNeto).toFixed(2)}`, icon: DollarSign, href: "/stats", color: "text-blue-600" },
      { title: "Ticket promedio", value: `Q${safe(display.ticketPromedio).toFixed(2)}`, icon: ArrowLeftRight, href: "/orders", color: "text-orange-600" },
      {
        title: "Cobertura",
        value: `${(safe(display.cobertura) * 100).toFixed(1)}%`,
        icon: TrendingUp,
        href: "/customers",
        color: "text-emerald-600",
        info: `Clientes visitados / Cartera (${safe(display.clientesUnicos)} / ${safe(display.totalClientes)})`,
      },
      {
        title: "Eficiencia",
        value: safe(display.eficiencia).toFixed(2),
        icon: TrendingUp,
        href: "/customers",
        color: "text-indigo-600",
        info: `Pedidos / Visitas (${safe(display.totalPedidos)} / ${safe(display.totalVisitas) || 1})`,
      },
      {
        title: "Eficacia",
        value: safe(display.eficacia).toFixed(2),
        icon: TrendingUp,
        href: "/customers",
        color: "text-rose-600",
        info: `Clientes con pedido / Clientes visitados (${safe(display.clientesUnicosPedido || display.clientesUnicos)} / ${safe(display.clientesUnicos)})`,
      },
      { title: "Motivos no compra", value: motivos.length > 0 ? motivos.length : "–", icon: Info, href: "#", color: "text-amber-600", info: "Catálogo registro_visita" },
    ],
    [display, period, mounted, motivos.length]
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="mt-2 text-gray-600">
              Bienvenido al sistema de preventa. Gestiona productos, pedidos y clientes desde aquí.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 mb-4">
            <Button
              variant={period === "current" ? "default" : "outline"}
              onClick={() => setPeriod("current")}
            >
              Mes actual
            </Button>
            <Button
              variant={period === "previous" ? "default" : "outline"}
              onClick={() => setPeriod("previous")}
            >
              Mes anterior
            </Button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            {stats.map((stat) => {
              const Icon = stat.icon
              return (
                <Card
                  key={stat.title}
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => {
                    if (stat.info) alert(stat.info)
                  }}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">{stat.title}</CardTitle>
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Grids */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-6">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>Top 10 productos más vendidos</CardTitle>
                <CardDescription>Cantidad vendida (sin IVA)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {display.top10.length === 0 && <p className="text-sm text-gray-500">Sin datos en el período.</p>}
                {display.top10.map((item) => (
                  <BarRow key={item.label} label={item.label} value={item.value} max={display.top10[0]?.value || 1} helper={item.helper} />
                ))}
              </CardContent>
            </Card>

          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-6">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>Top 10 productos menos vendidos</CardTitle>
                <CardDescription>Cantidad vendida (sin IVA)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {display.bottom10.length === 0 && <p className="text-sm text-gray-500">Sin datos en el período.</p>}
                {display.bottom10.map((item) => (
                  <BarRow key={item.label} label={item.label} value={item.value} max={display.bottom10[display.bottom10.length - 1]?.value || 1} helper={item.helper} />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top proveedores</CardTitle>
                <CardDescription>Ingresos netos (sin IVA)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {display.porProveedor.length === 0 && <p className="text-sm text-gray-500">Sin datos en el período.</p>}
                {display.porProveedor.map((item) => (
                  <BarRow
                    key={item.label}
                    label={item.label}
                    value={item.value}
                    max={display.porProveedor[0]?.value || 1}
                    helper={item.helper}
                    format={(v) => `Q${v.toFixed(2)}`}
                  />
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <Card>
              <CardHeader>
                <CardTitle>Top líneas</CardTitle>
                <CardDescription>Ingresos netos (sin IVA)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {display.porLinea.length === 0 && <p className="text-sm text-gray-500">Sin datos en el período.</p>}
                {display.porLinea.map((item) => (
                  <BarRow
                    key={item.label}
                    label={item.label}
                    value={item.value}
                    max={display.porLinea[0]?.value || 1}
                    helper={item.helper}
                    format={(v) => `Q${v.toFixed(2)}`}
                  />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Acciones rápidas</CardTitle>
                <CardDescription>Crear pedidos o navegar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href="/orders">
                  <Button className="w-full">
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Crear Pedido
                  </Button>
                </Link>
                <Link href="/products">
                  <Button variant="outline" className="w-full bg-transparent">
                    <Package className="w-4 h-4 mr-2" />
                    Ver Catálogo
                  </Button>
                </Link>
                <Link href="/stats">
                  <Button variant="outline" className="w-full bg-transparent">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Ver Reportes
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}

function BarRow({ label, value, max, format, helper }: { label: string; value: number; max: number; helper?: string; format?: (v: number) => string }) {
  const pct = max > 0 ? Math.max(2, Math.min(100, (value / max) * 100)) : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-600">
        <span className="truncate pr-2" title={helper ? `${label} (${helper})` : label}>
          {label}
          {helper && <span className="ml-1 text-[10px] text-gray-400">({helper})</span>}
        </span>
        <span>{format ? format(value) : value}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="p-3 rounded-lg border border-gray-100 bg-white shadow-sm">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold text-gray-800">{value}</div>
    </div>
  )
}
