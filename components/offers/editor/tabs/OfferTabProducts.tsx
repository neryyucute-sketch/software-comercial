"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import type { OfferDef } from "@/lib/types.offers";
import type { CatalogoGeneral } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getAccessToken } from "@/services/auth";
import { useRouter } from "next/navigation";

type Props = {
  draft: OfferDef;
  update: (updater: (d: OfferDef) => OfferDef) => void;
  proveedores: CatalogoGeneral[];
  familias: CatalogoGeneral[];
  lineas: CatalogoGeneral[];
};

type Criterio = "product" | "provider" | "line";

export function OfferTabProducts({
  draft,
  update,
  proveedores,
  familias,
  lineas,
}: Props) {
  const router = useRouter();

  // 👇 DEBUG: Ver qué props llegan
  console.log('🔍 OfferTabProducts props:', {
    proveedoresLength: proveedores.length,
    familiasLength: familias.length,
    lineasLength: lineas.length,
    proveedores: proveedores.slice(0, 3), // primeros 3
    familias: familias.slice(0, 3),
    lineas: lineas.slice(0, 3),
  });

  // 👇 Mostrar mensaje si los catálogos están vacíos
  if (proveedores.length === 0 && familias.length === 0 && lineas.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-amber-600">
          <p className="font-semibold">⚠️ No hay catálogos disponibles</p>
          <p className="text-sm mt-2">
            Los catálogos de proveedores, familias y líneas están vacíos.
            <br />
            Verifica que existan datos en tu base de datos.
          </p>
        </div>
      </div>
    );
  }

  // Estado local para el criterio seleccionado
  const [criterio, setCriterio] = useState<Criterio>(() => {
    // Inicializar según lo que tenga el draft
    if ((draft.products ?? []).length > 0) return "product";
    if ((draft.scope?.codigosProveedor ?? []).length > 0) return "provider";
    if ((draft.scope?.codigosLinea ?? []).length > 0) return "line";
    return "product"; // default
  });

  // Cambiar criterio limpia los datos de los otros criterios
  const handleCambioCriterio = (nuevoCriterio: Criterio) => {
    setCriterio(nuevoCriterio);
    
    // Limpiar los datos de los criterios no seleccionados
    update((d) => ({
      ...d,
      products: nuevoCriterio === "product" ? (d.products ?? []) : [],
      scope: {
        ...(d.scope ?? {}),
        codigosProveedor: nuevoCriterio === "provider" ? (d.scope?.codigosProveedor ?? []) : [],
        codigosLinea: nuevoCriterio === "line" ? (d.scope?.codigosLinea ?? []) : [],
      },
    }));
  };

  // =========================================================
  //  CRITERIO: PRODUCTO CON PAGINADO
  // =========================================================
  const [queryProducto, setQueryProducto] = useState("");
  const [productosRemote, setProductosRemote] = useState<any[]>([]);
  const [loadingProductos, setLoadingProductos] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const observerTarget = useRef<HTMLDivElement>(null);
  
  const [productosMap, setProductosMap] = useState<Map<string, any>>(new Map());
  const codigosProductoSeleccionados: string[] = draft.products ?? [];
  
  // Calcular hasMore basado en page y totalPages
  const hasMore = page + 1 < totalPages;
  
  useEffect(() => {
    if (!queryProducto || queryProducto.trim().length < 2) {
      setProductosRemote([]);
      setPage(0);
      setTotalPages(0);
      return;
    }
  
    let ignore = false;
    const controller = new AbortController();
  
    async function buscarProductos() {
      try {
        setLoadingProductos(true);
        const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10931/preventa/api/v1";
        const token = await getAccessToken();
        
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        };
  
        const url = `${API_BASE}/catalogo-productos?q=${encodeURIComponent(queryProducto.trim())}&page=0&size=20`;
        const res = await fetch(url, { signal: controller.signal, headers });
        
        if (!res.ok) {
          if (res.status === 401) {
            router.push('/login');
            return;
          }
          throw new Error("HTTP " + res.status);
        }
        
        const data = await res.json();
        
        if (!ignore) {
          const items = data.content ?? [];
          const total = data.totalPages ?? 1;
          
          console.log('[DEBUG] Primera carga:', { items: items.length, totalPages: total, page: 0 });
          
          setProductosRemote(items);
          setPage(0);
          setTotalPages(total);
          
          setProductosMap(prev => {
            const newMap = new Map(prev);
            items.forEach((p: any) => {
              const codigo = p.codigoProducto ?? p.codigo;
              newMap.set(codigo, p);
            });
            return newMap;
          });
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return;
        }
        
        console.error("[❌ Buscar Productos] Error:", err.message);
        
        if (err.message.includes("No hay sesión activa")) {
          router.push('/login');
          return;
        }
        
        if (!ignore) {
          setProductosRemote([]);
          setTotalPages(0);
        }
      } finally {
        if (!ignore) setLoadingProductos(false);
      }
    }
  
    buscarProductos();
    return () => {
      ignore = true;
      controller.abort();
    };
  }, [queryProducto, router]);

  const loadMore = useCallback(async () => {
    console.log('[DEBUG] loadMore llamado:', { page, totalPages, hasMore, loadingProductos });
    
    if (!hasMore || loadingProductos || !queryProducto || queryProducto.trim().length < 2) {
      console.log('[DEBUG] loadMore cancelado:', { hasMore, loadingProductos, query: queryProducto });
      return;
    }

    try {
      setLoadingProductos(true);
      const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10931/preventa/api/v1";
      const token = await getAccessToken();
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };

      const nextPage = page + 1;
      console.log('[DEBUG] Cargando página:', nextPage);
      
      const url = `${API_BASE}/catalogo-productos?q=${encodeURIComponent(queryProducto.trim())}&page=${nextPage}&size=20`;
      const res = await fetch(url, { headers });
      
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error("HTTP " + res.status);
      }
      
      const data = await res.json();
      const items = data.content ?? [];
      
      console.log('[DEBUG] Datos recibidos:', { items: items.length, page: nextPage });
      
      setProductosRemote(prev => [...prev, ...items]);
      setPage(nextPage);
      
      setProductosMap(prev => {
        const newMap = new Map(prev);
        items.forEach((p: any) => {
          const codigo = p.codigoProducto ?? p.codigo;
          newMap.set(codigo, p);
        });
        return newMap;
      });
    } catch (err: any) {
      console.error("[❌ Load More] Error:", err.message);
      if (err.message.includes("No hay sesión activa")) {
        router.push('/login');
      }
    } finally {
      setLoadingProductos(false);
    }
  }, [page, totalPages, hasMore, loadingProductos, queryProducto, router]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        console.log('[DEBUG] IntersectionObserver:', { 
          isIntersecting: entries[0].isIntersecting, 
          hasMore, 
          loadingProductos 
        });
        
        if (entries[0].isIntersecting && hasMore && !loadingProductos) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, loadingProductos, loadMore]);
  
  const handleAddProducto = (producto: any) => {
    const codigo = producto.codigoProducto ?? producto.codigo;
    
    const actuales = draft.products ?? [];
    if (actuales.includes(codigo)) {
      return;
    }
  
    update((d) => ({
      ...d,
      products: [...actuales, codigo],
    }));
  };

  // =========================================================
  //  CRITERIO: PROVEEDOR
  // =========================================================
  const [queryProveedor, setQueryProveedor] = useState("");

  const proveedoresFiltrados = useMemo(() => {
    const q = queryProveedor.trim().toLowerCase();
    if (!q) return proveedores.slice(0, 50);

    const filtrados = proveedores.filter((p) =>
      (p.descripcion ?? "").toLowerCase().includes(q)
    );

    return filtrados;
  }, [queryProveedor, proveedores]);

  const codigosProveedorSeleccionados: string[] =
    draft.scope?.codigosProveedor ?? [];

  const handleAddProveedor = (prov: CatalogoGeneral) => {
    const actuales = draft.scope?.codigosProveedor ?? [];
    if (actuales.includes(prov.codigo)) {
      return;
    }

    update((d) => ({
      ...d,
      scope: {
        ...(d.scope ?? {}),
        codigosProveedor: [...actuales, prov.codigo],
      },
    }));
  };

  // =========================================================
  //  CRITERIO: LÍNEA (filtro_venta)
  // =========================================================
  const [queryLinea, setQueryLinea] = useState("");

  const lineasFiltradas = useMemo(() => {
    const q = queryLinea.trim().toLowerCase();
    if (!q) return lineas.slice(0, 50);
  
    const filtradas = lineas.filter((l) =>
      (l.descripcion ?? "").toLowerCase().includes(q)
    );
  
    return filtradas;
  }, [queryLinea, lineas]);

  const codigosLineaSeleccionados: string[] =
    draft.scope?.codigosLinea ?? [];

  const handleAddLinea = (linea: CatalogoGeneral) => {
    const actuales = draft.scope?.codigosLinea ?? [];
    if (actuales.includes(linea.codigo)) {
      return;
    }

    update((d) => ({
      ...d,
      scope: {
        ...(d.scope ?? {}),
        codigosLinea: [...actuales, linea.codigo],
      },
    }));
  };

  // =========================================================
  return (
    <div className="space-y-4">
      {/* Selector de criterio con radio buttons HORIZONTAL */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-semibold text-slate-700 mb-3">
          Condición de la oferta:
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["product", "Producto"],
              ["provider", "Proveedor"],
              ["line", "Línea"],
            ] as [Criterio, string][]
          ).map(([value, label]) => (
            <label
              key={value}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-pointer transition-all",
                criterio === value
                  ? "border-emerald-600 bg-emerald-50"
                  : "border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50"
              )}
            >
              <input
                type="radio"
                name="criterio-oferta"
                value={value}
                checked={criterio === value}
                onChange={() => handleCambioCriterio(value)}
                className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
              />
              <span className={cn(
                "text-sm font-medium",
                criterio === value ? "text-emerald-900" : "text-slate-700"
              )}>
                {label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* ================== CRITERIO PRODUCTO ================== */}
      {criterio === "product" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* IZQUIERDA: Búsqueda y resultados */}
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Buscar productos
              </label>
              <Input
                value={queryProducto}
                onChange={(e) => setQueryProducto(e.target.value)}
                placeholder="Escribe al menos 2 caracteres…"
                className="text-sm"
              />
            </div>

            <div className="h-64 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 text-xs">
              {loadingProductos && productosRemote.length === 0 && (
                <div className="px-3 py-2 text-slate-400">Buscando productos…</div>
              )}

              {!loadingProductos && queryProducto.trim().length < 2 && (
                <div className="px-3 py-2 text-slate-400">
                  Escribe al menos 2 caracteres para buscar.
                </div>
              )}

              {!loadingProductos && queryProducto.trim().length >= 2 && productosRemote.length === 0 && (
                <div className="px-3 py-2 text-slate-400">
                  No se encontraron productos.
                </div>
              )}

              {productosRemote.map((p) => {
                const codigo = p.codigoProducto ?? p.codigo;
                const desc = p.descripcion ?? p.nombre ?? "";
                const yaSeleccionado = codigosProductoSeleccionados.includes(codigo);
                
                return (
                  <div
                    key={p.idt ?? p.id ?? codigo}
                    className={cn(
                      "flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 last:border-0",
                      yaSeleccionado ? "bg-emerald-50" : "hover:bg-slate-100"
                    )}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="font-semibold text-slate-800">{codigo}</span>
                      <span className="ml-2 text-slate-600">— {desc}</span>
                    </span>
                    {yaSeleccionado ? (
                      <span className="flex-shrink-0 px-3 py-1 bg-emerald-600 text-white text-xs rounded-md font-medium">
                        ✓
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAddProducto(p)}
                        className="flex-shrink-0 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md font-medium"
                      >
                        +
                      </button>
                    )}
                  </div>
                );
              })}

              {hasMore && queryProducto.trim().length >= 2 && productosRemote.length > 0 && (
                <div ref={observerTarget} className="px-3 py-2 text-center">
                  {loadingProductos ? (
                    <span className="text-slate-400 text-xs">Cargando más…</span>
                  ) : (
                    <span className="text-slate-300 text-xs">
                      ↓ Scroll para más (página {page + 1} de {totalPages})
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* DERECHA: Productos seleccionados */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold text-slate-700 mb-3">
              Productos seleccionados ({codigosProductoSeleccionados.length})
            </div>
          
            {codigosProductoSeleccionados.length === 0 ? (
              <div className="h-64 flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-400 text-sm">
                Aún no has agregado productos
              </div>
            ) : (
              <div className="h-64 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                {codigosProductoSeleccionados.map((codigo) => {
                  const producto = productosMap.get(codigo);
                  const desc = producto?.descripcion ?? producto?.nombre ?? "";
          
                  return (
                    <div
                      key={codigo}
                      className="flex items-start justify-between gap-2 px-3 py-2 bg-emerald-50 rounded-lg border border-emerald-200 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-emerald-900">{codigo}</div>
                        {desc && <div className="text-slate-600 mt-0.5">{desc}</div>}
                      </div>
                      <button
                        type="button"
                        className="flex-shrink-0 text-red-600 hover:text-red-800 font-bold text-lg leading-none"
                        onClick={() => {
                          update((d) => ({
                            ...d,
                            products: (d.products ?? []).filter((c) => c !== codigo),
                          }));
                        }}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================== CRITERIO PROVEEDOR ================== */}
      {criterio === "provider" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* IZQUIERDA: Búsqueda y resultados */}
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Buscar proveedores
              </label>
              <Input
                value={queryProveedor}
                onChange={(e) => setQueryProveedor(e.target.value)}
                placeholder="Escribe parte de la descripción…"
                className="text-sm"
              />
            </div>

            <div className="h-64 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 text-xs">
              {proveedoresFiltrados.length === 0 && (
                <div className="px-3 py-2 text-slate-400">
                  No hay proveedores disponibles.
                </div>
              )}

              {proveedoresFiltrados.map((p) => {
                const yaSeleccionado = codigosProveedorSeleccionados.includes(p.codigo);
                
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 last:border-0",
                      yaSeleccionado ? "bg-emerald-50" : "hover:bg-slate-100"
                    )}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="font-semibold text-slate-800">{p.codigo}</span>
                      <span className="ml-2 text-slate-600">— {p.descripcion}</span>
                    </span>
                    {yaSeleccionado ? (
                      <span className="flex-shrink-0 px-3 py-1 bg-emerald-600 text-white text-xs rounded-md font-medium">
                        ✓
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAddProveedor(p)}
                        className="flex-shrink-0 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md font-medium"
                      >
                        +
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* DERECHA: Proveedores seleccionados */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold text-slate-700 mb-3">
              Proveedores seleccionados ({codigosProveedorSeleccionados.length})
            </div>

            {codigosProveedorSeleccionados.length === 0 ? (
              <div className="h-64 flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-400 text-sm">
                Aún no has agregado proveedores
              </div>
            ) : (
              <div className="h-64 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                {codigosProveedorSeleccionados.map((codigo) => {
                  const prov = proveedores.find((p) => p.codigo === codigo);
                  return (
                    <div
                      key={codigo}
                      className="flex items-start justify-between gap-2 px-3 py-2 bg-emerald-50 rounded-lg border border-emerald-200 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-emerald-900">{codigo}</div>
                        {prov?.descripcion && (
                          <div className="text-slate-600 mt-0.5">{prov.descripcion}</div>
                        )}
                      </div>
                      <button
                        type="button"
                        className="flex-shrink-0 text-red-600 hover:text-red-800 font-bold text-lg leading-none"
                        onClick={() => {
                          update((d) => ({
                            ...d,
                            scope: {
                              ...(d.scope ?? {}),
                              codigosProveedor: codigosProveedorSeleccionados.filter(
                                (c) => c !== codigo
                              ),
                            },
                          }));
                        }}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================== CRITERIO LÍNEA ================== */}
      {criterio === "line" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* IZQUIERDA: Búsqueda y resultados */}
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Buscar líneas
              </label>
              <Input
                value={queryLinea}
                onChange={(e) => setQueryLinea(e.target.value)}
                placeholder="Escribe parte de la descripción…"
                className="text-sm"
              />
            </div>

            <div className="h-64 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 text-xs">
              {lineasFiltradas.length === 0 && (
                <div className="px-3 py-2 text-slate-400">
                  No hay líneas disponibles.
                </div>
              )}

              {lineasFiltradas.map((l) => {
                const yaSeleccionado = codigosLineaSeleccionados.includes(l.codigo);
                
                return (
                  <div
                    key={l.codigo || l.id}
                    className={cn(
                      "flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 last:border-0",
                      yaSeleccionado ? "bg-emerald-50" : "hover:bg-slate-100"
                    )}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="font-semibold text-slate-800">{l.codigo}</span>
                      <span className="ml-2 text-slate-600">— {l.descripcion}</span>
                    </span>
                    {yaSeleccionado ? (
                      <span className="flex-shrink-0 px-3 py-1 bg-emerald-600 text-white text-xs rounded-md font-medium">
                        ✓
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAddLinea(l)}
                        className="flex-shrink-0 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md font-medium"
                      >
                        +
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* DERECHA: Líneas seleccionadas */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold text-slate-700 mb-3">
              Líneas seleccionadas ({codigosLineaSeleccionados.length})
            </div>

            {codigosLineaSeleccionados.length === 0 ? (
              <div className="h-64 flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-400 text-sm">
                Aún no has agregado líneas
              </div>
            ) : (
              <div className="h-64 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                {codigosLineaSeleccionados.map((codigo) => {
                  const linea = lineas.find((l) => l.codigo === codigo);
                  return (
                    <div
                      key={codigo}
                      className="flex items-start justify-between gap-2 px-3 py-2 bg-emerald-50 rounded-lg border border-emerald-200 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-emerald-900">{codigo}</div>
                        {linea?.descripcion && (
                          <div className="text-slate-600 mt-0.5">{linea.descripcion}</div>
                        )}
                      </div>
                      <button
                        type="button"
                        className="flex-shrink-0 text-red-600 hover:text-red-800 font-bold text-lg leading-none"
                        onClick={() => {
                          update((d) => ({
                            ...d,
                            scope: {
                              ...(d.scope ?? {}),
                              codigosLinea: codigosLineaSeleccionados.filter((c) => c !== codigo),
                            },
                          }));
                        }}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}