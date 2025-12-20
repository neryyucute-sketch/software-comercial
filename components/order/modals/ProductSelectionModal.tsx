"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Package, ChevronLeft, ChevronRight, X } from "lucide-react";
import ProductQuantityModal from "./ProductQuantityModal";
import type { Product, OrderItem, PriceList } from "@/lib/types";
import { selectCustomerPriceList } from "@/lib/price-list-utils";

function uuidItem(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

type CarouselItem = { id: string; label: string; count?: number };

function PickerCarousel({
  title,
  items,
  selected,
  onSelect,
  badgeClass,
}: {
  title: string;
  items: CarouselItem[];
  selected: string | null;
  onSelect: (val: string) => void;
  badgeClass?: string;
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
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Badge className={`text-xs font-medium px-2 py-1 rounded-md ${badgeClass || ""}`}>
            {title}
          </Badge>
          <span className="text-xs text-gray-500">({items.length})</span>
        </div>

        <div className="flex gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full shadow-sm hover:bg-gray-100"
            onClick={() => scrollBy("left")}
            aria-label="Anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full shadow-sm hover:bg-gray-100"
            onClick={() => scrollBy("right")}
            aria-label="Siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 pr-1 scrollbar-visible"
        style={{ scrollbarWidth: "auto" }}
      >
        {items.map(({ id, label, count }) => {
          const isActive = selected === id;
          return (
            <div
              key={id}
              onClick={() => onSelect(id)}
              className={[
                "min-w-[140px] cursor-pointer snap-start rounded-xl p-3 shadow-sm border transition-all",
                isActive
                  ? "bg-blue-600 text-white border-blue-600 shadow-md scale-[1.03]"
                  : "bg-white text-gray-800 border-gray-200 hover:shadow-md hover:bg-gray-50",
              ].join(" ")}
            >
              <div className="text-sm font-semibold line-clamp-1">{label}</div>
              {typeof count === "number" && (
                <div className={`text-xs mt-1 ${isActive ? "text-blue-100" : "text-gray-500"}`}>
                  {count} items
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

type NegotiatedPriceInfo = {
  price: number;
  offerId?: string;
  offerName?: string;
  offerCode?: string | null;
  priority?: number;
  scopeCategory?: string;
};

type PriceInfo = {
  price: number;
  source: "lista" | "default" | "base" | "negotiated";
  listName?: string;
  listId?: string;
  listCode?: string;
  offerId?: string;
  offerName?: string;
  offerCode?: string | null;
  priority?: number;
  scopeCategory?: string;
};

const NEGOTIATED_SCOPE_LABELS: Record<string, string> = {
  client: "Cliente",
  subcanal: "Subcanal",
  canal: "Canal",
  vendor: "Vendedor",
  region: "Región",
  general: "General",
};

type CustomerPriceContext = {
  clasificacionPrecios?: number | string | null;
  clasificacion_precios?: number | string | null;
  listaPrecio?: string | null;
  lista_precio?: string | null;
  listaPrecioCodigo?: string | null;
  listaPrecioCod?: string | null;
  priceList?: string | null;
  priceListCode?: string | null;
};

function getCustomerPrice(
  product: Product,
  customer: CustomerPriceContext | null,
  priceLists: PriceList[],
  companyId: string,
  negotiated?: Record<string, NegotiatedPriceInfo>
): PriceInfo {
  const productKey = String(product.codigoProducto ?? "").trim();

  const negotiatedEntry = productKey && negotiated ? negotiated[productKey] : undefined;
  if (negotiatedEntry && Number.isFinite(negotiatedEntry.price)) {
    const price = Number(negotiatedEntry.price);
    return {
      price,
      source: "negotiated",
      listName: negotiatedEntry.offerName ?? "Precio negociado",
      listCode: negotiatedEntry.offerCode ?? undefined,
      offerId: negotiatedEntry.offerId,
      offerName: negotiatedEntry.offerName ?? "Precio negociado",
      offerCode: negotiatedEntry.offerCode ?? undefined,
      priority: typeof negotiatedEntry.priority === "number" ? negotiatedEntry.priority : undefined,
      scopeCategory: negotiatedEntry.scopeCategory,
    };
  }

  if (!priceLists.length) {
    return { price: product.precio ?? 0, source: "base" };
  }

  const selection = selectCustomerPriceList(customer, priceLists, companyId);
  const candidates: Array<{ list?: PriceList; source: PriceInfo["source"] }> = [];

  if (selection.matchedList) {
    candidates.push({ list: selection.matchedList, source: "lista" });
  }

  if (selection.baseList && (!selection.matchedList || selection.baseList.id !== selection.matchedList.id)) {
    candidates.push({ list: selection.baseList, source: "default" });
  }

  if (!candidates.length && selection.effectiveList) {
    candidates.push({ list: selection.effectiveList, source: "default" });
  }

  for (const entry of candidates) {
    const list = entry.list;
    if (!list) continue;
    const listPrice = list.products?.[product.codigoProducto];
    if (typeof listPrice === "number") {
      return {
        price: listPrice,
        source: entry.source,
        listName: list.name,
        listId: list.id,
        listCode: list.code,
      };
    }
  }

  return { price: product.precio ?? 0, source: "base" };
}

export default function ProductSelectionModal({
  open,
  onOpenChange,
  onPick,
  existingItems,
  customer,
  priceLists = [],
  companyId = "E01",
  negotiatedPrices = {} as Record<string, NegotiatedPriceInfo>,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (items: OrderItem[]) => void;
  existingItems?: Record<string, number>;
  customer?: CustomerPriceContext | null;
  priceLists?: PriceList[];
  companyId?: string;
  negotiatedPrices?: Record<string, NegotiatedPriceInfo>;
}) {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [masterProducts, setMasterProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [active, setActive] = useState<Product | null>(null);
  const [activePrice, setActivePrice] = useState<PriceInfo | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [zoomImg, setZoomImg] = useState<string | null>(null);
  const [providerSearch, setProviderSearch] = useState("");
  const [lineSearch, setLineSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 320);
    return () => clearTimeout(t);
  }, [q]);

  // Carga catálogo local desde Dexie al abrir el modal
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    (async () => {
      try {
        const { db } = await import("@/lib/db");
        const all = await db.products.toArray();
        if (cancelled) return;
        setMasterProducts(all as Product[]);
        setProducts(all as Product[]);
      } catch (e) {
        if (!cancelled) {
          console.warn("No se pudieron cargar productos locales", e);
          setLoadError("No se pudieron cargar los productos almacenados en el dispositivo.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const asId = (v?: string | number | null) => (v ?? "").toString().trim();

  const selectedCount = useMemo(() => {
    if (!existingItems) return 0;
    return Object.values(existingItems).reduce((acc, qty) => acc + (qty || 0), 0);
  }, [existingItems]);

  const colorPill = (seedText?: string) => {
    const txt = seedText || "";
    const seed = Array.from(txt).reduce((s, c) => s + c.charCodeAt(0), 0);
    const palette = [
      "bg-blue-100 text-blue-800",
      "bg-green-100 text-green-800",
      "bg-amber-100 text-amber-800",
      "bg-fuchsia-100 text-fuchsia-800",
      "bg-sky-100 text-sky-800",
      "bg-rose-100 text-rose-800",
      "bg-purple-100 text-purple-800",
      "bg-teal-100 text-teal-800",
    ];
    return palette[seed % palette.length];
  };

  const providers = useMemo(() => {
    const source = masterProducts.length ? masterProducts : products;
    const map = new Map<string, { id: string; label: string; count: number }>();
    source.forEach((p) => {
      const id = asId(p.codigoProveedor);
      if (!id) return;
      const label = p.proveedor || id;
      const prev = map.get(id)?.count ?? 0;
      map.set(id, { id, label, count: prev + 1 });
    });
    return Array.from(map.values())
      .filter((item) => item.count > 0)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [masterProducts, products]);

  const filteredProviders = useMemo(() => {
    const term = providerSearch.trim().toLowerCase();
    if (!term) return providers;
    return providers.filter((p) => p.label.toLowerCase().includes(term) || p.id.toLowerCase().includes(term));
  }, [providers, providerSearch]);

  const lines = useMemo(() => {
    if (!selectedProvider) return [];
    const source = masterProducts.length ? masterProducts : products;
    const normalizedProvider = asId(selectedProvider);
    const subs = new Map<string, { id: string; label: string; count: number }>();
    source.forEach((p) => {
      if (asId(p.codigoProveedor) !== normalizedProvider) return;
      const id = asId(p.codigoFiltroVenta);
      if (!id) return;
      const label = p.filtroVenta || p.linea || id;
      const prev = subs.get(id)?.count ?? 0;
      subs.set(id, { id, label, count: prev + 1 });
    });
    return Array.from(subs.values())
      .filter((item) => item.count > 0)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [masterProducts, products, selectedProvider]);

  const filteredLines = useMemo(() => {
    const term = lineSearch.trim().toLowerCase();
    if (!term) return lines;
    return lines.filter((l) => l.label.toLowerCase().includes(term) || l.id.toLowerCase().includes(term));
  }, [lines, lineSearch]);

  const filtered = useMemo(() => {
    const source = masterProducts.length ? masterProducts : products;
    const search = debouncedQ.trim().toLowerCase();
    return source
      .filter((p) => {
        if (selectedProvider && asId(p.codigoProveedor) !== asId(selectedProvider)) return false;
        if (selectedLine && asId(p.codigoFiltroVenta) !== asId(selectedLine)) return false;
        if (!search) return true;
        const haystack = `${p.descripcion || ""} ${p.codigoProducto || ""}`.toLowerCase();
        return haystack.includes(search);
      })
      .slice(0, 600);
  }, [masterProducts, products, selectedProvider, selectedLine, debouncedQ]);

  const openQty = (product: Product) => {
    const priceInfo = getCustomerPrice(
      product,
      customer ?? null,
      priceLists,
      companyId || "E01",
      negotiatedPrices
    );
    setActive(product);
    setActivePrice(priceInfo);
  };

  const handleConfirmQty = (qty: number) => {
    if (!active || !activePrice) return;
    const price = Number.isFinite(activePrice.price) ? activePrice.price : 0;
    const quantity = Math.max(1, qty);
    const subtotal = Math.round(quantity * price * 100) / 100;
    const codigoProveedor = active.codigoProveedor != null ? String(active.codigoProveedor) : undefined;
    const nombreProveedor = active.proveedor ?? undefined;
    const codigoLinea = active.codigoLinea ?? active.codigoFiltroVenta ?? (active as any).lineaVenta ?? undefined;
    const nombreLinea = active.linea ?? active.filtroVenta ?? undefined;
    const isNegotiated = activePrice.source === "negotiated";
    const fromStandardList = activePrice.source === "lista" || activePrice.source === "default";
    const appliesPriceList = isNegotiated || fromStandardList;
    const listaCodigo = isNegotiated
      ? activePrice.offerCode ?? undefined
      : activePrice.listCode ?? undefined;
    const displayListName = isNegotiated
      ? activePrice.offerName ?? activePrice.listName
      : activePrice.listName;
    const appliedOfferName = isNegotiated
      ? activePrice.offerName ?? activePrice.listName ?? "Precio negociado"
      : undefined;

    const item: OrderItem = {
      id: uuidItem(),
      productoId: active.codigoProducto,
      descripcion: active.descripcion || active.codigoProducto,
      cantidad: quantity,
      precioUnitario: price,
      subtotal,
      subtotalSinDescuento: subtotal,
      priceSource: isNegotiated ? "negotiated" : activePrice.source,
      priceListName: displayListName,
      priceListId: isNegotiated ? undefined : activePrice.listId,
      priceListCode: isNegotiated ? activePrice.offerCode ?? undefined : activePrice.listCode,
      codigoProveedor: codigoProveedor ?? null,
      nombreProveedor: nombreProveedor ?? null,
      codigoLinea: codigoLinea ?? null,
      nombreLinea: nombreLinea ?? null,
      ofertaCodigo: listaCodigo ?? null,
      ofertaIdAplicada: isNegotiated ? activePrice.offerId ?? undefined : undefined,
      ofertaNombre: appliedOfferName,
      tipoOferta: appliesPriceList ? "pricelist" : undefined,
    };

    onPick([item]);
    setActive(null);
    setActivePrice(null);
  };

  const prevActive = useRef<Product | null>(null);
  const prevZoomImg = useRef<string | null>(null);
  useEffect(() => {
    prevActive.current = active;
    prevZoomImg.current = zoomImg;
  }, [active, zoomImg]);

  const handleDialogOpenChange = (v: boolean) => {
    if (!v) {
      if (prevActive.current || prevZoomImg.current) return;
      if (!active && !zoomImg) onOpenChange(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange} modal>
        <DialogContent
          className="
            fixed inset-0 translate-x-0 translate-y-0
            w-screen h-[100dvh] max-w-none
            p-0 overflow-hidden rounded-none
            sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2
            sm:w-[96vw] sm:h-[90dvh] sm:max-w-6xl sm:rounded-lg
          "
          onPointerDownOutside={(e: any) => e.preventDefault()}
          onInteractOutside={(e: any) => e.preventDefault()}
          onEscapeKeyDown={(e: any) => e.preventDefault()}
        >
          <div className="flex flex-col h-full overflow-x-hidden bg-white">
            <div className="sticky top-0 z-20 border-b bg-white px-2 py-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Package className="w-5 h-5 text-primary" />
                <DialogTitle className="text-base font-semibold">Agregar productos</DialogTitle>
                {selectedCount > 0 && (
                  <Badge variant="outline" className="text-xs font-medium px-2 py-0.5">
                    Seleccionados: {selectedCount}
                  </Badge>
                )}
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="rounded-full border border-input bg-white text-muted-foreground hover:text-foreground shadow-sm"
                title="Cerrar"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="px-4 sm:px-6 pb-4 space-y-5">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {providerSearch && (
                    <Button variant="ghost" size="icon" onClick={() => setProviderSearch("")} className="rounded-full">
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <PickerCarousel
                  title="Proveedor"
                  items={filteredProviders}
                  selected={selectedProvider}
                  onSelect={(id) => {
                    const next = asId(id) === asId(selectedProvider) ? null : asId(id);
                    setSelectedProvider(next);
                    setSelectedLine(null);
                  }}
                  badgeClass={colorPill(selectedProvider || "Proveedor")}
                />
              </div>

              {selectedProvider && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {lineSearch && (
                      <Button variant="ghost" size="icon" onClick={() => setLineSearch("")} className="rounded-full">
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <PickerCarousel
                    title="Línea de producto"
                    items={filteredLines}
                    selected={selectedLine}
                    onSelect={(id) => {
                      const next = asId(id) === asId(selectedLine) ? null : asId(id);
                      setSelectedLine(next);
                    }}
                    badgeClass={colorPill(selectedLine || "Linea")}
                  />
                </div>
              )}

{!selectedProvider && (
  <div className="relative">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
    <Input
      placeholder="Buscar por código, descripción"
      value={q}
      onChange={(e) => setQ(e.target.value)}
      className="pl-10"
    />
  </div>
)}

            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 sm:p-4">
              {loadError && (
                <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
                  {loadError}
                </div>
              )}

              {loading && !products.length ? (
                <div className="text-sm text-muted-foreground">Cargando productos...</div>
              ) : filtered.length === 0 ? (
                <div className="text-sm text-muted-foreground">Sin productos disponibles.</div>
              ) : (
                <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
                  {filtered.map((p) => {
                    const alreadyQty = existingItems?.[p.codigoProducto] ?? 0;
                    const selected = alreadyQty > 0;
                    const priceInfo = getCustomerPrice(
                      p,
                      customer ?? null,
                      priceLists,
                      companyId || "E01",
                      negotiatedPrices
                    );
                    const unit = priceInfo.price ?? 0;

                    return (
                      <Card
                        key={p.codigoProducto}
                        className={[
                          "relative cursor-pointer border transition-all duration-150 hover:shadow-md rounded-xl",
                          selected
                            ? "border-green-500 bg-green-50/60 dark:bg-green-900/20"
                            : "border-gray-200 bg-white dark:bg-neutral-900 hover:border-primary/60",
                        ].join(" ")}
                        onClick={() => openQty(p)}
                      >
                        {/* xN en la esquina */}
                        {selected && (
                          <div className="absolute top-2 right-2 bg-green-600 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow">
                            x{alreadyQty}
                          </div>
                        )}

                        <div className="flex flex-row md:flex-col gap-2 p-2">
                          {/* Imagen + precio encima */}
                          <div className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-full md:h-36 rounded-lg overflow-hidden flex items-center justify-center shadow bg-gray-100 dark:bg-neutral-800 flex-shrink-0">
                            <div className="absolute top-1 left-1 bg-black/70 text-white text-[11px] font-semibold px-2 py-0.5 rounded">
                              Q{unit.toFixed(2)}
                            </div>

                            {p.urlImg ? (
                              <img
                                src={p.urlImg}
                                alt={p.descripcion || p.codigoProducto}
                                className="w-full h-full object-cover cursor-zoom-in"
                                onClick={(e) => {
                                  e.stopPropagation();
                                 setZoomImg(p.urlImg || null);
                                }}
                                title="Ver imagen"
                              />
                            ) : (
                              <div className="text-[10px] text-muted-foreground text-center">
                                Sin
                                <br />
                                imagen
                              </div>
                            )}
                          </div>

                          {/* Texto compacto */}
                          <div className="flex-1 min-w-0 flex flex-col">
                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-1">
                              {p.descripcion || p.codigoProducto}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate">{p.codigoProducto}</div>

                            <div className="flex flex-wrap gap-1 mt-1">
                              {priceInfo.source === "negotiated" && (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-800 rounded px-2 py-0.5 font-semibold">
                                  Negociado
                                  {priceInfo.priority !== undefined && (
                                    <span className="inline-flex items-center text-[9px] font-semibold bg-white/60 text-emerald-700 rounded-full px-2 py-[1px]">
                                      P{priceInfo.priority}
                                      {priceInfo.scopeCategory && ` · ${NEGOTIATED_SCOPE_LABELS[priceInfo.scopeCategory] || priceInfo.scopeCategory}`}
                                    </span>
                                  )}
                                </span>
                              )}
                              {p.proveedor && (
                                <span className="inline-flex items-center text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 rounded px-2 py-0.5">
                                  {p.proveedor}
                                </span>
                              )}
                              {p.filtroVenta && (
                                <span className="inline-flex items-center text-[10px] bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-gray-200 rounded px-2 py-0.5">
                                  {p.filtroVenta}
                                </span>
                              )}
                            </div>

                            {/* Solo muestra lista si existe (compacto) */}
                            {priceInfo.listName && (
                              <div
                                className={
                                  "text-[10px] truncate mt-1 " +
                                  (priceInfo.source === "negotiated"
                                    ? "text-emerald-600 font-semibold"
                                    : "text-muted-foreground")
                                }
                              >
                                {priceInfo.listName}
                                {priceInfo.source === "negotiated" && priceInfo.priority !== undefined && (
                                  <span className="ml-1 text-[9px] font-normal text-emerald-700">
                                    (P{priceInfo.priority})
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {active && activePrice && (
        <ProductQuantityModal
          open={!!active}
          onOpenChange={(v) => !v && setActive(null)}
          title={(active.descripcion || active.codigoProducto) ?? ""}
          price={activePrice.price ?? 0}
          priceSource={activePrice.source}
          priceListName={activePrice.listName}
          initialQty={Math.max(1, existingItems?.[active.codigoProducto] ?? 1)}
          onConfirm={handleConfirmQty}
        />
      )}

      {zoomImg && (
        <Dialog open={!!zoomImg} onOpenChange={() => setZoomImg(null)}>
          <DialogContent className="max-w-lg p-0 bg-transparent shadow-none border-none flex flex-col items-center">
            <DialogHeader className="sr-only">
              <DialogTitle>Vista ampliada del producto</DialogTitle>
            </DialogHeader>
            <img
              src={zoomImg ?? ""}
              alt="Imagen ampliada"
              className="rounded-lg max-h-[70vh] max-w-full shadow-lg"
              style={{ background: "#fff" }}
            />
            <Button
              variant="ghost"
              className="mt-2 text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/30"
              onClick={() => setZoomImg(null)}
            >
              Cerrar
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
