"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, TrendingUp, ShoppingCart, Calendar, DollarSign } from "lucide-react";
import type { Cliente } from "@/lib/types";

// 🔹 Props adaptados
interface ClienteStatsProps {
  cliente: Cliente;
  onClose: () => void;
}

export default function ClienteStatsModal({ cliente, onClose }: ClienteStatsProps) {
  // ⚠️ Por ahora no tenemos pedidos integrados a Cliente,
  // así que dejo data dummy que luego puedes conectar con tu backend.
  const totalOrders = 12;
  const totalAmount = 45000;
  const averageOrderValue = totalAmount / totalOrders;
  const lastOrderDate = new Date();

  const topProducts = [
    { id: "1", name: "Producto A", quantity: 10, totalAmount: 5000 },
    { id: "2", name: "Producto B", quantity: 8, totalAmount: 3200 },
  ];

  const monthlyPurchases = [
    { month: "Ene 2025", orders: 2, amount: 5000 },
    { month: "Feb 2025", orders: 3, amount: 9000 },
    { month: "Mar 2025", orders: 1, amount: 3000 },
    { month: "Abr 2025", orders: 4, amount: 12000 },
    { month: "May 2025", orders: 2, amount: 16000 },
    { month: "Jun 2025", orders: 0, amount: 0 },
  ];

  const lastOrders = [
    { id: "P-001", fecha: "01/05/2025", total: 1200, status: "entregado" },
    { id: "P-002", fecha: "10/05/2025", total: 3500, status: "pendiente" },
  ];

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
