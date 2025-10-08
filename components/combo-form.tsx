"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ModernDatePicker } from "@/components/ui/modern-date-picker"
import { usePreventa } from "@/contexts/preventa-context"
import { useAuth } from "@/contexts/AuthContext"
import { X, Plus, Minus, Check } from "lucide-react"
import type { Combo, ComboProduct } from "@/lib/types"

interface ComboFormProps {
  combo?: Combo | null
  onClose: () => void
}

export function ComboForm({ combo, onClose }: ComboFormProps) {
  const { addCombo, updateCombo, products, customers, vendors } = usePreventa()
  const { users } = useAuth()

  const [formData, setFormData] = useState({
    name: combo?.name || "",
    description: combo?.description || "",
    price: combo?.price || 0,
    totalProducts: combo?.totalProducts || 5,
    fixedProducts: combo?.fixedProducts || [],
    optionalProductLines: combo?.optionalProductLines || [],
    optionalProductIds: combo?.optionalProductIds || [],
    restrictions: {
      regions: combo?.restrictions.regions || [],
      vendorIds: combo?.restrictions.vendorIds || [],
      customerCriteria: {
        channels: combo?.restrictions.customerCriteria?.channels || [],
        codes: combo?.restrictions.customerCriteria?.codes || [],
      },
    },
    isActive: combo?.isActive ?? true,
    validFrom: combo?.validFrom
      ? (() => {
          const date = new Date(combo.validFrom)
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
        })()
      : (() => {
          const date = new Date()
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
        })(),
    validTo: combo?.validTo
      ? (() => {
          const date = new Date(combo.validTo)
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
        })()
      : (() => {
          const date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
        })(),
  })

  const [customerRestrictionType, setCustomerRestrictionType] = useState<"channel" | "specific">("channel")
  const [customerCodeSearch, setCustomerCodeSearch] = useState("")
  const [vendorSearch, setVendorSearch] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      alert("El nombre del combo es requerido")
      return
    }

    if (!formData.description.trim()) {
      alert("La descripción del combo es requerida")
      return
    }

    if (formData.price <= 0) {
      alert("El precio del combo debe ser mayor a 0")
      return
    }

    if (formData.totalProducts <= 0) {
      alert("La cantidad total de productos debe ser mayor a 0")
      return
    }

    if (!formData.validFrom) {
      alert("La fecha de inicio es requerida")
      return
    }

    if (!formData.validTo) {
      alert("La fecha de fin es requerida")
      return
    }

    if (new Date(formData.validFrom) >= new Date(formData.validTo)) {
      alert("La fecha de inicio debe ser anterior a la fecha de fin")
      return
    }

    // Validate fixed products
    for (let i = 0; i < formData.fixedProducts.length; i++) {
      const product = formData.fixedProducts[i]
      if (!product.productId) {
        alert(`Debes seleccionar un producto para el producto fijo #${i + 1}`)
        return
      }
      if (product.quantity <= 0) {
        alert(`La cantidad del producto fijo #${i + 1} debe ser mayor a 0`)
        return
      }
    }

    // Validate that there are products configured (fixed or optional)
    if (
      formData.fixedProducts.length === 0 &&
      formData.optionalProductLines.length === 0 &&
      (!formData.optionalProductIds || formData.optionalProductIds.length === 0)
    ) {
      alert("Debes configurar al menos un producto fijo o productos opcionales")
      return
    }

    const comboData = {
      ...formData,
      name: formData.name.trim(),
      description: formData.description.trim(),
      validFrom: new Date(formData.validFrom),
      validTo: new Date(formData.validTo),
      restrictions: {
        ...formData.restrictions,
        regions: formData.restrictions.regions.length > 0 ? formData.restrictions.regions : undefined,
        vendorIds: formData.restrictions.vendorIds.length > 0 ? formData.restrictions.vendorIds : undefined,
        customerCriteria: {
          channels:
            formData.restrictions.customerCriteria.channels.length > 0
              ? formData.restrictions.customerCriteria.channels
              : undefined,
          codes:
            formData.restrictions.customerCriteria.codes.length > 0
              ? formData.restrictions.customerCriteria.codes
              : undefined,
        },
      },
    }

    if (combo) {
      updateCombo(combo.id, comboData)
    } else {
      addCombo(comboData)
    }

    onClose()
  }

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const addFixedProduct = () => {
    const newProduct: ComboProduct = {
      productId: "",
      isFixed: true,
      quantity: 1,
    }
    setFormData((prev) => ({
      ...prev,
      fixedProducts: [...prev.fixedProducts, newProduct],
    }))
  }

  const updateFixedProduct = (index: number, field: keyof ComboProduct, value: any) => {
    setFormData((prev) => ({
      ...prev,
      fixedProducts: prev.fixedProducts.map((product, i) => (i === index ? { ...product, [field]: value } : product)),
    }))
  }

  const removeFixedProduct = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      fixedProducts: prev.fixedProducts.filter((_, i) => i !== index),
    }))
  }

  const toggleProductLine = (category: string) => {
    setFormData((prev) => ({
      ...prev,
      optionalProductLines: prev.optionalProductLines.includes(category)
        ? prev.optionalProductLines.filter((c) => c !== category)
        : [...prev.optionalProductLines, category],
    }))
  }

  const toggleOptionalProduct = (productId: string) => {
    setFormData((prev) => ({
      ...prev,
      optionalProductIds: prev.optionalProductIds?.includes(productId)
        ? prev.optionalProductIds.filter((id) => id !== productId)
        : [...(prev.optionalProductIds || []), productId],
    }))
  }

  const activeProducts = products?.filter((p) => p.isActive) || []
  const categories = [...new Set(activeProducts.map((p) => p.category).filter(Boolean))]
  const regions = [...new Set((customers || []).map((c) => c.region).filter(Boolean))]
  const channels = [...new Set((customers || []).map((c) => c.channel).filter(Boolean))]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>{combo ? "Editar Combo" : "Nuevo Combo"}</CardTitle>
              <CardDescription>
                {combo ? "Modifica la configuración del combo" : "Crea un nuevo combo con productos fijos y opcionales"}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">Básico</TabsTrigger>
                <TabsTrigger value="products">Productos</TabsTrigger>
                <TabsTrigger value="optional">Opcionales</TabsTrigger>
                <TabsTrigger value="restrictions">Restricciones</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Nombre del Combo *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      placeholder="Ej: Combo Tintes Premium"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="price">Precio del Combo (Q) *</Label>
                    <Input
                      id="price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => handleChange("price", Number.parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Descripción *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleChange("description", e.target.value)}
                    placeholder="Describe el combo y sus beneficios"
                    rows={3}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="totalProducts">Cantidad Total de Productos *</Label>
                  <Input
                    id="totalProducts"
                    type="number"
                    min="1"
                    value={formData.totalProducts}
                    onChange={(e) => handleChange("totalProducts", Number.parseInt(e.target.value) || 1)}
                    placeholder="5"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Número total de productos que incluye el combo</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="validFrom">Válido Desde *</Label>
                    <ModernDatePicker
                      value={formData.validFrom}
                      onChange={(value) => handleChange("validFrom", value)}
                      placeholder="Seleccionar fecha de inicio"
                    />
                  </div>
                  <div>
                    <Label htmlFor="validTo">Válido Hasta *</Label>
                    <ModernDatePicker
                      value={formData.validTo}
                      onChange={(value) => handleChange("validTo", value)}
                      placeholder="Seleccionar fecha de fin"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="products" className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <Label>Productos Fijos (Siempre Incluidos)</Label>
                    <Button type="button" size="sm" onClick={addFixedProduct}>
                      <Plus className="w-4 h-4 mr-1" />
                      Agregar
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {formData.fixedProducts.map((product, index) => (
                      <Card key={`fixed-product-${index}`} className="p-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                          <div>
                            <Label>Producto *</Label>
                            <select
                              value={product.productId}
                              onChange={(e) => updateFixedProduct(index, "productId", e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              required
                            >
                              <option value="">Seleccionar producto</option>
                              {activeProducts.map((p) => (
                                <option key={`product-option-${p.id}`} value={p.id}>
                                  {p.name} - Q{p.price}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <Label>Cantidad *</Label>
                            <Input
                              type="number"
                              min="1"
                              value={product.quantity}
                              onChange={(e) =>
                                updateFixedProduct(index, "quantity", Number.parseInt(e.target.value) || 1)
                              }
                              required
                            />
                          </div>
                          <Button type="button" variant="outline" size="sm" onClick={() => removeFixedProduct(index)}>
                            <Minus className="w-4 h-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {formData.fixedProducts.length === 0 && (
                    <p className="text-gray-500 text-sm text-center py-4">No hay productos fijos configurados</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="optional" className="space-y-4">
                <div>
                  <Label>Líneas de Productos Opcionales</Label>
                  <Card className="p-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {categories
                        .filter((category) => category && category.trim())
                        .map((category) => (
                          <div key={`category-${category}`} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`category-${category}`}
                              checked={formData.optionalProductLines.includes(category)}
                              onChange={() => toggleProductLine(category)}
                              className="rounded border-gray-300"
                            />
                            <label htmlFor={`category-${category}`} className="text-sm">
                              {category}
                            </label>
                          </div>
                        ))}
                    </div>
                  </Card>
                  <p className="text-xs text-gray-500">El cliente podrá elegir productos de estas líneas</p>
                </div>

                <div>
                  <Label>O Productos Específicos Opcionales</Label>
                  <Card className="p-4 max-h-60 overflow-y-auto">
                    <div className="space-y-2">
                      {activeProducts.map((product) => (
                        <div key={`optional-product-${product.id}`} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`optional-${product.id}`}
                            checked={formData.optionalProductIds?.includes(product.id) || false}
                            onChange={() => toggleOptionalProduct(product.id)}
                            className="rounded border-gray-300"
                          />
                          <label htmlFor={`optional-${product.id}`} className="flex-1 text-sm">
                            {product.name} - Q{product.price.toLocaleString()}
                          </label>
                        </div>
                      ))}
                    </div>
                  </Card>
                  <p className="text-xs text-gray-500">Productos específicos que el cliente puede elegir</p>
                </div>
              </TabsContent>

              <TabsContent value="restrictions" className="space-y-4">
                <div className="bg-amber-50 p-4 rounded-lg">
                  <h3 className="font-medium text-amber-900 mb-2">Restricciones del Combo</h3>
                  <p className="text-sm text-amber-700">
                    Configura quién puede acceder a este combo. Si no seleccionas ninguna restricción, estará disponible
                    para todos.
                  </p>
                </div>

                {/* Restricciones por región */}
                <Card className="p-4">
                  <h4 className="font-medium mb-3">Restricciones por Región</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Selecciona las regiones donde estará disponible este combo:
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {regions
                      .filter((region) => region && region.trim())
                      .map((region) => (
                        <div key={`region-${region}`} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`region-${region}`}
                            checked={formData.restrictions.regions.includes(region)}
                            onChange={(e) => {
                              const newRegions = e.target.checked
                                ? [...formData.restrictions.regions, region]
                                : formData.restrictions.regions.filter((r) => r !== region)
                              handleChange("restrictions", {
                                ...formData.restrictions,
                                regions: newRegions,
                              })
                            }}
                            className="rounded border-gray-300"
                          />
                          <label htmlFor={`region-${region}`} className="text-sm">
                            {region}
                          </label>
                        </div>
                      ))}
                  </div>
                </Card>

                {/* Restricciones por vendedor */}
                <Card className="p-4">
                  <h4 className="font-medium mb-3">Restricciones por Vendedor</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Busca y selecciona los vendedores que pueden ofrecer este combo:
                  </p>

                  <div className="mb-4">
                    <Input
                      placeholder="Buscar vendedor por nombre o región..."
                      value={vendorSearch}
                      onChange={(e) => setVendorSearch(e.target.value)}
                      className="w-full"
                    />
                  </div>

                  {/* Vendedores seleccionados */}
                  {formData.restrictions.vendorIds && formData.restrictions.vendorIds.length > 0 && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-700 font-medium mb-2">
                        {formData.restrictions.vendorIds.length} vendedor(es) seleccionado(s):
                      </p>
                      <div className="space-y-2">
                        {formData.restrictions.vendorIds.map((vendorId) => {
                          const vendor = (vendors || []).find((v) => v.idt === vendorId)
                          return vendor ? (
                            <div
                              key={vendorId}
                              className="flex items-center justify-between bg-white p-2 rounded border"
                            >
                              <div>
                                <span className="font-medium text-sm">
                                  {vendor.codigo} - {vendor.primer_nombre} {vendor.primer_apellido}
                                </span>
                                <p className="text-xs text-gray-500">
                                  Ruta {vendor.numero_ruta} • {vendor.telefono}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  handleChange("restrictions", {
                                    ...formData.restrictions,
                                    vendorIds: formData.restrictions.vendorIds.filter((id) => id !== vendorId),
                                  })
                                }}
                                className="text-red-500 hover:text-red-700"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : null
                        })}
                      </div>
                    </div>
                  )}

                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {(vendors || [])
                      .sort((a, b) => {
                        const aSelected = formData.restrictions.vendorIds?.includes(a.idt) || false
                        const bSelected = formData.restrictions.vendorIds?.includes(b.idt) || false
                        if (aSelected && !bSelected) return -1
                        if (!aSelected && bSelected) return 1
                        return 0
                      })
                      .filter((vendor) => {
                        if (!vendor || !vendor.primer_nombre || !vendor.primer_apellido) return false
                        const searchLower = vendorSearch.toLowerCase()
                        return (
                          vendor.activo &&
                          (vendor.primer_nombre.toLowerCase().includes(searchLower) ||
                            vendor.primer_apellido.toLowerCase().includes(searchLower) ||
                            (vendor.numero_ruta && vendor.numero_ruta.toLowerCase().includes(searchLower)))
                        )
                      })
                      .map((vendor) => {
                        const isSelected = formData.restrictions.vendorIds?.includes(vendor.idt) || false
                        return (
                          <div
                            key={vendor.idt}
                            className={`flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 ${
                              isSelected ? "border-blue-500 bg-blue-50" : ""
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                id={`vendor-${vendor.idt}`}
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    handleChange("restrictions", {
                                      ...formData.restrictions,
                                      vendorIds: [...formData.restrictions.vendorIds, vendor.idt],
                                    })
                                  } else {
                                    handleChange("restrictions", {
                                      ...formData.restrictions,
                                      vendorIds: formData.restrictions.vendorIds.filter((id) => id !== vendor.idt),
                                    })
                                  }
                                }}
                                className="rounded border-gray-300"
                              />
                              <div>
                                <label htmlFor={`vendor-${vendor.idt}`} className="font-medium">
                                  {vendor.codigo} - {vendor.primer_nombre} {vendor.primer_apellido}
                                </label>
                                <p className="text-sm text-gray-500">
                                  Ruta {vendor.numero_ruta} • {vendor.telefono}
                                </p>
                                {vendor.es_supervisor && (
                                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                    Supervisor
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-sm text-gray-400">{vendor.correo}</div>
                          </div>
                        )
                      })}
                  </div>
                </Card>

                <Card className="p-4">
                  <h4 className="font-medium mb-3">Restricciones por Cliente</h4>
                  <p className="text-sm text-gray-600 mb-4">Elige cómo quieres restringir el acceso por cliente:</p>

                  {/* Selector de tipo de restricción */}
                  <div className="mb-6">
                    <Label className="text-sm font-medium mb-3 block">Tipo de restricción:</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Card
                        className={`p-4 cursor-pointer border-2 transition-all ${
                          customerRestrictionType === "channel"
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-blue-300"
                        }`}
                        onClick={() => {
                          setCustomerRestrictionType("channel")
                          // Limpiar restricciones de clientes específicos
                          handleChange("restrictions", {
                            ...formData.restrictions,
                            customerCriteria: {
                              ...formData.restrictions.customerCriteria,
                              codes: [],
                            },
                          })
                          setCustomerCodeSearch("")
                        }}
                      >
                        <div className="text-center">
                          <h5 className="font-medium mb-2">Por Canal</h5>
                          <p className="text-sm text-gray-600">
                            Restringir por tipo de canal (Mayorista, Minorista, etc.)
                          </p>
                        </div>
                      </Card>

                      <Card
                        className={`p-4 cursor-pointer border-2 transition-all ${
                          customerRestrictionType === "specific"
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-blue-300"
                        }`}
                        onClick={() => {
                          setCustomerRestrictionType("specific")
                          // Limpiar restricciones de canales
                          handleChange("restrictions", {
                            ...formData.restrictions,
                            customerCriteria: {
                              ...formData.restrictions.customerCriteria,
                              channels: [],
                            },
                          })
                        }}
                      >
                        <div className="text-center">
                          <h5 className="font-medium mb-2">Por Cliente Específico</h5>
                          <p className="text-sm text-gray-600">
                            Restringir a clientes específicos por código o búsqueda
                          </p>
                        </div>
                      </Card>
                    </div>
                  </div>

                  {/* Restricción por canal */}
                  {customerRestrictionType === "channel" && (
                    <div>
                      <Label className="text-sm font-medium">Canales de cliente permitidos:</Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                        {channels
                          .filter((channel) => channel && channel.trim())
                          .map((channel) => (
                            <div key={`channel-${channel}`} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`channel-${channel}`}
                                checked={formData.restrictions.customerCriteria.channels.includes(channel)}
                                onChange={(e) => {
                                  const newChannels = e.target.checked
                                    ? [...formData.restrictions.customerCriteria.channels, channel]
                                    : formData.restrictions.customerCriteria.channels.filter((c) => c !== channel)
                                  handleChange("restrictions", {
                                    ...formData.restrictions,
                                    customerCriteria: {
                                      ...formData.restrictions.customerCriteria,
                                      channels: newChannels,
                                    },
                                  })
                                }}
                                className="rounded border-gray-300"
                              />
                              <label htmlFor={`channel-${channel}`} className="text-sm">
                                {channel}
                              </label>
                            </div>
                          ))}
                      </div>

                      {formData.restrictions.customerCriteria.channels.length > 0 && (
                        <div className="mt-3 p-2 bg-blue-50 rounded">
                          <p className="text-sm text-blue-700">
                            {formData.restrictions.customerCriteria.channels.length} canal(es) seleccionado(s):{" "}
                            {formData.restrictions.customerCriteria.channels.join(", ")}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Restricción por cliente específico */}
                  {customerRestrictionType === "specific" && (
                    <div>
                      <Label className="text-sm font-medium">Clientes específicos:</Label>
                      <p className="text-xs text-gray-500 mb-3">
                        Busca clientes por código, nombre, NIT, razón social, dirección o teléfono:
                      </p>

                      <div className="space-y-3">
                        <Input
                          placeholder="Buscar cliente por cualquier campo..."
                          value={customerCodeSearch}
                          onChange={(e) => setCustomerCodeSearch(e.target.value)}
                          className="w-full"
                        />

                        {customerCodeSearch && (
                          <div className="max-h-48 overflow-y-auto border rounded-lg">
                            {(customers || [])
                              .filter((customer) => {
                                if (!customer) return false
                                const searchLower = customerCodeSearch.toLowerCase()
                                return (
                                  (customer.code && customer.code.toLowerCase().includes(searchLower)) ||
                                  (customer.name && customer.name.toLowerCase().includes(searchLower)) ||
                                  (customer.email && customer.email.toLowerCase().includes(searchLower)) ||
                                  (customer.phone && customer.phone.includes(searchLower)) ||
                                  (customer.address && customer.address.toLowerCase().includes(searchLower)) ||
                                  (customer.nit && customer.nit.toLowerCase().includes(searchLower)) ||
                                  (customer.razonSocial && customer.razonSocial.toLowerCase().includes(searchLower)) ||
                                  (customer.channel && customer.channel.toLowerCase().includes(searchLower)) ||
                                  (customer.region && customer.region.toLowerCase().includes(searchLower))
                                )
                              })
                              .slice(0, 10)
                              .map((customer) => {
                                const isSelected = formData.restrictions.customerCriteria.codes.includes(customer.code)
                                return (
                                  <div
                                    key={customer.id}
                                    className={`p-3 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer ${
                                      isSelected ? "bg-green-50 border-green-200" : ""
                                    }`}
                                    onClick={() => {
                                      if (isSelected) {
                                        handleChange("restrictions", {
                                          ...formData.restrictions,
                                          customerCriteria: {
                                            ...formData.restrictions.customerCriteria,
                                            codes: formData.restrictions.customerCriteria.codes.filter(
                                              (code) => code !== customer.code,
                                            ),
                                          },
                                        })
                                      } else {
                                        handleChange("restrictions", {
                                          ...formData.restrictions,
                                          customerCriteria: {
                                            ...formData.restrictions.customerCriteria,
                                            codes: [...formData.restrictions.customerCriteria.codes, customer.code],
                                          },
                                        })
                                      }
                                    }}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium text-sm">
                                            {customer.code} - {customer.name}
                                          </span>
                                          {isSelected && (
                                            <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                              <Check className="w-2 h-2 text-white" />
                                            </div>
                                          )}
                                        </div>
                                        <div className="text-xs text-gray-600 mt-1">
                                          <span className="font-medium">Canal:</span> {customer.channel}
                                        </div>
                                        {customer.nit && (
                                          <div className="text-xs text-gray-600">
                                            <span className="font-medium">NIT:</span> {customer.nit}
                                          </div>
                                        )}
                                        {customer.razonSocial && (
                                          <div className="text-xs text-gray-600">
                                            <span className="font-medium">Razón Social:</span> {customer.razonSocial}
                                          </div>
                                        )}
                                        <div className="text-xs text-gray-500 mt-1">
                                          {customer.address} • {customer.phone}
                                        </div>
                                        <div className="text-xs text-blue-600">
                                          {customer.region} - {customer.route}
                                        </div>
                                      </div>
                                      <Button
                                        type="button"
                                        variant={isSelected ? "default" : "outline"}
                                        size="sm"
                                        className={isSelected ? "bg-green-600 hover:bg-green-700" : ""}
                                      >
                                        {isSelected ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                                      </Button>
                                    </div>
                                  </div>
                                )
                              })}
                          </div>
                        )}

                        {formData.restrictions.customerCriteria.codes.length > 0 && (
                          <div className="p-3 bg-green-50 rounded-lg">
                            <p className="text-sm text-green-700 font-medium mb-2">
                              {formData.restrictions.customerCriteria.codes.length} cliente(s) seleccionado(s):
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {formData.restrictions.customerCriteria.codes.map((code) => {
                                const customer = (customers || []).find((c) => c.code === code)
                                return (
                                  <div
                                    key={code}
                                    className="flex items-center gap-1 bg-white px-2 py-1 rounded border text-xs"
                                  >
                                    <span>{customer ? `${code} - ${customer.name}` : code}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleChange("restrictions", {
                                          ...formData.restrictions,
                                          customerCriteria: {
                                            ...formData.restrictions.customerCriteria,
                                            codes: formData.restrictions.customerCriteria.codes.filter(
                                              (c) => c !== code,
                                            ),
                                          },
                                        })
                                      }}
                                      className="text-red-500 hover:text-red-700"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              </TabsContent>
            </Tabs>

            <div className="flex items-center space-x-2">
              <input
                id="isActive"
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => handleChange("isActive", e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="isActive">Combo activo</Label>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" className="flex-1">
                {combo ? "Actualizar" : "Crear"} Combo
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
