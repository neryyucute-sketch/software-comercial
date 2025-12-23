"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ModernDatePicker } from "@/components/ui/modern-date-picker"
import { usePreventa } from "@/contexts/preventa-context"
import { X } from "lucide-react"
import type { Offer } from "@/lib/types"

interface OfferFormProps {
  offer?: Offer | null
  onClose: () => void
}

export function OfferForm({ offer, onClose }: OfferFormProps) {
  const { addOffer, updateOffer, products } = usePreventa()
  const [formData, setFormData] = useState({
    name: offer?.name || "",
    type: offer?.type || ("discount" as Offer["type"]),
    description: offer?.description || "",
    products: offer?.products || [],
    discountPercent: offer?.discountPercent || 0,
    discountAmount: offer?.discountAmount || 0,
    stackableWithSameProduct: (offer as any)?.stackableWithSameProduct ?? false,
    isActive: offer?.isActive ?? true,
    validFrom: offer?.validFrom
      ? (() => {
          const date = new Date(offer.validFrom)
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
        })()
      : (() => {
          const date = new Date()
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
        })(),
    validTo: offer?.validTo
      ? (() => {
          const date = new Date(offer.validTo)
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
        })()
      : (() => {
          const date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
        })(),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const offerData = {
      ...formData,
      validFrom: new Date(formData.validFrom),
      validTo: new Date(formData.validTo),
      discountPercent:
        formData.type === "discount" && formData.discountPercent > 0 ? formData.discountPercent : undefined,
      discountAmount: formData.type === "discount" && formData.discountAmount > 0 ? formData.discountAmount : undefined,
      stackableWithSameProduct: formData.stackableWithSameProduct,
    }

    if (offer) {
      updateOffer(offer.id, offerData)
    } else {
      addOffer(offerData)
    }

    onClose()
  }

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleProductToggle = (productId: string) => {
    setFormData((prev) => ({
      ...prev,
      products: prev.products.includes(productId)
        ? prev.products.filter((id) => id !== productId)
        : [...prev.products, productId],
    }))
  }

  const activeProducts = products.filter((p) => p.isActive)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>{offer ? "Editar Oferta" : "Nueva Oferta"}</CardTitle>
              <CardDescription>
                {offer ? "Modifica los datos de la oferta" : "Crea una nueva oferta o promoción"}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nombre de la Oferta</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Ej: Combo Verano 2024"
                  required
                />
              </div>

              <div>
                <Label htmlFor="type">Tipo de Oferta</Label>
                <select
                  id="type"
                  value={formData.type}
                  onChange={(e) => handleChange("type", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="combo">Combo - Productos agrupados</option>
                  <option value="kit">Kit - Conjunto de productos</option>
                  <option value="bonus">Bonificación - Regalo adicional</option>
                  <option value="discount">Descuento - Reducción de precio</option>
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="Describe los detalles de la oferta"
                rows={3}
              />
            </div>

            {/* Discount Settings - Only for discount type */}
            {formData.type === "discount" && (
              <Card className="p-4">
                <h3 className="font-medium mb-3">Configuración de Descuento</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="discountPercent">Descuento por Porcentaje (%)</Label>
                    <Input
                      id="discountPercent"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.discountPercent}
                      onChange={(e) => {
                        handleChange("discountPercent", Number.parseFloat(e.target.value) || 0)
                        handleChange("discountAmount", 0) // Reset amount when using percent
                      }}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="discountAmount">Descuento por Monto (Q)</Label>
                    <Input
                      id="discountAmount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.discountAmount}
                      onChange={(e) => {
                        handleChange("discountAmount", Number.parseFloat(e.target.value) || 0)
                        handleChange("discountPercent", 0) // Reset percent when using amount
                      }}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Usa solo uno: porcentaje O monto fijo</p>
              </Card>
            )}

            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="validFrom">Válido Desde</Label>
                <ModernDatePicker
                  value={formData.validFrom}
                  onChange={(value) => handleChange("validFrom", value)}
                  placeholder="Seleccionar fecha de inicio"
                />
              </div>
              <div>
                <Label htmlFor="validTo">Válido Hasta</Label>
                <ModernDatePicker
                  value={formData.validTo}
                  onChange={(value) => handleChange("validTo", value)}
                  placeholder="Seleccionar fecha de fin"
                />
              </div>
            </div>

            {/* Product Selection */}
            <div>
              <Label>Productos Incluidos</Label>
              <Card className="p-4 max-h-60 overflow-y-auto">
                {activeProducts.length === 0 ? (
                  <p className="text-gray-500 text-sm">No hay productos activos disponibles</p>
                ) : (
                  <div className="space-y-2">
                    {activeProducts.map((product) => {
                      const price = product.precio ?? 0
                      return (
                        <div key={product.idt} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`product-${product.idt}`}
                            checked={formData.products.includes(product.idt)}
                            onChange={() => handleProductToggle(product.idt)}
                            className="rounded border-gray-300"
                          />
                          <label htmlFor={`product-${product.idt}`} className="flex-1 text-sm">
                            {product.descripcion} - Q{price.toLocaleString()}
                          </label>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
              <p className="text-xs text-gray-500 mt-1">Selecciona los productos que forman parte de esta oferta</p>
            </div>

            <div className="flex items-center space-x-2">
              <input
                id="isActive"
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => handleChange("isActive", e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="isActive">Oferta activa</Label>
            </div>

            <div className="flex items-start space-x-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <input
                id="stackableWithSameProduct"
                type="checkbox"
                checked={formData.stackableWithSameProduct}
                onChange={(e) => handleChange("stackableWithSameProduct", e.target.checked)}
                className="mt-1 rounded border-gray-300"
              />
              <div>
                <Label htmlFor="stackableWithSameProduct">Permitir combinar con otras ofertas del mismo producto</Label>
                <p className="text-xs text-gray-500">
                  Activa esta opción si la oferta puede coexistir con otra que afecte el mismo producto.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" className="flex-1">
                {offer ? "Actualizar" : "Crear"} Oferta
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
