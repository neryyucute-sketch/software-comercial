"use client";

import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getAccessToken } from "@/services/auth";
import type { OfferEditorApi } from "../useOfferEditor";
import type { CatalogoGeneral } from "@/lib/types";

type Props = {
  editor: OfferEditorApi;
  proveedores: CatalogoGeneral[];
  lineas: CatalogoGeneral[];
};

export function OfferTabBasic({ editor, proveedores, lineas }: Props) {
  const { draft, setDraft } = editor;
  if (!draft) return null;

  const tiers = draft.discount?.tiers ?? [];
  const bonus = draft.bonus || {};
  const isPackOffer = draft.type === "combo" || draft.type === "kit";
  const isCombo = draft.type === "combo";
  const isKit = draft.type === "kit";
  const isReferenceLocked = Boolean(draft.referenceCode && draft.serverId);

  const ensurePack = () => ({
    precioFijo: draft.pack?.precioFijo ?? 0,
    cantidadTotalProductos: draft.pack?.cantidadTotalProductos ?? 1,
    itemsFijos: draft.pack?.itemsFijos ?? [],
    itemsVariablesPermitidos: draft.pack?.itemsVariablesPermitidos ?? [],
  });

  const unidadesFijas = draft.pack?.itemsFijos?.reduce(
    (acc, item) => acc + Number(item.unidades ?? 0),
    0
  ) ?? 0;
  const totalCupos = isKit ? unidadesFijas : draft.pack?.cantidadTotalProductos ?? 0;
  const unidadesPendientes = isCombo ? Math.max(0, totalCupos - unidadesFijas) : 0;

  const updatePack = (partial: Partial<ReturnType<typeof ensurePack>>) => {
    setDraft((d) => {
      if (!d) return d;
      const base = {
        precioFijo: d.pack?.precioFijo ?? 0,
        cantidadTotalProductos: d.pack?.cantidadTotalProductos ?? 1,
        itemsFijos: d.pack?.itemsFijos ?? [],
        itemsVariablesPermitidos: d.pack?.itemsVariablesPermitidos ?? [],
      };
      return {
        ...d,
        pack: {
          ...base,
          ...partial,
        },
      };
    });
  };

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [skuResults, setSkuResults] = useState<any[]>([]);
  const [loadingSku, setLoadingSku] = useState(false);
  const [skuDetails, setSkuDetails] = useState<Record<string, string>>({});
  const [selectedSkus, setSelectedSkus] = useState<string[]>(() => {
    const tgt = draft?.bonus?.target;
    const list = (tgt as any)?.productIds as string[] | undefined;
    if (list?.length) return list;
    return tgt?.productId ? [tgt.productId] : [];
  });
  const [selectedLineas, setSelectedLineas] = useState<string[]>(() => {
    const tgt = draft?.bonus?.target;
    const list = (tgt as any)?.lineaIds as string[] | undefined;
    if (list?.length) return list;
    return tgt?.lineaId ? [tgt.lineaId] : [];
  });
  const [selectedProveedores, setSelectedProveedores] = useState<string[]>(() => {
    const tgt = draft?.bonus?.target as any;
    const list = tgt?.proveedorIds as string[] | undefined;
    if (list?.length) return list;
    return tgt?.proveedorId ? [tgt.proveedorId] : [];
  });

  const proveedoresFiltrados = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return proveedores.slice(0, 50);
    return proveedores.filter((p) => (p.descripcion ?? "").toLowerCase().includes(q));
  }, [pickerQuery, proveedores]);

  const lineasFiltradas = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return lineas.slice(0, 50);
    return lineas.filter((l) => (l.descripcion ?? "").toLowerCase().includes(q));
  }, [pickerQuery, lineas]);

  const lineasMap = useMemo(() => {
    const map = new Map<string, string>();
    lineas.forEach((l) => map.set(l.codigo, l.descripcion ?? l.codigo));
    return map;
  }, [lineas]);

  const proveedoresMap = useMemo(() => {
    const map = new Map<string, string>();
    proveedores.forEach((p) => map.set(p.codigo, p.descripcion ?? p.codigo));
    return map;
  }, [proveedores]);

  const toggleSku = (codigo: string, descripcion?: string) => {
    setSelectedSkus((prev) => {
      if (prev.includes(codigo)) {
        return prev.filter((c) => c !== codigo);
      }
      setSkuDetails((d) => (d[codigo] ? d : { ...d, [codigo]: descripcion || codigo }));
      return [...prev, codigo];
    });
  };

  const toggleLinea = (codigo: string) => {
    setSelectedLineas((prev) =>
      prev.includes(codigo) ? prev.filter((c) => c !== codigo) : [...prev, codigo]
    );
  };

  const toggleProveedor = (codigo: string) => {
    setSelectedProveedores((prev) =>
      prev.includes(codigo) ? prev.filter((c) => c !== codigo) : [...prev, codigo]
    );
  };

  const applyPickerSelection = () => {
    const targetType = bonus.target?.type;
    if (targetType === "sku") {
      updateBonus({ target: { type: "sku", productId: selectedSkus[0], productIds: selectedSkus } });
    } else if (targetType === "linea") {
      updateBonus({ target: { type: "linea", lineaId: selectedLineas[0], lineaIds: selectedLineas, requiereSeleccionUsuario: !!bonus.target?.requiereSeleccionUsuario } });
    } else if (targetType === "proveedor") {
      updateBonus({ target: { type: "proveedor", proveedorId: selectedProveedores[0], proveedorIds: selectedProveedores } as any });
    }
    setPickerOpen(false);
  };

  useEffect(() => {
    const tgt = draft?.bonus?.target as any;
    if (tgt?.type === "sku") {
      const next = tgt.productIds?.length ? tgt.productIds : tgt.productId ? [tgt.productId] : [];
      setSelectedSkus((prev) => (prev.join("|") === next.join("|") ? prev : next));
    } else if (tgt?.type === "linea") {
      const next = tgt.lineaIds?.length ? tgt.lineaIds : tgt.lineaId ? [tgt.lineaId] : [];
      setSelectedLineas((prev) => (prev.join("|") === next.join("|") ? prev : next));
    } else if (tgt?.type === "proveedor") {
      const next = tgt.proveedorIds?.length ? tgt.proveedorIds : tgt.proveedorId ? [tgt.proveedorId] : [];
      setSelectedProveedores((prev) => (prev.join("|") === next.join("|") ? prev : next));
    }
  }, [draft?.bonus?.target]);

  const updateBonus = (partial: any) => {
    setDraft((d) => ({
      ...d,
      bonus: { ...(d.bonus || {}), ...partial },
    }));
  };

  useEffect(() => {
    if (!pickerOpen) return;
    if (draft?.bonus?.target?.type !== "sku") return;
    const q = pickerQuery.trim();
    if (q.length < 2) {
      setSkuResults([]);
      return;
    }

    let ignore = false;
    const controller = new AbortController();

    const fetchSku = async () => {
      try {
        setLoadingSku(true);
        const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10931/preventa/api/v1";
        const token = await getAccessToken();
        const headers: HeadersInit = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        };
        const url = `${API_BASE}/catalogo-productos?q=${encodeURIComponent(q)}&page=0&size=20`;
        const res = await fetch(url, { headers, signal: controller.signal });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        if (ignore) return;
        setSkuResults(data.content ?? []);
      } catch (err: any) {
        if (err.name === "AbortError") return;
        if (!ignore) setSkuResults([]);
      } finally {
        if (!ignore) setLoadingSku(false);
      }
    };

    fetchSku();
    return () => {
      ignore = true;
      controller.abort();
    };
  }, [pickerOpen, pickerQuery, draft?.bonus?.target?.type]);

  const updateTier = (index: number, field: "from" | "to" | "percent" | "amount", value: number | undefined) => {
    setDraft((d) => {
      const nextTiers = [...(d.discount?.tiers ?? [])];
      nextTiers[index] = { ...(nextTiers[index] ?? {}), [field]: value } as any;
      return {
        ...d,
        discount: {
          ...(d.discount ?? {}),
          tiers: nextTiers,
        },
      };
    });
  };

  const removeTier = (index: number) => {
    setDraft((d) => {
      const nextTiers = [...(d.discount?.tiers ?? [])];
      nextTiers.splice(index, 1);
      return {
        ...d,
        discount: {
          ...(d.discount ?? {}),
          tiers: nextTiers,
        },
      };
    });
  };

  const addTier = () => {
    setDraft((d) => {
      const current = d.discount?.tiers ?? [];
      const lastTo = current.length ? current[current.length - 1]?.to : undefined;
      const suggestedFrom = lastTo !== undefined && lastTo !== null && !Number.isNaN(lastTo) ? Number(lastTo) + 1 : undefined;
      return {
        ...d,
        discount: {
          ...(d.discount ?? {}),
          tiers: [...current, { from: suggestedFrom, percent: undefined, amount: undefined }],
        },
      };
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="md:col-span-1">
            <Label>Tipo</Label>
            <select
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/70"
              value={draft.type}
              onChange={(e) =>
                setDraft((d) => {
                  const nextType = e.target.value as typeof d.type;
                  const next = {
                    ...d,
                    type: nextType,
                  } as typeof d;
                  if (nextType === "combo" || nextType === "kit") {
                    const basePack = {
                      precioFijo: d.pack?.precioFijo ?? 0,
                      cantidadTotalProductos: d.pack?.cantidadTotalProductos ?? 1,
                      itemsFijos: d.pack?.itemsFijos ?? [],
                      itemsVariablesPermitidos: d.pack?.itemsVariablesPermitidos ?? [],
                    };
                    if (nextType === "kit") {
                      const unidades = basePack.itemsFijos.reduce(
                        (acc, item) => acc + Number(item.unidades ?? 0),
                        0
                      );
                      basePack.itemsVariablesPermitidos = [];
                      basePack.cantidadTotalProductos = unidades;
                    }
                    next.pack = basePack;
                  }
                  if (nextType === "discount") {
                    next.bonus = undefined;
                  }
                  if (nextType === "bonus") {
                    next.discount = undefined;
                  }
                  return next;
                })
              }
            >
              <option value="bonus">Bonificación</option>
              <option value="discount">Descuento</option>
              <option value="combo">Combo</option>
              <option value="kit">Kit</option>
              <option value="pricelist">Lista de precios</option>
            </select>
          </div>
          <div className="md:col-span-1">
            <Label>Estado</Label>
            <select
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/70"
              value={draft.status}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  status: e.target.value as typeof d.status,
                }))
              }
            >
              <option value="draft">Borrador</option>
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </div>
          <div className="md:col-span-1">
            <Label>Nombre</Label>
            <Input
              className="mt-1"
              value={draft.name}
              onChange={(e) =>
                setDraft((d) => ({ ...d, name: e.target.value }))
              }
            />
          </div>
        </div>

        <div>
          <Label>Descripción</Label>
          <textarea
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/70"
            rows={3}
            value={draft.description || ""}
            onChange={(e) =>
              setDraft((d) => ({ ...d, description: e.target.value }))
            }
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label>Válido desde</Label>
            <Input
              type="date"
              className="mt-1"
              value={draft.dates.validFrom}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  dates: { ...d.dates, validFrom: e.target.value },
                }))
              }
            />
          </div>
          <div>
            <Label>Válido hasta</Label>
            <Input
              type="date"
              className="mt-1"
              value={draft.dates.validTo}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  dates: { ...d.dates, validTo: e.target.value },
                }))
              }
            />
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3">
          <input
            id="stackableWithSameProduct"
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            checked={!!draft.stackableWithSameProduct}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                stackableWithSameProduct: e.target.checked,
              }))
            }
          />
          <div className="space-y-1">
            <Label htmlFor="stackableWithSameProduct">Permitir combinar con otras ofertas del mismo producto</Label>
            <p className="text-xs text-slate-600">
              Si está activo, esta oferta puede coexistir con otras que afecten los mismos productos. De lo contrario, se considerará exclusiva por producto.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3">
          <Label>Código de oferta</Label>
          <Input
            className="mt-1 uppercase"
            placeholder="Ej. OFERTA-001"
            value={draft.referenceCode || ""}
            disabled={isReferenceLocked}
            onChange={(e) => {
              const next = e.target.value?.toUpperCase();
              setDraft((d) => ({ ...d, referenceCode: next }));
            }}
          />
          <p className="mt-1 text-xs text-amber-900">
            Este código aparece en los pedidos y PDF para que el equipo identifique la promoción.
            {isPackOffer ? " Los combos y kits lo necesitan para agrupar los productos." : " Úsalo para referenciar descuentos, bonificaciones o listas negociadas."}
            {isReferenceLocked && " Este código proviene del backend y no puede modificarse."}
          </p>
        </div>
      </div>

      {/* Descuento */}
      {draft.type === "discount" && (
        <div className="grid gap-4 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
          <div>
            <div className="text-sm font-semibold text-emerald-900">
              Configuración del descuento
            </div>
            <p className="text-xs text-emerald-800/80">
              Define escalas por cantidad con % o monto fijo. Si no agregas escalas, no se aplicará descuento.
            </p>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-white p-3">
            <input
              id="perLine"
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              checked={!!draft.discount?.perLine}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  discount: { ...(d.discount ?? {}), perLine: e.target.checked },
                }))
              }
            />
            <div className="space-y-1">
              <Label htmlFor="perLine">Evaluar por cada línea (no por mezcla)</Label>
              <p className="text-xs text-slate-600">
                Si está activo, la escala y el mínimo se calculan con la cantidad de cada renglón. Si está apagado, se suman las unidades de todos los productos aplicables.
              </p>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-emerald-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-emerald-900">Escalas por cantidad</div>
                <p className="text-xs text-emerald-800/80">Ej.: 12-23 → 5%, 24-47 → 7%, 48 en adelante → 9%. Si no agregas escalas, aplica con cualquier cantidad.</p>
              </div>
              <button
                type="button"
                onClick={addTier}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-700"
              >
                + Agregar escala
              </button>
            </div>

            {tiers.length === 0 ? (
              <div className="rounded-md border border-dashed border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                Sin escalas: el descuento aplica con cualquier cantidad usando el % o monto fijo definido arriba.
              </div>
            ) : (
              <div className="space-y-2">
                {tiers.map((tier, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-3">
                      <Label className="text-xs">Desde</Label>
                      <Input
                        type="number"
                        className="mt-1"
                        value={tier.from ?? ""}
                        onChange={(e) => updateTier(idx, "from", e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </div>
                    <div className="col-span-3">
                      <Label className="text-xs">Hasta</Label>
                      <Input
                        type="number"
                        className="mt-1"
                        value={tier.to ?? ""}
                        placeholder="en adelante"
                        onChange={(e) => updateTier(idx, "to", e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </div>
                    <div className="col-span-3">
                      <Label className="text-xs">% desc.</Label>
                      <Input
                        type="number"
                        className="mt-1"
                        value={tier.percent ?? ""}
                        onChange={(e) => updateTier(idx, "percent", e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Monto (Q)</Label>
                      <Input
                        type="number"
                        className="mt-1"
                        value={tier.amount ?? ""}
                        onChange={(e) => updateTier(idx, "amount", e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </div>
                    <div className="col-span-1 flex items-end justify-end">
                      <button
                        type="button"
                        onClick={() => removeTier(idx)}
                        className="text-red-600 hover:text-red-800 text-lg leading-none"
                        aria-label="Eliminar escala"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Combo / Kit */}
      {isPackOffer && (
        <div className="grid gap-4 rounded-xl border border-amber-200 bg-amber-50/80 p-4">
          <div>
            <div className="text-sm font-semibold text-amber-900">
              Configuración general del {draft.type === "combo" ? "combo" : "kit"}
            </div>
            <p className="text-xs text-amber-800/80">
              {isCombo
                ? "Define el precio fijo y la cantidad total de productos que debe entregar el combo."
                : "Define el precio fijo del kit; la cantidad total se calcula con los productos fijos ingresados."}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label>Precio fijo (Q)</Label>
              <Input
                type="number"
                className="mt-1"
                min="0"
                step="0.01"
                value={draft.pack?.precioFijo ?? ""}
                onChange={(e) => {
                  const value = e.target.value ? Number(e.target.value) : 0;
                  updatePack({ precioFijo: value });
                }}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Cantidad total de productos</Label>
              <Input
                type="number"
                className="mt-1"
                min="1"
                value={isKit ? unidadesFijas : draft.pack?.cantidadTotalProductos ?? ""}
                readOnly={isKit}
                onChange={(e) => {
                  if (isKit) return;
                  const value = e.target.value ? Number(e.target.value) : 0;
                  updatePack({ cantidadTotalProductos: value });
                }}
                placeholder="Ej. 12"
              />
              {isKit && (
                <p className="mt-1 text-xs text-amber-800">
                  Para los kits se suma automáticamente lo configurado en los productos fijos.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-amber-200 bg-white p-3 text-xs text-amber-900">
            <div className="font-semibold text-sm">Resumen de cupos</div>
            <div className="mt-1 flex flex-wrap gap-4 text-amber-800">
              <span>Fijos definidos: <strong>{unidadesFijas}</strong></span>
              <span>Total requerido: <strong>{totalCupos || "-"}</strong></span>
              {isCombo ? (
                <span>Pendientes para variables: <strong>{unidadesPendientes}</strong></span>
              ) : (
                <span>Los kits no admiten productos variables.</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bonificación */}
      {draft.type === "bonus" && (
        <div className="grid gap-4 rounded-xl border border-indigo-200 bg-indigo-50/70 p-4">
          <div>
            <div className="text-sm font-semibold text-indigo-900">Configuración de bonificación</div>
            <p className="text-xs text-indigo-800/80">Define cada cuántas unidades se bonifica y qué producto se entrega.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label>Cada N unidades</Label>
              <Input
                type="number"
                className="mt-1"
                value={bonus.everyN ?? bonus.buyQty ?? ""}
                onChange={(e) => updateBonus({ everyN: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="Ej. 12"
              />
            </div>
            <div>
              <Label>Bonifica M unidades</Label>
              <Input
                type="number"
                className="mt-1"
                value={bonus.givesM ?? bonus.bonusQty ?? ""}
                onChange={(e) => updateBonus({ givesM: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="Ej. 1"
              />
            </div>
            <div>
              <Label>Modo de conteo</Label>
              <select
                className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/70"
                value={bonus.mode || "acumulado"}
                onChange={(e) => updateBonus({ mode: e.target.value as any })}
              >
                <option value="acumulado">Acumulado (suma todas las líneas)</option>
                <option value="por_linea">Por línea (cada renglón)</option>
              </select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label>Qué se bonifica</Label>
              <select
                className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/70"
                value={bonus.target?.type || (bonus.sameAsQualifier ? "same" : "same")}
                onChange={(e) => {
                    const type = e.target.value as any;
                    updateBonus({
                      target: {
                        type,
                        productId: undefined,
                        lineaId: undefined,
                        familiaId: undefined,
                        proveedorId: undefined,
                        requiereSeleccionUsuario: type === "linea" ? !!bonus.target?.requiereSeleccionUsuario : false,
                      },
                    });
                }}
              >
                <option value="same">Mismo producto comprado</option>
                <option value="sku">SKU específico</option>
                <option value="linea">Cualquier SKU de línea</option>
                <option value="proveedor">Cualquier SKU de proveedor</option>
              </select>
            </div>

              {(bonus.target?.type === "sku") && (
                <div className="flex flex-col gap-1">
                  <Label>SKU bonificado</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      className="flex-1"
                      value={((bonus.target as any)?.productIds?.length ? (bonus.target as any).productIds.join(", ") : bonus.target?.productId) || ""}
                      placeholder="Código de producto"
                      readOnly
                    />
                    <Button variant="outline" type="button" onClick={() => { setPickerQuery(""); setPickerOpen(true); }}>
                      Buscar SKU
                    </Button>
                  </div>
                </div>
              )}

              {(bonus.target?.type === "linea") && (
                <div className="flex flex-col gap-1">
                  <Label>Línea bonificada</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      className="flex-1"
                      value={((bonus.target as any)?.lineaIds?.length ? (bonus.target as any).lineaIds.join(", ") : bonus.target?.lineaId) || ""}
                      placeholder="Código de línea"
                      readOnly
                    />
                    <Button variant="outline" type="button" onClick={() => { setPickerQuery(""); setPickerOpen(true); }}>
                      Elegir línea
                    </Button>
                  </div>
                </div>
              )}

              {(bonus.target?.type === "proveedor") && (
                <div className="flex flex-col gap-1">
                  <Label>Proveedor bonificado</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      className="flex-1"
                      value={((bonus.target as any)?.proveedorIds?.length ? (bonus.target as any).proveedorIds.join(", ") : (bonus.target as any)?.proveedorId) || ""}
                      placeholder="Código de proveedor"
                      readOnly
                    />
                    <Button variant="outline" type="button" onClick={() => { setPickerQuery(""); setPickerOpen(true); }}>
                      Elegir proveedor
                    </Button>
                  </div>
                </div>
              )}
          </div>

          {(bonus.target?.type === "linea") && (
            <div className="flex items-start gap-3 rounded-lg border border-indigo-200 bg-white p-3">
              <input
                id="requiereSeleccionUsuario"
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                checked={!!bonus.target?.requiereSeleccionUsuario}
                onChange={(e) => {
                  const currentLineaTarget =
                    bonus.target?.type === "linea" ? bonus.target : undefined;
                  updateBonus({
                    target: {
                      ...(currentLineaTarget ?? {}),
                      type: "linea",
                      requiereSeleccionUsuario: e.target.checked,
                    },
                  });
                }}
              />
              <div className="space-y-1">
                <Label htmlFor="requiereSeleccionUsuario">Requiere seleccionar SKU</Label>
                <p className="text-xs text-slate-600">Si está activo, el usuario deberá elegir qué SKU bonificar dentro de la línea/familia.</p>
              </div>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label>Límite de aplicaciones (opcional)</Label>
              <Input
                type="number"
                className="mt-1"
                value={bonus.maxApplications ?? ""}
                onChange={(e) => updateBonus({ maxApplications: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="Sin límite"
              />
            </div>
          </div>
        </div>
      )}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-5xl w-full">
          <DialogHeader>
            <DialogTitle>
              {bonus.target?.type === "sku" && "Buscar SKU"}
              {bonus.target?.type === "linea" && "Seleccionar línea"}
              {bonus.target?.type === "proveedor" && "Seleccionar proveedor"}
            </DialogTitle>
          </DialogHeader>

          {bonus.target?.type === "sku" && (
            <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
              <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <Input
                  placeholder="Buscar SKU (mín. 2 caracteres)"
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                />
                {pickerQuery.trim().length < 2 ? (
                  <p className="text-xs text-muted-foreground">Empieza a escribir para buscar.</p>
                ) : loadingSku ? (
                  <p className="text-sm text-muted-foreground">Buscando…</p>
                ) : skuResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin resultados.</p>
                ) : (
                  <div className="max-h-72 overflow-auto rounded border">
                    {skuResults.map((p) => {
                      const codigo = p.codigoProducto ?? p.codigo;
                      const checked = selectedSkus.includes(codigo);
                      const nombre = p.descripcion || codigo;
                      return (
                        <div
                          key={codigo}
                          className={`flex items-center justify-between gap-3 px-3 py-2 border-b last:border-0 ${checked ? "bg-emerald-50" : "hover:bg-slate-50"}`}
                        >
                          <div className="flex flex-col text-sm font-semibold text-slate-800">
                            <span className="text-sm">{nombre}</span>
                            <span className="text-xs text-slate-500">{codigo}</span>
                          </div>
                          <button
                            type="button"
                            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white shadow ${checked ? "bg-emerald-500 hover:bg-emerald-600" : "bg-blue-600 hover:bg-blue-700"}`}
                            onClick={() => toggleSku(codigo, nombre)}
                          >
                            {checked ? "✓" : "+"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-sm">
                <div className="text-sm font-semibold text-slate-800">SKUs seleccionados ({selectedSkus.length})</div>
                <p className="text-xs text-slate-500">Mantén el modal abierto y arma la lista antes de aplicar.</p>
                <div className="mt-2 max-h-72 space-y-2 overflow-auto">
                  {selectedSkus.length === 0 && (
                    <p className="text-sm text-slate-500">Sin SKUs seleccionados.</p>
                  )}
                  {selectedSkus.map((code) => (
                    <div
                      key={code}
                      className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm shadow-sm"
                    >
                      <div className="flex flex-col leading-tight">
                        <span className="font-medium text-slate-800">{skuDetails[code] ?? code}</span>
                        <span className="text-xs text-slate-500">{code}</span>
                      </div>
                      <button
                        type="button"
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                        onClick={() => toggleSku(code)}
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {bonus.target?.type === "linea" && (
            <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
              <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <Input
                  placeholder="Filtrar por nombre de línea"
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                />
                <div className="max-h-72 overflow-auto rounded border">
                  {lineasFiltradas.map((ln) => {
                    const checked = selectedLineas.includes(ln.codigo);
                    return (
                      <div
                        key={ln.codigo}
                        className={`flex items-center justify-between gap-3 px-3 py-2 border-b last:border-0 ${checked ? "bg-emerald-50" : "hover:bg-slate-50"}`}
                      >
                        <div className="flex items-center gap-3 text-sm font-semibold text-slate-800">
                          <span className="text-xs font-bold text-slate-500">{ln.codigo}</span>
                          <span>{ln.descripcion || ln.codigo}</span>
                        </div>
                        <button
                          type="button"
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white shadow ${checked ? "bg-emerald-500 hover:bg-emerald-600" : "bg-blue-600 hover:bg-blue-700"}`}
                          onClick={() => toggleLinea(ln.codigo)}
                        >
                          {checked ? "✓" : "+"}
                        </button>
                      </div>
                    );
                  })}
                  {lineasFiltradas.length === 0 && (
                    <p className="px-3 py-2 text-sm text-muted-foreground">Sin resultados.</p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-sm">
                <div className="text-sm font-semibold text-slate-800">Líneas seleccionadas ({selectedLineas.length})</div>
                <p className="text-xs text-slate-500">Elige varias líneas sin cerrar el modal.</p>
                <div className="mt-2 max-h-72 space-y-2 overflow-auto">
                  {selectedLineas.length === 0 && (
                    <p className="text-sm text-slate-500">Sin líneas seleccionadas.</p>
                  )}
                  {selectedLineas.map((code) => (
                    <div
                      key={code}
                      className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm shadow-sm"
                    >
                      <div className="flex flex-col leading-tight">
                        <span className="font-medium text-slate-800">{lineasMap.get(code) ?? code}</span>
                        <span className="text-xs text-slate-500">{code}</span>
                      </div>
                      <button
                        type="button"
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                        onClick={() => toggleLinea(code)}
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {bonus.target?.type === "proveedor" && (
            <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
              <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <Input
                  placeholder="Filtrar por proveedor"
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                />
                <div className="max-h-72 overflow-auto rounded border">
                  {proveedoresFiltrados.map((pr) => {
                    const checked = selectedProveedores.includes(pr.codigo);
                    return (
                      <div
                        key={pr.codigo}
                        className={`flex items-center justify-between gap-3 px-3 py-2 border-b last:border-0 ${checked ? "bg-emerald-50" : "hover:bg-slate-50"}`}
                      >
                        <div className="flex items-center gap-3 text-sm font-semibold text-slate-800">
                          <span className="text-xs font-bold text-slate-500">{pr.codigo}</span>
                          <span>{pr.descripcion || pr.codigo}</span>
                        </div>
                        <button
                          type="button"
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white shadow ${checked ? "bg-emerald-500 hover:bg-emerald-600" : "bg-blue-600 hover:bg-blue-700"}`}
                          onClick={() => toggleProveedor(pr.codigo)}
                        >
                          {checked ? "✓" : "+"}
                        </button>
                      </div>
                    );
                  })}
                  {proveedoresFiltrados.length === 0 && (
                    <p className="px-3 py-2 text-sm text-muted-foreground">Sin resultados.</p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-sm">
                <div className="text-sm font-semibold text-slate-800">Proveedores seleccionados ({selectedProveedores.length})</div>
                <p className="text-xs text-slate-500">Arma la selección sin cerrar el modal.</p>
                <div className="mt-2 max-h-72 space-y-2 overflow-auto">
                  {selectedProveedores.length === 0 && (
                    <p className="text-sm text-slate-500">Sin proveedores seleccionados.</p>
                  )}
                  {selectedProveedores.map((code) => (
                    <div
                      key={code}
                      className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm shadow-sm"
                    >
                      <div className="flex flex-col leading-tight">
                        <span className="font-medium text-slate-800">{proveedoresMap.get(code) ?? code}</span>
                        <span className="text-xs text-slate-500">{code}</span>
                      </div>
                      <button
                        type="button"
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                        onClick={() => toggleProveedor(code)}
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPickerOpen(false)}>
              Cerrar
            </Button>
            <Button onClick={applyPickerSelection}>
              Aplicar selección
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
