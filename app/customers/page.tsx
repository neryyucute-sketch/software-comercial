"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, RefreshCw, ChevronLeft, ChevronRight, Shield, BarChart3 } from "lucide-react";
import { useClientes } from "@/contexts/ClientesContext";
import { useAuth } from "@/contexts/AuthContext";
import type { Cliente } from "@/lib/types";
import ClienteStatsModal from "@/components/cliente-stats-modal";
import ClienteDetalleModal from "@/components/cliente-detalle-modal";

const asId = (v: any) => String(v ?? "").trim();

export default function ClientesPage() {
  const { clientes, syncing, error, loadClientesFromDB, syncClientes } = useClientes();
  const { hasPermission } = useAuth();

  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [routes, setRoutes] = useState<{ id: string; nombre: string; count: number }[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredClientes, setFilteredClientes] = useState<Cliente[]>([]);

  const canRead = hasPermission("customers", "read");
  const canCreate = hasPermission("customers", "create");
  const canUpdate = hasPermission("customers", "update");

  useEffect(() => {
    loadClientesFromDB();
  }, []);

  // 🚀 Agrupar rutas (tomando ciudad de la primera dirección)
  useEffect(() => {
    const rutas = clientes.reduce((acc, c) => {
      const id = asId(c?.rutaVenta || "0");
      const nombre = `Ruta ${id}`;
      if (!acc[id]) acc[id] = { id, nombre, count: 0 };
      acc[id].count++;
      return acc;
    }, {} as Record<string, { id: string; nombre: string; count: number }>);
    setRoutes(Object.values(rutas));
  }, [clientes]);

  // 🚀 Filtrar clientes
  useEffect(() => {
    let base = clientes;
    if (searchTerm) {
      base = base.filter(
        (c) =>
          (c.nombreCliente ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          (c.codigoCliente ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          (c.correo ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          (c.telefono ?? "").includes(searchTerm)
      );
    }
    if (selectedRoute) {
      base = base.filter((c) => asId(c?.rutaVenta || "Sin ruta") === asId(selectedRoute));
    }
    setFilteredClientes(base);
  }, [clientes, searchTerm, selectedRoute]);

  if (!canRead) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Shield className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Acceso Denegado</h3>
              <p className="text-muted-foreground">No tienes permisos para ver los clientes.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [selectedClienteDetalle, setSelectedClienteDetalle] = useState<Cliente | null>(null);
  const [selectedClienteStats, setSelectedClienteStats] = useState<Cliente | null>(null);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Clientes</h1>
          <p className="text-gray-600 mt-1">{filteredClientes.length} clientes</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={syncClientes} disabled={syncing} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            {syncing ? "Sincronizando..." : "Sincronizar"}
          </Button>
          {canCreate && (
            <Button>Nuevo Cliente</Button> // 🔹 podrías abrir un modal aquí
          )}
        </div>
      </div>

      {error && <div className="text-sm text-red-700">{error}</div>}

      {/* Carrusel de Rutas */}
      <PickerCarousel
        title="Ruta"
        items={routes.map((r) => ({ id: r.id, label: r.nombre, count: r.count }))}
        selected={selectedRoute}
        onSelect={(val) => setSelectedRoute(asId(val) === asId(selectedRoute) ? null : asId(val))}
      />

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          placeholder="Buscar por nombre, código, correo o teléfono…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Lista de clientes */}
      {filteredClientes.length === 0 ? (
        <div className="text-center text-gray-600 py-10 border rounded-md">
          No se encontraron clientes
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClientes.map((c) => (

            <Card key={c.idt} className="hover:shadow-md">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{c.nombreCliente}</CardTitle>
                    <CardDescription>{c.codigoCliente}</CardDescription>
                  </div>
                  <div className="flex gap-1">
                    {/* Botón Estadísticas */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedClienteStats(c)}
                      title="Ver estadísticas del cliente"
                    >
                      <BarChart3 className="w-4 h-4" />
                    </Button>

                    {/* Botón Detalle */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedClienteDetalle(c)}
                      title="Ver detalle del cliente"
                    >
                      <Search className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><span className="font-medium">Tel:</span> {c.telefono || "—"}</p>
                <p><span className="font-medium">Correo:</span> {c.correo || "—"}</p>
                <p><span className="font-medium">Ruta:</span> {c?.rutaVenta || "Sin ruta"}</p>
                <p><span className="font-medium">Última sync:</span> {new Date(c.updatedAt).toLocaleDateString()}</p>
              </CardContent>
            </Card>

          ))}
        </div>
      )}


        {/* Modal Detalle */}
        {selectedClienteDetalle && (
          <ClienteDetalleModal
            cliente={selectedClienteDetalle}
            onClose={() => setSelectedClienteDetalle(null)}
          />
        )}

        {/* Modal Estadísticas */}
        {selectedClienteStats && (
          <ClienteStatsModal
            cliente={selectedClienteStats}
            onClose={() => setSelectedClienteStats(null)}
          />
        )}


    </div>
    
  );
}


/* ---------- PickerCarousel ---------- */
function PickerCarousel({
  title,
  items,
  selected,
  onSelect,
}: {
  title: string;
  items: { id: string; label: string; count?: number }[];
  selected: string | null;
  onSelect: (val: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const scrollBy = (dir: "left" | "right") => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.max(280, el.clientWidth * 0.9);
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <Badge className="px-2 py-1">{title}</Badge>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => scrollBy("left")}><ChevronLeft className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => scrollBy("right")}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      </div>
      <div ref={scrollerRef} className="flex gap-3 overflow-x-auto pb-2 pr-1 scrollbar-hide">
        {items.map(({ id, label, count }) => {
          const isActive = selected === id;
          return (
            <div
              key={id}
              onClick={() => onSelect(id)}
              className={`min-w-[140px] cursor-pointer rounded-xl p-3 border ${
                isActive ? "bg-blue-600 text-white" : "bg-white"
              }`}
            >
              <div className="text-sm font-semibold">{label}</div>
              {typeof count === "number" && <div className="text-xs mt-1">{count} clientes</div>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
