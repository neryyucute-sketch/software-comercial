"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, RefreshCw, Eye, ShoppingCart, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type CodimisaProduct = {
  descripcion?: string;
  descripcion_corta?: string;
  codigo_producto?: string;
  codigo_fabricante?: string;
  proveedor?: string;
  categoria?: string;
  familia?: string;
  subfamilia?: string;
  presentacion?: string;
  price?: number;
  stock?: number;
  isActive?: boolean;
};

const localMock: CodimisaProduct[] = [];

export default function ProductsPage() {
  const [items, setItems] = useState<CodimisaProduct[]>(localMock);
  const [searchTerm, setSearchTerm] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar desde /api/products al montar
  useEffect(() => {
    handleSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSync = async () => {
    try {
      setSyncing(true);
      setError(null);
      const res = await fetch("/api/products", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as CodimisaProduct[];
      setItems(Array.isArray(data) && data.length ? data : localMock);
    } catch (e: any) {
      setError(e?.message ?? "No se pudo sincronizar.");
      setItems(localMock);
    } finally {
      setSyncing(false);
    }
  };

  // Búsqueda y filtrado
  const filteredProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return items.filter((p) => p.isActive !== false);

    return items.filter((p) => {
      const haystack = [
        p.descripcion ?? "",
        p.descripcion_corta ?? "",
        p.codigo_producto ?? "",
        p.codigo_fabricante ?? "",
        p.proveedor ?? "",
        p.categoria ?? "",
        p.familia ?? "",
        p.subfamilia ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q) && (p.isActive !== false);
    });
  }, [items, searchTerm]);

  // Agrupar por subfamilia y ordenar por nombre de subfamilia
  const groups = useMemo(() => {
    const map = new Map<string, CodimisaProduct[]>();
    for (const p of filteredProducts) {
      const key = (p.subfamilia || "Sin subfamilia").trim();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    // ordenar grupos por nombre; cada grupo ordenado por descripción
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, arr]) => ({
        name,
        items: arr.sort((x, y) => (x.descripcion ?? "").localeCompare(y.descripcion ?? "")),
      }));
  }, [filteredProducts]);

  const formatPrice = (price?: number) => {
    const n = price ?? 0;
    try {
      return new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" }).format(n);
    } catch {
      return `Q${n.toFixed(2)}`;
    }
  };

  const getBadgeColor = (texto?: string) => {
    if (!texto) return "bg-gray-100 text-gray-800";
    // colorcito estable por subfamilia
    const code = Array.from(texto).reduce((s, c) => s + c.charCodeAt(0), 0);
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
    return palette[code % palette.length];
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Catálogo de Productos</h1>
          <p className="text-gray-600 mt-1">{filteredProducts.length} productos</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {syncing ? "Sincronizando..." : "Sincronizar"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          placeholder="Buscar por código, descripción, proveedor, familia o subfamilia…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Carouseles por subfamilia */}
      {groups.map(({ name, items }) => (
        <SubfamilyCarousel
          key={name}
          title={name}
          items={items}
          formatPrice={formatPrice}
          badgeClass={getBadgeColor(name)}
        />
      ))}

      {/* Vacío */}
      {groups.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Search className="w-12 h-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron productos</h3>
          <p className="text-gray-600">Intenta con otro término de búsqueda</p>
        </div>
      )}
    </div>
  );
}

/* ------------------------- Subcomponentes ------------------------- */

function SubfamilyCarousel({
  title,
  items,
  formatPrice,
  badgeClass,
}: {
  title: string;
  items: CodimisaProduct[];
  formatPrice: (n?: number) => string;
  badgeClass: string;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const scrollBy = (dir: "left" | "right") => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.max(320, el.clientWidth * 0.9);
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge className={`text-xs ${badgeClass}`}>{title}</Badge>
          <span className="text-sm text-gray-500">({items.length})</span>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => scrollBy("left")} aria-label="Anterior">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => scrollBy("right")} aria-label="Siguiente">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 pr-1 [-ms-overflow-style:none] [scrollbar-width:none]"
        style={{ scrollbarWidth: "none" }}
      >
        {/* esconder scrollbars en navegadores webkit */}
        <style jsx>{`
          div::-webkit-scrollbar {
            display: none;
          }
        `}</style>

        {items.map((product, idx) => (
          <article
            key={product.codigo_producto ?? `${title}-${idx}`}
            className="min-w-[280px] max-w-[280px] snap-start"
          >
            <Card className="h-full group hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-2">
                  <CardTitle className="text-sm font-medium line-clamp-2 group-hover:text-blue-600 transition-colors">
                    {product.descripcion_corta || product.descripcion}
                  </CardTitle>
                  {product.subfamilia && (
                    <Badge className={`text-[10px] ${badgeClass}`}>{product.subfamilia}</Badge>
                  )}
                </div>
                {product.codigo_producto && (
                  <p className="text-xs text-gray-500 font-mono bg-gray-50 px-2 py-1 rounded">
                    {product.codigo_producto}
                  </p>
                )}
                {product.proveedor && (
                  <p className="text-[11px] text-blue-600 font-medium">{product.proveedor}</p>
                )}
              </CardHeader>

              <CardContent className="pb-3">
                <p className="text-sm text-gray-600 line-clamp-2 mb-3">{product.descripcion}</p>
                <div className="flex justify-between items-center">
                  <span className="text-xl font-bold text-green-600">{formatPrice(product.price)}</span>
                  <span className="text-xs text-gray-500">Stock: {product.stock ?? 0}</span>
                </div>
                {product.presentacion && (
                  <p className="text-[11px] text-gray-500 mt-1">{product.presentacion}</p>
                )}
              </CardContent>

              <CardFooter className="pt-0 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 bg-transparent"
                  onClick={() => console.log("VER:", product)}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Ver
                </Button>
              </CardFooter>
            </Card>
          </article>
        ))}
      </div>
    </section>
  );
}
