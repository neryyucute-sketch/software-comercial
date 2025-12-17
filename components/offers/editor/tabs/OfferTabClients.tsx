"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import type { OfferDef } from "@/lib/types.offers";
import type { CatalogoGeneral } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getAccessToken } from "@/services/auth";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";

type Props = {
  draft: OfferDef;
  update: (updater: (d: OfferDef) => OfferDef) => void;
  canalesVenta: CatalogoGeneral[];
  subCanalesVenta: CatalogoGeneral[];
};

type Criterio = "cliente" | "canal" | "subcanal";

export function OfferTabClients({
  draft,
  update,
  canalesVenta,
  subCanalesVenta,
}: Props) {
  const router = useRouter();

  // 👇 DEBUG
  console.log('🔍 OfferTabClients props:', {
    canalesVentaLength: canalesVenta.length,
    subCanalesVentaLength: subCanalesVenta.length,
    canalesVenta: canalesVenta.slice(0, 3),
    subCanalesVenta: subCanalesVenta.slice(0, 3),
  });

  const [clienteDetalle, setClienteDetalle] = useState<any | null>(null);

  // 👇 Validación
  if (canalesVenta.length === 0 && subCanalesVenta.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-amber-600">
          <p className="font-semibold">⚠️ No hay catálogos disponibles</p>
          <p className="text-sm mt-2">
            Los catálogos de canales y sub-canales están vacíos.
            <br />
            Verifica que existan datos en tu base de datos.
          </p>
        </div>
      </div>
    );
  }
  
  const [criterio, setCriterio] = useState<Criterio>(() => {
    if ((draft.scope?.codigosCliente ?? []).length > 0) return "cliente";
    if ((draft.scope?.canales ?? []).length > 0) return "canal";
    if ((draft.scope?.subCanales ?? []).length > 0) return "subcanal";
    return "cliente";
  });

  const handleCambioCriterio = (nuevoCriterio: Criterio) => {
    setCriterio(nuevoCriterio);
    
    update((d) => ({
      ...d,
      scope: {
        ...(d.scope ?? {}),
        codigosCliente: nuevoCriterio === "cliente" ? (d.scope?.codigosCliente ?? []) : [],
        canales: nuevoCriterio === "canal" ? (d.scope?.canales ?? []) : [],
        subCanales: nuevoCriterio === "subcanal" ? (d.scope?.subCanales ?? []) : [],
      },
    }));
  };

  // =========================================================
  //  CRITERIO: CLIENTE CON PAGINADO
  // =========================================================
  const [queryCliente, setQueryCliente] = useState("");
  const [clientesRemote, setClientesRemote] = useState<any[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const observerTarget = useRef<HTMLDivElement>(null);
  
  const [clientesMap, setClientesMap] = useState<Map<string, any>>(new Map());
  const codigosClienteSeleccionados: string[] = draft.scope?.codigosCliente ?? [];
  
  const hasMore = page + 1 < totalPages;
  
  useEffect(() => {
    if (!queryCliente || queryCliente.trim().length < 2) {
      setClientesRemote([]);
      setPage(0);
      setTotalPages(0);
      return;
    }
  
    let ignore = false;
    const controller = new AbortController();
  
    async function buscarClientes() {
      try {
        setLoadingClientes(true);
        const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10931/preventa/api/v1";
        const token = await getAccessToken();
        
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        };
        const codigoEmpresa = draft.codigoEmpresa || "E01";
        const url = `${API_BASE}/catalogo-clientes?codigoEmpresa=${encodeURIComponent(codigoEmpresa)}&q=${encodeURIComponent(queryCliente.trim())}&page=0&size=20`;
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
          
          setClientesRemote(items);
          setPage(0);
          setTotalPages(total);
          
          setClientesMap(prev => {
            const newMap = new Map(prev);
            items.forEach((c: any) => {
              const codigo = c.codigoCliente ?? c.codigo;
              newMap.set(codigo, c);
            });
            return newMap;
          });
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return;
        }
        
        console.error("[❌ Buscar Clientes] Error:", err.message);
        
        if (err.message.includes("No hay sesión activa")) {
          router.push('/login');
          return;
        }
        
        if (!ignore) {
          setClientesRemote([]);
          setTotalPages(0);
        }
      } finally {
        if (!ignore) setLoadingClientes(false);
      }
    }
  
    buscarClientes();
    return () => {
      ignore = true;
      controller.abort();
    };
  }, [queryCliente, router, draft.codigoEmpresa]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingClientes || !queryCliente || queryCliente.trim().length < 2) {
      return;
    }

    try {
      setLoadingClientes(true);
      const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10931/preventa/api/v1";
      const token = await getAccessToken();
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };

      const nextPage = page + 1;
      const codigoEmpresa = draft.codigoEmpresa || "E01";
      const url = `${API_BASE}/catalogo-clientes?codigoEmpresa=${encodeURIComponent(codigoEmpresa)}&q=${encodeURIComponent(queryCliente.trim())}&page=${nextPage}&size=20`;
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
      
      setClientesRemote(prev => [...prev, ...items]);
      setPage(nextPage);
      
      setClientesMap(prev => {
        const newMap = new Map(prev);
        items.forEach((c: any) => {
          const codigo = c.codigoCliente ?? c.codigo;
          newMap.set(codigo, c);
        });
        return newMap;
      });
    } catch (err: any) {
      console.error("[❌ Load More] Error:", err.message);
      if (err.message.includes("No hay sesión activa")) {
        router.push('/login');
      }
    } finally {
      setLoadingClientes(false);
    }
  }, [page, totalPages, hasMore, loadingClientes, queryCliente, router, draft.codigoEmpresa]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingClientes) {
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
  }, [hasMore, loadingClientes, loadMore]);
  
  const handleAddCliente = (cliente: any) => {
    const codigo = cliente.codigoCliente ?? cliente.codigo;
    
    const actuales = draft.scope?.codigosCliente ?? [];
    if (actuales.includes(codigo)) {
      return;
    }

    setClientesMap((prev) => {
      const next = new Map(prev);
      next.set(codigo, cliente);
      return next;
    });
  
    update((d) => ({
      ...d,
      scope: {
        ...(d.scope ?? {}),
        codigosCliente: [...actuales, codigo],
      },
    }));
  };

  useEffect(() => {
    if (clientesRemote.length === 0) return;
    setClientesMap((prev) => {
      const next = new Map(prev);
      clientesRemote.forEach((c: any) => {
        const code = c.codigoCliente ?? c.codigo;
        if (!next.has(code)) next.set(code, c);
      });
      return next;
    });
  }, [clientesRemote]);

  useEffect(() => {
    const faltantes = (draft.scope?.codigosCliente ?? []).filter((code) => !clientesMap.has(code));
    if (faltantes.length === 0) return;

    const controller = new AbortController();

    const fetchMissing = async () => {
      try {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10931/preventa/api/v1";
        const token = await getAccessToken();
        const headers: HeadersInit = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        };
        const codigoEmpresa = draft.codigoEmpresa || "E01";

        const requests = faltantes.map(async (code) => {
          const url = `${API_BASE}/catalogo-clientes?codigoEmpresa=${encodeURIComponent(codigoEmpresa)}&q=${encodeURIComponent(code)}&page=0&size=1`;
          const res = await fetch(url, { headers, signal: controller.signal });
          if (!res.ok) return null;
          const data = await res.json();
          const item = data.content?.[0];
          if (!item) return null;
          const codigo = item.codigoCliente ?? item.codigo;
          return codigo ? { codigo, item } : null;
        });

        const resolved = await Promise.all(requests);
        setClientesMap((prev) => {
          const next = new Map(prev);
          resolved.forEach((entry) => {
            if (entry) next.set(entry.codigo, entry.item);
          });
          return next;
        });
      } catch (err: any) {
        if (err.name === "AbortError") return;
      }
    };

    fetchMissing();
    return () => controller.abort();
  }, [draft.scope?.codigosCliente, clientesMap, draft.codigoEmpresa]);

  // =========================================================
  //  CRITERIO: CANAL DE VENTA
  // =========================================================
  const [queryCanal, setQueryCanal] = useState("");

  const canalesFiltrados = useMemo(() => {
    const q = queryCanal.trim().toLowerCase();
    if (!q) return canalesVenta.slice(0, 50);

    const filtrados = canalesVenta.filter((c) =>
      (c.descripcion ?? "").toLowerCase().includes(q)
    );

    return filtrados;
  }, [queryCanal, canalesVenta]);

  const codigosCanalesSeleccionados: string[] = draft.scope?.canales ?? [];

  const handleAddCanal = (canal: CatalogoGeneral) => {
    const actuales = draft.scope?.canales ?? [];
    if (actuales.includes(canal.codigo)) {
      return;
    }

    update((d) => ({
      ...d,
      scope: {
        ...(d.scope ?? {}),
        canales: [...actuales, canal.codigo],
      },
    }));
  };

  // =========================================================
  //  CRITERIO: SUB-CANAL DE VENTA
  // =========================================================
  const [querySubCanal, setQuerySubCanal] = useState("");

  const subCanalesFiltrados = useMemo(() => {
    const q = querySubCanal.trim().toLowerCase();
    if (!q) return subCanalesVenta.slice(0, 50);
  
    const filtrados = subCanalesVenta.filter((sc) =>
      (sc.descripcion ?? "").toLowerCase().includes(q)
    );
  
    return filtrados;
  }, [querySubCanal, subCanalesVenta]);

  const codigosSubCanalesSeleccionados: string[] = draft.scope?.subCanales ?? [];

  const handleAddSubCanal = (subCanal: CatalogoGeneral) => {
    const actuales = draft.scope?.subCanales ?? [];
    if (actuales.includes(subCanal.codigo)) {
      return;
    }

    update((d) => ({
      ...d,
      scope: {
        ...(d.scope ?? {}),
        subCanales: [...actuales, subCanal.codigo],
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
              ["cliente", "Cliente"],
              ["canal", "Canal de Venta"],
              ["subcanal", "Sub-Canal de Venta"],
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
                name="criterio-oferta-clientes"
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

      {/* ================== CRITERIO CLIENTE ================== */}
      {criterio === "cliente" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* IZQUIERDA: Búsqueda y resultados */}
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Buscar clientes
              </label>
              <Input
                value={queryCliente}
                onChange={(e) => setQueryCliente(e.target.value)}
                placeholder="Escribe al menos 2 caracteres…"
                className="text-sm"
              />
            </div>

            <div className="h-64 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 text-xs">
              {loadingClientes && clientesRemote.length === 0 && (
                <div className="px-3 py-2 text-slate-400">Buscando clientes…</div>
              )}

              {!loadingClientes && queryCliente.trim().length < 2 && (
                <div className="px-3 py-2 text-slate-400">
                  Escribe al menos 2 caracteres para buscar.
                </div>
              )}

              {!loadingClientes && queryCliente.trim().length >= 2 && clientesRemote.length === 0 && (
                <div className="px-3 py-2 text-slate-400">
                  No se encontraron clientes.
                </div>
              )}

              {clientesRemote.map((c) => {
                const codigo = c.codigoCliente ?? c.codigo;
                const nombre = c.nombreCliente ?? c.nombre ?? "";
                const yaSeleccionado = codigosClienteSeleccionados.includes(codigo);
                
                return (
                  <div
                    key={codigo}
                    className={cn(
                      "flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 last:border-0",
                      yaSeleccionado ? "bg-emerald-50" : "hover:bg-slate-100"
                    )}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setClienteDetalle(c);
                      }}
                      className="flex-shrink-0 p-1 hover:bg-slate-200 rounded transition-colors"
                      title="Ver detalles del cliente"
                    >
                      <Eye className="h-4 w-4 text-slate-500" />
                    </button>

                    <span className="flex-1 min-w-0">
                      <span className="font-semibold text-slate-800">{codigo}</span>
                      <span className="ml-2 text-slate-600">— {nombre}</span>
                    </span>
                    {yaSeleccionado ? (
                      <span className="flex-shrink-0 px-3 py-1 bg-emerald-600 text-white text-xs rounded-md font-medium">
                        ✓
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAddCliente(c)}
                        className="flex-shrink-0 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md font-medium"
                      >
                        +
                      </button>
                    )}
                  </div>
                );
              })}

              {hasMore && queryCliente.trim().length >= 2 && clientesRemote.length > 0 && (
                <div ref={observerTarget} className="px-3 py-2 text-center">
                  {loadingClientes ? (
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

          {/* DERECHA: Clientes seleccionados */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold text-slate-700 mb-3">
              Clientes seleccionados ({codigosClienteSeleccionados.length})
            </div>
          
            {codigosClienteSeleccionados.length === 0 ? (
              <div className="h-64 flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-400 text-sm">
                Aún no has agregado clientes
              </div>
            ) : (
              <div className="h-64 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                {codigosClienteSeleccionados.map((codigo) => {
                  const cliente = clientesMap.get(codigo);
                  const nombre = cliente?.nombreCliente ?? cliente?.nombre ?? "";
          
                  return (
                    <div
                      key={codigo}
                      className="flex items-start justify-between gap-2 px-3 py-2 bg-emerald-50 rounded-lg border border-emerald-200 text-xs"
                    >
                      {cliente && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setClienteDetalle(cliente);
                          }}
                          className="flex-shrink-0 p-1 hover:bg-emerald-200 rounded transition-colors"
                          title="Ver detalles del cliente"
                        >
                          <Eye className="h-3 w-3 text-emerald-700" />
                        </button>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-emerald-900">{codigo}</div>
                        {nombre && <div className="text-slate-600 mt-0.5">{nombre}</div>}
                      </div>
                      <button
                        type="button"
                        className="flex-shrink-0 text-red-600 hover:text-red-800 font-bold text-lg leading-none"
                        onClick={() => {
                          update((d) => ({
                            ...d,
                            scope: {
                              ...(d.scope ?? {}),
                              codigosCliente: (d.scope?.codigosCliente ?? []).filter((c) => c !== codigo),
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

      {/* ================== CRITERIO CANAL ================== */}
      {criterio === "canal" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Buscar canales de venta
              </label>
              <Input
                value={queryCanal}
                onChange={(e) => setQueryCanal(e.target.value)}
                placeholder="Escribe parte de la descripción…"
                className="text-sm"
              />
            </div>

            <div className="h-64 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 text-xs">
              {canalesFiltrados.length === 0 && (
                <div className="px-3 py-2 text-slate-400">
                  No hay canales disponibles.
                </div>
              )}

              {canalesFiltrados.map((c) => {
                const yaSeleccionado = codigosCanalesSeleccionados.includes(c.codigo);
                
                return (
                  <div
                    key={c.codigo}
                    className={cn(
                      "flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 last:border-0",
                      yaSeleccionado ? "bg-emerald-50" : "hover:bg-slate-100"
                    )}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="font-semibold text-slate-800">{c.codigo}</span>
                      <span className="ml-2 text-slate-600">— {c.descripcion}</span>
                    </span>
                    {yaSeleccionado ? (
                      <span className="flex-shrink-0 px-3 py-1 bg-emerald-600 text-white text-xs rounded-md font-medium">
                        ✓
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAddCanal(c)}
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

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold text-slate-700 mb-3">
              Canales seleccionados ({codigosCanalesSeleccionados.length})
            </div>

            {codigosCanalesSeleccionados.length === 0 ? (
              <div className="h-64 flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-400 text-sm">
                Aún no has agregado canales
              </div>
            ) : (
              <div className="h-64 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                {codigosCanalesSeleccionados.map((codigo) => {
                  const canal = canalesVenta.find((c) => c.codigo === codigo);
                  return (
                    <div
                      key={codigo}
                      className="flex items-start justify-between gap-2 px-3 py-2 bg-emerald-50 rounded-lg border border-emerald-200 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-emerald-900">{codigo}</div>
                        {canal?.descripcion && (
                          <div className="text-slate-600 mt-0.5">{canal.descripcion}</div>
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
                              canales: codigosCanalesSeleccionados.filter((c) => c !== codigo),
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

      {/* ================== CRITERIO SUB-CANAL ================== */}
      {criterio === "subcanal" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Buscar sub-canales de venta
              </label>
              <Input
                value={querySubCanal}
                onChange={(e) => setQuerySubCanal(e.target.value)}
                placeholder="Escribe parte de la descripción…"
                className="text-sm"
              />
            </div>

            <div className="h-64 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 text-xs">
              {subCanalesFiltrados.length === 0 && (
                <div className="px-3 py-2 text-slate-400">
                  No hay sub-canales disponibles.
                </div>
              )}

              {subCanalesFiltrados.map((sc) => {
                const yaSeleccionado = codigosSubCanalesSeleccionados.includes(sc.codigo);
                
                return (
                  <div
                    key={sc.codigo}
                    className={cn(
                      "flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 last:border-0",
                      yaSeleccionado ? "bg-emerald-50" : "hover:bg-slate-100"
                    )}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="font-semibold text-slate-800">{sc.codigo}</span>
                      <span className="ml-2 text-slate-600">— {sc.descripcion}</span>
                    </span>
                    {yaSeleccionado ? (
                      <span className="flex-shrink-0 px-3 py-1 bg-emerald-600 text-white text-xs rounded-md font-medium">
                        ✓
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAddSubCanal(sc)}
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

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold text-slate-700 mb-3">
              Sub-Canales seleccionados ({codigosSubCanalesSeleccionados.length})
            </div>

            {codigosSubCanalesSeleccionados.length === 0 ? (
              <div className="h-64 flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-400 text-sm">
                Aún no has agregado sub-canales
              </div>
            ) : (
              <div className="h-64 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                {codigosSubCanalesSeleccionados.map((codigo) => {
                  const subCanal = subCanalesVenta.find((sc) => sc.codigo === codigo);
                  return (
                    <div
                      key={codigo}
                      className="flex items-start justify-between gap-2 px-3 py-2 bg-emerald-50 rounded-lg border border-emerald-200 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-emerald-900">{codigo}</div>
                        {subCanal?.descripcion && (
                          <div className="text-slate-600 mt-0.5">{subCanal.descripcion}</div>
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
                              subCanales: codigosSubCanalesSeleccionados.filter((c) => c !== codigo),
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

      {/* Modal compacto con solo campos disponibles */}
      {clienteDetalle && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setClienteDetalle(null)}
        >
          <div 
            className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900">
                Detalle del Cliente
              </h3>
              <button
                type="button"
                onClick={() => setClienteDetalle(null)}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold text-slate-700">Código:</span>
                <span className="col-span-2 text-slate-900">{clienteDetalle.codigoCliente ?? clienteDetalle.codigo}</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold text-slate-700">Nombre:</span>
                <span className="col-span-2 text-slate-900">{clienteDetalle.nombreCliente ?? clienteDetalle.nombre}</span>
              </div>

              {clienteDetalle.telefono && (
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-semibold text-slate-700">Teléfono:</span>
                  <span className="col-span-2 text-slate-900">{clienteDetalle.telefono}</span>
                </div>
              )}

              {clienteDetalle.canalVenta && (
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-semibold text-slate-700">Canal:</span>
                  <span className="col-span-2 text-slate-900">{clienteDetalle.canalVenta}</span>
                </div>
              )}

              {clienteDetalle.correo && (
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-semibold text-slate-700">Email:</span>
                  <span className="col-span-2 text-slate-900 break-all">{clienteDetalle.correo}</span>
                </div>
              )}

              {clienteDetalle.nit && (
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-semibold text-slate-700">NIT:</span>
                  <span className="col-span-2 text-slate-900">{clienteDetalle.nit}</span>
                </div>
              )}

              {clienteDetalle.direccionList && clienteDetalle.direccionList.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-semibold text-slate-700">Dirección:</span>
                  <div className="col-span-2 text-slate-900">
                    {clienteDetalle.direccionList.map((dir: any, idx: number) => (
                      <div key={idx}>{dir.direccion}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setClienteDetalle(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors text-sm font-medium"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}