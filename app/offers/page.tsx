"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Loader2, Tag, Calendar, Building2, Gift, Package, Percent, BadgeDollarSign, ListChecks } from "lucide-react";
import { getAccessToken } from "@/services/auth";
import { cn, formatCurrencyQ } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "";
  // Si es formato YYYY-MM-DD, mostrarlo tal cual en local
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  }
  // Si es ISO con T, tomar solo la parte de fecha
  if (/^\d{4}-\d{2}-\d{2}T/.test(dateStr)) {
    const [datePart] = dateStr.split("T");
    const [y, m, d] = datePart.split("-");
    return `${d}/${m}/${y}`;
  }
  // Fallback: intentar parsear
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("es-GT", { day: "2-digit", month: "2-digit", year: "numeric" });
};

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

const dedupeOffers = (items: OfferDef[]): OfferDef[] => {
  const ordered = new Map<string, OfferDef>();

  const buildKey = (offer: OfferDef): string => {
    const uuid = (offer.serverId ?? offer.id ?? "").toString().trim();
    if (uuid) return `UUID:${uuid}`;

    const code = (offer.codigoOferta ?? offer.referenceCode ?? "").toString().trim().toUpperCase();
    const empresa = (offer.codigoEmpresa ?? "").toString().trim().toUpperCase();
    if (code) return `CODE:${empresa}:${code}`;

    const name = (offer.name ?? "").toString().trim();
    if (name) return `NAME:${empresa}:${name}`;

    return `TMP:${Math.random()}`;
  };

  for (const offer of items) {
    const key = buildKey(offer);
    const existing = ordered.get(key);

    if (!existing) {
      ordered.set(key, offer);
      continue;
    }

    const existingUpdated = Date.parse(existing.updatedAt ?? "");
    const currentUpdated = Date.parse(offer.updatedAt ?? "");
    const existingTs = Number.isNaN(existingUpdated) ? 0 : existingUpdated;
    const currentTs = Number.isNaN(currentUpdated) ? 0 : currentUpdated;

    if (currentTs >= existingTs) {
      ordered.set(key, offer);
    }
  }

  return [...ordered.values()];
};

export default function OffersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState("TODAS");
  const [ofertas, setOfertas] = useState<OfferDef[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(50);
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

  const [busqueda, setBusqueda] = useState("");
  const [tipoSel, setTipoSel] = useState("todos");
  const [estadoSel, setEstadoSel] = useState("todos");
  const [fechaDesde, setFechaDesde] = useState(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate());
    return start.toISOString().split("T")[0];
  });
  const [fechaHasta, setFechaHasta] = useState(() => {
    const now = new Date();
    return now.toISOString().split("T")[0];
  });
  const [modoFecha, setModoFecha] = useState<"inicio" | "fin">("inicio");

  useEffect(() => {
    cargarCatalogos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cargarOfertas(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaSeleccionada, page]);

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

  async function cargarOfertas(pageToLoad = 0) {
    try {
      setLoading(true);
      if (empresaSeleccionada === "TODAS") {
        // Para "TODAS", solo muestra la primera página de la primera empresa (mejorar si necesitas paginado global)
        const emp = EMPRESAS.find(e => e.codigo !== "TODAS");
        if (!emp) return;
        const { items, totalPages: tp } = await getOfferDefsOnline(emp.codigo, undefined, pageToLoad, pageSize);
        setOfertas(dedupeOffers(items));
        setTotalPages(tp);
      } else {
        const { items, totalPages: tp } = await getOfferDefsOnline(empresaSeleccionada, undefined, pageToLoad, pageSize);
        setOfertas(dedupeOffers(items));
        setTotalPages(tp);
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
      priority: 5,
      version: 1,
      updatedAt: new Date().toISOString(),
      dirty: false,
      deleted: false,
      referenceCode: "",
      codigoOferta: "",
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
      const actorUsername = user?.usuario?.trim() || undefined;
      const timestampIso = new Date().toISOString();
      const normalizedReference = oferta.referenceCode ? oferta.referenceCode.trim().toUpperCase() : undefined;

      const ofertaAEnviar: OfferDef = {
        ...oferta,
        referenceCode: normalizedReference,
        codigoOferta: normalizedReference,
        priority: Number.isFinite(Number(oferta.priority)) ? Number(oferta.priority) : 5,
        updatedAt: timestampIso,
        updatedBy: actorUsername ?? oferta.updatedBy,
        createdAt: oferta.createdAt ?? timestampIso,
        createdBy: oferta.createdBy ?? actorUsername,
      };

      if (oferta.serverId) {
        await updateOfferDefOnline(ofertaAEnviar, actorUsername);
      } else {
        await createOfferDefOnline(ofertaAEnviar, actorUsername);
      }

      setEditorOpen(false);
      setOfertaEditando(null);
      await cargarOfertas();
    } catch (error: any) {
      console.error("Error guardando oferta:", error);
      // Mostrar error con fondo amarillo y texto negro para mejor visibilidad
      const errorDiv = document.createElement('div');
      errorDiv.style.position = 'fixed';
      errorDiv.style.bottom = '32px';
      errorDiv.style.right = '32px';
      errorDiv.style.zIndex = '9999';
      errorDiv.style.background = '#fffbe6';
      errorDiv.style.color = '#222';
      errorDiv.style.border = '2px solid #ffe58f';
      errorDiv.style.borderRadius = '8px';
      errorDiv.style.padding = '18px 28px';
      errorDiv.style.fontSize = '1.1rem';
      errorDiv.style.boxShadow = '0 2px 12px rgba(0,0,0,0.12)';
      errorDiv.textContent = `Error guardando oferta: ${error.message}`;
      document.body.appendChild(errorDiv);
      setTimeout(() => errorDiv.remove(), 9000);
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

  const ofertasFiltradas = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    const filtroDesde = fechaDesde ? Date.parse(fechaDesde) : null;
    const filtroHasta = fechaHasta ? Date.parse(fechaHasta) : null;

    const matchTerm = (value: string | undefined | null) => {
      if (!term) return true;
      return (value ?? "").toString().toLowerCase().includes(term);
    };

    const matchArray = (arr: string[] | undefined) => {
      if (!term) return true;
      if (!arr || arr.length === 0) return false;
      return arr.some((code) => (code ?? "").toString().toLowerCase().includes(term));
    };

    return ofertas.filter((o) => {
      const tipoLabel = TIPO_LABELS[o.type] || o.type;
      const estadoLabel = o.status === "draft" ? "borrador" : o.status === "active" ? "activa" : o.status === "inactive" ? "inactiva" : o.status;

      if (term) {
        const hits = [
          matchTerm(o.name),
          matchTerm(o.description),
          matchArray(o.products || o.scope?.codigosProducto),
          matchArray(o.scope?.codigosCliente),
          matchArray(o.proveedores || o.scope?.codigosProveedor),
          matchArray(o.scope?.codigosLinea || o.familias || []),
          matchArray(o.scope?.canales),
          matchArray(o.scope?.subCanales),
          matchTerm(tipoLabel),
          matchTerm(estadoLabel),
        ];
        if (!hits.some(Boolean)) return false;
      }

      if (tipoSel !== "todos" && o.type !== tipoSel) return false;
      if (estadoSel !== "todos" && o.status !== estadoSel) return false;

      const vigenciaDesde = Date.parse(o.dates.validFrom ?? "");
      const vigenciaHasta = Date.parse(o.dates.validTo ?? "");

      if (modoFecha === "inicio") {
        if (filtroDesde !== null && !Number.isNaN(vigenciaDesde) && vigenciaDesde < filtroDesde) return false;
        if (filtroHasta !== null && !Number.isNaN(vigenciaDesde) && vigenciaDesde > filtroHasta) return false;
      } else if (modoFecha === "fin") {
        if (filtroDesde !== null && !Number.isNaN(vigenciaHasta) && vigenciaHasta < filtroDesde) return false;
        if (filtroHasta !== null && !Number.isNaN(vigenciaHasta) && vigenciaHasta > filtroHasta) return false;
      }

      return true;
    });
  }, [ofertas, busqueda, fechaDesde, fechaHasta, tipoSel, estadoSel, modoFecha]);

  return (
    <div className="container mx-auto p-2 pt-3 space-y-6">
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

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-center">
          <div className="lg:col-span-2">
            <Input
              placeholder="Buscar por nombre, descripción, producto, cliente, proveedor, línea, canal o subcanal"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              placeholder="Desde"
            />
            <Input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              placeholder="Hasta"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-700">
          <span className="font-medium text-slate-800">Modo de fecha:</span>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="modo-fecha"
              checked={modoFecha === "inicio"}
              onChange={() => setModoFecha("inicio")}
              className="h-4 w-4 border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            Filtrar por fecha de inicio
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="modo-fecha"
              checked={modoFecha === "fin"}
              onChange={() => setModoFecha("fin")}
              className="h-4 w-4 border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            Filtrar por fecha de finalización
          </label>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-center">
          <Select value={tipoSel} onValueChange={setTipoSel}>
            <SelectTrigger>
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los tipos</SelectItem>
              {Object.entries(TIPO_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={estadoSel} onValueChange={setEstadoSel}>
            <SelectTrigger>
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              <SelectItem value="draft">Borrador</SelectItem>
              <SelectItem value="active">Activa</SelectItem>
              <SelectItem value="inactive">Inactiva</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setBusqueda("");
              setTipoSel("todos");
              setEstadoSel("todos");
              setFechaDesde("");
              setFechaHasta("");
              setModoFecha("inicio");
            }}
          >
            Limpiar
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ofertasFiltradas.length === 0 ? (
              <div className="col-span-full text-center py-12 text-slate-500">
                No hay ofertas creadas
              </div>
            ) : (
              ofertasFiltradas.map((oferta) => {
                const statusStyle = STATUS_COLORS[oferta.status] || STATUS_COLORS.draft;
                const empresaNombre = EMPRESAS.find(e => e.codigo === oferta.codigoEmpresa)?.nombre || oferta.codigoEmpresa;

                // Distintivo visual por tipo de oferta
                const tipoColor = {
                  kit: 'bg-blue-100 text-blue-800 border-blue-200',
                  combo: 'bg-orange-100 text-orange-800 border-orange-200',
                  discount: 'bg-green-100 text-green-800 border-green-200',
                  bonus: 'bg-purple-100 text-purple-800 border-purple-200',
                  pricelist: 'bg-pink-100 text-pink-800 border-pink-200',
                }[oferta.type] || 'bg-slate-100 text-slate-800 border-slate-200';

                const tipoIcon = {
                  kit: <Package className="h-4 w-4 mr-1" />,
                  combo: <Gift className="h-4 w-4 mr-1" />,
                  discount: <Percent className="h-4 w-4 mr-1" />,
                  bonus: <BadgeDollarSign className="h-4 w-4 mr-1" />,
                  pricelist: <ListChecks className="h-4 w-4 mr-1" />,
                }[oferta.type] || <Tag className="h-4 w-4 mr-1" />;

                 // Calcular el total bruto: usamos productos seleccionados si existen
                 const totalBruto = Array.isArray(oferta.products)
                   ? oferta.products.length
                   : 0;
                return (
                  <div
                    key={oferta.id}
                    className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
                  >
                    <div className="p-5 space-y-3">
                      {/* Header con título, distintivo y acciones */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-bold uppercase shrink-0 ${tipoColor}`}
                            title={TIPO_LABELS[oferta.type] || oferta.type}
                          >
                            {tipoIcon}
                            {TIPO_LABELS[oferta.type] || oferta.type}
                          </span>
                          <h3 className="text-lg font-semibold text-slate-900 line-clamp-2 flex-1 ml-2">
                            {oferta.name || "Sin título"}
                          </h3>
                        </div>
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
                       {/* Total bruto del pedido */}
                       <div className="flex items-center justify-end mt-2">
                         <span className="text-2xl font-bold text-blue-700" style={{ letterSpacing: "1px" }}>
                           {formatCurrencyQ(totalBruto)}
                         </span>
                       </div>
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
                            {formatDate(oferta.dates.validFrom)} → {formatDate(oferta.dates.validTo)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {/* Paginación */}
          <div className="flex justify-center items-center gap-4 mt-6">
            <Button
              variant="outline"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Anterior
            </Button>
            <span className="text-sm text-slate-700">
              Página {page + 1} de {totalPages}
            </span>
            <Button
              variant="outline"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              Siguiente
            </Button>
          </div>
        </>
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
          existingOffers={ofertas}
          catalogs={catalogos}
          catalogsLoading={catalogsLoading}
          catalogsError={catalogsError}
        />
      )}
    </div>
  );
}