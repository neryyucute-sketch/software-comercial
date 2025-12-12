"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { OfferDef } from "@/lib/types.offers";
import type { CatalogoGeneral } from "@/lib/types";
import {
  getOfferDefsOnline,
  createOfferDefOnline,
  updateOfferDefOnline,
  deleteOfferDefOnline,
} from "@/services/offers.repo";
import { OfferEditorDialog } from "@/components/offers/editor/OfferEditorDialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Loader2, Tag, Calendar, Building2 } from "lucide-react";
import { getAccessToken } from "@/services/auth";
import { cn } from "@/lib/utils";

const EMPRESAS = [
  { codigo: "TODAS", nombre: "Todas las empresas" },
  { codigo: "E01", nombre: "Codimisa" },
  { codigo: "E07", nombre: "Dimisa" },
];

const TIPO_LABELS: Record<string, string> = {
  discount: "Descuento",
  bonus: "Bonificación",
  combo: "Combo",
  kit: "Kit",
  pricelist: "Lista de Precios",
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  draft: { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" },
  active: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  inactive: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
};

export default function OffersPage() {
  const router = useRouter();
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState("TODAS");
  const [ofertas, setOfertas] = useState<OfferDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [ofertaEditando, setOfertaEditando] = useState<OfferDef | null>(null);

  const [catalogos, setCatalogos] = useState<{
    proveedores: CatalogoGeneral[];
    familias: CatalogoGeneral[];
    lineas: CatalogoGeneral[];
    canalesVenta: CatalogoGeneral[];
    subCanalesVenta: CatalogoGeneral[];
  }>({
    proveedores: [],
    familias: [],
    lineas: [],
    canalesVenta: [],
    subCanalesVenta: [],
  });

  const [catalogsLoading, setCatalogsLoading] = useState(false);
  const [catalogsError, setCatalogsError] = useState<string | null>(null);

  useEffect(() => {
    cargarCatalogos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cargarOfertas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaSeleccionada]);

async function cargarCatalogos() {
  try {
    setCatalogsLoading(true);
    setCatalogsError(null);

    const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10931/preventa/api/v1";
    
    console.log('🔐 Paso 1: Obteniendo token...');
    const token = await getAccessToken();
    console.log('✅ Paso 2: Token obtenido');
    
    if (!token) {
      throw new Error('No se obtuvo token');
    }

    const codigoEmpresa = "E01";

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    console.log('📡 Paso 3: Cargando todos los catálogos de E01...');

    // 🔥 Cargar todos los catálogos en paralelo
    const [proveedoresRes, familiasRes, lineasRes, canalesRes, subcanalesRes] = await Promise.all([
      fetch(`${API_BASE}/catalogos-generales/${codigoEmpresa}/proveedor`, { headers }),
      fetch(`${API_BASE}/catalogos-generales/${codigoEmpresa}/familia`, { headers }),
      fetch(`${API_BASE}/catalogos-generales/${codigoEmpresa}/filtro_venta`, { headers }),
      fetch(`${API_BASE}/catalogos-generales/${codigoEmpresa}/canal_venta`, { headers }),
      fetch(`${API_BASE}/catalogos-generales/${codigoEmpresa}/sub_canal_venta`, { headers }),
    ]);

    console.log('📡 Paso 4: Responses recibidos');

    // Parsear las respuestas
    const [proveedores, familias, lineas, canales, subcanales] = await Promise.all([
      proveedoresRes.json(),
      familiasRes.json(),
      lineasRes.json(),
      canalesRes.json(),
      subcanalesRes.json(),
    ]);

    console.log('📦 Paso 5: Todos los catálogos parseados:', {
      proveedores: Array.isArray(proveedores) ? proveedores.length : 0,
      familias: Array.isArray(familias) ? familias.length : 0,
      lineas: Array.isArray(lineas) ? lineas.length : 0,
      canales: Array.isArray(canales) ? canales.length : 0,
      subcanales: Array.isArray(subcanales) ? subcanales.length : 0,
    });

    // Setear en el estado
    setCatalogos({
      proveedores: Array.isArray(proveedores) ? proveedores : [],
      familias: Array.isArray(familias) ? familias : [],
      lineas: Array.isArray(lineas) ? lineas : [],
      canalesVenta: Array.isArray(canales) ? canales : [],
      subCanalesVenta: Array.isArray(subcanales) ? subcanales : [],
    });

    console.log('✅ Paso 6: Todos los catálogos cargados exitosamente! 🎉');
    setCatalogsLoading(false);

  } catch (error: any) {
    console.error("❌ ERROR cargando catálogos:", error);
    console.error("❌ Error message:", error.message);
    setCatalogsError(error.message || "Error cargando catálogos");
    setCatalogsLoading(false);
  }
}

  async function cargarOfertas() {
    try {
      setLoading(true);
      
      if (empresaSeleccionada === "TODAS") {
        const todasOfertas: OfferDef[] = [];
        for (const emp of EMPRESAS.filter(e => e.codigo !== "TODAS")) {
          const items = await getOfferDefsOnline(emp.codigo);
          todasOfertas.push(...items);
        }
        setOfertas(todasOfertas);
      } else {
        const items = await getOfferDefsOnline(empresaSeleccionada);
        setOfertas(items);
      }
    } catch (error: any) {
      console.error("Error cargando ofertas:", error);
      if (error.message.includes("401") || error.message.includes("403")) {
        router.push("/login");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleNuevaOferta() {
    const nuevaOferta: OfferDef = {
      id: crypto.randomUUID(),
      codigoEmpresa: empresaSeleccionada === "TODAS" ? "E01" : empresaSeleccionada,
      type: "discount",
      name: "",
      description: "",
      status: "draft",
      dates: {
        validFrom: new Date().toISOString().split("T")[0],
        validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      },
      scope: {},
      products: [],
      familias: [],
      subfamilias: [],
      proveedores: [],
      stackableWithSameProduct: false,
      version: 1,
      updatedAt: new Date().toISOString(),
      dirty: false,
      deleted: false,
    };

    setOfertaEditando(nuevaOferta);
    setEditorOpen(true);
  }

  function handleEditarOferta(oferta: OfferDef) {
    setOfertaEditando({ ...oferta });
    setEditorOpen(true);
  }

  async function handleGuardarOferta(oferta: OfferDef) {
    try {
      if (oferta.serverId) {
        await updateOfferDefOnline(oferta);
      } else {
        await createOfferDefOnline(oferta);
      }

      setEditorOpen(false);
      setOfertaEditando(null);
      await cargarOfertas();
    } catch (error: any) {
      console.error("Error guardando oferta:", error);
      alert(`Error guardando oferta: ${error.message}`);
    }
  }

  async function handleEliminarOferta(oferta: OfferDef) {
    if (!confirm(`¿Eliminar la oferta "${oferta.name}"?`)) return;

    try {
      const uuid = oferta.serverId || oferta.id;
      await deleteOfferDefOnline(uuid);
      await cargarOfertas();
    } catch (error: any) {
      console.error("Error eliminando oferta:", error);
      alert(`Error eliminando oferta: ${error.message}`);
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Gestión de Ofertas</h1>
        <Button 
          onClick={handleNuevaOferta} 
          className="bg-black hover:bg-slate-800"
          disabled={catalogsLoading}
        >
          <Plus className="mr-2 h-4 w-4" />
          {catalogsLoading ? "Cargando catálogos..." : "Nueva Oferta"}
        </Button>
      </div>

      <div className="flex gap-4 items-center bg-white p-4 rounded-xl border border-slate-200">
        <label className="font-semibold text-slate-700">Empresa:</label>
        <Select value={empresaSeleccionada} onValueChange={setEmpresaSeleccionada}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EMPRESAS.map((emp) => (
              <SelectItem key={emp.codigo} value={emp.codigo}>
                {emp.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ofertas.length === 0 ? (
            <div className="col-span-full text-center py-12 text-slate-500">
              No hay ofertas creadas
            </div>
          ) : (
            ofertas.map((oferta) => {
              const statusStyle = STATUS_COLORS[oferta.status] || STATUS_COLORS.draft;
              const empresaNombre = EMPRESAS.find(e => e.codigo === oferta.codigoEmpresa)?.nombre || oferta.codigoEmpresa;

              return (
                <div
                  key={oferta.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
                >
                  <div className="p-5 space-y-3">
                    {/* Header con título y acciones */}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-lg font-semibold text-slate-900 line-clamp-2 flex-1">
                        {oferta.name || "Sin título"}
                      </h3>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditarOferta(oferta)}
                          className="h-8 w-8 p-0 hover:bg-slate-100"
                        >
                          <Pencil className="h-4 w-4 text-slate-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEliminarOferta(oferta)}
                          className="h-8 w-8 p-0 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>

                    {/* Descripción */}
                    {oferta.description && (
                      <p className="text-sm text-slate-600 line-clamp-2">
                        {oferta.description}
                      </p>
                    )}

                    {/* Badges de información */}
                    <div className="flex flex-wrap gap-2">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border",
                        statusStyle.bg,
                        statusStyle.text,
                        statusStyle.border
                      )}>
                        <Tag className="h-3 w-3" />
                        {TIPO_LABELS[oferta.type] || oferta.type}
                      </span>

                      <span className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border capitalize",
                        statusStyle.bg,
                        statusStyle.text,
                        statusStyle.border
                      )}>
                        {oferta.status === "draft" && "Borrador"}
                        {oferta.status === "active" && "Activa"}
                        {oferta.status === "inactive" && "Inactiva"}
                      </span>
                    </div>

                    {/* Información adicional */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Building2 className="h-3.5 w-3.5" />
                        <span className="font-medium">{empresaNombre}</span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>
                          {oferta.dates.validFrom} → {oferta.dates.validTo}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {editorOpen && (
        <OfferEditorDialog
          open={editorOpen}
          draft={ofertaEditando}
          onClose={() => {
            setEditorOpen(false);
            setOfertaEditando(null);
          }}
          onSave={handleGuardarOferta}
          catalogs={catalogos}
          catalogsLoading={catalogsLoading}
          catalogsError={catalogsError}
        />
      )}
    </div>
  );
}