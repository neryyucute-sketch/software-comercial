"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePreventa } from "@/contexts/preventa-context"
import { useAuth } from "@/contexts/AuthContext"
import { Plus, Search, Edit, Eye, EyeOff, Shield, Gift, Package } from "lucide-react"
import { OfferForm } from "@/components/offer-form"
import { ComboForm } from "@/components/combo-form"
import { KitForm } from "@/components/kit-form"
import type { Offer, Combo, Kit } from "@/lib/types"
import { Tag } from "lucide-react"

export default function OffersPage() {
  const { offers, combos, kits, products, updateOffer, updateCombo, updateKit } = usePreventa()
  const { hasPermission } = useAuth()
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [showOfferForm, setShowOfferForm] = useState(false)
  const [showComboForm, setShowComboForm] = useState(false)
  const [showKitForm, setShowKitForm] = useState(false)
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null)
  const [editingCombo, setEditingCombo] = useState<Combo | null>(null)
  const [editingKit, setEditingKit] = useState<Kit | null>(null)

  const canRead = hasPermission("offers", "read")
  const canCreate = hasPermission("offers", "create")
  const canUpdate = hasPermission("offers", "update")
  const canDelete = hasPermission("offers", "delete")

  if (!canRead) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Shield className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Acceso Denegado</h3>
              <p className="text-muted-foreground">No tienes permisos para ver las ofertas.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const filteredOffers = offers.filter((offer) => {
    const matchesSearch =
      offer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      offer.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = typeFilter === "all" || offer.type === typeFilter
    return matchesSearch && matchesType
  })

  const filteredCombos = combos.filter((combo) => {
    const matchesSearch =
      combo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      combo.description.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  const filteredKits = (kits || []).filter((kit) => {
    const matchesSearch =
      kit.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      kit.description.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  const handleEditOffer = (offer: Offer) => {
    setEditingOffer(offer)
    setShowOfferForm(true)
  }

  const handleEditCombo = (combo: Combo) => {
    setEditingCombo(combo)
    setShowComboForm(true)
  }

  const handleEditKit = (kit: Kit) => {
    setEditingKit(kit)
    setShowKitForm(true)
  }

  const toggleOfferStatus = (offerId: string, isActive: boolean) => {
    updateOffer(offerId, { isActive: !isActive })
  }

  const toggleComboStatus = (comboId: string, isActive: boolean) => {
    updateCombo(comboId, { isActive: !isActive })
  }

  const toggleKitStatus = (kitId: string, isActive: boolean) => {
    updateKit(kitId, { isActive: !isActive })
  }

  const handleOfferFormClose = () => {
    setShowOfferForm(false)
    setEditingOffer(null)
  }

  const handleComboFormClose = () => {
    setShowComboForm(false)
    setEditingCombo(null)
  }

  const handleKitFormClose = () => {
    setShowKitForm(false)
    setEditingKit(null)
  }

  const getOfferTypeBadge = (type: Offer["type"]) => {
    switch (type) {
      case "combo":
        return <Badge variant="default">Combo</Badge>
      case "kit":
        return <Badge variant="secondary">Kit</Badge>
      case "bonus":
        return <Badge className="bg-green-500">Bonificación</Badge>
      case "discount":
        return <Badge variant="destructive">Descuento</Badge>
      default:
        return <Badge variant="outline">Desconocido</Badge>
    }
  }

  const isOfferValid = (offer: Offer) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const validFrom = new Date(offer.validFrom)
    validFrom.setHours(0, 0, 0, 0)

    const validTo = new Date(offer.validTo)
    validTo.setHours(0, 0, 0, 0)

    return today >= validFrom && today <= validTo
  }

  const isComboValid = (combo: Combo) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const validFrom = new Date(combo.validFrom)
    validFrom.setHours(0, 0, 0, 0)

    const validTo = new Date(combo.validTo)
    validTo.setHours(0, 0, 0, 0)

    return today >= validFrom && today <= validTo
  }

  const isKitValid = (kit: Kit) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const validFrom = new Date(kit.validFrom)
    validFrom.setHours(0, 0, 0, 0)

    const validTo = new Date(kit.validTo)
    validTo.setHours(0, 0, 0, 0)

    return today >= validFrom && today <= validTo
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Ofertas y Promociones</h1>
              <p className="mt-2 text-gray-600">Gestiona combos avanzados, kits, bonificaciones y descuentos</p>
            </div>
            {canCreate && (
              <div className="flex gap-2">
                <Button onClick={() => setShowKitForm(true)} className="bg-blue-600 hover:bg-blue-700">
                  <Package className="w-4 h-4 mr-2" />
                  Nuevo Kit
                </Button>
                <Button onClick={() => setShowComboForm(true)} className="bg-purple-600 hover:bg-purple-700">
                  <Gift className="w-4 h-4 mr-2" />
                  Nuevo Combo
                </Button>
                <Button onClick={() => setShowOfferForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nueva Oferta
                </Button>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar ofertas y combos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos los tipos</option>
              <option value="combo">Combos</option>
              <option value="kit">Kits</option>
              <option value="bonus">Bonificaciones</option>
              <option value="discount">Descuentos</option>
            </select>
          </div>

          <Tabs defaultValue="combos" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="combos" className="flex items-center gap-2">
                <Gift className="w-4 h-4" />
                Combos ({filteredCombos.length})
              </TabsTrigger>
              <TabsTrigger value="kits" className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                Kits ({filteredKits.length})
              </TabsTrigger>
              <TabsTrigger value="offers" className="flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Ofertas ({filteredOffers.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="combos" className="mt-6">
              {filteredCombos.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <div className="text-gray-500 text-center">
                      <Gift className="w-12 h-12 mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">No hay combos</h3>
                      <p className="text-sm">
                        {searchTerm
                          ? "No se encontraron combos con los filtros aplicados"
                          : "Comienza creando tu primer combo avanzado"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredCombos.map((combo) => (
                    <Card key={combo.id} className="hover:shadow-lg transition-shadow border-purple-200">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Gift className="w-5 h-5 text-purple-600" />
                              <CardTitle className="text-lg">{combo.name}</CardTitle>
                            </div>
                            <CardDescription className="mt-1">{combo.description}</CardDescription>
                          </div>
                          <div className="flex gap-1 ml-2">
                            {canUpdate && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleComboStatus(combo.id, combo.isActive)}
                                title={combo.isActive ? "Desactivar combo" : "Activar combo"}
                              >
                                {combo.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                              </Button>
                            )}
                            {canUpdate && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditCombo(combo)}
                                title="Editar combo"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="text-center p-3 bg-purple-50 rounded-lg">
                            <div className="text-2xl font-bold text-purple-600">Q{combo.price.toLocaleString()}</div>
                            <div className="text-sm text-gray-600">{combo.totalProducts} productos total</div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-gray-600">Productos fijos:</span>
                              <div className="font-medium">{combo.fixedProducts.length}</div>
                            </div>
                            <div>
                              <span className="text-gray-600">Opcionales:</span>
                              <div className="font-medium">
                                {combo.totalProducts - combo.fixedProducts.reduce((sum, p) => sum + p.quantity, 0)}
                              </div>
                            </div>
                          </div>

                          {(combo.restrictions.regions ||
                            combo.restrictions.vendorIds ||
                            combo.restrictions.customerCriteria?.channels) && (
                            <div className="text-xs text-gray-500">
                              <div className="font-medium mb-1">Restricciones:</div>
                              {combo.restrictions.regions && (
                                <div>• Regiones: {combo.restrictions.regions.join(", ")}</div>
                              )}
                              {combo.restrictions.customerCriteria?.channels && (
                                <div>• Canales: {combo.restrictions.customerCriteria.channels.join(", ")}</div>
                              )}
                            </div>
                          )}

                          <div className="text-xs text-gray-500">
                            <div>Válido desde: {new Date(combo.validFrom).toLocaleDateString()}</div>
                            <div>Válido hasta: {new Date(combo.validTo).toLocaleDateString()}</div>
                          </div>

                          <div className="flex gap-2">
                            <Badge variant={combo.isActive ? "default" : "secondary"}>
                              {combo.isActive ? "Activo" : "Inactivo"}
                            </Badge>
                            <Badge variant={isComboValid(combo) ? "default" : "destructive"}>
                              {isComboValid(combo) ? "Vigente" : "Vencido"}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="kits" className="mt-6">
              {filteredKits.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <div className="text-gray-500 text-center">
                      <Package className="w-12 h-12 mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">No hay kits</h3>
                      <p className="text-sm">
                        {searchTerm
                          ? "No se encontraron kits con los filtros aplicados"
                          : "Comienza creando tu primer kit"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredKits.map((kit) => (
                    <Card key={kit.id} className="hover:shadow-lg transition-shadow border-blue-200">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Package className="w-5 h-5 text-blue-600" />
                              <CardTitle className="text-lg">{kit.name}</CardTitle>
                            </div>
                            <CardDescription className="mt-1">{kit.description}</CardDescription>
                          </div>
                          <div className="flex gap-1 ml-2">
                            {canUpdate && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleKitStatus(kit.id, kit.isActive)}
                                title={kit.isActive ? "Desactivar kit" : "Activar kit"}
                              >
                                {kit.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                              </Button>
                            )}
                            {canUpdate && (
                              <Button variant="ghost" size="sm" onClick={() => handleEditKit(kit)} title="Editar kit">
                                <Edit className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="text-center p-3 bg-blue-50 rounded-lg">
                            <div className="text-2xl font-bold text-blue-600">Q{kit.price.toLocaleString()}</div>
                            <div className="text-sm text-gray-600">{kit.products.length} productos fijos</div>
                          </div>

                          <div className="text-sm">
                            <span className="text-gray-600">Productos incluidos:</span>
                            <div className="mt-1 space-y-1">
                              {kit.products.slice(0, 3).map((kitProduct) => {
                                const product = products?.find((p) => p.id === kitProduct.productId)
                                return (
                                  <div key={kitProduct.productId} className="text-xs text-gray-500">
                                    • {product?.name} (x{kitProduct.quantity})
                                  </div>
                                )
                              })}
                              {kit.products.length > 3 && (
                                <div className="text-xs text-gray-500">
                                  • Y {kit.products.length - 3} productos más...
                                </div>
                              )}
                            </div>
                          </div>

                          {(kit.restrictions.regions ||
                            kit.restrictions.vendorIds ||
                            kit.restrictions.customerCriteria?.channels) && (
                            <div className="text-xs text-gray-500">
                              <div className="font-medium mb-1">Restricciones:</div>
                              {kit.restrictions.regions && <div>• Regiones: {kit.restrictions.regions.join(", ")}</div>}
                              {kit.restrictions.customerCriteria?.channels && (
                                <div>• Canales: {kit.restrictions.customerCriteria.channels.join(", ")}</div>
                              )}
                            </div>
                          )}

                          <div className="text-xs text-gray-500">
                            <div>Válido desde: {new Date(kit.validFrom).toLocaleDateString()}</div>
                            <div>Válido hasta: {new Date(kit.validTo).toLocaleDateString()}</div>
                          </div>

                          <div className="flex gap-2">
                            <Badge variant={kit.isActive ? "default" : "secondary"}>
                              {kit.isActive ? "Activo" : "Inactivo"}
                            </Badge>
                            <Badge variant={isKitValid(kit) ? "default" : "destructive"}>
                              {isKitValid(kit) ? "Vigente" : "Vencido"}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="offers" className="mt-6">
              {filteredOffers.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <div className="text-gray-500 text-center">
                      <Tag className="w-12 h-12 mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">No hay ofertas</h3>
                      <p className="text-sm">
                        {searchTerm || typeFilter !== "all"
                          ? "No se encontraron ofertas con los filtros aplicados"
                          : "Comienza creando tu primera oferta"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredOffers.map((offer) => (
                    <Card key={offer.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <CardTitle className="text-lg">{offer.name}</CardTitle>
                              {getOfferTypeBadge(offer.type)}
                            </div>
                            <CardDescription className="mt-1">{offer.description}</CardDescription>
                          </div>
                          <div className="flex gap-1 ml-2">
                            {canUpdate && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleOfferStatus(offer.id, offer.isActive)}
                                title={offer.isActive ? "Desactivar oferta" : "Activar oferta"}
                              >
                                {offer.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                              </Button>
                            )}
                            {canUpdate && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditOffer(offer)}
                                title="Editar oferta"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {(offer.discountPercent || offer.discountAmount) && (
                            <div className="text-center p-3 bg-red-50 rounded-lg">
                              <div className="text-2xl font-bold text-red-600">
                                {offer.discountPercent
                                  ? `${offer.discountPercent}% OFF`
                                  : `Q${offer.discountAmount?.toLocaleString()} OFF`}
                              </div>
                            </div>
                          )}

                          <div>
                            <span className="text-sm text-gray-600">Productos incluidos:</span>
                            <div className="text-sm font-medium">
                              {offer.products?.length || 0} producto{(offer.products?.length || 0) !== 1 ? "s" : ""}
                            </div>
                          </div>

                          <div className="text-xs text-gray-500">
                            <div>Válido desde: {new Date(offer.validFrom).toLocaleDateString()}</div>
                            <div>Válido hasta: {new Date(offer.validTo).toLocaleDateString()}</div>
                          </div>

                          <div className="flex gap-2">
                            <Badge variant={offer.isActive ? "default" : "secondary"}>
                              {offer.isActive ? "Activa" : "Inactiva"}
                            </Badge>
                            <Badge variant={isOfferValid(offer) ? "default" : "destructive"}>
                              {isOfferValid(offer) ? "Vigente" : "Vencida"}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {showOfferForm && (canCreate || canUpdate) && <OfferForm offer={editingOffer} onClose={handleOfferFormClose} />}
      {showComboForm && (canCreate || canUpdate) && <ComboForm combo={editingCombo} onClose={handleComboFormClose} />}
      {showKitForm && (canCreate || canUpdate) && <KitForm kit={editingKit} onClose={handleKitFormClose} />}
    </div>
  )
}
