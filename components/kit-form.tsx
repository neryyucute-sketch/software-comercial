"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ModernDatePicker } from "@/components/ui/modern-date-picker"
import { usePreventa } from "@/contexts/preventa-context"
import { X, Plus, Minus, Package, Info, ShoppingCart, Shield, ChevronLeft, ChevronRight, Check } from "lucide-react"
import type { Kit, ComboProduct, ComboRestrictions } from "@/lib/types"

interface KitFormProps {
  kit?: Kit | null
  onClose: () => void
}

export function KitForm({ kit, onClose }: KitFormProps) {
  const { products, customers, vendors, addKit, updateKit } = usePreventa()
  const [activeTab, setActiveTab] = useState("basic")
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: 0,
    validFrom: "",
    validTo: "",
    isActive: true,
  })
  const [kitProducts, setKitProducts] = useState<ComboProduct[]>([])
  const [restrictions, setRestrictions] = useState<ComboRestrictions>({
    regions: undefined,
    vendorIds: undefined,
    customerCriteria: {
      channels: undefined,
      codes: undefined,
    },
  })

  const [customerRestrictionType, setCustomerRestrictionType] = useState<"channel" | "specific">("channel")

  // Datos derivados para los selectores
  const categories = [...new Set((products || []).map((p) => p.category))]
  const regions = [...new Set((customers || []).map((c) => c.region))]
  const channels = [...new Set((customers || []).map((c) => c.channel))]
  const codes = [...new Set((customers || []).map((c) => c.code))]

  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [searchTerm, setSearchTerm] = useState("")
  const [customerCodeSearch, setCustomerCodeSearch] = useState("")
  const [vendorSearch, setVendorSearch] = useState("")
  const [categoryIndex, setCategoryIndex] = useState(0)

  useEffect(() => {
    if (kit) {
      const validFromDate = new Date(kit.validFrom)
      const validToDate = new Date(kit.validTo)

      setFormData({
        name: kit.name,
        description: kit.description,
        price: kit.price,
        validFrom: `${validFromDate.getFullYear()}-${String(validFromDate.getMonth() + 1).padStart(2, "0")}-${String(validFromDate.getDate()).padStart(2, "0")}`,
        validTo: `${validToDate.getFullYear()}-${String(validToDate.getMonth() + 1).padStart(2, "0")}-${String(validToDate.getDate()).padStart(2, "0")}`,
        isActive: kit.isActive,
      })
      setKitProducts(kit.products)
      setRestrictions(kit.restrictions)

      if (kit.restrictions.customerCriteria?.codes && kit.restrictions.customerCriteria.codes.length > 0) {
        setCustomerRestrictionType("specific")
      } else {
        setCustomerRestrictionType("channel")
      }
    }
  }, [kit])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      alert("El nombre del kit es requerido")
      return
    }

    if (!formData.description.trim()) {
      alert("La descripción del kit es requerida")
      return
    }

    if (formData.price <= 0) {
      alert("El precio del kit debe ser mayor a 0")
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

    if (kitProducts.length === 0) {
      alert("Debes agregar al menos un producto al kit")
      return
    }

    const kitData: Omit<Kit, "id" | "createdAt"> = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      price: formData.price,
      products: kitProducts,
      restrictions,
      isActive: formData.isActive,
      validFrom: new Date(formData.validFrom),
      validTo: new Date(formData.validTo),
    }

    if (kit) {
      updateKit(kit.id, kitData)
    } else {
      addKit(kitData)
    }

    onClose()
  }

  const addProduct = (productId: string) => {
    const existingIndex = kitProducts.findIndex((p) => p.productId === productId)
    if (existingIndex >= 0) {
      const updated = [...kitProducts]
      updated[existingIndex].quantity += 1
      setKitProducts(updated)
    } else {
      setKitProducts([...kitProducts, { productId, isFixed: true, quantity: 1 }])
    }
  }

  const updateProductQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setKitProducts(kitProducts.filter((p) => p.productId !== productId))
    } else {
      const updated = kitProducts.map((p) => (p.productId === productId ? { ...p, quantity } : p))
      setKitProducts(updated)
    }
  }

  const removeProduct = (productId: string) => {
    setKitProducts(kitProducts.filter((p) => p.productId !== productId))
  }

  const getTotalValue = () => {
    return kitProducts.reduce((total, kitProduct) => {
      const product = products?.find((p) => p.id === kitProduct.productId)
      return total + (product ? product.price * kitProduct.quantity : 0)
    }, 0)
  }

  const isProductSelected = (productId: string) => {
    return kitProducts.some((kp) => kp.productId === productId)
  }

  const filteredCategories = categories.filter(
    (category) => category && category.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const filteredProducts = selectedCategory
    ? (products || []).filter(
        (p) =>
          p.category === selectedCategory &&
          p.isActive &&
          p.name &&
          p.name.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    : (products || []).filter((p) => p.isActive && p.name && p.name.toLowerCase().includes(searchTerm.toLowerCase()))

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            {kit ? "Editar Kit" : "Crear Nuevo Kit"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic" className="flex items-center gap-2">
                <Info className="w-4 h-4" />
                Básico
              </TabsTrigger>
              <TabsTrigger value="products" className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                Productos
              </TabsTrigger>
              <TabsTrigger value="restrictions" className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Restricciones
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nombre del Kit *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Kit Oficina Básica"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="price">Precio del Kit (Q) *</Label>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number.parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Descripción *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe el kit y sus beneficios..."
                  rows={4}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="validFrom">Válido desde *</Label>
                  <ModernDatePicker
                    value={formData.validFrom}
                    onChange={(value) => setFormData({ ...formData, validFrom: value })}
                    placeholder="Seleccionar fecha de inicio"
                  />
                </div>
                <div>
                  <Label htmlFor="validTo">Válido hasta *</Label>
                  <ModernDatePicker
                    value={formData.validTo}
                    onChange={(value) => setFormData({ ...formData, validTo: value })}
                    placeholder="Seleccionar fecha de fin"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked as boolean })}
                />
                <Label htmlFor="isActive">Kit activo</Label>
              </div>
            </TabsContent>

            <TabsContent value="products" className="space-y-4 mt-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">Productos del Kit</h3>
                <p className="text-sm text-blue-700">
                  Todos los productos en un kit son fijos. Los clientes no pueden modificar la selección.
                </p>
              </div>

              {/* Lista de productos agregados */}
              {kitProducts.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium">Productos incluidos ({kitProducts.length}):</h4>
                  {kitProducts.map((kitProduct) => {
                    const product = products?.find((p) => p.id === kitProduct.productId)
                    return (
                      <Card key={kitProduct.productId} className="p-4">
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <h5 className="font-medium">{product?.name}</h5>
                            <p className="text-sm text-gray-600">
                              Q{product?.price.toLocaleString()} × {kitProduct.quantity} = Q
                              {product ? (product.price * kitProduct.quantity).toLocaleString() : "0"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => updateProductQuantity(kitProduct.productId, kitProduct.quantity - 1)}
                              disabled={kitProduct.quantity <= 1}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="w-8 text-center font-medium">{kitProduct.quantity}</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => updateProductQuantity(kitProduct.productId, kitProduct.quantity + 1)}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeProduct(kitProduct.productId)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    )
                  })}

                  <Card className="bg-gradient-to-r from-blue-50 to-green-50 p-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Valor total de productos:</span>
                        <span className="text-lg font-bold text-blue-600">Q{getTotalValue().toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Precio del kit:</span>
                        <span className="text-sm font-medium">Q{formData.price.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Descuento para el cliente:</span>
                        <span className="text-sm font-bold text-green-600">
                          Q{(getTotalValue() - formData.price).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Buscar productos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  {selectedCategory && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setSelectedCategory("")
                      }}
                    >
                      Ver todas las líneas
                    </Button>
                  )}
                </div>

                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-medium">Líneas de producto:</h4>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCategoryIndex(Math.max(0, categoryIndex - 3))}
                        disabled={categoryIndex === 0}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCategoryIndex(Math.min(categories.length - 3, categoryIndex + 3))}
                        disabled={categoryIndex >= categories.length - 3}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {categories.slice(categoryIndex, categoryIndex + 3).map((category) => {
                      const categoryProducts = (products || []).filter((p) => p.category === category && p.isActive)
                      return (
                        <Card
                          key={category}
                          className={`p-4 cursor-pointer hover:shadow-md transition-shadow border-2 ${
                            selectedCategory === category ? "border-blue-500 bg-blue-50" : "hover:border-blue-300"
                          }`}
                          onClick={() => setSelectedCategory(category)}
                        >
                          <div className="text-center">
                            <h5 className="font-medium mb-2">{category}</h5>
                            <p className="text-sm text-gray-600">{categoryProducts.length} productos</p>
                            <div className="mt-3">
                              <Button
                                type="button"
                                variant={selectedCategory === category ? "default" : "outline"}
                                size="sm"
                              >
                                {selectedCategory === category ? "Seleccionada" : "Ver productos"}
                              </Button>
                            </div>
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                </div>

                {selectedCategory && (
                  <div>
                    <h4 className="font-medium mb-3">
                      Productos de: <span className="text-blue-600">{selectedCategory}</span>
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                      {filteredProducts.map((product) => {
                        const isSelected = isProductSelected(product.id)
                        return (
                          <Card
                            key={product.id}
                            className={`p-4 transition-all ${
                              isSelected ? "border-green-500 bg-green-50 shadow-md" : "hover:shadow-md border-gray-200"
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h6 className="font-medium text-sm">{product.name}</h6>
                                  {isSelected && (
                                    <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                                      <Check className="w-3 h-3 text-white" />
                                    </div>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 mt-1">Q{product.price.toLocaleString()}</p>
                                <p className="text-xs text-gray-500 mt-1">Stock: {product.stock}</p>
                              </div>
                              <Button
                                type="button"
                                variant={isSelected ? "default" : "outline"}
                                size="sm"
                                onClick={() => addProduct(product.id)}
                                disabled={isSelected}
                                className={isSelected ? "bg-green-600 hover:bg-green-700" : ""}
                              >
                                {isSelected ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                              </Button>
                            </div>
                          </Card>
                        )
                      })}
                    </div>
                  </div>
                )}

                {searchTerm && (
                  <div>
                    <h4 className="font-medium mb-3">Resultados de búsqueda: "{searchTerm}"</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                      {filteredProducts.map((product) => {
                        const isSelected = isProductSelected(product.id)
                        return (
                          <Card
                            key={product.id}
                            className={`p-4 transition-all ${
                              isSelected ? "border-green-500 bg-green-50 shadow-md" : "hover:shadow-md border-gray-200"
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h6 className="font-medium text-sm">{product.name}</h6>
                                  {isSelected && (
                                    <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                                      <Check className="w-3 h-3 text-white" />
                                    </div>
                                  )}
                                </div>
                                <p className="text-sm text-blue-600 mt-1">{product.category}</p>
                                <p className="text-sm text-gray-600">Q{product.price.toLocaleString()}</p>
                                <p className="text-xs text-gray-500 mt-1">Stock: {product.stock}</p>
                              </div>
                              <Button
                                type="button"
                                variant={isSelected ? "default" : "outline"}
                                size="sm"
                                onClick={() => addProduct(product.id)}
                                disabled={isSelected}
                                className={isSelected ? "bg-green-600 hover:bg-green-700" : ""}
                              >
                                {isSelected ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                              </Button>
                            </div>
                          </Card>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="restrictions" className="space-y-6 mt-6">
              <div className="bg-amber-50 p-4 rounded-lg">
                <h3 className="font-medium text-amber-900 mb-2">Restricciones del Kit</h3>
                <p className="text-sm text-amber-700">
                  Configura quién puede acceder a este kit. Si no seleccionas ninguna restricción, estará disponible
                  para todos.
                </p>
              </div>

              {/* Restricciones por región */}
              <Card className="p-4">
                <h4 className="font-medium mb-3">Restricciones por Región</h4>
                <p className="text-sm text-gray-600 mb-3">Selecciona las regiones donde estará disponible este kit:</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {regions.map((region) => (
                    <div key={region} className="flex items-center space-x-2">
                      <Checkbox
                        id={`region-${region}`}
                        checked={restrictions.regions?.includes(region) || false}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setRestrictions({
                              ...restrictions,
                              regions: [...(restrictions.regions || []), region],
                            })
                          } else {
                            setRestrictions({
                              ...restrictions,
                              regions: restrictions.regions?.filter((r) => r !== region),
                            })
                          }
                        }}
                      />
                      <Label htmlFor={`region-${region}`} className="text-sm">
                        {region}
                      </Label>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Restricciones por vendedor */}
              <Card className="p-4">
                <h4 className="font-medium mb-3">Restricciones por Vendedor</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Busca y selecciona los vendedores que pueden ofrecer este kit:
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
                {restrictions.vendorIds && restrictions.vendorIds.length > 0 && (
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-700 font-medium mb-2">
                      {restrictions.vendorIds.length} vendedor(es) seleccionado(s):
                    </p>
                    <div className="space-y-2">
                      {restrictions.vendorIds.map((vendorId) => {
                        const vendor = (vendors || []).find((v) => v.idt === vendorId)
                        return vendor ? (
                          <div key={vendorId} className="flex items-center justify-between bg-white p-2 rounded border">
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
                                setRestrictions({
                                  ...restrictions,
                                  vendorIds: restrictions.vendorIds?.filter((id) => id !== vendorId),
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
                      const aSelected = restrictions.vendorIds?.includes(a.idt) || false
                      const bSelected = restrictions.vendorIds?.includes(b.idt) || false
                      if (aSelected && !bSelected) return -1
                      if (!aSelected && bSelected) return 1
                      return 0
                    })
                    .filter(
                      (vendor) =>
                        vendor.activo &&
                        (vendor.primer_nombre.toLowerCase().includes(vendorSearch.toLowerCase()) ||
                          vendor.primer_apellido.toLowerCase().includes(vendorSearch.toLowerCase()) ||
                          vendor.numero_ruta.toLowerCase().includes(vendorSearch.toLowerCase())),
                    )
                    .map((vendor) => {
                      const isSelected = restrictions.vendorIds?.includes(vendor.idt) || false
                      return (
                        <div
                          key={vendor.idt}
                          className={`flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 ${
                            isSelected ? "border-blue-500 bg-blue-50" : ""
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <Checkbox
                              id={`vendor-${vendor.idt}`}
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setRestrictions({
                                    ...restrictions,
                                    vendorIds: [...(restrictions.vendorIds || []), vendor.idt],
                                  })
                                } else {
                                  setRestrictions({
                                    ...restrictions,
                                    vendorIds: restrictions.vendorIds?.filter((id) => id !== vendor.idt),
                                  })
                                }
                              }}
                            />
                            <div>
                              <Label htmlFor={`vendor-${vendor.idt}`} className="font-medium">
                                {vendor.codigo} - {vendor.primer_nombre} {vendor.primer_apellido}
                              </Label>
                              <p className="text-sm text-gray-500">
                                Ruta {vendor.numero_ruta} • {vendor.telefono}
                              </p>
                              {vendor.es_supervisor && (
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Supervisor</span>
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
                        setRestrictions({
                          ...restrictions,
                          customerCriteria: {
                            ...restrictions.customerCriteria,
                            codes: undefined,
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
                        setRestrictions({
                          ...restrictions,
                          customerCriteria: {
                            ...restrictions.customerCriteria,
                            channels: undefined,
                          },
                        })
                      }}
                    >
                      <div className="text-center">
                        <h5 className="font-medium mb-2">Por Cliente Específico</h5>
                        <p className="text-sm text-gray-600">Restringir a clientes específicos por código o búsqueda</p>
                      </div>
                    </Card>
                  </div>
                </div>

                {/* Restricción por canal */}
                {customerRestrictionType === "channel" && (
                  <div>
                    <Label className="text-sm font-medium">Canales de cliente permitidos:</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                      {channels.map((channel) => (
                        <div key={channel} className="flex items-center space-x-2">
                          <Checkbox
                            id={`channel-${channel}`}
                            checked={restrictions.customerCriteria?.channels?.includes(channel) || false}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setRestrictions({
                                  ...restrictions,
                                  customerCriteria: {
                                    ...restrictions.customerCriteria,
                                    channels: [...(restrictions.customerCriteria?.channels || []), channel],
                                  },
                                })
                              } else {
                                setRestrictions({
                                  ...restrictions,
                                  customerCriteria: {
                                    ...restrictions.customerCriteria,
                                    channels: restrictions.customerCriteria?.channels?.filter((c) => c !== channel),
                                  },
                                })
                              }
                            }}
                          />
                          <Label htmlFor={`channel-${channel}`} className="text-sm">
                            {channel}
                          </Label>
                        </div>
                      ))}
                    </div>

                    {restrictions.customerCriteria?.channels && restrictions.customerCriteria.channels.length > 0 && (
                      <div className="mt-3 p-2 bg-blue-50 rounded">
                        <p className="text-sm text-blue-700">
                          {restrictions.customerCriteria.channels.length} canal(es) seleccionado(s):{" "}
                          {restrictions.customerCriteria.channels.join(", ")}
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
                              const searchLower = customerCodeSearch.toLowerCase()
                              return (
                                customer.code.toLowerCase().includes(searchLower) ||
                                customer.name.toLowerCase().includes(searchLower) ||
                                customer.email.toLowerCase().includes(searchLower) ||
                                customer.phone.toLowerCase().includes(searchLower) ||
                                customer.address.toLowerCase().includes(searchLower) ||
                                customer.nit?.toLowerCase().includes(searchLower) ||
                                customer.razonSocial?.toLowerCase().includes(searchLower) ||
                                customer.channel.toLowerCase().includes(searchLower) ||
                                customer.region.toLowerCase().includes(searchLower)
                              )
                            })
                            .slice(0, 10) // Limitar a 10 resultados para performance
                            .map((customer) => {
                              const isSelected = restrictions.customerCriteria?.codes?.includes(customer.code) || false
                              return (
                                <div
                                  key={customer.id}
                                  className={`p-3 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer ${
                                    isSelected ? "bg-green-50 border-green-200" : ""
                                  }`}
                                  onClick={() => {
                                    if (isSelected) {
                                      // Remover cliente
                                      setRestrictions({
                                        ...restrictions,
                                        customerCriteria: {
                                          ...restrictions.customerCriteria,
                                          codes: restrictions.customerCriteria?.codes?.filter(
                                            (code) => code !== customer.code,
                                          ),
                                        },
                                      })
                                    } else {
                                      // Agregar cliente
                                      setRestrictions({
                                        ...restrictions,
                                        customerCriteria: {
                                          ...restrictions.customerCriteria,
                                          codes: [...(restrictions.customerCriteria?.codes || []), customer.code],
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

                          {customerCodeSearch &&
                            (customers || []).filter((customer) => {
                              const searchLower = customerCodeSearch.toLowerCase()
                              return (
                                customer.code.toLowerCase().includes(searchLower) ||
                                customer.name.toLowerCase().includes(searchLower) ||
                                customer.email.toLowerCase().includes(searchLower) ||
                                customer.phone.toLowerCase().includes(searchLower) ||
                                customer.address.toLowerCase().includes(searchLower) ||
                                customer.nit?.toLowerCase().includes(searchLower) ||
                                customer.razonSocial?.toLowerCase().includes(searchLower) ||
                                customer.channel.toLowerCase().includes(searchLower) ||
                                customer.region.toLowerCase().includes(searchLower)
                              )
                            }).length === 0 && (
                              <div className="p-4 text-center text-gray-500">
                                <p className="text-sm">
                                  No se encontraron clientes que coincidan con "{customerCodeSearch}"
                                </p>
                              </div>
                            )}
                        </div>
                      )}

                      {restrictions.customerCriteria?.codes && restrictions.customerCriteria.codes.length > 0 && (
                        <div className="p-3 bg-green-50 rounded-lg">
                          <p className="text-sm text-green-700 font-medium mb-2">
                            {restrictions.customerCriteria.codes.length} cliente(s) seleccionado(s):
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {restrictions.customerCriteria.codes.map((code) => {
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
                                      setRestrictions({
                                        ...restrictions,
                                        customerCriteria: {
                                          ...restrictions.customerCriteria,
                                          codes: restrictions.customerCriteria?.codes?.filter((c) => c !== code),
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
          <div className="flex gap-3 pt-6 border-t">
            <Button type="submit" className="flex-1">
              {kit ? "Actualizar Kit" : "Crear Kit"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
