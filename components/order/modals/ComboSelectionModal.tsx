// components/order/modals/ComboSelectionModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Gift, Minus, Plus } from "lucide-react";
import type { OrderItem, Product } from "@/lib/types";
import type { OfferDef, ComboPackConfig } from "@/lib/types.offers";
import { db } from "@/lib/db";
import ProductQuantityModal from "./ProductQuantityModal";
import { pickReferenceCode } from "@/lib/utils";

type PackRow = {
  idt: string;
  descripcion: string;
  items?: Array<{ productoId: string; descripcion: string; cantidad: number; precioUnitario: number }>;
  _type: "combo" | "kit";
  source: "legacy" | "offer";
  offer?: OfferDef;
  packConfig?: ComboPackConfig;
  price?: number;
};

export type OfferPackRow = PackRow & { source: "offer"; packConfig: ComboPackConfig; offer: OfferDef };

function uuidItem(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function ComboSelectionModal({
  open,
  onOpenChange,
  onPick,
  disabled,
  customer,
  existingItems,
  products = [],
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (items: OrderItem[]) => void;
  disabled?: boolean;
  customer: { codigoCliente: string } | null;
  existingItems?: Record<string, number>;
  products?: Product[];
}) {
  const [combos, setCombos] = useState<PackRow[]>([]);
  const [kits, setKits] = useState<PackRow[]>([]);
  const [offerDefs, setOfferDefs] = useState<OfferDef[]>([]);
  const [activeLegacy, setActiveLegacy] = useState<PackRow | null>(null);
  const [activeOfferPack, setActiveOfferPack] = useState<OfferPackRow | null>(null);

  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => {
      if (p?.codigoProducto) {
        map.set(String(p.codigoProducto), p);
      }
    });
    return map;
  }, [products]);

  useEffect(() => {
    if (!open || disabled) return;
    Promise.all([
      (db as any).combos?.toArray?.().catch(() => []) ?? [],
      (db as any).kits?.toArray?.().catch(() => []) ?? [],
      db.offer_defs
        ?.where?.("type")
        ?.anyOf?.("combo", "kit")
        ?.toArray?.()
        .catch(() => []) ?? [],
    ]).then(([c, k, offers]) => {
      setCombos((c || []).map((item: any) => ({ ...item, _type: "combo", source: "legacy" })));
      setKits((k || []).map((item: any) => ({ ...item, _type: "kit", source: "legacy" })));
      setOfferDefs(offers as OfferDef[]);
    });
  }, [open, disabled]);

  const offerRows = useMemo<PackRow[]>(() => {
    if (!offerDefs.length || !customer) return [];
    const today = new Date();
    return offerDefs
      .filter((off) => {
        const packType = resolvePackType(off.type);
        return (
          !!packType &&
          !off.deleted &&
          isOfferActive(off.status) &&
          !!off.pack
        );
      })
      .filter((off) => isOfferInDateRange(off, today))
      .filter((off) => matchesOfferScope(off, customer, { skipCustomerCodes: true }))
      .map((off) => {
        const pack = off.pack!;
        const packType = resolvePackType(off.type) ?? "combo";
        const preview = [
          ...(pack.itemsFijos ?? []).map((item) => ({
            productoId: item.productoId,
            descripcion: item.descripcion ?? item.productoId,
            cantidad: item.unidades,
            precioUnitario: 0,
          })),
          ...(pack.itemsVariablesPermitidos ?? []).map((item) => ({
            productoId: item.productoId,
            descripcion: `${item.descripcion ?? item.productoId} · variable`,
            cantidad: 0,
            precioUnitario: 0,
          })),
        ];
        return {
          idt: off.id,
          descripcion: off.name || off.description || `Oferta ${off.id}`,
          items: preview,
          _type: packType,
          source: "offer" as const,
          offer: off,
          packConfig: pack,
          price: pack.precioFijo,
        } satisfies PackRow;
      });
  }, [offerDefs, customer]);

  const all = useMemo(() => {
    const legacy = [...combos, ...kits];
    return [...legacy, ...offerRows].slice(0, 300);
  }, [combos, kits, offerRows]);

  const openPack = (pack: PackRow) => {
    if (pack.source === "offer" && pack.packConfig && pack.offer) {
      setActiveOfferPack(pack as OfferPackRow);
    } else {
      setActiveLegacy(pack);
    }
  };

  const confirmLegacyPack = (packsQty: number) => {
    if (!activeLegacy) return;
    const referenceCode = pickReferenceCode(
      (activeLegacy as any)?.referenceCode,
      (activeLegacy as any)?.codigoReferencia,
      (activeLegacy as any)?.codigoOferta,
      (activeLegacy as any)?.ofertaCodigo
    );
    const fallbackCode = pickReferenceCode(
      (activeLegacy as any)?.codigo,
      (activeLegacy as any)?.code,
      (activeLegacy as any)?.codigoCombo,
      (activeLegacy as any)?.codigoKit,
      (activeLegacy as any)?.comboCode,
      (activeLegacy as any)?.kitCode,
      (activeLegacy as any)?.id,
      (activeLegacy as any)?.idt
    );

    const out: OrderItem[] = (activeLegacy.items || []).map((it) => {
      const cant = Math.max(1, packsQty) * (it.cantidad || 1);
      const subtotal = Math.round(cant * it.precioUnitario * 100) / 100;
      const product = productMap.get(String(it.productoId));
      const codigoProveedor = product?.codigoProveedor != null ? String(product.codigoProveedor) : undefined;
      const nombreProveedor = product?.proveedor ?? undefined;
      const codigoLinea = product?.codigoLinea ?? product?.codigoFiltroVenta ?? (product as any)?.lineaVenta ?? undefined;
      const nombreLinea = product?.linea ?? product?.filtroVenta ?? undefined;
      const comboCode = referenceCode ?? fallbackCode ?? null;
      const comboName = activeLegacy.descripcion;
      return {
        id: uuidItem(),
        productoId: it.productoId,
        descripcion: it.descripcion,
        cantidad: cant,
        precioUnitario: it.precioUnitario,
        subtotal,
        subtotalSinDescuento: subtotal,
        comboId: activeLegacy._type === "combo" ? activeLegacy.idt : undefined,
        kitId: activeLegacy._type === "kit" ? activeLegacy.idt : undefined,
        priceSource: "base",
        comboCode,
        comboName,
        comboType: activeLegacy._type,
        comboPacksQty: packsQty,
        ofertaCodigo: referenceCode ?? null,
        ofertaIdAplicada: activeLegacy.idt,
        ofertaNombre: comboName,
        tipoOferta: activeLegacy._type,
        codigoProveedor: codigoProveedor ?? null,
        nombreProveedor: nombreProveedor ?? null,
        codigoLinea: codigoLinea ?? null,
        nombreLinea: nombreLinea ?? null,
      } as OrderItem;
    });
    if (out.length) {
      onPick(out);
      setActiveLegacy(null);
      onOpenChange(false);
    }
  };

  return (
    <>
      <Dialog open={open && !disabled} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-5xl w-[96vw] p-0 overflow-hidden max-h-[90dvh] md:max-h-[85vh]">
          <div className="flex h-full max-h-[inherit] flex-col">
            <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <DialogHeader className="px-4 pt-4 pb-3">
                <DialogTitle className="flex items-center gap-2">
                  <Gift className="w-4 h-4" />
                  Agregar combos / kits
                </DialogTitle>
              </DialogHeader>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {all.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  {disabled ? "Este cliente no califica para combos/kits." : "No hay combos/kits disponibles."}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {all.map((x) => {
                  const meaningfulItems = (x.items || []).filter((it) => (it.cantidad ?? 0) > 0);
                  const selectedHint = meaningfulItems.length > 0
                    ? meaningfulItems.every((it) => (existingItems?.[it.productoId] ?? 0) >= (it.cantidad ?? 0))
                    : false;

                  return (
                    <Card
                      key={`${x._type}-${x.idt}`}
                      className={[
                        "relative cursor-pointer border transition hover:shadow-md",
                        selectedHint ? "border-green-500" : "hover:border-primary",
                      ].join(" ")}
                      onClick={() => openPack(x)}
                    >
                      {selectedHint && (
                        <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1 shadow-md">
                          <Check className="w-4 h-4" />
                        </div>
                      )}

                      <div className="p-3">
                        <div className="font-medium">{x.descripcion}</div>
                        <div className="text-xs text-muted-foreground">
                          {x._type.toUpperCase()} · {pickReferenceCode(
                            (x as any)?.referenceCode,
                            (x as any)?.codigoReferencia,
                            (x as any)?.codigoOferta,
                            (x as any)?.codigo,
                            (x as any)?.code,
                            x.idt
                          ) ?? "–"}
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground line-clamp-2">
                          {(x.items || []).slice(0, 3).map((it) => it.descripcion).join(", ")}
                          {(x.items || []).length > 3 ? "…" : ""}
                        </div>
                        {x.source === "offer" && x.price !== undefined && (
                          <div className="mt-2 text-[11px] font-semibold text-amber-700">
                            Q{x.price.toFixed(2)} por pack
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {activeLegacy && (
        <ProductQuantityModal
          open={!!activeLegacy}
          onOpenChange={(v) => !v && setActiveLegacy(null)}
          title={`${activeLegacy._type === "combo" ? "Combo" : "Kit"} · ${activeLegacy.descripcion}`}
          price={Math.round(((activeLegacy.items || []).reduce((acc, it) => acc + it.precioUnitario, 0)) * 100) / 100}
          initialQty={1}
          onConfirm={confirmLegacyPack}
        />
      )}

      {activeOfferPack && (
        <OfferPackConfigurator
          open={!!activeOfferPack}
          pack={activeOfferPack}
          onOpenChange={(v) => {
            if (!v) setActiveOfferPack(null);
          }}
          onConfirm={(items) => {
            onPick(items);
            setActiveOfferPack(null);
            onOpenChange(false);
          }}
          productMap={productMap}
        />
      )}
    </>
  );
}

export function OfferPackConfigurator({
  open,
  pack,
  onOpenChange,
  onConfirm,
  productMap,
}: {
  open: boolean;
  pack: OfferPackRow;
  onOpenChange: (value: boolean) => void;
  onConfirm: (items: OrderItem[]) => void;
  productMap: Map<string, Product>;
}) {
  const packConfig = pack.packConfig;
  const [packsQty, setPacksQty] = useState(1);
  const [variableQuantities, setVariableQuantities] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [showFixed, setShowFixed] = useState(true);

  const fixedItems = packConfig.itemsFijos ?? [];
  const variableItems = packConfig.itemsVariablesPermitidos ?? [];
  const fixedUnitsPerPack = fixedItems.reduce((acc, it) => acc + Number(it.unidades ?? 0), 0);
  const totalUnitsPerPack = packConfig.cantidadTotalProductos;
  const pendingPerPack = Math.max(0, totalUnitsPerPack - fixedUnitsPerPack);
  const requiredVariableTotal = pendingPerPack * packsQty;
  const currentVariableTotal = Object.values(variableQuantities).reduce((acc, qty) => acc + Number(qty ?? 0), 0);
  const remainingVariable = Math.max(0, requiredVariableTotal - currentVariableTotal);
  const pricePerPack = round2(packConfig.precioFijo);
  const totalPrice = round2(pricePerPack * packsQty);

  const resolveDescription = (productoId: string, fallback?: string) => {
    return productMap.get(String(productoId))?.descripcion || fallback || productoId;
  };

  const clampVariableSelection = (store: Record<string, number>, totalAllowed: number) => {
    const entries = Object.entries(store);
    let remaining = totalAllowed;
    let changed = false;
    const next: Record<string, number> = {};
    for (const [pid, qtyRaw] of entries) {
      if (remaining <= 0) {
        if (qtyRaw) changed = true;
        continue;
      }
      const qty = Math.max(0, Math.floor(Number(qtyRaw) || 0));
      const clamped = Math.min(qty, remaining);
      if (clamped !== qty) changed = true;
      if (clamped > 0) next[pid] = clamped;
      remaining -= clamped;
    }
    if (!changed && entries.length === Object.keys(next).length) return store;
    return next;
  };

  const handlePackQtyChange = (raw: number) => {
    const normalized = Math.max(1, Math.floor(Number(raw) || 1));
    setPacksQty(normalized);
    if (pendingPerPack > 0) {
      const nextAllowed = pendingPerPack * normalized;
      setVariableQuantities((prev) => clampVariableSelection(prev, nextAllowed));
    }
  };

  const handleVariableChange = (productoId: string, raw: number) => {
    setVariableQuantities((prev) => {
      const sanitized = Math.max(0, Math.floor(Number(raw) || 0));
      const othersTotal = Object.entries(prev).reduce((acc, [id, val]) => (id === productoId ? acc : acc + Number(val || 0)), 0);
      const maxForItem = Math.max(0, requiredVariableTotal - othersTotal);
      const clamped = Math.min(sanitized, maxForItem);
      const current = Number(prev[productoId] || 0);
      if (clamped === current) return prev;
      if (clamped <= 0) {
        if (!(productoId in prev)) return prev;
        const next = { ...prev };
        delete next[productoId];
        return next;
      }
      return { ...prev, [productoId]: clamped };
    });
  };

  const handleAutoFill = () => {
    if (!variableItems.length || requiredVariableTotal <= 0) {
      setVariableQuantities({});
      return;
    }
    const perItem = Math.floor(requiredVariableTotal / variableItems.length);
    let remainder = requiredVariableTotal % variableItems.length;
    const draft: Record<string, number> = {};
    variableItems.forEach((item) => {
      draft[item.productoId] = perItem + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;
    });
    setVariableQuantities(clampVariableSelection(draft, requiredVariableTotal));
  };

  const handleConfirm = () => {
    if (packsQty <= 0) {
      setError("Ingresa la cantidad de paquetes");
      return;
    }
    if (pendingPerPack > 0 && variableItems.length === 0) {
      setError("Este combo requiere productos variables, pero la oferta no define ninguno.");
      return;
    }
    if (pendingPerPack > 0 && remainingVariable !== 0) {
      setError("Distribuye todas las unidades variables antes de continuar.");
      return;
    }

    const orderItems = buildOfferPackItems(pack, packsQty, variableQuantities, productMap);
    if (!orderItems.length) {
      setError("No se pudo armar el paquete. Verifica las cantidades.");
      return;
    }

    setError(null);
    onConfirm(orderItems);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {(pack._type === "combo" ? "Combo" : "Kit").concat(" · ", pack.descripcion)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-700">Cantidad de paquetes</label>
              <div className="mt-1 flex items-center rounded-md border border-slate-300 bg-white">
                <button
                  type="button"
                  className="p-2 text-slate-600 hover:text-slate-800"
                  onClick={() => handlePackQtyChange(packsQty - 1)}
                  aria-label="Disminuir paquetes"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <Input
                  type="number"
                  min={1}
                  value={packsQty}
                  onChange={(e) => handlePackQtyChange(Number(e.target.value))}
                  className="border-0 text-center focus-visible:ring-0"
                />
                <button
                  type="button"
                  className="p-2 text-slate-600 hover:text-slate-800"
                  onClick={() => handlePackQtyChange(packsQty + 1)}
                  aria-label="Aumentar paquetes"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div>Precio fijo por pack: <strong>Q{pricePerPack.toFixed(2)}</strong></div>
              <div>Total seleccionado: <strong>Q{totalPrice.toFixed(2)}</strong></div>
              <div>Productos por pack: <strong>{totalUnitsPerPack}</strong></div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200">
            <div className="flex items-center justify-between border-b px-4 py-2 text-sm font-semibold text-slate-700">
              <span>Productos fijos</span>
              {fixedItems.length > 0 && (
                <button
                  type="button"
                  className="text-xs uppercase font-semibold text-amber-600 hover:text-amber-700"
                  onClick={() => setShowFixed((prev) => !prev)}
                >
                  {showFixed ? "Ocultar" : "Mostrar"}
                </button>
              )}
            </div>
            {showFixed && (
              <div className="max-h-48 overflow-y-auto divide-y">
                {fixedItems.length === 0 && (
                  <div className="px-4 py-3 text-sm text-slate-500">Este paquete no tiene productos fijos.</div>
                )}
                {fixedItems.map((item) => {
                  const totalQty = Number(item.unidades ?? 0) * packsQty;
                  return (
                    <div key={item.productoId} className="px-4 py-3 text-sm flex justify-between gap-4">
                      <div>
                        <div className="font-semibold text-slate-800">{resolveDescription(item.productoId, item.descripcion)}</div>
                        <div className="text-xs text-slate-500">SKU: {item.productoId}</div>
                      </div>
                      <div className="text-right text-xs text-slate-600">
                        <div>{item.unidades} / pack</div>
                        <div>Total: {totalQty}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {pack._type === "combo" && variableItems.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/40">
              <div className="flex items-center justify-between border-b border-amber-200 px-4 py-2 text-sm font-semibold text-amber-900">
                <span>Productos variables permitidos</span>
                <div className="text-xs text-amber-800">
                  Pendientes por asignar: <strong>{remainingVariable}</strong>
                </div>
              </div>
              <div className="flex items-center justify-between px-4 py-2 text-xs text-amber-900">
                <span>Completa {requiredVariableTotal || 0} unidades variables ({pendingPerPack} por pack).</span>
                <Button variant="secondary" size="sm" onClick={handleAutoFill} disabled={requiredVariableTotal === 0}>
                  Repartir automático
                </Button>
              </div>
              <div className="max-h-56 overflow-y-auto divide-y divide-amber-100">
                {variableItems.map((item) => {
                  const resolved = resolveDescription(item.productoId, item.descripcion);
                  const storedValue = variableQuantities[item.productoId];
                  const numericValue = Number(storedValue ?? 0);
                  const maxForRow = Math.max(0, numericValue + remainingVariable);
                  const displayValue = storedValue ?? "";
                  return (
                    <div key={item.productoId} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                      <div>
                        <div className="font-semibold text-amber-900">{resolved}</div>
                        <div className="text-xs text-amber-700">SKU: {item.productoId}</div>
                      </div>
                      <div className="flex items-center gap-1 rounded-md border border-amber-200 bg-white px-1">
                        <button
                          type="button"
                          className="p-1 text-amber-700 hover:text-amber-900"
                          onClick={() => handleVariableChange(item.productoId, numericValue - 1)}
                          aria-label="Restar producto"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <Input
                          type="number"
                          min={0}
                          max={maxForRow}
                          value={displayValue}
                          onChange={(e) => handleVariableChange(item.productoId, Number(e.target.value))}
                          className="w-20 border-0 text-center focus-visible:ring-0"
                        />
                        <button
                          type="button"
                          className="p-1 text-amber-700 hover:text-amber-900"
                          onClick={() => handleVariableChange(item.productoId, numericValue + 1)}
                          aria-label="Sumar producto"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleConfirm}>Agregar {packsQty > 1 ? `${packsQty} paquetes` : "paquete"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function buildOfferPackItems(
  pack: OfferPackRow,
  packsQty: number,
  variableQuantities: Record<string, number>,
  productMap: Map<string, Product>
): OrderItem[] {
  const packConfig = pack.packConfig;
  const totalUnitsPerPack = packConfig.cantidadTotalProductos;
  const totalUnitsAll = totalUnitsPerPack * packsQty;
  if (!totalUnitsAll || packConfig.precioFijo <= 0) return [];

  const fixedLines = (packConfig.itemsFijos ?? []).map((item) => ({
    productoId: item.productoId,
    descripcion: item.descripcion,
    qty: Number(item.unidades ?? 0) * packsQty,
  }));

  const variableLines = (packConfig.itemsVariablesPermitidos ?? []).map((item) => ({
    productoId: item.productoId,
    descripcion: item.descripcion,
    qty: Number(variableQuantities[item.productoId] ?? 0),
  }));

  const lines = [...fixedLines, ...variableLines].filter((line) => line.qty > 0);
  if (!lines.length) return [];

  const totalPrice = round2(packConfig.precioFijo * packsQty);
  let allocated = 0;
  const packId = pack.offer?.serverId || pack.offer?.id || pack.idt;
  const referenceCode = pickReferenceCode(
    pack.offer?.referenceCode,
    (pack.offer as any)?.codigoReferencia,
    (pack.offer as any)?.codigoOferta
  );
  const fallbackCode = pickReferenceCode(
    (pack.offer as any)?.codigo,
    (pack.offer as any)?.code,
    pack.offer?.id,
    pack.offer?.serverId,
    pack.idt
  );

  return lines.map((line, idx) => {
    const shareRatio = line.qty / totalUnitsAll;
    let share = round2(totalPrice * shareRatio);
    if (idx === lines.length - 1) {
      share = round2(totalPrice - allocated);
    } else {
      allocated = round2(allocated + share);
    }
    const unitPrice = line.qty > 0 ? share / line.qty : 0;
    const product = productMap.get(String(line.productoId));
    const codigoProveedor = product?.codigoProveedor != null ? String(product.codigoProveedor) : undefined;
    const nombreProveedor = product?.proveedor ?? undefined;
    const codigoLinea = product?.codigoLinea ?? product?.codigoFiltroVenta ?? (product as any)?.lineaVenta ?? undefined;
    const nombreLinea = product?.linea ?? product?.filtroVenta ?? undefined;
    const comboCode = referenceCode ?? fallbackCode ?? null;
    return {
      id: uuidItem(),
      productoId: line.productoId,
      descripcion: productMap.get(String(line.productoId))?.descripcion || line.descripcion || line.productoId,
      cantidad: line.qty,
      precioUnitario: unitPrice,
      subtotal: share,
      subtotalSinDescuento: share,
      comboId: pack._type === "combo" ? packId : undefined,
      kitId: pack._type === "kit" ? packId : undefined,
      priceSource: "oferta",
      ofertaIdAplicada: pack.offer?.id,
      ofertaNombre: pack.offer?.name,
      ofertaCodigo: referenceCode ?? null,
      codigoOferta: referenceCode ?? null,
      comboCode,
      comboName: pack.descripcion,
      comboType: pack._type,
      comboPackPrice: packConfig.precioFijo,
      comboPacksQty: packsQty,
      tipoOferta: pack._type,
      codigoProveedor: codigoProveedor ?? null,
      nombreProveedor: nombreProveedor ?? null,
      codigoLinea: codigoLinea ?? null,
      nombreLinea: nombreLinea ?? null,
    } as OrderItem;
  });
}

function normalizeValue(value?: unknown): string {
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("codigo" in obj && obj.codigo != null) return normalizeValue(obj.codigo);
    if ("code" in obj && obj.code != null) return normalizeValue(obj.code);
    if ("id" in obj && obj.id != null) return normalizeValue(obj.id);
    if ("value" in obj && obj.value != null) return normalizeValue(obj.value);
    if ("descripcion" in obj && obj.descripcion != null) return normalizeValue(obj.descripcion);
    if ("name" in obj && obj.name != null) return normalizeValue(obj.name);
  }
  if (typeof value === "string") return value.trim().toLowerCase();
  if (typeof value === "number") return String(value).trim().toLowerCase();
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value == null) return "";
  return String(value).trim().toLowerCase();
}

export function resolvePackType(type?: unknown): "combo" | "kit" | null {
  const normalized = normalizeValue(type);
  if (normalized === "kit") return "kit";
  if (normalized === "combo") return "combo";
  return null;
}

export function isOfferActive(status?: unknown) {
  if (typeof status === "boolean") return status;
  if (typeof status === "number") return status === 1;
  const normalized = normalizeValue(status);
  return ["active", "activa", "activo", "vigente", "true", "1", "a"].includes(normalized);
}

export function matchesOfferScope(offer: OfferDef, cliente: any | null, options?: { skipCustomerCodes?: boolean }): boolean {
  if (!cliente) return false;
  const scope = offer.scope || {};
  if (!options?.skipCustomerCodes && scope.codigosCliente?.length && !scope.codigosCliente.includes(cliente.codigoCliente)) {
    return false;
  }
  if (scope.canales?.length) {
    // Solo campos explícitos de canal, no tipoCliente
    const candidates = [cliente.canalVenta, cliente.canal, cliente.codigoCanal, cliente.canalCodigo];
    if (!matchesAny(scope.canales, candidates)) return false;
  }
  if (scope.subCanales?.length) {
    const subs = [cliente.subCanalVenta, cliente.subCanal, cliente.codigoSubCanal];
    if (!matchesAny(scope.subCanales, subs)) return false;
  }
  return true;
}

function matchesAny(
  candidates: Array<string | number | Record<string, unknown>> = [],
  values: Array<string | number | undefined | null> = []
) {
  if (!candidates.length) return true;
  const normalizedCandidates = candidates.map(normalizeValue).filter(Boolean);
  if (!normalizedCandidates.length) return true;

  const normalizedValues = values.map((val) => (val == null ? "" : normalizeValue(val))).filter(Boolean);
  if (!normalizedValues.length) return true;

  for (const val of normalizedValues) {
    if (normalizedCandidates.includes(val)) return true;
    if (normalizedCandidates.some((cand) => cand.includes(val) || val.includes(cand))) return true;
  }
  return false;
}

export function isOfferInDateRange(offer: OfferDef, today: Date) {
  const vf = offer.dates?.validFrom ? new Date(offer.dates.validFrom) : null;
  const vt = offer.dates?.validTo ? new Date(offer.dates.validTo) : null;
  if (vf && today < vf) return false;
  if (vt && today > vt) return false;
  return true;
}

function round2(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}
