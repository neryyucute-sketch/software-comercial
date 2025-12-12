"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import type { Product, OrderItem } from "@/lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Search, Package } from "lucide-react";
import ProductQuantityModal from "./ProductQuantityModal";
import { X } from "lucide-react";

function uuidItem(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// === PickerCarousel reutilizado (idéntico a tu catálogo) ===
function PickerCarousel({
  title,
  items,
  selected,
  onSelect,
}: {
  title: string;
  items: { id: string; label: string; count?: number; badgeClass?: string }[];
  selected?: string | null; // ✅ ← antes era string | undefined
  onSelect: (id: string | null) => void;
}) {
  return (
    <div className="w-full">
      <div className="text-sm font-semibold mb-1 px-4">{title}</div>
      <div className="relative overflow-x-auto flex gap-2 px-4 pb-2 scrollbar-none">
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => onSelect(selected === it.id ? null : it.id)}
            className={[
              "whitespace-nowrap px-3 py-1.5 rounded-full border text-sm transition-all",
              selected === it.id
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground border-border",
            ].join(" ")}
          >
            {it.label}
            {typeof it.count === "number" && (
              <span className="ml-1 text-xs text-muted-foreground/70">({it.count})</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// === Modal principal ===
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

  // filtros
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [zoomImg, setZoomImg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    db.products.toArray().then((rows) => setProducts(rows));
  }, [open]);

 // === Función utilitaria para IDs ===
const asId = (v?: string | number | null) =>
  (v ?? "").toString().trim().toLowerCase().replace(/\s+/g, "_");

// === Calcular proveedores y líneas ===
const providers = useMemo(() => {
  const provsWithCount = products.reduce((acc, p) => {
    if (!p.codigoProveedor) return acc;
    const id = asId(p.codigoProveedor);
    const nombre = p.proveedor || "—";
    if (!acc[id]) acc[id] = { id, label: nombre, count: 0 };
    acc[id].count++;
    return acc;
  }, {} as Record<string, { id: string; label: string; count: number }>);
  return Object.values(provsWithCount);
}, [products]);

const lines = useMemo(() => {
  if (!selectedProvider) return [];
  const provId = asId(selectedProvider);
  const productsProv = products.filter(
    (p) => asId(p.codigoProveedor) === provId
  );

  const subs = new Map<string, { id: string; label: string; count: number }>();
  for (const p of productsProv) {
    const id = asId(p.codigoFiltroVenta);
    if (!id) continue;
    const nombre = p.filtroVenta || "—";
    const prev = subs.get(id);
    subs.set(id, { id, label: nombre, count: (prev?.count ?? 0) + 1 });
  }

  return Array.from(subs.values());
}, [products, selectedProvider]);


  // filtrado global
const filtered = useMemo(() => {
  let list = products;

  // Filtrar por proveedor
  if (selectedProvider) {
    const provId = asId(selectedProvider);
    list = list.filter((p) => asId(p.codigoProveedor) === provId);
  }

  // Filtrar por línea
  if (selectedLine) {
    const lineId = asId(selectedLine);
    list = list.filter((p) => asId(p.codigoFiltroVenta) === lineId);
  }

  // Filtrar por texto
  const s = q.trim().toLowerCase();
  if (s)
    list = list.filter(
      (p) =>
        p.codigoProducto.toLowerCase().includes(s) ||
        (p.descripcion || "").toLowerCase().includes(s)
    );

  // fallback: mostrar algo aunque no haya coincidencia (opcional)
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
        <DialogContent
          className="
            sm:max-w-5xl w-[96vw]
            p-0 overflow-hidden   /* <- cortamos scroll del content */
          "
        >
          <div className="flex flex-col h-[85dvh] md:h-[80vh]">
            {/* Header sticky con carruseles */}
            <div className="sticky top-0 z-10 bg-background/95 border-b backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <DialogHeader className="px-4 pt-4 pb-3 flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2 text-primary">
                  <Package className="w-5 h-5 text-primary" />
                  Agregar productos
                </DialogTitle>

  <Button
    size="icon"
    variant="secondary"
    onClick={() => onOpenChange(false)}
    className="
      absolute top-3 right-3 z-50
      rounded-full shadow-md
      bg-primary text-primary-foreground
      hover:bg-primary/90
      transition-transform hover:rotate-90
    "
    title="Cerrar"
  >
    <X className="w-4 h-4" />
  </Button>

              </DialogHeader>


              <div className="space-y-1 pb-2">
                <PickerCarousel
                  title="Proveedor"
                  items={providers}
                  selected={selectedProvider}
                  onSelect={(id) => {
                    setSelectedProvider(id);
                    setSelectedLine(null);
                  }}
                />
                {selectedProvider && (
                  <PickerCarousel
                    title="Línea"
                    items={lines}
                    selected={selectedLine}
                    onSelect={setSelectedLine}
                  />
                )}
              </div>

              <div className="px-4 pb-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Buscar producto…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Grid scrollable */}
            <div
                  className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4"
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
                  {filtered.length === 0 && (
                    <div className="text-sm text-muted-foreground">Sin productos disponibles.</div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map((p) => {
                  const alreadyQty = existingItems?.[p.codigoProducto] ?? 0;
                  const selected = alreadyQty > 0;
                  const unit = p.precio ?? 0;
                  
                  return (
                    <Card
                      key={p.codigoProducto}
                      className={[
                        "relative cursor-pointer border transition-all duration-150 hover:shadow-lg hover:-translate-y-[2px]",
                        selected
                          ? "border-green-500 bg-green-50/60 dark:bg-green-900/20"
                          : "border-gray-200 bg-white dark:bg-neutral-900 hover:border-primary/60",
                        "rounded-xl"
                      ].join(" ")}
                      onClick={() => openQty(p)}
                    >
                      {selected && (
                        <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1 shadow-md">
                          <Check className="w-4 h-4" />
                        </div>
                      )}

                      <div className="flex gap-3 p-3">

                        <div className="w-28 h-28 rounded-lg overflow-hidden flex flex-col items-center justify-center shadow bg-gray-100 dark:bg-neutral-800">
                          {p.urlImg ? (
                            <img
                              src={p.urlImg}
                              alt={p.descripcion || p.codigoProducto}
                              className="w-full h-full object-cover cursor-zoom-in"
                              onClick={e => {
                                e.stopPropagation();
                                setZoomImg(p.urlImg || null);
                              }}
                              title="Ver imagen"
                            />
                          ) : (
                            <div className="text-xs text-muted-foreground text-center">Sin<br />imagen</div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate text-gray-900 dark:text-gray-100">{p.descripcion}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {p.codigoProducto}
                          </div>
                          {p.proveedor && (
                            <span className="inline-block text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 rounded px-2 py-0.5 mt-1 mr-1">
                              {p.proveedor}
                            </span>
                          )}
                          {p.filtroVenta && (
                            <span className="inline-block text-xs  rounded px-2 py-0.5 mt-1">
                              {p.filtroVenta}
                            </span>
                          )}
                          <div className="mt-2">
                            <span className="inline-block bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 rounded px-2 py-0.5 text-sm font-semibold shadow">
                              Q{unit.toFixed(2)}
                            </span>
                          </div>
                          {selected && (
                            <div className="text-[16px] text-green-700 dark:text-green-300 mt-1 font-semibold">
                              Seleccionado (cant. {alreadyQty})
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}

              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mini modal de cantidad */}
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
