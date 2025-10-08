"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { usePreventa } from "@/contexts/preventa-context"
import { ShoppingCart, Package, Users, TrendingUp } from "lucide-react"

export default function HomePage() {
  const { products, customers, orders } = usePreventa()

  // Evita hydration mismatch: no renderices números reales hasta que el componente monte en el cliente
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const safe = (n: number) => (mounted ? n : 0)

  // “Ventas hoy”: pedidos entregados con fecha de hoy
  const ventasHoy = useMemo(() => {
    if (!mounted) return 0
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const d = now.getDate()
    const start = new Date(y, m, d, 0, 0, 0, 0)
    const end = new Date(y, m, d, 23, 59, 59, 999)
    return orders.filter(
      (o) =>
        o.status === "entregado" &&
        new Date(o.createdAt).getTime() >= start.getTime() &&
        new Date(o.createdAt).getTime() <= end.getTime()
    ).length
  }, [mounted, orders])

  const stats = useMemo(
    () => [
      { title: "Productos", value: safe(products.length), icon: Package, href: "/products", color: "text-blue-600" },
      { title: "Clientes", value: safe(customers.length), icon: Users, href: "/customers", color: "text-green-600" },
      { title: "Pedidos", value: safe(orders.length), icon: ShoppingCart, href: "/orders", color: "text-purple-600" },
      { title: "Ventas Hoy", value: ventasHoy, icon: TrendingUp, href: "/stats", color: "text-orange-600" },
    ],
    [products.length, customers.length, orders.length, ventasHoy, mounted]
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

          {/* Stats Grid */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            {stats.map((stat) => {
              const Icon = stat.icon
              return (
                <Card key={stat.title} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">{stat.title}</CardTitle>
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <Link href={stat.href}>
                      <Button variant="link" className="p-0 h-auto text-sm">
                        Ver detalles →
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Nuevo Pedido</CardTitle>
                <CardDescription>Crear un nuevo pedido de preventa</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/orders">
                  <Button className="w-full">
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Crear Pedido
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Gestionar Productos</CardTitle>
                <CardDescription>Agregar o editar productos del catálogo</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/products">
                  <Button variant="outline" className="w-full bg-transparent">
                    <Package className="w-4 h-4 mr-2" />
                    Ver Catálogo
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ver Estadísticas</CardTitle>
                <CardDescription>Analizar ventas y rendimiento</CardDescription>
              </CardHeader>
              <CardContent>
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
