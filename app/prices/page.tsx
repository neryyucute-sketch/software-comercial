"use client"

import { Fragment, useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"
import { PriceListForm } from "@/components/price-list-form"
import { useAuth } from "@/contexts/AuthContext"
import { usePreventa } from "@/contexts/preventa-context"
import type { PriceList, Product } from "@/lib/types"
import { getAccessToken } from "@/services/auth"
import { ClipboardPaste, Eye, EyeOff, Filter, Plus, RefreshCw, Settings2, Shield } from "lucide-react"

const productKey = (product: Product | any) => product.codigoProducto || product.idt || product.id || product.codigo
const productName = (product: Product | any) =>
  product.descripcion || product.descripcionCorta || product.name || product.codigoProducto || "Producto"
const normalizeStr = (val: any) => (typeof val === "string" ? val.trim() : val ? String(val) : "")
const productProvider = (product: Product | any) =>
  normalizeStr(product.codigoProveedor || product.proveedor) || "Sin proveedor"
const productProviderLabel = (product: Product | any) =>
  normalizeStr(product.proveedor || product.codigoProveedor) || "Sin proveedor"
const productLine = (product: Product | any) =>
  normalizeStr(
    product.codigoFiltroVenta ||
      product.filtroVenta ||
      product.codigoLinea ||
      product.linea ||
      product.codigoSubfamilia ||
      product.subfamilia ||
      product.codigoFamilia ||
      product.familia,
  ) || "Sin línea"
const productLineLabel = (product: Product | any) =>
  normalizeStr(
    product.filtroVenta ||
      product.codigoFiltroVenta ||
      product.linea ||
      product.codigoLinea ||
      product.subfamilia ||
      product.codigoSubfamilia ||
      product.familia ||
      product.codigoFamilia,
  ) || "Sin línea"
const productBasePrice = (product: Product | any) => product.precio ?? product.price ?? 0
const getPriceListCode = (tier: number) => (tier === 0 ? "default" : String(tier))

export default function PricesPage() {
  const { priceLists, products, updatePriceList, addPriceList, loadPriceListsOnline } = usePreventa()
  const { hasPermission } = useAuth()

  const [searchTerm, setSearchTerm] = useState("")
  const [lineFilter, setLineFilter] = useState("")
  const [showAllProducts, setShowAllProducts] = useState(false)
  const [lineSearch, setLineSearch] = useState("")
  const [openLineSelect, setOpenLineSelect] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState("E01")
  const [targetListId, setTargetListId] = useState<string | null>(null)
  const [applyToVariations, setApplyToVariations] = useState(false)
  const [hiddenLines, setHiddenLines] = useState<string[]>([])
  const [bulkText, setBulkText] = useState("")
  const priceTableReadOnly = true
  const [drafts, setDrafts] = useState<Record<string, Record<string, number>>>({})
  const [showForm, setShowForm] = useState(false)
  const [editingPriceList, setEditingPriceList] = useState<PriceList | null>(null)
  const [isGeneratingStructure, setIsGeneratingStructure] = useState(false)
  const [remoteProducts, setRemoteProducts] = useState<Product[]>([])
  const [remoteLoaded, setRemoteLoaded] = useState(false)
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [productsCache, setProductsCache] = useState<Record<string, Product[]>>({})
  const [isSyncingLists, setIsSyncingLists] = useState(false)
  const [catalogLines, setCatalogLines] = useState<{ codigo: string; descripcion: string; codigoPadre?: string }[]>([])

  const hasProductFilter = useMemo(
    () => searchTerm.trim().length >= 2 || Boolean(lineFilter),
    [searchTerm, lineFilter],
  )

  const canRead = hasPermission("prices", "read")
  const canCreate = hasPermission("prices", "create")
  const canUpdate = hasPermission("prices", "update")

  const activeProducts = useMemo(() => {
    // Si el usuario quiere ver todos los productos, ignora el filtro
    if (showAllProducts) {
      const source = remoteLoaded ? remoteProducts : products;
      return source.filter((p) => p.isActive !== false);
    }
    if (!hasProductFilter) return [];
    const source = remoteLoaded ? remoteProducts : products;
    return source.filter((p) => p.isActive !== false);
  }, [products, remoteProducts, remoteLoaded, hasProductFilter, showAllProducts]);

  useEffect(() => {
    let ignore = false;
    const fetchRemoteProducts = async () => {
      if (!selectedCompany) return;
      // Si el usuario quiere ver todos los productos, consulta todos
      const fetchAll = showAllProducts;
      if (!hasProductFilter && !fetchAll) {
        setRemoteLoaded(false);
        setRemoteProducts([]);
        return;
      }
      setRemoteLoaded(false);
      setRemoteProducts([]);
      setIsLoadingProducts(true);
      const cacheKey = fetchAll ? `${selectedCompany}|ALL` : `${selectedCompany}|${lineFilter || "all"}`;
      if (productsCache[cacheKey]) {
        setRemoteProducts(productsCache[cacheKey]);
        setRemoteLoaded(true);
        setIsLoadingProducts(false);
        return;
      }
      try {
        const token = await getAccessToken();
        const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";
        let page = 0;
        let totalPages = 1;
        const collected: Product[] = [];
        while (page < totalPages) {
          const q = searchTerm.trim();
          let url = `${API_BASE}/catalogo-productos?codigoEmpresa=${encodeURIComponent(selectedCompany)}`;
          if (!fetchAll && lineFilter) url += `&linea=${encodeURIComponent(lineFilter)}`;
          if (q) url += `&q=${encodeURIComponent(q)}`;
          url += `&page=${page}&size=100`;
          const res = await fetch(url, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (!res.ok) break;
          const data = await res.json();
          const content = (data?.content ?? []) as Product[];
          collected.push(...content);
          totalPages = data?.totalPages ?? 1;
          page += 1;
        }
        const withFiltroVenta = collected.filter(
          (p) => (p.isActive !== false) && (p.filtroVenta || p.codigoFiltroVenta),
        );
        if (!ignore) {
          setRemoteProducts(withFiltroVenta);
          setRemoteLoaded(true);
          setProductsCache(prev => ({ ...prev, [cacheKey]: withFiltroVenta }));
        }
      } catch (error) {
        console.error("Error cargando productos en línea", error);
        if (!ignore) {
          setRemoteProducts([]);
          setRemoteLoaded(false);
        }
      } finally {
        if (!ignore) setIsLoadingProducts(false);
      }
    };
    fetchRemoteProducts();
    return () => { ignore = true; };
  }, [selectedCompany, hasProductFilter, searchTerm, lineFilter, productsCache, showAllProducts]);

  // Carga catálogos generales (línea) igual que en ofertas
  useEffect(() => {
    let ignore = false
    const fetchCatalogs = async () => {
      if (!selectedCompany) return
      try {
        const token = await getAccessToken()
        const base = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "")
        const headers: HeadersInit = { Authorization: `Bearer ${token}` }

        const lineRes = await fetch(`${base}/catalogos-generales/${selectedCompany}/filtro_venta`, { headers })

        if (!ignore && lineRes.ok) {
          const lineJson = await lineRes.json().catch(() => [])
          if (Array.isArray(lineJson)) setCatalogLines(lineJson as any)
        }
      } catch (e) {
        console.warn("No se pudieron cargar catálogos de línea", e)
      }
    }

    fetchCatalogs()
    return () => {
      ignore = true
    }
  }, [selectedCompany])

  useEffect(() => {
    let ignore = false
    const load = async () => {
      if (!canRead || !selectedCompany) return
      setIsSyncingLists(true)
      try {
        const lists = await loadPriceListsOnline(selectedCompany)
        if (!ignore) {
          console.log("[Precio] listas cargadas (raw)", lists)
          console.log("[Precio] listas UUID/codigo", lists.map((l: PriceList) => ({ name: l.name, serverId: l.serverId, code: l.code })))
          console.log("[Precio] productos por lista", lists.map((l: PriceList) => ({ name: l.name, productos: Object.keys(l.products || {}).length })))
        }
      } catch (error) {
        console.error("Error cargando listas de precios", error)
      } finally {
        if (!ignore) setIsSyncingLists(false)
      }
    }
    load()
    return () => {
      ignore = true
    }
  }, [canRead, selectedCompany, loadPriceListsOnline])

  const lineOptions = useMemo(() => {
    if (catalogLines.length) {
      const map = new Map<string, { id: string; label: string }>()
      catalogLines.forEach((c) => {
        const id = normalizeStr(c.codigo || c.descripcion)
        const label = (c.descripcion || c.codigo || "").trim()
        if (!id || !label) return
        if (!map.has(id)) map.set(id, { id, label })
      })
      return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label))
    }

    const map = new Map<string, { id: string; label: string }>()
    products.forEach((p) => {
      if (p.isActive === false) return
      const id = productLine(p)
      const label = productLineLabel(p)
      if (!id || !label) return
      if (!map.has(id)) map.set(id, { id, label })
    })
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label))
  }, [catalogLines, products])

  const filteredLineOptions = useMemo(() => {
    const term = lineSearch.trim().toLowerCase()
    if (!term) return lineOptions
    return lineOptions.filter(
      (line) => line.label.toLowerCase().includes(term) || line.id.toLowerCase().includes(term),
    )
  }, [lineOptions, lineSearch])

  const companyOptions = useMemo(
    () => [
      { id: "E01", label: "E01 · Codimisa" },
      { id: "E07", label: "E07 · Dimisa" },
    ],
    [],
  )

  const filteredProducts = useMemo(() => {
    let products = activeProducts;
    if (!showAllProducts) {
      products = lineFilter ? products.filter(p => productLine(p) === lineFilter) : products;
    }
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      products = products.filter(p => `${productName(p)} ${productKey(p) || ""}`.toLowerCase().includes(term));
    }
    return products.sort((a, b) => productName(a).localeCompare(productName(b)));
  }, [activeProducts, searchTerm, lineFilter, showAllProducts]);

  const groupedProducts = useMemo(() => {
    const providerMap = new Map<string, { label: string; lines: Map<string, { label: string; products: Product[] }> }>()

    filteredProducts.forEach((p) => {
      const providerId = productProvider(p) || "Sin proveedor"
      const providerLabel = productProviderLabel(p) || providerId
      const lineId = productLine(p) || "Sin línea"
      const lineLabel = productLineLabel(p) || lineId

      if (!providerMap.has(providerId)) providerMap.set(providerId, { label: providerLabel, lines: new Map() })
      const provEntry = providerMap.get(providerId)!

      if (!provEntry.lines.has(lineId)) provEntry.lines.set(lineId, { label: lineLabel, products: [] })
      provEntry.lines.get(lineId)!.products.push(p)
    })

    return Array.from(providerMap.entries())
      .map(([providerId, provEntry]) => ({
        provider: provEntry.label,
        lines: Array.from(provEntry.lines.entries())
          .map(([lineId, lineEntry]) => ({ line: lineEntry.label, products: lineEntry.products }))
          .sort((a, b) => a.line.localeCompare(b.line)),
      }))
      .sort((a, b) => a.provider.localeCompare(b.provider))
  }, [filteredProducts, hiddenLines])

  const companyPriceLists = useMemo(() => {
    const sel = (selectedCompany || "general").toUpperCase()
    return priceLists
      .filter((pl) => ((pl.companyId || "general").toUpperCase() === sel))
      .sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0))
  }, [priceLists, selectedCompany])

  useEffect(() => {
    const ids = companyOptions.map((c) => c.id)
    if (!ids.includes(selectedCompany)) {
      setSelectedCompany(ids[0])
    }
  }, [companyOptions, selectedCompany])

  const baseList = useMemo(() => {
    // tier === 0 o code === "default"
    const found = companyPriceLists.find((pl) => (pl.tier ?? 0) === 0 || (pl.code || "").toLowerCase() === "default")
    return found || null
  }, [companyPriceLists])

  const additionalLists = useMemo(() => {
    return companyPriceLists
      .filter((pl) => (pl.tier ?? 0) !== 0 && (pl.code || "").toLowerCase() !== "default")
      .sort((a, b) => (a.tier ?? 999) - (b.tier ?? 999))
  }, [companyPriceLists])

  const visibleLists = useMemo(() => {
    const list = baseList ? [baseList, ...additionalLists] : additionalLists
    return list.length ? list : companyPriceLists // fallback: muestra todo si no se detecta base/tiers
  }, [baseList, additionalLists, companyPriceLists])

  const nextListLabel = useMemo(() => {
    if (!companyPriceLists.length) return "Default"
    const tiers = companyPriceLists.map((pl) => pl.tier ?? 0)
    const nextTier = Math.max(...tiers) + 1
    return `Lista de precios ${nextTier}`
  }, [companyPriceLists])

  useEffect(() => {
    if (!visibleLists.length) {
      setTargetListId(null)
      return
    }
    if (!targetListId || !visibleLists.some((l) => l.id === targetListId)) {
      setTargetListId(visibleLists[0].id)
    }
  }, [visibleLists, targetListId])

  if (!canRead) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Shield className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Acceso Denegado</h3>
              <p className="text-muted-foreground">No tienes permisos para ver las listas de precios.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const togglePriceListStatus = (priceListId: string, isActive: boolean) => {
    if (!canUpdate) return
    updatePriceList(priceListId, { isActive: !isActive })
  }

  const handleEdit = (priceList: PriceList) => {
    setEditingPriceList(priceList)
    setShowForm(true)
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingPriceList(null)
  }

  const handlePriceChange = (listId: string, productId: string, price: number) => {
    setDrafts((prev) => ({
      ...prev,
      [listId]: {
        ...(prev[listId] || {}),
        [productId]: price,
      },
    }))
  }

  const persistList = (listId: string) => {
    const payload = drafts[listId] || {}
    updatePriceList(listId, { products: payload })
  }

  const handleBulkPaste = (text: string) => {
    if (!targetListId) return
    if (!text || !text.trim()) return
    const clean = text.replace(/\r/g, "")
    const rawLines = clean.split(/\n|;/).map((l) => l.trim()).filter(Boolean)

    // Detect formato codigo,precio (coma/tab) por línea
    const pairEntries = rawLines
      .map((line) => {
        const parts = line.split(/[\t,]+/).map((p) => p.trim()).filter(Boolean)
        if (parts.length < 2) return null
        const price = Number.parseFloat(parts[1].replace(",", "."))
        if (!Number.isFinite(price)) return null
        return { code: parts[0], price }
      })
      .filter(Boolean) as Array<{ code: string; price: number }>

    let nextMap = { ...(drafts[targetListId] || {}) }

    if (pairEntries.length) {
      const byCode = new Map(
        filteredProducts.map((p) => [String(productKey(p) || "").trim(), p] as const),
      )

      pairEntries.forEach(({ code, price }) => {
        const product = byCode.get(String(code).trim())
        if (!product) return
        const targetKey = productKey(product)
        if (!targetKey) return

        if (!applyToVariations) {
          nextMap[targetKey] = price
          return
        }

        const affected = filteredProducts.filter((p) => {
          const sameProvider = productProvider(p) && productProvider(p) === productProvider(product)
          const sameLine = productLine(p) && productLine(p) === productLine(product)
          return sameProvider || sameLine
        })

        affected.forEach((p) => {
          const pid = productKey(p)
          if (pid) nextMap[pid] = price
        })
      })
    } else {
      const values = clean
        .replace(/\t/g, "\n")
        .split(/\n|;|,/)
        .map((v) => Number.parseFloat(v.trim().replace(",", ".")))
        .filter((n) => Number.isFinite(n))

      if (!values.length) return

      values.forEach((value, index) => {
        const product = filteredProducts[index]
        if (!product) return
        const key = productKey(product)
        if (!key) return

        const affected = applyToVariations
          ? filteredProducts.filter((p) => {
              const sameProvider = productProvider(p) && productProvider(p) === productProvider(product)
              const sameLine = productLine(p) && productLine(p) === productLine(product)
              return sameProvider || sameLine
            })
          : [product]

        affected.forEach((p) => {
          const pid = productKey(p)
          if (pid) nextMap[pid] = value
        })
      })
    }

    setDrafts((prev) => ({ ...prev, [targetListId]: nextMap }))
    updatePriceList(targetListId, { products: nextMap })
  }

  const ensureDefaultStructure = async () => {
    if (!canCreate) return
    setIsGeneratingStructure(true)
    const tiers = [0, 1, 2, 3]
    const names = ["Default", "Lista de precios 1", "Lista de precios 2", "Lista de precios 3"]
    const defaultProductPrices = products.reduce<Record<string, number>>((acc, product) => {
      if (product.isActive === false) return acc
      const key = productKey(product)
      if (!key) return acc
      acc[key] = productBasePrice(product)
      return acc
    }, {})

    try {
      for (let i = 0; i < tiers.length; i++) {
        const tier = tiers[i]
        const exists = companyPriceLists.some((pl) => (pl.tier ?? 0) === tier)
        if (exists) continue

        const listCode = getPriceListCode(tier)
        const productsPayload = tier === 0 ? baseList?.products ?? defaultProductPrices : {}

        await addPriceList({
          name: `${selectedCompany} ${names[i]}`,
          companyId: selectedCompany,
          tier,
          products: productsPayload,
          isActive: true,
          listCode,
        })
      }
    } finally {
      setIsGeneratingStructure(false)
    }
  }

  const handleQuickCreate = async () => {
    if (!canCreate) return
    const tiers = companyPriceLists.map((pl) => pl.tier ?? 0)
    const nextTier = tiers.length === 0 ? 0 : Math.max(...tiers) + 1
    const label = nextTier === 0 ? "Default" : `Lista de precios ${nextTier}`

    await addPriceList({
      name: label,
      companyId: selectedCompany,
      tier: nextTier,
      products: {},
      isActive: true,
      listCode: getPriceListCode(nextTier),
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto p-2 pt-3 sm:px-2 lg:px-4 overflow-visible">
        <div className="px-4 py-6 sm:px-0 space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Listas de Precios</h1>
              <p className="mt-2 text-gray-600">
                Gestiona precios por empresa con lista base y adicionales (1, 2, 3)
              </p>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <Button onClick={handleQuickCreate} disabled={!canCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Crear lista ({nextListLabel})
              </Button>
              {canCreate && (
                <Button variant="outline" onClick={ensureDefaultStructure} disabled={isGeneratingStructure}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {isGeneratingStructure ? "Creando..." : "Estructura base + 1/2/3"}
                </Button>
              )}
              {canCreate && (
                <Button variant="secondary" onClick={() => setShowForm(true)}>
                  <Settings2 className="w-4 h-4 mr-2" />
                  Personalizar
                </Button>
              )}
              {!canCreate && <span className="text-xs text-gray-500">Sin permiso de creación.</span>}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Card className="xl:col-span-2">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Filter className="w-4 h-4" />
                  Filtros de productos
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Product filter block (single instance) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
                  <div className="md:col-span-1">
                    <label className="text-sm text-gray-700">Buscar por código o nombre</label>
                    <Input
                      placeholder="Buscar..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="w-full">
                    <label className="text-sm text-gray-700">Línea</label>
                    <Select
                      open={openLineSelect}
                      onOpenChange={setOpenLineSelect}
                      value={lineFilter || "all"}
                      onValueChange={(val) => {
                        setLineFilter(val === "all" ? "" : val)
                        setOpenLineSelect(false)
                        setLineSearch("");
                      }}
                    >
                      <SelectTrigger className="mt-1 w-full">
                        <SelectValue placeholder="Selecciona o busca línea..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-64 overflow-y-auto z-[9999]" position="popper">
                        <div className="px-2 py-1">
                          <Input
                            autoFocus
                            placeholder="Buscar o seleccionar línea..."
                            value={lineSearch}
                            onChange={(e) => setLineSearch(e.target.value)}
                            className="mb-2 w-full"
                            onClick={e => e.stopPropagation()}
                          />
                        </div>
                        <SelectItem value="all">Todas</SelectItem>
                        {filteredLineOptions.map((line) => (
                          <SelectItem key={line.id} value={line.id}>
                            {line.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end w-full">
                    <Button
                      variant={showAllProducts ? "secondary" : "default"}
                      onClick={() => setShowAllProducts((prev) => !prev)}
                    >
                      {showAllProducts ? "Ocultar todos los productos" : "Mostrar todos los productos"}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-700">Empresa</label>
                    <select
                      value={selectedCompany}
                      onChange={(e) => setSelectedCompany(e.target.value || "E01")}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    >
                      {companyOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Selecciona la empresa (E01 Codimisa / E07 Dimisa).</p>
                  </div>
                  <div className="flex flex-wrap gap-2 items-end">
                    {visibleLists.map((pl) => (
                      <Badge key={pl.id} variant={pl.isActive ? "default" : "secondary"}>
                        {pl.name} {pl.isActive ? "" : "(inactiva)"}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Estructura de listas</CardTitle>
                <CardDescription>Base + adicionales (1, 2, 3) por empresa</CardDescription>
                <Button size="sm" className="mt-2" onClick={handleQuickCreate} disabled={!canCreate}>
                  Crear lista ({nextListLabel})
                </Button>
                {!canCreate && (
                  <p className="text-xs text-gray-500">Necesitas permiso de creación para agregar una lista.</p>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-700">Listas disponibles</div>
                    <div className="text-xl font-semibold">{visibleLists.length}</div>
                  </div>
                  <div className="text-right text-sm text-gray-600">
                    <div>Empresa: {selectedCompany}</div>
                    <div>Productos filtrados: {filteredProducts.length}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  {visibleLists.map((pl) => (
                    <div key={pl.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <div>
                        <div className="font-medium">{pl.name}</div>
                        <div className="text-xs text-gray-500">Tier: {pl.tier ?? 0}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        {canUpdate && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => togglePriceListStatus(pl.id, pl.isActive)}
                            title={pl.isActive ? "Desactivar" : "Activar"}
                          >
                            {pl.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </Button>
                        )}
                        {canUpdate && (
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(pl)} title="Editar metadatos">
                            <Settings2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {visibleLists.length === 0 && (
                    <p className="text-sm text-gray-600">Crea la estructura base + 1/2/3 para comenzar.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">Pegado rápido</CardTitle>
                  <CardDescription>
                    Pega una columna de precios y se aplicará en orden a los productos filtrados.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <ClipboardPaste className="w-4 h-4 text-gray-500" />
                  <select
                    value={targetListId ?? ""}
                    onChange={(e) => setTargetListId(e.target.value)}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    {visibleLists.map((pl) => (
                      <option key={pl.id} value={pl.id}>
                        {pl.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                className="w-full h-28 rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
                placeholder="Pega precios aquí “código,precio” (ej. 7239238123,125.00)"
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
              />
              <div className="flex items-center gap-2">
                <input
                  id="apply-variations"
                  type="checkbox"
                  checked={applyToVariations}
                  onChange={(e) => setApplyToVariations(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label htmlFor="apply-variations" className="text-sm text-gray-700">
                  Aplicar también a variaciones (mismo proveedor o línea)
                </label>
              </div>
              <p className="text-xs text-gray-500">
                El pegado recorre los productos filtrados en orden. Si activas variaciones, el precio se replica a
                productos con la misma línea o proveedor.
              </p>
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    handleBulkPaste(bulkText)
                    setBulkText("")
                  }}
                  disabled={!bulkText.trim()}
                >
                  Aplicar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Edición rápida de precios</CardTitle>
              <CardDescription>Filtra por línea y edita listas base y 1/2/3 en línea.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-auto space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="text-sm text-gray-700">Buscar producto rápido</label>
                  <Input
                    placeholder="Nombre o código"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="w-full">
                  <label className="text-sm text-gray-700">Línea</label>
                  <Select
                    open={openLineSelect}
                    onOpenChange={setOpenLineSelect}
                    value={lineFilter || "all"}
                    onValueChange={(val) => {
                      setLineFilter(val === "all" ? "" : val)
                      setOpenLineSelect(false)
                      setLineSearch("");
                    }}
                  >
                    <SelectTrigger className="mt-1 w-full">
                      <SelectValue placeholder="Selecciona o busca línea..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-64 overflow-y-auto z-[9999]" position="popper">
                      <div className="px-2 py-1">
                        <Input
                          autoFocus
                          placeholder="Buscar o seleccionar línea..."
                          value={lineSearch}
                          onChange={(e) => setLineSearch(e.target.value)}
                          className="mb-2 w-full"
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                      <SelectItem value="all">Todas</SelectItem>
                      {filteredLineOptions.map((line) => (
                        <SelectItem key={line.id} value={line.id}>
                          {line.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                  <div className="flex justify-end w-full">
                    <Button
                      variant={showAllProducts ? "secondary" : "default"}
                      onClick={() => setShowAllProducts((prev) => !prev)}
                    >
                      {showAllProducts ? "Ocultar todos los productos" : "Mostrar todos los productos"}
                    </Button>
                  </div>
              </div>

              <div className="min-w-full overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600">
                      <th
                        className="py-2 pr-4 bg-white sticky z-20 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]"
                        style={{ left: "0px", minWidth: "240px" }}
                      >
                        Producto
                      </th>
                      <th
                        className="py-2 pr-4 bg-white sticky z-20 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]"
                        style={{ left: "240px", minWidth: "140px" }}
                      >
                        Proveedor
                      </th>
                      <th
                        className="py-2 pr-4 bg-white sticky z-20 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]"
                        style={{ left: "380px", minWidth: "120px" }}
                      >
                        Línea
                      </th>
                      {visibleLists.map((pl) => (
                        <th key={pl.id} className="py-2 pr-4">
                          <div className="flex items-center gap-2">
                            <span>{pl.name}</span>
                            <Badge variant={pl.isActive ? "default" : "secondary"}>
                              {pl.isActive ? "Activa" : "Inactiva"}
                            </Badge>
                            {canUpdate && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => togglePriceListStatus(pl.id, pl.isActive)}
                                title={pl.isActive ? "Desactivar" : "Activar"}
                              >
                                {pl.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                              </Button>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => {
                      const key = productKey(product)
                      if (!key) return null
                      const basePrice = productBasePrice(product)

                      return (
                        <tr key={key} className="border-t">
                          <td
                            className="py-2 pr-4 bg-white sticky z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]"
                            style={{ left: "0px", minWidth: "240px" }}
                          >
                            <div className="font-medium">{productName(product)}</div>
                            <div className="text-xs text-gray-500">{key}</div>
                          </td>
                          <td
                            className="py-2 pr-4 bg-white sticky z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]"
                            style={{ left: "240px", minWidth: "140px" }}
                          >
                            {productProvider(product) || "-"}
                          </td>
                          <td
                            className="py-2 pr-4 bg-white sticky z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]"
                            style={{ left: "380px", minWidth: "120px" }}
                          >
                            {productLine(product) || "-"}
                          </td>
                          {visibleLists.map((pl) => {
                            const draftValue = drafts[pl.id]?.[key]
                            const currentValue = draftValue ?? pl.products?.[key]
                            const value = currentValue ?? ""

                            return (
                              <td key={`${pl.id}-${key}`} className="py-2 pr-4">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={value}
                                  placeholder={basePrice ? basePrice.toString() : "0"}
                                  disabled
                                  readOnly
                                  className="w-28"
                                />
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                    {filteredProducts.length === 0 && (
                      <tr>
                        <td colSpan={4 + visibleLists.length} className="py-6 text-center text-gray-500">
                          No hay productos con los filtros seleccionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {showForm && (canCreate || canUpdate) && <PriceListForm priceList={editingPriceList} onClose={handleFormClose} />}
    </div>
  )
}
