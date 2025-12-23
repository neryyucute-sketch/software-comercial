"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import type { OfferDef } from "@/lib/types.offers";
import type { CatalogoGeneral } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
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
type PackState = NonNullable<OfferDef["pack"]>;

type BulkPriceEntry = {
  productId: string;
  price: number;
};

const BULK_SEPARATORS = [",", ";", "\t"] as const;

const stripWrappingQuotes = (value: string): string =>
  value.replace(/^['"`]+/, "").replace(/['"`]+$/, "");

const normalizeBulkPriceValue = (raw: string): number | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const compact = trimmed.replace(/\s+/g, "");

  const dotPattern = /^\d+(?:\.\d+)?$/;
  const commaPattern = /^\d+(?:,\d+)?$/;

  if (dotPattern.test(compact)) {
    return Number(compact);
  }

  if (commaPattern.test(compact) && compact.indexOf(".") === -1) {
    return Number(compact.replace(",", "."));
  }

  const sanitized = compact.replace(/[^0-9,.-]/g, "");
  const lastComma = sanitized.lastIndexOf(",");
  const lastDot = sanitized.lastIndexOf(".");

  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      const value = Number(sanitized.replace(/\./g, "").replace(",", "."));
      return Number.isNaN(value) ? null : value;
    }
    if (lastDot > lastComma) {
      const value = Number(sanitized.replace(/,/g, ""));
      return Number.isNaN(value) ? null : value;
    }
  }

  const fallback = Number(sanitized);
  return Number.isNaN(fallback) ? null : fallback;
};

const parseBulkPriceInput = (input: string): { entries: BulkPriceEntry[]; errors: string[] } => {
  const entries: BulkPriceEntry[] = [];
  const errors: string[] = [];
  if (!input) {
    return { entries, errors };
  }

  const lines = input.split(/\r?\n/);

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return;
    const baseLine = stripWrappingQuotes(trimmedLine);
    if (!baseLine) return;

    let skuPart = "";
    let pricePart = "";

    for (const separator of BULK_SEPARATORS) {
      const sepIndex = baseLine.indexOf(separator);
      if (sepIndex !== -1) {
        skuPart = baseLine.slice(0, sepIndex);
        pricePart = baseLine.slice(sepIndex + 1);
        break;
      }
    }

    if (!pricePart) {
      const segments = baseLine.split(/\s+/);
      if (segments.length >= 2) {
        skuPart = segments[0];
        pricePart = segments.slice(1).join(" ");
      }
    }

    const sku = stripWrappingQuotes(skuPart).trim();
    const priceValue = normalizeBulkPriceValue(stripWrappingQuotes(pricePart));

    if (!sku || priceValue === null || !Number.isFinite(priceValue) || priceValue <= 0) {
      errors.push(`Línea ${index + 1}: formato inválido. Usa "SKU,precio".`);
      return;
    }

    entries.push({ productId: sku, price: priceValue });
  });

  return { entries, errors };
};

export function OfferTabProducts({
  draft,
  update,
  proveedores,
  familias,
  lineas,
}: Props) {
  const router = useRouter();
  const isPackOffer = draft.type === "combo" || draft.type === "kit";
  const isKitOffer = draft.type === "kit";
  const isComboOffer = draft.type === "combo";
  const isPriceListOffer = draft.type === "pricelist";
  const [addMode, setAddMode] = useState<"fixed" | "variable">("fixed");
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [productosMap, setProductosMap] = useState<Map<string, any>>(new Map());
  const [localCacheMap, setLocalCacheMap] = useState<Map<string, any>>(new Map());

  const bulkParse = useMemo(() => parseBulkPriceInput(bulkText), [bulkText]);

  useEffect(() => {
    if (isKitOffer && addMode !== "fixed") {
      setAddMode("fixed");
    }
  }, [isKitOffer, addMode]);

  useEffect(() => {
    if (!bulkModalOpen) {
      setBulkText("");
      setBulkError(null);
    } else {
      setBulkError(null);
    }
  }, [bulkModalOpen]);

  useEffect(() => {
    if (!bulkModalOpen) return;
    (async () => {
      try {
        const { getCachedProducts } = await import("@/services/products");
        const cache = await getCachedProducts();
        setLocalCacheMap(
          new Map(cache.map((p: any) => [p.codigoProducto ?? p.codigo, p]))
        );
      } catch {
        setLocalCacheMap(new Map());
      }
    })();
  }, [bulkModalOpen]);

  // Prefetch descripciones desde backend para los SKUs pegados que no estén en cache
  useEffect(() => {
    if (!bulkModalOpen) return;
    const codes = bulkParse.entries.map((e) => e.productId.trim()).filter(Boolean);
    const missing = codes.filter((code) =>
      !productosMap.has(code) && !localCacheMap.has(code)
    );
    if (!missing.length) return;

    let cancelled = false;
    const fetchMissing = async () => {
      try {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10931/preventa/api/v1";
        const token = await getAccessToken();
        const headers: HeadersInit = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        };

        const requests = missing.slice(0, 20).map(async (code) => {
          const url = `${API_BASE}/catalogo-productos?q=${encodeURIComponent(code)}&page=0&size=1`;
          const res = await fetch(url, { headers });
          if (!res.ok) return null;
          const data = await res.json();
          const item = data?.content?.[0];
          if (!item) return null;
          const codigo = item.codigoProducto ?? item.codigo;
          return codigo ? { codigo, item } : null;
        });

        const results = await Promise.all(requests);
        if (cancelled) return;

        setLocalCacheMap((prev) => {
          const next = new Map(prev);
          results.forEach((r) => {
            if (r) next.set(r.codigo, r.item);
          });
          return next;
        });

        setProductosMap((prev) => {
          const next = new Map(prev);
          results.forEach((r) => {
            if (r && !next.has(r.codigo)) next.set(r.codigo, r.item);
          });
          return next;
        });
      } catch (err) {
        // Silencioso para no bloquear UI
      }
    };

    fetchMissing();
    return () => {
      cancelled = true;
    };
  }, [bulkModalOpen, bulkParse.entries, productosMap, localCacheMap]);

  const ensurePack = (pack?: PackState): PackState => ({
    precioFijo: pack?.precioFijo ?? 0,
    cantidadTotalProductos: pack?.cantidadTotalProductos ?? 1,
    itemsFijos: pack?.itemsFijos ?? [],
    itemsVariablesPermitidos: pack?.itemsVariablesPermitidos ?? [],
  });

  const patchPack = (mutator: (current: PackState) => PackState) => {
    update((d) => {
      const current = ensurePack(d.pack as PackState | undefined);
      let nextPack = mutator(current);
      if (d.type === "kit") {
        const totalFijos = nextPack.itemsFijos.reduce(
          (acc, item) => acc + Number(item.unidades ?? 0),
          0
        );
        nextPack = {
          ...nextPack,
          itemsVariablesPermitidos: [],
          cantidadTotalProductos: totalFijos,
        };
      }
      return {
        ...d,
        pack: nextPack,
      };
    });
  };

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
  if (!isPriceListOffer && proveedores.length === 0 && familias.length === 0 && lineas.length === 0) {
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

  const priceListProducts = draft.priceList?.products ?? [];
  const codigosProductoSeleccionados: string[] = isPriceListOffer
    ? priceListProducts.map((item) => item.productId)
    : (draft.products ?? []);
  const packFixedItems = draft.pack?.itemsFijos ?? [];
  const packVariableItems = isKitOffer ? [] : (draft.pack?.itemsVariablesPermitidos ?? []);
  const packFixedUnits = packFixedItems.reduce(
    (acc, item) => acc + Number(item.unidades ?? 0),
    0
  );
  const packTotalUnits = isKitOffer ? packFixedUnits : (draft.pack?.cantidadTotalProductos ?? 0);
  const packPendingUnits = isComboOffer
    ? Math.max(0, packTotalUnits - packFixedUnits)
    : 0;
  const packProductIds = useMemo(() => {
    const fixed = packFixedItems.map((item) => item.productoId).filter(Boolean);
    const variable = packVariableItems.map((item) => item.productoId).filter(Boolean);
    return [...fixed, ...variable];
  }, [packFixedItems, packVariableItems]);
  const referencedProductIds = useMemo(() => {
    return isPackOffer ? packProductIds : codigosProductoSeleccionados;
  }, [isPackOffer, packProductIds, codigosProductoSeleccionados]);

  const filterActiveProducts = useCallback((list: any[] = []) => {
    return list.filter((p) => {
      const rawStatus = p.status ?? p.estado;
      if (rawStatus === undefined || rawStatus === null) return true;
      const normalized = String(rawStatus).trim().toLowerCase();
      if (!normalized) return true;
      if (["inactivo", "inactive", "0", "false", "no"].includes(normalized)) return false;
      return true;
    });
  }, []);

  const formatPrice = useCallback((value?: number | null) => {
    if (value === undefined || value === null || Number.isNaN(Number(value))) {
      return "—";
    }
    return Number(value).toLocaleString("es-GT", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, []);
  
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
          const rawItems = data.content ?? [];
          const items = filterActiveProducts(rawItems);
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
  }, [queryProducto, router, filterActiveProducts]);

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
      const rawItems = data.content ?? [];
      const items = filterActiveProducts(rawItems);
      
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
  }, [page, totalPages, hasMore, loadingProductos, queryProducto, router, filterActiveProducts]);

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

  useEffect(() => {
    if (!isPriceListOffer || priceListProducts.length === 0) return;
    setProductosMap((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const item of priceListProducts) {
        if (next.has(item.productId)) continue;
        next.set(item.productId, {
          codigoProducto: item.productId,
          descripcion: item.description ?? item.productId,
          precio: item.basePrice ?? item.price ?? undefined,
        });
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [isPriceListOffer, priceListProducts]);
  
  const handleAddProducto = (producto: any) => {
    const codigo = producto?.codigoProducto ?? producto?.codigo;
    if (!codigo) return;

    setProductosMap((prev) => {
      const next = new Map(prev);
      next.set(codigo, producto);
      return next;
    });

    if (isPriceListOffer) {
      update((d) => {
        const currentList = d.priceList?.products ?? [];
        if (currentList.some((item) => item.productId === codigo)) {
          return d;
        }

        const rawPrice =
          typeof producto?.precio === "number"
            ? producto.precio
            : typeof producto?.precioLista === "number"
            ? producto.precioLista
            : typeof producto?.precioUnitario === "number"
            ? producto.precioUnitario
            : undefined;
        const numericPrice =
          rawPrice !== undefined && !Number.isNaN(Number(rawPrice))
            ? Number(rawPrice)
            : undefined;
        const nextList = [
          ...currentList,
          {
            productId: codigo,
            price: numericPrice,
            description: producto?.descripcion ?? producto?.nombre ?? undefined,
            basePrice: numericPrice,
          },
        ];
        const nextProducts = new Set(d.products ?? []);
        nextProducts.add(codigo);
        return {
          ...d,
          products: Array.from(nextProducts),
          priceList: { products: nextList },
        };
      });
      return;
    }

    update((d) => {
      const actuales = d.products ?? [];
      if (actuales.includes(codigo)) {
        return d;
      }
      return {
        ...d,
        products: [...actuales, codigo],
      };
    });
  };

  const handleApplyBulkPrices = async () => {
    const parsed = parseBulkPriceInput(bulkText);
    if (!parsed.entries.length) {
      setBulkError(parsed.errors[0] ?? "No se detectaron pares SKU, precio.");
      return;
    }
    if (parsed.errors.length) {
      setBulkError(parsed.errors[0]);
      return;
    }

    setBulkError(null);

    // Fallback a cache local para obtener descripción/basePrice cuando vienen por pegado
    let localCache: any[] = [];
    let localMap = new Map<string, any>();
    try {
      const { getCachedProducts } = await import("@/services/products");
      localCache = await getCachedProducts();
      localMap = new Map(
        localCache.map((p: any) => [p.codigoProducto ?? p.codigo, p])
      );
    } catch {}

    let createdCount = 0;
    let updatedCount = 0;
    const toRemember: Array<{ code: string; info: any }> = [];

    update((d) => {
      const currentList = d.priceList?.products ?? [];
      const map = new Map(currentList.map((item) => [item.productId.trim(), item]));
      const nextProductsSet = new Set(d.products ?? []);
      const seenInBatch = new Set<string>();
      let localCreated = 0;
      let localUpdated = 0;

      parsed.entries.forEach((entry) => {
        const key = entry.productId.trim();
        if (!key) return;

        const existing = map.get(key);
        const duplicate = seenInBatch.has(key);

        if (existing) {
          if (!duplicate) {
            localUpdated += 1;
          }
          map.set(key, { ...existing, price: entry.price });
        } else {
          if (!duplicate) {
            localCreated += 1;
          }
          const productInfo = productosMap.get(key) ?? localCacheMap.get(key) ?? localMap.get(key);
          if (productInfo) {
            toRemember.push({ code: key, info: productInfo });
          } else {
            toRemember.push({ code: key, info: { codigoProducto: key, descripcion: key } });
          }
          map.set(key, {
            productId: key,
            price: entry.price,
            description: productInfo?.descripcion ?? productInfo?.nombre ?? undefined,
            basePrice:
              typeof productInfo?.precio === "number"
                ? Number(productInfo.precio)
                : undefined,
          });
        }

        seenInBatch.add(key);
        nextProductsSet.add(key);
      });

      createdCount = localCreated;
      updatedCount = localUpdated;

      return {
        ...d,
        products: Array.from(nextProductsSet),
        priceList: { products: Array.from(map.values()) },
      };
    });

    setBulkModalOpen(false);
    setBulkText("");

    // Asegura que productosMap tenga la descripción/base para los pegados
    if (toRemember.length) {
      setProductosMap((prev) => {
        const next = new Map(prev);
        toRemember.forEach(({ code, info }) => {
          if (!next.has(code)) {
            next.set(code, info ?? { codigoProducto: code, descripcion: code });
          }
        });
        return next;
      });
    }

    toast({
      title: "Lista negociada actualizada",
      description: `Se agregaron ${createdCount} y se actualizaron ${updatedCount}.`,
    });
  };

  const rememberProduct = (producto: any) => {
    const codigo = producto.codigoProducto ?? producto.codigo;
    if (!codigo) return;
    setProductosMap((prev) => {
      const next = new Map(prev);
      if (!next.has(codigo)) {
        next.set(codigo, producto);
      }
      return next;
    });
  };

  const handlePriceListPriceChange = (productId: string, rawValue: string) => {
    if (!isPriceListOffer) return;
    update((d) => {
      const currentList = d.priceList?.products ?? [];
      const nextList = currentList.map((item) => {
        if (item.productId !== productId) return item;
        if (rawValue === "") {
          return { ...item, price: undefined };
        }
        const parsed = Number(rawValue);
        if (Number.isNaN(parsed)) {
          return item;
        }
        return { ...item, price: parsed };
      });
      return {
        ...d,
        priceList: { products: nextList },
      };
    });
  };

  const handleRemovePriceListProduct = (productId: string) => {
    update((d) => {
      const currentList = d.priceList?.products ?? [];
      const nextList = currentList.filter((item) => item.productId !== productId);
      const remainingProducts = (d.products ?? []).filter((code) => code !== productId);
      return {
        ...d,
        products: remainingProducts,
        priceList: nextList.length ? { products: nextList } : undefined,
      };
    });
  };

  const handleAddFixedProduct = (producto: any) => {
    const codigo = producto.codigoProducto ?? producto.codigo;
    if (!codigo) return;
    rememberProduct(producto);
    patchPack((current) => {
      if (current.itemsFijos.some((it) => it.productoId === codigo)) {
        return current;
      }
      return {
        ...current,
        itemsVariablesPermitidos: current.itemsVariablesPermitidos.filter(
          (it) => it.productoId !== codigo
        ),
        itemsFijos: [
          ...current.itemsFijos,
          {
            productoId: codigo,
            unidades: 1,
            descripcion: producto.descripcion ?? producto.nombre ?? codigo,
          },
        ],
      };
    });
  };

  const handleAddVariableProduct = (producto: any) => {
    if (isKitOffer) return;
    const codigo = producto.codigoProducto ?? producto.codigo;
    if (!codigo) return;
    rememberProduct(producto);
    patchPack((current) => {
      if (current.itemsVariablesPermitidos.some((it) => it.productoId === codigo)) {
        return current;
      }
      return {
        ...current,
        itemsVariablesPermitidos: [
          ...current.itemsVariablesPermitidos,
          {
            productoId: codigo,
            descripcion: producto.descripcion ?? producto.nombre ?? codigo,
          },
        ],
      };
    });
  };

  const handleUpdateFixedQty = (productId: string, raw: number) => {
    const unidades = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1;
    patchPack((current) => ({
      ...current,
      itemsFijos: current.itemsFijos.map((it) =>
        it.productoId === productId ? { ...it, unidades } : it
      ),
    }));
  };

  const handleRemoveFixedProduct = (productId: string) => {
    patchPack((current) => ({
      ...current,
      itemsFijos: current.itemsFijos.filter((it) => it.productoId !== productId),
    }));
  };

  const handleRemoveVariableProduct = (productId: string) => {
    if (isKitOffer) return;
    patchPack((current) => ({
      ...current,
      itemsVariablesPermitidos: current.itemsVariablesPermitidos.filter(
        (it) => it.productoId !== productId
      ),
    }));
  };

  useEffect(() => {
    if (productosRemote.length === 0) return;
    setProductosMap((prev) => {
      const next = new Map(prev);
      productosRemote.forEach((p: any) => {
        const code = p.codigoProducto ?? p.codigo;
        if (!next.has(code)) next.set(code, p);
      });
      return next;
    });
  }, [productosRemote]);

  useEffect(() => {
    if (referencedProductIds.length === 0) return;
    const faltantes = referencedProductIds.filter((code) => code && !productosMap.has(code));
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

        const requests = faltantes.map(async (code) => {
          const url = `${API_BASE}/catalogo-productos?q=${encodeURIComponent(code)}&page=0&size=1`;
          const res = await fetch(url, { headers, signal: controller.signal });
          if (!res.ok) return null;
          const data = await res.json();
          const item = data.content?.[0];
          if (!item) return null;
          const codigo = item.codigoProducto ?? item.codigo;
          return codigo ? { codigo, item } : null;
        });

        const resolved = await Promise.all(requests);
        setProductosMap((prev) => {
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
  }, [referencedProductIds, productosMap]);

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

  if (isPackOffer) {
    const packLabel = draft.type === "combo" ? "combo" : "kit";
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-700">
            Productos del {packLabel}
          </div>
          <p className="text-xs text-slate-600 mt-1">
            {isKitOffer
              ? "Los kits se componen únicamente de productos fijos. La cantidad total se calcula con la suma de sus unidades."
              : "Define qué SKUs son fijos y cuáles quedan habilitados como variables. Las unidades fijas no pueden exceder el cupo total."}
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <label className="block text-sm font-semibold text-slate-700">
                Buscar productos
              </label>
              {isComboOffer ? (
                <div className="inline-flex rounded-full border border-slate-200 bg-slate-100 text-[11px]">
                  {([
                    ["fixed", "Items fijos"],
                    ["variable", "Variables"],
                  ] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setAddMode(mode)}
                      className={cn(
                        "px-3 py-1 font-semibold rounded-full transition-colors",
                        addMode === mode
                          ? "bg-amber-600 text-white"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="rounded-full bg-amber-600 px-3 py-1 text-[11px] font-semibold text-white">
                  Solo productos fijos
                </span>
              )}
            </div>
            <Input
              value={queryProducto}
              onChange={(e) => setQueryProducto(e.target.value)}
              placeholder="Escribe al menos 2 caracteres…"
              className="text-sm"
            />

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
                const yaFijo = packFixedItems.some((it) => it.productoId === codigo);
                const yaVariable = isKitOffer
                  ? false
                  : packVariableItems.some((it) => it.productoId === codigo);
                const yaEnPack = yaFijo || yaVariable;

                return (
                  <div
                    key={codigo}
                    className={cn(
                      "flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 last:border-0",
                      yaFijo
                        ? "bg-amber-50"
                        : yaVariable
                        ? "bg-emerald-50"
                        : "hover:bg-slate-100"
                    )}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="font-semibold text-slate-800">{codigo}</span>
                      <span className="ml-2 text-slate-600">— {desc}</span>
                    </span>
                    {yaEnPack ? (
                      <span className={cn(
                        "flex-shrink-0 px-3 py-1 text-xs rounded-md font-semibold",
                        yaFijo
                          ? "bg-amber-600 text-white"
                          : "bg-emerald-600 text-white"
                      )}>
                        {yaFijo ? "Fijo" : "Variable"}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          isKitOffer || addMode === "fixed"
                            ? handleAddFixedProduct(p)
                            : handleAddVariableProduct(p)
                        }
                        className="flex-shrink-0 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md font-medium"
                      >
                        {isKitOffer
                          ? "Agregar fijo"
                          : addMode === "fixed"
                          ? "Agregar fijo"
                          : "Permitir"}
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

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <div className="font-semibold mb-2">Resumen del {packLabel}</div>
              <div className="flex flex-wrap gap-4 text-xs text-slate-600">
                <span>
                  Unidades fijas: {packFixedUnits}/{packTotalUnits}
                </span>
                {isComboOffer ? (
                  <>
                    <span>Pendientes por definir: {packPendingUnits}</span>
                    <span>Variables permitidos: {packVariableItems.length}</span>
                  </>
                ) : (
                  <span>Los kits no admiten variables</span>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-700 mb-3">
                Items fijos ({packFixedItems.length})
              </div>

              {packFixedItems.length === 0 ? (
                <div className="h-48 flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-400 text-sm">
                  Sin productos fijos aún
                </div>
              ) : (
                <div className="h-48 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                  {packFixedItems.map((item) => {
                    const producto = productosMap.get(item.productoId);
                    const desc = producto?.descripcion ?? producto?.nombre ?? item.descripcion ?? "";
                    return (
                      <div
                        key={item.productoId}
                        className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-amber-900">{item.productoId}</div>
                          {desc && <div className="text-slate-700 mt-0.5 text-[13px]">{desc}</div>}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] uppercase text-slate-500">
                          <span>Cant.</span>
                          <Input
                            type="number"
                            min="1"
                            className="w-20"
                            value={item.unidades ?? 1}
                            onChange={(e) =>
                              handleUpdateFixedQty(item.productoId, Number(e.target.value))
                            }
                          />
                        </div>
                        <button
                          type="button"
                          className="flex-shrink-0 text-red-600 hover:text-red-800 font-bold text-lg leading-none"
                          onClick={() => handleRemoveFixedProduct(item.productoId)}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {isComboOffer && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-700 mb-3">
                  Items variables permitidos ({packVariableItems.length})
                </div>

                {packVariableItems.length === 0 ? (
                  <div className="h-40 flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-400 text-sm">
                    Sin variables disponibles todavía
                  </div>
                ) : (
                  <div className="h-40 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                    {packVariableItems.map((item) => {
                      const producto = productosMap.get(item.productoId);
                      const desc = producto?.descripcion ?? producto?.nombre ?? item.descripcion ?? "";
                      return (
                        <div
                          key={item.productoId}
                          className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-emerald-900">{item.productoId}</div>
                            {desc && <div className="text-slate-700 mt-0.5 text-[13px]">{desc}</div>}
                          </div>
                          <button
                            type="button"
                            className="flex-shrink-0 text-red-600 hover:text-red-800 font-bold text-lg leading-none"
                            onClick={() => handleRemoveVariableProduct(item.productoId)}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isPriceListOffer) {
    const bulkDerivedError = bulkError ?? bulkParse.errors[0] ?? null;
    const previewEntries = bulkParse.entries.slice(0, 5);
    const describe = (code: string) => {
      const p = productosMap.get(code) ?? localCacheMap.get(code);
      const desc = p?.descripcion ?? p?.nombre ?? p?.description;
      if (!desc) return undefined;
      const trimmedDesc = String(desc).trim();
      if (!trimmedDesc) return undefined;
      if (trimmedDesc === String(code).trim()) return undefined;
      return trimmedDesc;
    };
    const previewCount = bulkParse.entries.length;

    return (
      <>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 lg:col-span-2">
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

            <div className="h-72 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 text-xs">
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
                const yaSeleccionado = priceListProducts.some((item) => item.productId === codigo);
                const basePrice =
                  typeof p?.precio === "number"
                    ? Number(p.precio)
                    : typeof p?.precioLista === "number"
                    ? Number(p.precioLista)
                    : typeof p?.precioUnitario === "number"
                    ? Number(p.precioUnitario)
                    : undefined;

                return (
                  <div
                    key={codigo}
                    className={cn(
                      "flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 last:border-0",
                      yaSeleccionado ? "bg-emerald-50" : "hover:bg-slate-100"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-800">{codigo}</div>
                      <div className="text-xs text-slate-600 truncate">{desc}</div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Precio base: {formatPrice(basePrice)}
                      </div>
                    </div>
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

            <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:col-span-3">
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="text-sm font-semibold text-slate-700">
                Productos negociados ({priceListProducts.length})
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">
                  Define el precio final que verán los clientes asignados.
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkModalOpen(true)}
                >
                  Pegar lista
                </Button>
              </div>
            </div>

            {priceListProducts.length === 0 ? (
              <div className="h-72 flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-400 text-sm">
                Aún no has agregado productos.
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Producto</th>
                      <th className="px-3 py-2 text-left">Precio base</th>
                      <th className="px-3 py-2 text-left">Precio negociado</th>
                      <th className="px-3 py-2 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {priceListProducts.map((item) => {
                      const producto = productosMap.get(item.productId) ?? null;
                      const descripcion = item.description ?? producto?.descripcion ?? producto?.nombre ?? "";
                      const basePrice =
                        item.basePrice ??
                        (typeof producto?.precio === "number" ? Number(producto.precio) : undefined);
                      const negotiatedValue = typeof item.price === "number" ? item.price : "";

                      return (
                        <tr key={item.productId} className="align-top">
                          <td className="px-3 py-3">
                            <div className="font-semibold text-slate-900">{item.productId}</div>
                            {descripcion && (
                              <div className="text-xs text-slate-500 mt-1">{descripcion}</div>
                            )}
                          </td>
                          <td className="px-3 py-3 text-sm text-slate-600">
                            {formatPrice(basePrice)}
                          </td>
                          <td className="px-3 py-3">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={negotiatedValue}
                              onChange={(e) => handlePriceListPriceChange(item.productId, e.target.value)}
                              className="text-sm"
                            />
                          </td>
                          <td className="px-3 py-3 text-right">
                            <button
                              type="button"
                              className="text-red-600 hover:text-red-800 font-semibold"
                              onClick={() => handleRemovePriceListProduct(item.productId)}
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        </div>

        <Dialog open={bulkModalOpen} onOpenChange={setBulkModalOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Pegar lista de precios</DialogTitle>
              <DialogDescription>
                Pega líneas con el formato <span className="font-mono text-xs">SKU,precio</span>.
                También se aceptan separadores por tabulación o espacio.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <Textarea
                value={bulkText}
                onChange={(event) => setBulkText(event.target.value)}
                placeholder={`Ejemplo:\nSKU001, 125.50\nSKU002, 98.75`}
                className="min-h-[160px] text-sm"
              />

              {bulkDerivedError ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {bulkDerivedError}
                </div>
              ) : (
                bulkText && (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                    {previewCount === 1
                      ? "Se detectó 1 producto listo para importar."
                      : `Se detectaron ${previewCount} productos listos para importar.`}
                    {previewEntries.length > 0 && (
                      <ul className="mt-2 space-y-1 text-emerald-800">
                        {previewEntries.map((entry) => {
                          const desc = describe(entry.productId);
                          return (
                            <li key={entry.productId} className="font-mono text-[11px]">
                              {entry.productId}
                              {desc ? ` — ${desc}` : ""} → {entry.price.toFixed(2)}
                            </li>
                          );
                        })}
                        {previewCount > previewEntries.length && (
                          <li className="text-[11px] text-emerald-600">
                            … y {previewCount - previewEntries.length} más
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                )
              )}
            </div>

            <DialogFooter className="mt-4 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setBulkModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  await handleApplyBulkPrices();
                }}
                disabled={!bulkText.trim() || Boolean(bulkDerivedError)}
              >
                Aplicar cambios
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

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
                    key={codigo}
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
                    key={p.id || p.codigo}
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