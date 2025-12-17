"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, TrendingUp, ShoppingCart, Calendar, DollarSign } from "lucide-react";
import type { Cliente } from "@/lib/types";
import { usePreventa } from "@/contexts/preventa-context";

// 🔹 Props adaptados
interface ClienteStatsProps {
  cliente: Cliente;
  onClose: () => void;
}

type BackendSalesStats = {
  totalPedidos?: number;
  totalVentas?: number;
  promedioPorPedido?: number;
  ultimoPedido?: string;
  topProductos?: Array<{ id?: string; codigo?: string; nombre?: string; cantidad: number; monto: number }>;
  comprasMensuales?: Array<{ mes: string; pedidos: number; monto: number }>;
  ultimosPedidos?: Array<{ id: string; fecha: string; total: number; estado?: string }>;
};

const asDate = (value: any): Date | undefined => {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const formatMonthLabel = (date: Date) =>
  date.toLocaleDateString("es-ES", {
    month: "short",
    year: "numeric",
  });

export default function ClienteStatsModal({ cliente, onClose }: ClienteStatsProps) {
  const { orders, products } = usePreventa();
  const [salesStats, setSalesStats] = useState<BackendSalesStats | null>(null);

  // Carga opcional desde backend (solo si configuras NEXT_PUBLIC_STATS_API_URL)
  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_STATS_API_URL;
    if (!base || !cliente?.codigoCliente) {
      setSalesStats(null);
      return;
    }

    let active = true;
    const load = async () => {
      try {
        const res = await fetch(`${base}/clientes/${cliente.codigoCliente}/stats`);
        if (!res.ok) return;
        const data = (await res.json()) as BackendSalesStats;
        if (active) setSalesStats(data);
      } catch (error) {
        // silenciar errores, se usa fallback local
        if (active) setSalesStats(null);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [cliente?.codigoCliente]);

  const stats = useMemo(() => {
    const customerOrders = orders.filter((order) => order.codigoCliente === cliente.codigoCliente);

    const totalOrders = customerOrders.length;
    const totalAmount = customerOrders.reduce((sum, order) => sum + (order.total ?? order.subtotal ?? 0), 0);
    const averageOrderValue = totalOrders > 0 ? totalAmount / totalOrders : 0;

    const lastOrderDate = customerOrders
      .map((order) => asDate(order.createdAt ?? order.fecha))
      .filter(Boolean) as Date[];
    const latestOrder = lastOrderDate.length ? new Date(Math.max(...lastOrderDate.map((d) => d.getTime()))) : undefined;

    const productStats = new Map<string, { quantity: number; amount: number; name?: string }>();
    customerOrders.forEach((order) => {
      order.items?.forEach((item) => {
        const key = item.productoId || item.id;
        if (!key) return;
        const current = productStats.get(key) || { quantity: 0, amount: 0, name: item.descripcion };
        const amount = item.total ?? item.subtotal ?? 0;
        productStats.set(key, {
          quantity: current.quantity + item.cantidad,
          amount: current.amount + amount,
          name:
            current.name ||
            products.find((p) => p.idt === key || p.codigoProducto === key)?.descripcion ||
            item.descripcion,
        });
      });
    });

    const topProducts = Array.from(productStats.entries())
      .map(([id, value]) => ({
        id,
        name: value.name || "Producto",
        quantity: value.quantity,
        totalAmount: value.amount,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 5);

    const monthlyPurchases = [] as Array<{ month: string; orders: number; amount: number }>;
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthOrders = customerOrders.filter((order) => {
        const orderDate = asDate(order.createdAt ?? order.fecha);
        return (
          orderDate &&
          orderDate.getFullYear() === date.getFullYear() &&
          orderDate.getMonth() === date.getMonth()
        );
      });

      monthlyPurchases.push({
        month: formatMonthLabel(date),
        orders: monthOrders.length,
        amount: monthOrders.reduce((sum, order) => sum + (order.total ?? order.subtotal ?? 0), 0),
      });
    }

    const lastOrders = [...customerOrders]
      .sort((a, b) => {
        const da = asDate(a.createdAt ?? a.fecha)?.getTime() ?? 0;
        const db = asDate(b.createdAt ?? b.fecha)?.getTime() ?? 0;
        return db - da;
      })
      .slice(0, 5)
      .map((order) => ({
        id: order.numeroPedido || order.serverId || order.id,
        fecha: asDate(order.createdAt ?? order.fecha)?.toLocaleDateString() ?? "",
        total: order.total ?? order.subtotal ?? 0,
        status: order.estado || "pendiente",
      }));

    if (!salesStats) {
      return { totalOrders, totalAmount, averageOrderValue, lastOrderDate: latestOrder, topProducts, monthlyPurchases, lastOrders };
    }

    return {
      totalOrders: salesStats.totalPedidos ?? totalOrders,
      totalAmount: salesStats.totalVentas ?? totalAmount,
      averageOrderValue: salesStats.promedioPorPedido ?? averageOrderValue,
      lastOrderDate: asDate(salesStats.ultimoPedido) ?? latestOrder,
      topProducts:
        salesStats.topProductos?.map((p, idx) => ({
          id: p.id || p.codigo || String(idx),
          name: p.nombre || p.codigo || "Producto",
          quantity: p.cantidad,
          totalAmount: p.monto,
        })) ?? topProducts,
      monthlyPurchases:
        salesStats.comprasMensuales?.map((m) => ({
          month: m.mes,
          orders: m.pedidos,
          amount: m.monto,
        })) ?? monthlyPurchases,
      lastOrders:
        salesStats.ultimosPedidos?.map((o) => ({
          id: o.id,
          fecha: asDate(o.fecha)?.toLocaleDateString() ?? "",
          total: o.total,
          status: o.estado || "pendiente",
        })) ?? lastOrders,
    };
  }, [cliente.codigoCliente, orders, products, salesStats]);

  const { totalOrders, totalAmount, averageOrderValue, lastOrderDate, topProducts, monthlyPurchases, lastOrders } = stats;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">
              Estadísticas de {cliente.nombreCliente} ({cliente.codigoCliente})
            </h2>
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
                <div className="text-sm font-bold">
                  {lastOrderDate ? lastOrderDate.toLocaleDateString() : "N/A"}
                </div>
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
                {topProducts.map((p, index) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <Badge variant="secondary">{index + 1}</Badge>
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-sm text-gray-500">{p.quantity} unidades</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">Q{p.totalAmount.toLocaleString()}</p>
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
                {monthlyPurchases.map((m, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{m.month}</p>
                      <p className="text-sm text-gray-500">{m.orders} pedidos</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">Q{m.amount.toLocaleString()}</p>
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
                {lastOrders.map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">Pedido #{o.id}</p>
                      <p className="text-sm text-gray-500">{o.fecha}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">Q{o.total.toLocaleString()}</p>
                      <Badge variant={o.status === "entregado" ? "default" : "secondary"}>
                        {o.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
