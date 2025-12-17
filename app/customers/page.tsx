"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, RefreshCw, ChevronLeft, ChevronRight, Shield, BarChart3, ClipboardList, ShoppingCart } from "lucide-react";
import { useClientes } from "@/contexts/ClientesContext";
import { useAuth } from "@/contexts/AuthContext";
import type { Cliente } from "@/lib/types";
import ClienteStatsModal from "@/components/cliente-stats-modal";
import ClienteDetalleModal from "@/components/cliente-detalle-modal";
import { usePreventa } from "@/contexts/preventa-context";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";
import React from "react";

const asId = (v: any) => String(v ?? "").trim();

export default function ClientesPage() {
  const { clientes, syncing, error, loadClientesFromDB, syncClientes } = useClientes();
  const { hasPermission } = useAuth();
  const { addVisit } = usePreventa();
  const router = useRouter();

  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [routes, setRoutes] = useState<{ id: string; nombre: string; count: number }[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredClientes, setFilteredClientes] = useState<Cliente[]>([]);
  const [motivos, setMotivos] = useState<string[]>([]);
  const [visitModal, setVisitModal] = useState<{ open: boolean; cliente: Cliente | null }>({ open: false, cliente: null });

  const canRead = hasPermission("customers", "read");
  const canCreate = hasPermission("customers", "create");
  const canUpdate = hasPermission("customers", "update");

  useEffect(() => {
    loadClientesFromDB();
  }, []);

  useEffect(() => {
    const loadMotivos = async () => {
      try {
        const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10931/preventa/api/v1";
        const res = await fetch(`${base}/catalogos-generales/E01/registro_visita`);
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) setMotivos(data.map((m: any) => m.descripcion || m.codigo || ""));
      } catch (e) {
        // opcional, no bloquear
      }
    };
    loadMotivos();
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

  const openVisitModal = (cliente: Cliente) => {
    setVisitModal({ open: true, cliente });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Clientes</h1>
          <p className="text-sm text-slate-600 mt-1">{filteredClientes.length} clientes</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={syncClientes}
            disabled={syncing}
            variant="outline"
            size="sm"
            className="border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {syncing ? "Sincronizando..." : "Sincronizar"}
          </Button>
          {canCreate && (
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700/40">
              Nuevo Cliente
            </Button> // 🔹 podrías abrir un modal aquí
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
            <Card
              key={c.idt}
              className="relative overflow-hidden border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-white shadow-sm hover:shadow-lg transition-shadow"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-blue-500" />
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold uppercase">
                        {c.nombreCliente?.charAt(0) || "C"}
                      </div>
                      <div>
                        <CardTitle className="text-lg text-slate-900">{c.nombreCliente}</CardTitle>
                        <CardDescription className="text-slate-600">{c.codigoCliente}</CardDescription>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 border border-emerald-100">
                        {c.rutaVenta ? `Ruta ${c.rutaVenta}` : "Sin ruta"}
                      </span>
                      {c.canalVenta && (
                        <span className="rounded-full bg-slate-100 text-slate-700 px-3 py-1 border border-slate-200">
                          {c.canalVenta}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedClienteStats(c)}
                      title="Ver estadísticas del cliente"
                      className="hover:text-emerald-700"
                    >
                      <BarChart3 className="w-4 h-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedClienteDetalle(c)}
                      title="Ver detalle del cliente"
                      className="hover:text-emerald-700"
                    >
                      <Search className="w-4 h-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openVisitModal(c)}
                      title="Registrar visita o pedido"
                      className="hover:text-emerald-700"
                    >
                      <ClipboardList className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-700">
                <p><span className="font-medium text-slate-900">Tel:</span> {c.telefono || "—"}</p>
                <p><span className="font-medium text-slate-900">Correo:</span> {c.correo || "—"}</p>
                <p><span className="font-medium text-slate-900">Ruta:</span> {c?.rutaVenta || "Sin ruta"}</p>
                <p><span className="font-medium text-slate-900">Última sync:</span> {new Date(c.updatedAt).toLocaleDateString()}</p>
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

        {visitModal.open && visitModal.cliente && (
          <VisitModal
            cliente={visitModal.cliente}
            motivos={motivos}
            onClose={() => setVisitModal({ open: false, cliente: null })}
            onSave={async (motivo, notas) => {
              await addVisit({
                clienteId: visitModal.cliente!.idt,
                clienteCodigo: visitModal.cliente!.codigoCliente,
                motivo: motivo || "Sin motivo",
                notas,
                fecha: new Date().toISOString(),
              });
              setVisitModal({ open: false, cliente: null });
            }}
            onTakeOrder={() => {
              setVisitModal({ open: false, cliente: null });
              const params = new URLSearchParams({
                customerId: visitModal.cliente?.codigoCliente || "",
                customerName: visitModal.cliente?.nombreCliente || "",
                nit: visitModal.cliente?.nit || "",
              });
              router.push(`/orders?${params.toString()}`);
            }}
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

const VisitModal = React.memo(function VisitModal({
  cliente,
  motivos,
  onClose,
  onSave,
  onTakeOrder,
}: {
  cliente: Cliente;
  motivos: string[];
  onClose: () => void;
  onSave: (motivo: string, notas: string) => Promise<void>;
  onTakeOrder: () => void;
}) {
  const [motivoSel, setMotivoSel] = useState("");
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMotivoSel("");
    setNotas("");
  }, [cliente.idt]);

  const handleSave = async () => {
    if (!motivoSel) return;
    try {
      setSaving(true);
      await onSave(motivoSel, notas);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Registro de visita</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
        <p className="text-sm text-gray-600">{cliente.nombreCliente}</p>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-600">Motivo de no compra / visita</label>
          <select
            className="w-full border rounded-md px-3 py-2 text-sm"
            value={motivoSel}
            onChange={(e) => setMotivoSel(e.target.value)}
          >
            <option value="">Selecciona un motivo</option>
            {motivos.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-600">Notas</label>
          <Textarea
            rows={3}
            placeholder="Detalle de la visita"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={handleSave} disabled={!motivoSel || saving}>
            <ClipboardList className="w-4 h-4 mr-2" /> {saving ? "Guardando..." : "Guardar visita"}
          </Button>
          <Button variant="outline" onClick={onTakeOrder}>
            <ShoppingCart className="w-4 h-4 mr-2" /> Tomar pedido
          </Button>
        </div>
      </div>
    </div>
  );
});
