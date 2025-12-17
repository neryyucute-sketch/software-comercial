"use client"

import { Fragment, useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
  normalizeStr(product.proveedor || product.codigoProveedor) || "Sin proveedor"
const productLine = (product: Product | any) =>
  normalizeStr(
    product.filtroVenta ||
      product.codigoFiltroVenta ||
      product.linea ||
      product.codigoLinea ||
      product.subfamilia ||
      product.codigoSubfamilia ||
      product.familia ||
      product.codigoFamilia ||
      product.codigoFiltroVenta,
  ) || "Sin línea"
const productBasePrice = (product: Product | any) => product.precio ?? product.price ?? 0

export default function PricesPage() {
  const { priceLists, products, updatePriceList, addPriceList, syncPriceLists } = usePreventa()
  const { hasPermission } = useAuth()

  const [searchTerm, setSearchTerm] = useState("")
  const [providerFilter, setProviderFilter] = useState("")
  const [lineFilter, setLineFilter] = useState("")
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
  const [isSyncingLists, setIsSyncingLists] = useState(false)

  const hasProductFilter = useMemo(
    () => searchTerm.trim().length >= 2 || Boolean(providerFilter) || Boolean(lineFilter),
    [searchTerm, providerFilter, lineFilter],
  )

  const canRead = hasPermission("prices", "read")
  const canCreate = hasPermission("prices", "create")
  const canUpdate = hasPermission("prices", "update")

  const activeProducts = useMemo(() => {
    if (!hasProductFilter) return []
    const source = remoteLoaded ? remoteProducts : products
    return source.filter((p) => p.isActive !== false)
  }, [products, remoteProducts, remoteLoaded, hasProductFilter])

  useEffect(() => {
    let ignore = false

    const fetchRemoteProducts = async () => {
      if (!selectedCompany) return
      if (!hasProductFilter) {
        setRemoteLoaded(false)
        setRemoteProducts([])
        return
      }
      setRemoteLoaded(false)
      setRemoteProducts([])
      setIsLoadingProducts(true)
      try {
        const token = await getAccessToken()
        const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ""
        let page = 0
        let totalPages = 1
        const collected: Product[] = []

        while (page < totalPages) {
          const q = searchTerm.trim()
          const url = `${API_BASE}/catalogo-productos?codigoEmpresa=${encodeURIComponent(selectedCompany)}${
            q ? `&q=${encodeURIComponent(q)}` : ""
          }&page=${page}&size=100`
          const res = await fetch(url, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })

          if (!res.ok) break

          const data = await res.json()
          const content = (data?.content ?? []) as Product[]
          collected.push(...content)
          totalPages = data?.totalPages ?? 1
          page += 1
        }

        const withFiltroVenta = collected.filter(
          (p) => (p.isActive !== false) && (p.filtroVenta || p.codigoFiltroVenta),
        )

        if (!ignore) {
          setRemoteProducts(withFiltroVenta)
          setRemoteLoaded(true)
        }
      } catch (error) {
        console.error("Error cargando productos en línea", error)
        if (!ignore) {
          setRemoteProducts([])
          setRemoteLoaded(false)
        }
      } finally {
        if (!ignore) setIsLoadingProducts(false)
      }
    }

    fetchRemoteProducts()

    return () => {
      ignore = true
    }
  }, [selectedCompany, hasProductFilter, searchTerm])

  useEffect(() => {
    let ignore = false
    const fetchLists = async () => {
      if (!canRead || !selectedCompany) return
      setIsSyncingLists(true)
      try {
        await syncPriceLists(selectedCompany)
      } catch (error) {
        console.error("Error sincronizando listas de precios", error)
      } finally {
        if (!ignore) setIsSyncingLists(false)
      }
    }

    fetchLists()
    return () => {
      ignore = true
    }
  }, [canRead, selectedCompany, syncPriceLists])

  const providerOptions = useMemo(() => {
    const set = new Set<string>()
    products.forEach((p) => {
      if (p.isActive === false) return
      const prov = productProvider(p)
      if (prov) set.add(prov)
    })
    return Array.from(set).sort()
  }, [products])

  const lineOptions = useMemo(() => {
    const set = new Set<string>()
    products.forEach((p) => {
      if (p.isActive === false) return
      const line = productLine(p)
      if (line) set.add(line)
    })
    return Array.from(set).sort()
  }, [products])

  const companyOptions = useMemo(
    () => [
      { id: "E01", label: "E01 · Codimisa" },
      { id: "E07", label: "E07 · Dimisa" },
    ],
    [],
  )

  const filteredProducts = useMemo(
    () =>
      activeProducts
        .filter((p) => {
          const matchesSearch = searchTerm
            ? `${productName(p)} ${productKey(p) || ""}`.toLowerCase().includes(searchTerm.toLowerCase())
            : true
          const matchesProvider = providerFilter ? productProvider(p) === providerFilter : true
          const matchesLine = lineFilter ? productLine(p) === lineFilter : true
          return matchesSearch && matchesProvider && matchesLine
        })
        .sort((a, b) => {
          const provA = (productProvider(a) || "").toLowerCase()
          const provB = (productProvider(b) || "").toLowerCase()
          if (provA !== provB) return provA.localeCompare(provB)

          const lineA = (productLine(a) || "").toLowerCase()
          const lineB = (productLine(b) || "").toLowerCase()
          if (lineA !== lineB) return lineA.localeCompare(lineB)

          return productName(a).localeCompare(productName(b))
        }),
    [activeProducts, searchTerm, providerFilter, lineFilter],
  )

  const groupedProducts = useMemo(() => {
    const providerMap = new Map<string, Map<string, Product[]>>()

    filteredProducts.forEach((p) => {
      const provider = productProvider(p) || "Sin proveedor"
      const line = productLine(p) || "Sin línea"
      if (!providerMap.has(provider)) providerMap.set(provider, new Map())
      const lineMap = providerMap.get(provider)!
      if (!lineMap.has(line)) lineMap.set(line, [])
      lineMap.get(line)!.push(p)
    })

    return Array.from(providerMap.entries())
      .map(([provider, lineMap]) => ({
        provider,
        lines: Array.from(lineMap.entries())
          .map(([line, products]) => ({ line, products }))
          .sort((a, b) => a.line.localeCompare(b.line)),
      }))
      .sort((a, b) => a.provider.localeCompare(b.provider))
  }, [filteredProducts, hiddenLines])

  const companyPriceLists = useMemo(
    () => priceLists.filter((pl) => (pl.companyId || "general") === selectedCompany),
    [priceLists, selectedCompany],
  )

  useEffect(() => {
    const ids = companyOptions.map((c) => c.id)
    if (!ids.includes(selectedCompany)) {
      setSelectedCompany(ids[0])
    }
  }, [companyOptions, selectedCompany])

  const baseList = useMemo(
    () => companyPriceLists.find((pl) => (pl.tier ?? 0) === 0) || null,
    [companyPriceLists],
  )

  const additionalLists = useMemo(
    () => companyPriceLists.filter((pl) => (pl.tier ?? 0) !== 0).sort((a, b) => (a.tier ?? 999) - (b.tier ?? 999)),
    [companyPriceLists],
  )

  const visibleLists = useMemo(() => {
    if (baseList) return [baseList, ...additionalLists]
    return additionalLists
  }, [baseList, additionalLists])

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
    const baseProducts = baseList?.products ?? {}

    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i]
      const exists = companyPriceLists.some((pl) => (pl.tier ?? 0) === tier)
      if (exists) continue

      await addPriceList({
        name: `${selectedCompany} ${names[i]}`,
        companyId: selectedCompany,
        tier,
        products: tier === 0 ? baseProducts : {},
        isActive: true,
      })
    }

    setIsGeneratingStructure(false)
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
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="md:col-span-2">
                    <label className="text-sm text-gray-700">Buscar por código o nombre</label>
                    <Input
                      placeholder="Buscar..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-700">Proveedor</label>
                    <select
                      value={providerFilter}
                      onChange={(e) => setProviderFilter(e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="">Todos</option>
                      {providerOptions.map((prov) => (
                        <option key={prov} value={prov}>
                          {prov}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-gray-700">Línea</label>
                    <select
                      value={lineFilter}
                      onChange={(e) => setLineFilter(e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="">Todas</option>
                      {lineOptions.map((line) => (
                        <option key={line} value={line}>
                          {line}
                        </option>
                      ))}
                    </select>
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
              <CardDescription>Filtra por proveedor/línea y edita listas base y 1/2/3 en línea.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-auto space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="text-sm text-gray-700">Buscar producto rápido</label>
                  <Input
                    placeholder="Nombre o código"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-700">Proveedor</label>
                  <select
                    value={providerFilter}
                    onChange={(e) => setProviderFilter(e.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">Todos</option>
                    {providerOptions.map((prov) => (
                      <option key={prov} value={prov}>
                        {prov}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-700">Línea</label>
                  <select
                    value={lineFilter}
                    onChange={(e) => setLineFilter(e.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">Todas</option>
                    {lineOptions.map((line) => (
                      <option key={line} value={line}>
                        {line}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
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
