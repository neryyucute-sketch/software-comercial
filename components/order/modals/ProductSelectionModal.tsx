"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/lib/db";
import type { Product, OrderItem } from "@/lib/types";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Check, Search, Package, ChevronLeft, ChevronRight, X } from "lucide-react";
import ProductQuantityModal from "./ProductQuantityModal";

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
        <style jsx>{`
          .scrollbar-visible::-webkit-scrollbar {
            height: 8px;
          }
          .scrollbar-visible::-webkit-scrollbar-thumb {
            background: #9ca3af;
            border-radius: 9999px;
          }
          .scrollbar-visible::-webkit-scrollbar-track {
            background: #e5e7eb;
            border-radius: 9999px;
          }
          .scrollbar-visible {
            scrollbar-color: #9ca3af #e5e7eb;
          }
        `}</style>

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

export default function ProductSelectionModal({
  open,
  onOpenChange,
  onPick,
  existingItems,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (items: OrderItem[]) => void;
  existingItems?: Record<string, number>;
}) {
  const [q, setQ] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [active, setActive] = useState<Product | null>(null);

  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [zoomImg, setZoomImg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    db.products.toArray().then((rows) => setProducts(rows));
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
    const map: Record<string, { id: string; label: string; count: number }> = {};
    for (const p of products) {
      if (!p.codigoProveedor) continue;
      const id = asId(p.codigoProveedor);
      const label = p.proveedor || "—";
      if (!map[id]) map[id] = { id, label, count: 0 };
      map[id].count++;
    }
    return Object.values(map);
  }, [products]);

  const lines = useMemo(() => {
    if (!selectedProvider) return [];
    const provId = asId(selectedProvider);
    const subs = new Map<string, { id: string; label: string; count: number }>();

    for (const p of products) {
      if (asId(p.codigoProveedor) !== provId) continue;
      const id = asId(p.codigoFiltroVenta);
      if (!id) continue;
      const label = p.filtroVenta || "—";
      const prev = subs.get(id);
      subs.set(id, { id, label, count: (prev?.count ?? 0) + 1 });
    }

    return Array.from(subs.values());
  }, [products, selectedProvider]);

  const filtered = useMemo(() => {
    let list = products;

    if (selectedProvider) {
      const provId = asId(selectedProvider);
      list = list.filter((p) => asId(p.codigoProveedor) === provId);
    }

    if (selectedLine) {
      const lineId = asId(selectedLine);
      list = list.filter((p) => asId(p.codigoFiltroVenta) === lineId);
    }

    const s = q.trim().toLowerCase();
    if (s) {
      list = list.filter(
        (p) =>
          p.codigoProducto.toLowerCase().includes(s) ||
          (p.descripcion || "").toLowerCase().includes(s)
      );
    }

    return list.slice(0, 300);
  }, [products, q, selectedProvider, selectedLine]);

  const openQty = (p: Product) => setActive(p);

  const handleConfirmQty = (qty: number) => {
    if (!active) return;
    const unit = active.precio ?? 0;

    const item: OrderItem = {
      id: uuidItem(),
      productoId: active.codigoProducto,
      descripcion: active.descripcion || active.codigoProducto,
      cantidad: qty,
      precioUnitario: unit,
      subtotal: Math.round(unit * qty * 100) / 100,
      priceSource: "base",
    };

    onPick([item]);
    setActive(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {/* Fullscreen real en mobile, modal centrado desde sm */}
        <DialogContent
          className="
            fixed inset-0 translate-x-0 translate-y-0
            w-screen h-[100dvh] max-w-none
            p-0 overflow-hidden rounded-none
            sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2
            sm:w-[96vw] sm:h-[90dvh] sm:max-w-6xl sm:rounded-lg
          "
        >
          {/* Un solo layout, SIN scroll duplicado */}
          <div className="flex flex-col h-full overflow-x-hidden bg-white">
            {/* Header sticky */}
            <div className="sticky top-0 z-20 border-b bg-white">
              <DialogHeader className="px-4 sm:px-6 pt-5 pb-4">
                <div className="flex items-start gap-3">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <div className="flex items-center gap-2 text-primary">
                      <Package className="w-5 h-5 text-primary" />
                      <DialogTitle className="text-lg">Agregar productos</DialogTitle>
                    </div>

                    <Badge variant="secondary" className="text-xs font-medium px-2 py-1">
                      {filtered.length} resultados
                    </Badge>

                    {selectedCount > 0 && (
                      <Badge variant="outline" className="text-xs font-medium px-2 py-1">
                        Seleccionados: {selectedCount}
                      </Badge>
                    )}
                  </div>

                  <div className="ml-auto flex items-center gap-2 shrink-0">
                    <span className="hidden sm:inline text-xs text-muted-foreground">
                      Tecla ESC para cerrar
                    </span>
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
                </div>
              </DialogHeader>

              {/* Filtros + búsqueda (parte sticky, sin scroll propio) */}
              <div className="px-4 sm:px-6 pb-4 space-y-5">
                <PickerCarousel
                  title="Proveedor"
                  items={providers}
                  selected={selectedProvider}
                  onSelect={(id) => {
                    const next = asId(id) === asId(selectedProvider) ? null : asId(id);
                    setSelectedProvider(next);
                    setSelectedLine(null);
                  }}
                  badgeClass={colorPill(selectedProvider || "Proveedor")}
                />

                {selectedProvider && (
                  <PickerCarousel
                    title="Línea de producto"
                    items={lines}
                    selected={selectedLine}
                    onSelect={(id) => {
                      const next = asId(id) === asId(selectedLine) ? null : asId(id);
                      setSelectedLine(next);
                    }}
                    badgeClass={colorPill(selectedLine || "Linea")}
                  />
                )}

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Buscar por código, descripción…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {/* ÚNICO scroll vertical */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 sm:p-4">
              {filtered.length === 0 ? (
                <div className="text-sm text-muted-foreground">Sin productos disponibles.</div>
              ) : (
                <div className="w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                  {filtered.map((p) => {
                    const alreadyQty = existingItems?.[p.codigoProducto] ?? 0;
                    const selected = alreadyQty > 0;
                    const unit = p.precio ?? 0;

                    return (
                      <Card
                        key={p.codigoProducto}
                        className={[
                          "relative cursor-pointer border transition-all duration-150 hover:shadow-lg hover:-translate-y-[2px] rounded-xl",
                          selected
                            ? "border-green-500 bg-green-50/60 dark:bg-green-900/20"
                            : "border-gray-200 bg-white dark:bg-neutral-900 hover:border-primary/60",
                        ].join(" ")}
                        onClick={() => openQty(p)}
                      >
                        {selected && (
                          <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1 shadow-md">
                            <Check className="w-4 h-4" />
                          </div>
                        )}

                        {/* List view en mobile, card en md+ */}
                        <div className="flex flex-row md:flex-col gap-3 p-3">
                          <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-full md:h-44 rounded-lg overflow-hidden flex items-center justify-center shadow bg-gray-100 dark:bg-neutral-800 flex-shrink-0">
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
                              <div className="text-xs text-muted-foreground text-center">
                                Sin
                                <br />
                                imagen
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0 flex flex-col">
                            <div className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">
                              {p.descripcion || p.codigoProducto}
                            </div>
                            <div className="text-[11px] sm:text-xs text-muted-foreground truncate">
                              {p.codigoProducto}
                            </div>

                            <div className="flex flex-wrap gap-1 mt-1">
                              {p.proveedor && (
                                <span className="inline-flex items-center text-[11px] bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 rounded px-2 py-0.5">
                                  {p.proveedor}
                                </span>
                              )}
                              {p.filtroVenta && (
                                <span className="inline-flex items-center text-[11px] bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-gray-200 rounded px-2 py-0.5">
                                  {p.filtroVenta}
                                </span>
                              )}
                            </div>

                            <div className="mt-2 flex items-center gap-2">
                              <span className="inline-block bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 rounded px-2 py-0.5 text-sm font-semibold shadow">
                                Q{unit.toFixed(2)}
                              </span>
                              {selected && (
                                <span className="text-[13px] text-green-700 dark:text-green-300 font-semibold">
                                  Cant. {alreadyQty}
                                </span>
                              )}
                            </div>

                            {selected && (
                              <div className="text-[11px] sm:text-xs text-muted-foreground mt-1">
                                Pulsa para modificar cantidad
                              </div>
                            )}

                            <div className="mt-auto pt-2 flex gap-2 flex-wrap">
                              <Button
                                size="sm"
                                variant={selected ? "secondary" : "outline"}
                                className="h-8 px-3"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openQty(p);
                                }}
                              >
                                {selected ? "Editar" : "Agregar"}
                              </Button>

                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-3"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setZoomImg(p.urlImg || null);
                                }}
                                disabled={!p.urlImg}
                              >
                                Ver
                              </Button>
                            </div>
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

      {/* Modal cantidad */}
      {active && (
        <ProductQuantityModal
          open={!!active}
          onOpenChange={(v) => !v && setActive(null)}
          title={active.descripcion || active.codigoProducto}
          price={active.precio ?? 0}
          initialQty={Math.max(1, existingItems?.[active.codigoProducto] ?? 1)}
          onConfirm={handleConfirmQty}
        />
      )}

      {/* Zoom imagen */}
      {zoomImg && (
        <Dialog open={!!zoomImg} onOpenChange={() => setZoomImg(null)}>
          <DialogContent className="max-w-lg p-0 bg-transparent shadow-none border-none flex flex-col items-center">
            <img
              src={zoomImg}
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
