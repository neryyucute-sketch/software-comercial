"use client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { X, TrendingUp, ShoppingCart, Calendar, DollarSign } from "lucide-react"
import { usePreventa } from "@/contexts/preventa-context"

type CustomerLite = {
  id?: string
  idt?: string
  code?: string
  codigoCliente?: string
  name?: string
  nombreCliente?: string
}

interface CustomerStatsProps {
  customer: CustomerLite
  onClose: () => void
}

export default function CustomerStatsModal({ customer, onClose }: CustomerStatsProps) {
  const { orders, products } = usePreventa()

  const customerId = customer.codigoCliente || customer.code || customer.id || customer.idt || ""
  const customerName = customer.name || customer.nombreCliente || "Cliente"

  const normalizeDate = (value: unknown, fallback?: unknown): Date => {
    if (value instanceof Date) return value
    if (typeof value === "string" || typeof value === "number") return new Date(value)
    if (fallback instanceof Date) return fallback
    if (typeof fallback === "string" || typeof fallback === "number") return new Date(fallback)
    return new Date()
  }

  // Calcular estadísticas del cliente
  const customerOrders = orders.filter((order) => order.codigoCliente === customerId)
  const totalOrders = customerOrders.length
  const totalAmount = customerOrders.reduce((sum, order) => sum + order.total, 0)
  const averageOrderValue = totalOrders > 0 ? totalAmount / totalOrders : 0
  const lastOrderDate =
    customerOrders.length > 0
      ? new Date(
          Math.max(
            ...customerOrders.map((order) => normalizeDate((order as any).createdAt, (order as any).fecha).getTime()),
          ),
        )
      : undefined

  // Productos más comprados
  const productStats = new Map<string, { quantity: number; amount: number }>()
  customerOrders.forEach((order) => {
    order.items.forEach((item) => {
      const productId = (item as any).productoId || (item as any).productId || item.id || ""
      const current = productStats.get(productId) || { quantity: 0, amount: 0 }
      const lineAmount = (item as any).total ?? (item as any).subtotal ?? 0
      const qty = (item as any).cantidad ?? (item as any).quantity ?? 0
      productStats.set(productId, {
        quantity: current.quantity + qty,
        amount: current.amount + lineAmount,
      })
    })
  })

  const topProducts = Array.from(productStats.entries())
    .map(([productId, stats]) => {
      const product = products.find((p) => p.idt === productId || (p as any).id === productId)
      return {
        productId,
        productName: (product as any)?.descripcion || (product as any)?.name || "Producto no encontrado",
        quantity: stats.quantity,
        totalAmount: stats.amount,
      }
    })
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 5)

  // Compras por mes (últimos 6 meses)
  const monthlyPurchases = []
  for (let i = 5; i >= 0; i--) {
    const date = new Date()
    date.setMonth(date.getMonth() - i)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`

    const monthOrders = customerOrders.filter((order) => {
      const orderDate = normalizeDate((order as any).createdAt, (order as any).fecha)
      return orderDate.getFullYear() === date.getFullYear() && orderDate.getMonth() === date.getMonth()
    })

    monthlyPurchases.push({
      month: date.toLocaleDateString("es-ES", { month: "short", year: "numeric" }),
      orders: monthOrders.length,
      amount: monthOrders.reduce((sum, order) => sum + order.total, 0),
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Estadísticas de {customerName}</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Métricas principales */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Pedidos</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalOrders}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Compras</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Q{totalAmount.toLocaleString()}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Promedio por Pedido</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Q{averageOrderValue.toLocaleString()}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Último Pedido</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-sm font-bold">{lastOrderDate ? lastOrderDate.toLocaleDateString() : "N/A"}</div>
              </CardContent>
            </Card>
          </div>

          {/* Productos más comprados */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Productos Más Comprados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topProducts.map((product, index) => (
                  <div key={product.productId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Badge variant="secondary">{index + 1}</Badge>
                      <div>
                        <p className="font-medium">{product.productName}</p>
                        <p className="text-sm text-gray-500">{product.quantity} unidades</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">Q{product.totalAmount.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Compras mensuales */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Compras por Mes (Últimos 6 meses)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {monthlyPurchases.map((month, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{month.month}</p>
                      <p className="text-sm text-gray-500">{month.orders} pedidos</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">Q{month.amount.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Últimos pedidos */}
          <Card>
            <CardHeader>
              <CardTitle>Últimos Pedidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {customerOrders.slice(0, 5).map((order) => {
                  const orderDate = normalizeDate((order as any).createdAt, (order as any).fecha)
                  const orderStatus = (order as any).status ?? (order as any).estado ?? "N/A"
                  return (
                    <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">Pedido #{order.id}</p>
                        <p className="text-sm text-gray-500">{orderDate.toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">Q{order.total.toLocaleString()}</p>
                        <Badge variant={orderStatus === "entregado" ? "default" : "secondary"}>{orderStatus}</Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
