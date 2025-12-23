"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ModernDatePicker } from "@/components/ui/modern-date-picker"
import { Label } from "@/components/ui/label"
import { usePreventa } from "@/contexts/preventa-context"
import { useAuth } from "@/contexts/AuthContext"
import { TrendingUp, Users, DollarSign, ShoppingCart, Shield } from "lucide-react"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"

export default function StatsPage() {
  const { orders, customers, products } = usePreventa()
  const { hasPermission } = useAuth()
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const canRead = hasPermission("stats", "read")

  const filteredOrders = useMemo(() => {
    let filtered = [...orders]

    if (dateFrom) {
      filtered = filtered.filter((order) => {
        const dateVal = order.createdAt ?? order.fecha
        const dt = dateVal ? new Date(dateVal) : null
        return dt ? dt >= new Date(dateFrom) : false
      })
    }
    if (dateTo) {
      filtered = filtered.filter((order) => {
        const dateVal = order.createdAt ?? order.fecha
        const dt = dateVal ? new Date(dateVal) : null
        return dt ? dt <= new Date(dateTo) : false
      })
    }

    return filtered
  }, [orders, dateFrom, dateTo])

  const stats = useMemo(() => {
    const totalSales = filteredOrders.reduce((sum, order) => sum + order.total, 0)
    const totalOrders = filteredOrders.length
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0
    const totalCustomers = new Set(filteredOrders.map((order) => order.codigoCliente)).size

    return {
      totalSales,
      totalOrders,
      averageOrderValue,
      totalCustomers,
    }
  }, [filteredOrders])

  const customerStats = useMemo(() => {
    const customerData = new Map()

    filteredOrders.forEach((order) => {
      const customerId = order.codigoCliente
      const customer = customers.find((c) => c.codigoCliente === customerId)

      if (!customerData.has(customerId)) {
        customerData.set(customerId, {
          customer,
          totalSales: 0,
          orderCount: 0,
          totalItems: 0,
        })
      }

      const data = customerData.get(customerId)
      data.totalSales += order.total
      data.orderCount += 1
      data.totalItems += order.items.reduce((sum, item) => sum + (item.cantidad ?? 0), 0)
    })

    return Array.from(customerData.values())
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, 10)
  }, [filteredOrders, customers])

  const productStats = useMemo(() => {
    const productData = new Map()

    filteredOrders.forEach((order) => {
      order.items.forEach((item) => {
        const product = products.find((p) => p.codigoProducto === item.productoId)

        if (!productData.has(item.productoId)) {
          productData.set(item.productoId, {
            product,
            totalSales: 0,
            quantitySold: 0,
            orderCount: 0,
          })
        }

        const data = productData.get(item.productoId)
        data.totalSales += item.total ?? item.subtotal ?? 0
        data.quantitySold += item.cantidad ?? 0
        data.orderCount += 1
      })
    })

    return Array.from(productData.values())
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, 10)
  }, [filteredOrders, products])

  const categoryStats = useMemo(() => {
    const categoryData = new Map()

    filteredOrders.forEach((order) => {
      order.items.forEach((item) => {
        const product = products.find((p) => p.codigoProducto === item.productoId)
        const category = (product as any)?.categoria || "Sin categoría"

        if (!categoryData.has(category)) {
          categoryData.set(category, {
            category,
            totalSales: 0,
            quantitySold: 0,
            productCount: new Set(),
          })
        }

        const data = categoryData.get(category)
        data.totalSales += item.total ?? item.subtotal ?? 0
        data.quantitySold += item.cantidad ?? 0
        data.productCount.add(item.productoId)
      })
    })

    return Array.from(categoryData.values())
      .map((data) => ({
        ...data,
        productCount: data.productCount.size,
      }))
      .sort((a, b) => b.totalSales - a.totalSales)
  }, [filteredOrders, products])

  const monthlySales = useMemo(() => {
    const monthlyData = new Map()

    filteredOrders.forEach((order) => {
      const date = new Date(order.createdAt ?? order.fecha)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`

      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, {
          month: monthKey,
          sales: 0,
          orders: 0,
        })
      }

      const data = monthlyData.get(monthKey)
      data.sales += order.total
      data.orders += 1
    })

    return Array.from(monthlyData.values()).sort((a, b) => a.month.localeCompare(b.month))
  }, [filteredOrders])

  const chartData = useMemo(() => {
    const monthlyChartData = monthlySales.map((month) => ({
      month: new Date(month.month + "-01").toLocaleDateString("es-GT", { month: "short", year: "2-digit" }),
      ventas: month.sales,
      pedidos: month.orders,
    }))

    const categoryChartData = categoryStats.map((category, index) => ({
      name: category.category,
      value: category.totalSales,
      fill: `hsl(${(index * 137.5) % 360}, 70%, 50%)`,
    }))

    const productChartData = productStats.slice(0, 5).map((product) => ({
      name: product.product?.name?.substring(0, 15) + "..." || "Producto",
      ventas: product.totalSales,
      cantidad: product.quantitySold,
    }))

    return {
      monthly: monthlyChartData,
      categories: categoryChartData,
      products: productChartData,
    }
  }, [monthlySales, categoryStats, productStats])

  if (!canRead) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Shield className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Acceso Denegado</h3>
              <p className="text-muted-foreground">No tienes permisos para ver las estadísticas.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto p-2 pt-3 sm:px-2 lg:px-4">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Estadísticas de Ventas</h1>
            <p className="mt-2 text-gray-600">Analiza el rendimiento de tus ventas y productos</p>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Filtros de Fecha</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dateFrom">Desde</Label>
                  <ModernDatePicker value={dateFrom} onChange={setDateFrom} placeholder="Seleccionar fecha inicial" />
                </div>
                <div>
                  <Label htmlFor="dateTo">Hasta</Label>
                  <ModernDatePicker value={dateTo} onChange={setDateTo} placeholder="Seleccionar fecha final" />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ventas Totales</CardTitle>
                <DollarSign className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">Q{stats.totalSales.toLocaleString()}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pedidos Confirmados</CardTitle>
                <ShoppingCart className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.totalOrders}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Valor Promedio</CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">Q{stats.averageOrderValue.toLocaleString()}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Clientes Activos</CardTitle>
                <Users className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{stats.totalCustomers}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Evolución de Ventas</CardTitle>
                <CardDescription>Tendencia de ventas por mes</CardDescription>
              </CardHeader>
              <CardContent>
                {chartData.monthly.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">No hay datos para mostrar</div>
                ) : (
                  <ChartContainer
                    config={{
                      ventas: {
                        label: "Ventas",
                        color: "hsl(var(--chart-1))",
                      },
                    }}
                    className="h-[300px]"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData.monthly}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <ChartTooltip
                          content={<ChartTooltipContent />}
                          formatter={(value: number | string) => [`Q${Number(value).toLocaleString()}`, "Ventas"]}
                        />
                        <Line
                          type="monotone"
                          dataKey="ventas"
                          stroke="hsl(142, 76%, 36%)"
                          strokeWidth={3}
                          dot={{ fill: "hsl(142, 76%, 36%)", strokeWidth: 2, r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Distribución por Categoría</CardTitle>
                <CardDescription>Participación de cada línea de producto</CardDescription>
              </CardHeader>
              <CardContent>
                {chartData.categories.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">No hay datos para mostrar</div>
                ) : (
                  <ChartContainer config={{}} className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData.categories}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          label={(props: any) => `${props.name} ${(Number(props.percent) * 100).toFixed(0)}%`}
                        >
                          {chartData.categories.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <ChartTooltip formatter={(value: number | string) => [`Q${Number(value).toLocaleString()}`, "Ventas"]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Top 5 Productos</CardTitle>
              <CardDescription>Productos con mayores ventas</CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.products.length === 0 ? (
                <div className="text-center text-gray-500 py-8">No hay datos para mostrar</div>
              ) : (
                <ChartContainer
                  config={{
                    ventas: {
                      label: "Ventas",
                      color: "hsl(var(--chart-2))",
                    },
                  }}
                  className="h-[300px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.products} layout="horizontal">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={120} />
                      <ChartTooltip
                        content={<ChartTooltipContent />}
                        formatter={(value: number | string) => [`Q${Number(value).toLocaleString()}`, "Ventas"]}
                      />
                      <Bar dataKey="ventas" fill="hsl(217, 91%, 60%)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Ventas por Mes</CardTitle>
                <CardDescription>Evolución de las ventas mensuales</CardDescription>
              </CardHeader>
              <CardContent>
                {monthlySales.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">No hay datos para mostrar</div>
                ) : (
                  <div className="space-y-3">
                    {monthlySales.map((month) => (
                      <div key={month.month} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium">{month.month}</div>
                          <div className="text-sm text-gray-600">{month.orders} pedidos</div>
                        </div>
                        <div className="text-lg font-bold text-green-600">Q{month.sales.toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ventas por Categoría</CardTitle>
                <CardDescription>Rendimiento por línea de producto</CardDescription>
              </CardHeader>
              <CardContent>
                {categoryStats.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">No hay datos para mostrar</div>
                ) : (
                  <div className="space-y-3">
                    {categoryStats.map((category, index) => (
                      <div
                        key={category.category}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">#{index + 1}</Badge>
                          <div>
                            <div className="font-medium">{category.category}</div>
                            <div className="text-sm text-gray-600">
                              {category.quantitySold} unidades • {category.productCount} productos
                            </div>
                          </div>
                        </div>
                        <div className="text-lg font-bold text-green-600">Q{category.totalSales.toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Mejores Clientes</CardTitle>
              <CardDescription>Top 10 clientes por volumen de ventas</CardDescription>
            </CardHeader>
            <CardContent>
              {customerStats.length === 0 ? (
                <div className="text-center text-gray-500 py-8">No hay datos para mostrar</div>
              ) : (
                <div className="space-y-3">
                  {customerStats.map((customerData, index) => (
                    <div
                      key={customerData.customer?.id || index}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <Badge variant="outline">#{index + 1}</Badge>
                        <div>
                          <div className="font-medium">{customerData.customer?.name || "Cliente desconocido"}</div>
                          <div className="text-sm text-gray-600">
                            {customerData.orderCount} pedidos • {customerData.totalItems} productos
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">
                          Q{customerData.totalSales.toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-600">
                          Q{(customerData.totalSales / customerData.orderCount).toLocaleString()} promedio
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Productos Más Vendidos</CardTitle>
              <CardDescription>Top 10 productos por volumen de ventas</CardDescription>
            </CardHeader>
            <CardContent>
              {productStats.length === 0 ? (
                <div className="text-center text-gray-500 py-8">No hay datos para mostrar</div>
              ) : (
                <div className="space-y-3">
                  {productStats.map((productData, index) => (
                    <div
                      key={productData.product?.id || index}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <Badge variant="outline">#{index + 1}</Badge>
                        <div>
                          <div className="font-medium">{productData.product?.name || "Producto desconocido"}</div>
                          <div className="text-sm text-gray-600">
                            {productData.quantitySold} unidades vendidas • {productData.orderCount} pedidos
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">
                          Q{productData.totalSales.toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-600">
                          Q{(productData.totalSales / productData.quantitySold).toLocaleString()} por unidad
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
