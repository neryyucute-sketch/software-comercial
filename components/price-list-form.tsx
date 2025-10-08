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
    products: priceList?.products || {},
    isActive: priceList?.isActive ?? true,
  })

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
          acc[product.id] = formData.products[product.id] || product.price
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

  const activeProducts = products.filter((p) => p.isActive)
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
              />
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

              {activeProducts.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-gray-500">
                    No hay productos activos disponibles
                  </CardContent>
                </Card>
              ) : (
                <Card className="p-4">
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {activeProducts.map((product) => {
                      const isInList = productsInList.includes(product.id)
                      const currentPrice = formData.products[product.id] || product.price

                      return (
                        <div key={product.id} className="flex items-center gap-4 p-3 border rounded-lg">
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={isInList}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  handleProductPriceChange(product.id, product.price)
                                } else {
                                  handleRemoveProduct(product.id)
                                }
                              }}
                              className="rounded border-gray-300"
                            />
                          </div>

                          <div className="flex-1">
                            <div className="font-medium">{product.name}</div>
                            <div className="text-sm text-gray-600">Precio base: Q{product.price.toLocaleString()}</div>
                          </div>

                          {isInList && (
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`price-${product.id}`} className="text-sm">
                                Precio:
                              </Label>
                              <Input
                                id={`price-${product.id}`}
                                type="number"
                                min="0"
                                step="0.01"
                                value={currentPrice}
                                onChange={(e) =>
                                  handleProductPriceChange(product.id, Number.parseFloat(e.target.value) || 0)
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
