"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { Search, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Product } from "@/lib/types";
import { useProducts } from "@/contexts/ProductsContext";
import Image from "next/image";

type ProductDetail = { imageUrl?: string; descripcion_larga?: string };

// helper para asegurar ids consistentes como string
const asId = (v: any) => String(v ?? "").trim();

export default function ProductsPage() {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  const [providers, setProviders] = useState<
    { id: string; nombre: string; count?: number }[]
  >([]);
  const [lines, setLines] = useState<
    { id: string; nombre: string; count?: number }[]
  >([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);

  const { products, syncing, error, syncProducts, loadProductsFromDB } = useProducts();

  const selectedProvName = useMemo(
    () => providers.find((p) => asId(p.id) === asId(selectedProvider))?.nombre,
    [providers, selectedProvider]
  );

  useEffect(() => {
    loadProductsFromDB() // 🔑 función expuesta desde el context que lee IndexedDB y setea products
  }, [])


// 🚀 Calcular proveedores y líneas desde products
useEffect(() => {
  // Proveedores
  const provsWithCount = products.reduce((acc, p) => {
    if (!p.codigoProveedor) return acc;
    const id = asId(p.codigoProveedor);
    const nombre = p.proveedor || "—";
    if (!acc[id]) acc[id] = { id, nombre, count: 0 };
    acc[id].count++;
    return acc;
  }, {} as Record<string, { id: string; nombre: string; count: number }>);

  setProviders(Object.values(provsWithCount));

  // Líneas
  if (!selectedProvider) {
    setLines([]);
    return;
  }

  const provId = asId(selectedProvider);
  const productsProv = products.filter(p => asId(p.codigoProveedor) === provId);

  const subs = new Map<string, { id: string; nombre: string; count: number }>();
  for (const p of productsProv) {
    const id = asId(p.codigoFiltroVenta);
    if (!id) continue;
    const nombre = p.filtroVenta || "—";
    const prev = subs.get(id);
    subs.set(id, { id, nombre, count: (prev?.count ?? 0) + 1 });
  }

  setLines(Array.from(subs.values()));
}, [products, selectedProvider]);

// 🚀 Filtrar productos
useEffect(() => {
  let base = products;

  if (searchTerm) {
    base = base.filter(p =>
      (p.descripcion ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.codigoProducto ?? "").toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  if (selectedProvider) {
    base = base.filter(p => asId(p.codigoProveedor) === asId(selectedProvider));
  }

  if (selectedLine) {
    base = base.filter(p => asId(p.codigoFiltroVenta) === asId(selectedLine));
  }
  setFilteredProducts(base);
}, [products, searchTerm, selectedProvider, selectedLine]);

  const formatPrice = (price?: number) => {
    const n = price ?? 0;
    try {
      return new Intl.NumberFormat("es-GT", {
        style: "currency",
        currency: "GTQ",
      }).format(n);
    } catch {
      return `Q${n.toFixed(2)}`;
    }
  };

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

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Catálogo de Productos
          </h1>
          <p className="text-gray-600 mt-1">
            {filteredProducts.length} productos
            {selectedProvider ? ` • ${selectedProvName}` : ""}
            {selectedLine
              ? ` → ${
                  lines.find((l) => asId(l.id) === asId(selectedLine))?.nombre ??
                  "—"
                }`
              : ""}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={syncProducts}
          disabled={syncing}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          {syncing ? "Sincronizando..." : "Sincronizar"}
        </Button>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {/* Carrusel de Proveedor */}
      <PickerCarousel
        title="Proveedor"
        items={providers.map((p) => ({
          id: p.id,
          label: p.nombre,
          count: p.count,
        }))}
        selected={selectedProvider}
        onSelect={(val) => {
          const next =
            asId(val) === asId(selectedProvider) ? null : asId(val);
          setSelectedProvider(next);
          setSelectedLine(null);
        }}
        badgeClass={colorPill(selectedProvider || "Proveedor")}
      />

      {/* Carrusel de Línea */}
      {selectedProvider && (
        <PickerCarousel
          title="Línea de producto"
          items={lines.map((l) => ({
            id: l.id,
            label: l.nombre,
            count: l.count,
          }))}
          selected={selectedLine}
          onSelect={(val) =>
            setSelectedLine(asId(val) === asId(selectedLine) ? null : asId(val))
          }
          badgeClass={colorPill(selectedLine || "Linea")}
        />
      )}

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          placeholder="Buscar por código, descripción…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Productos */}
      {!selectedProvider || selectedLine === null ? (
        <div className="text-center text-gray-600 py-10 border rounded-md">
          Selecciona un <span className="font-semibold">proveedor</span> y una{" "}
          <span className="font-semibold">línea</span> para ver productos.
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Search className="w-12 h-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No se encontraron productos
          </h3>
          <p className="text-gray-600">Ajusta el término de búsqueda</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts
            .sort((a, b) =>
              (a.descripcion ?? "").localeCompare(b.descripcion ?? "")
            )
            .map((product, idx) => {
              const isExpanded = expandedProduct === product.codigoProducto;

              return (
                <Card
                  key={product.codigoProducto ?? String(idx)}
                  className="group hover:shadow-lg transition-shadow"
                >
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start gap-2">
                      <CardTitle className="text-sm font-medium line-clamp-2 group-hover:text-blue-600 transition-colors">
                        {product.descripcionCorta || product.descripcion}
                      </CardTitle>

                      <Badge
                        className={`text-[10px] ${colorPill(
                          product.codigoSubfamilia || "—"
                        )}`}
                      >
                        {product.subfamilia || "—"}
                      </Badge>
                    </div>

                    {product.codigoProducto && (
                      <p className="text-xs text-gray-500 font-mono bg-gray-50 px-2 py-1 rounded">
                        {product.codigoProducto}
                      </p>
                    )}

                    {product.codigoProveedor && (
                      <p className="text-[11px] text-blue-600 font-medium">
                        {
                          providers.find(
                            (p) =>
                              asId(p.id) === asId(product.codigoProveedor)
                          )?.nombre
                        }
                      </p>
                    )}
                  </CardHeader>

                  <CardContent className="pb-3">
                    {/* Imagen expandible */}
                    <div
                      className={`flex justify-center mb-3 bg-gray-50 rounded cursor-pointer transition-all duration-300
              ${
                expandedProduct === product.codigoProducto
                  ? "h-[500px]"
                  : "h-32"
              }`}
                      onClick={() =>
                        setExpandedProduct(
                          isExpanded ? null : product.codigoProducto
                        )
                      }
                    >
                      <Image
                        src={product.urlImg || "/logo_codimisa.jpg"}
                        alt={product.descripcion || "Imagen del producto"}
                        width={200}
                        height={200}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src =
                            "/logo_codimisa.jpg";
                        }}
                      />
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-xl font-bold text-green-600">
                        {formatPrice(product.precio)}
                      </span>
                      <span className="text-xs text-gray-500">
                        Stock: {product.inventario ?? 0}
                      </span>
                    </div>

                    {product.presentacion && (
                      <p className="text-[11px] text-gray-500 mt-1">
                        {product.presentacion}
                      </p>
                    )}
                  </CardContent>

                  <CardFooter className="pt-0 gap-2"></CardFooter>
                </Card>
              );
            })}
        </div>
      )}
    </div>
  );
}

/* ---------- Carrusel ---------- */
function PickerCarousel({
  title,
  items,
  selected,
  onSelect,
  badgeClass,
}: {
  title: string;
  items: { id: string; label: string; count?: number }[];
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge
            className={`text-xs font-medium px-2 py-1 rounded-md ${
              badgeClass || "bg-gray-100 text-gray-800"
            }`}
          >
            {title}
          </Badge>
          <span className="text-xs text-gray-500">({items.length})</span>
        </div>
        <div className="flex gap-1">
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
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 pr-1 scrollbar-hide"
      >
        {items.map(({ id, label, count }) => {
          const isActive = selected === id;
          return (
            <div
              key={id}
              onClick={() => onSelect(id)}
              className={`min-w-[140px] cursor-pointer snap-start rounded-xl p-3 shadow-sm border transition-all
                ${
                  isActive
                    ? "bg-blue-600 text-white border-blue-600 shadow-md scale-105"
                    : "bg-white text-gray-800 border-gray-200 hover:shadow-md hover:bg-gray-50"
                }`}
            >
              <div className="text-sm font-semibold line-clamp-1">{label}</div>
              {typeof count === "number" && (
                <div
                  className={`text-xs mt-1 ${
                    isActive ? "text-blue-100" : "text-gray-500"
                  }`}
                >
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
