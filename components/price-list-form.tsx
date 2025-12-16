"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { usePreventa } from "@/contexts/preventa-context"
import { X } from "lucide-react"
import type { PriceList } from "@/lib/types"

interface PriceListFormProps {
  priceList?: PriceList | null
  onClose: () => void
}

export function PriceListForm({ priceList, onClose }: PriceListFormProps) {
  const { addPriceList, updatePriceList, products } = usePreventa()
  const [formData, setFormData] = useState({
    name: priceList?.name || "",
    companyId: priceList?.companyId || "general",
    tier: priceList?.tier ?? 0,
    products: priceList?.products || {},
    isActive: priceList?.isActive ?? true,
  })

  const isEditing = Boolean(priceList)

  const [providerFilter, setProviderFilter] = useState("")
  const [lineFilter, setLineFilter] = useState("")

  const productKey = (product: any) => product.codigoProducto || product.idt || product.id || product.codigo
  const productName = (product: any) => product.descripcion || product.descripcionCorta || product.name || product.codigoProducto
  const productProvider = (product: any) => product.proveedor || product.codigoProveedor || ""
  const productLine = (product: any) =>
    product.filtroVenta || product.codigoFiltroVenta || product.linea || product.codigoLinea || product.subfamilia || product.codigoSubfamilia || ""
  const basePrice = (product: any) => product.precio ?? product.price ?? 0

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (priceList) {
      updatePriceList(priceList.id, formData)
    } else {
      addPriceList(formData)
    }

    onClose()
  }

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleProductPriceChange = (productId: string, price: number) => {
    setFormData((prev) => ({
      ...prev,
      products: {
        ...prev.products,
        [productId]: price,
      },
    }))
  }

  const handleRemoveProduct = (productId: string) => {
    setFormData((prev) => {
      const newProducts = { ...prev.products }
      delete newProducts[productId]
      return {
        ...prev,
        products: newProducts,
      }
    })
  }

  const handleAddAllProducts = () => {
    const allProductPrices = products.reduce(
      (acc, product) => {
        if (product.isActive) {
          const id = productKey(product)
          if (!id) return acc
          acc[id] = formData.products[id] ?? basePrice(product)
        }
        return acc
      },
      {} as Record<string, number>,
    )

    setFormData((prev) => ({
      ...prev,
      products: allProductPrices,
    }))
  }

  const activeProducts = products.filter((p) => p.isActive !== false)

  const providerOptions = Array.from(
    new Set(activeProducts.map((p) => (productProvider(p) || "").trim()).filter(Boolean)),
  ).sort()

  const lineOptions = Array.from(
    new Set(activeProducts.map((p) => (productLine(p) || "").trim()).filter(Boolean)),
  ).sort()

  const filteredProducts = activeProducts
    .filter((p) => {
      const prov = (productProvider(p) || "").trim()
      const line = (productLine(p) || "").trim()
      const matchesProv = providerFilter ? prov === providerFilter : true
      const matchesLine = lineFilter ? line === lineFilter : true
      return matchesProv && matchesLine
    })
    .sort((a, b) => productName(a).localeCompare(productName(b)))
  const productsInList = Object.keys(formData.products)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>{priceList ? "Editar Lista de Precios" : "Nueva Lista de Precios"}</CardTitle>
              <CardDescription>
                {priceList ? "Modifica los precios de la lista" : "Crea una nueva lista de precios personalizada"}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="name">Nombre de la Lista</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Ej: Precios Mayorista, Lista VIP, Descuentos Especiales"
                required
                readOnly={isEditing}
                disabled={isEditing}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="companyId">Empresa</Label>
                <Input
                  id="companyId"
                  value={formData.companyId}
                  onChange={(e) => handleChange("companyId", e.target.value)}
                  placeholder="Código de empresa"
                  readOnly={isEditing}
                  disabled={isEditing}
                />
              </div>
              <div>
                <Label htmlFor="tier">Lista (0 = base)</Label>
                <Input
                  id="tier"
                  type="number"
                  min={0}
                  value={formData.tier}
                  onChange={(e) => handleChange("tier", Number.parseInt(e.target.value || "0", 10))}
                  placeholder="0, 1, 2, 3"
                  readOnly={isEditing}
                  disabled={isEditing}
                />
                <p className="text-xs text-gray-500 mt-1">0 es la lista base; 1, 2, 3 adicionales</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                id="isActive"
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => handleChange("isActive", e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="isActive">Lista activa</Label>
            </div>

            {/* Products Section */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <Label>Productos y Precios</Label>
                <Button type="button" onClick={handleAddAllProducts} size="sm" variant="outline">
                  Agregar Todos los Productos
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div>
                  <Label className="text-sm text-gray-700">Proveedor</Label>
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
                  <Label className="text-sm text-gray-700">Línea (filtro_venta)</Label>
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

              {filteredProducts.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-gray-500">
                    No hay productos que coincidan con los filtros
                  </CardContent>
                </Card>
              ) : (
                <Card className="p-4">
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {filteredProducts.map((product) => {
                      const id = productKey(product)
                      if (!id) return null

                      const isInList = productsInList.includes(id)
                      const currentPrice = formData.products[id] ?? basePrice(product)

                      return (
                        <div key={id} className="flex items-center gap-4 p-3 border rounded-lg">
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={isInList}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  handleProductPriceChange(id, basePrice(product))
                                } else {
                                  handleRemoveProduct(id)
                                }
                              }}
                              className="rounded border-gray-300"
                            />
                          </div>

                          <div className="flex-1">
                            <div className="font-medium">{productName(product)}</div>
                            <div className="text-sm text-gray-600">
                              Precio base: Q{basePrice(product).toLocaleString()}
                            </div>
                          </div>

                          {isInList && (
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`price-${id}`} className="text-sm">
                                Precio:
                              </Label>
                              <Input
                                id={`price-${id}`}
                                type="number"
                                min="0"
                                step="0.01"
                                value={currentPrice}
                                onChange={(e) =>
                                  handleProductPriceChange(id, Number.parseFloat(e.target.value) || 0)
                                }
                                className="w-32"
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </Card>
              )}
            </div>

            {/* Summary */}
            {productsInList.length > 0 && (
              <Card className="bg-gray-50">
                <CardContent className="pt-4">
                  <div className="text-sm">
                    <strong>Resumen:</strong> {productsInList.length} producto{productsInList.length !== 1 ? "s" : ""}{" "}
                    configurado{productsInList.length !== 1 ? "s" : ""}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-2 pt-4">
              <Button type="submit" className="flex-1">
                {priceList ? "Actualizar" : "Crear"} Lista
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
