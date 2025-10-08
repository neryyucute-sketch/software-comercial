"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { usePreventa } from "@/contexts/preventa-context"
import { useAuth } from "@/contexts/AuthContext"
import { Plus, Search, Edit, Eye, EyeOff, Shield } from "lucide-react"
import { PriceListForm } from "@/components/price-list-form"
import type { PriceList } from "@/lib/types"
import { List } from "lucide-react"

export default function PricesPage() {
  const { priceLists, products, updatePriceList } = usePreventa()
  const { hasPermission } = useAuth()
  const [searchTerm, setSearchTerm] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editingPriceList, setEditingPriceList] = useState<PriceList | null>(null)

  const canRead = hasPermission("prices", "read")
  const canCreate = hasPermission("prices", "create")
  const canUpdate = hasPermission("prices", "update")
  const canDelete = hasPermission("prices", "delete")

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

  // Filtrar listas de precios
  const filteredPriceLists = priceLists.filter((priceList) => {
    return priceList.name.toLowerCase().includes(searchTerm.toLowerCase())
  })

  const handleEdit = (priceList: PriceList) => {
    setEditingPriceList(priceList)
    setShowForm(true)
  }

  const togglePriceListStatus = (priceListId: string, isActive: boolean) => {
    updatePriceList(priceListId, { isActive: !isActive })
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingPriceList(null)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Listas de Precios</h1>
              <p className="mt-2 text-gray-600">Gestiona diferentes listas de precios para tus productos</p>
            </div>
            {canCreate && (
              <Button onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Nueva Lista
              </Button>
            )}
          </div>

          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar listas de precios..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Price Lists Grid */}
          {filteredPriceLists.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="text-gray-500 text-center">
                  <List className="w-12 h-12 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No hay listas de precios</h3>
                  <p className="text-sm">
                    {searchTerm
                      ? "No se encontraron listas con el término de búsqueda"
                      : "Comienza creando tu primera lista de precios"}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPriceLists.map((priceList) => {
                const productCount = Object.keys(priceList.products).length
                const activeProductsInList = Object.keys(priceList.products).filter((productId) =>
                  products.find((p) => p.id === productId && p.isActive),
                ).length

                return (
                  <Card key={priceList.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{priceList.name}</CardTitle>
                          <CardDescription className="mt-1">
                            {productCount} producto{productCount !== 1 ? "s" : ""} configurado
                            {productCount !== 1 ? "s" : ""}
                          </CardDescription>
                        </div>
                        <div className="flex gap-1 ml-2">
                          {canUpdate && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => togglePriceListStatus(priceList.id, priceList.isActive)}
                              title={priceList.isActive ? "Desactivar lista" : "Activar lista"}
                            >
                              {priceList.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            </Button>
                          )}
                          {canUpdate && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(priceList)}
                              title="Editar lista"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="text-sm text-gray-600">
                          <div>Productos activos: {activeProductsInList}</div>
                          <div>Creada: {new Date(priceList.createdAt).toLocaleDateString()}</div>
                        </div>

                        <div className="flex gap-2">
                          <Badge variant={priceList.isActive ? "default" : "secondary"}>
                            {priceList.isActive ? "Activa" : "Inactiva"}
                          </Badge>
                        </div>

                        {/* Sample prices preview */}
                        {productCount > 0 && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                            <h4 className="text-xs font-medium text-gray-700 mb-2">Vista previa:</h4>
                            <div className="space-y-1 text-xs">
                              {Object.entries(priceList.products)
                                .slice(0, 3)
                                .map(([productId, price]) => {
                                  const product = products.find((p) => p.id === productId)
                                  return (
                                    <div key={productId} className="flex justify-between">
                                      <span className="truncate">{product?.name || "Producto eliminado"}</span>
                                      <span className="font-medium">Q{price.toLocaleString()}</span>
                                    </div>
                                  )
                                })}
                              {productCount > 3 && <div className="text-gray-500">+{productCount - 3} más...</div>}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* Price List Form Modal */}
      {showForm && (canCreate || canUpdate) && <PriceListForm priceList={editingPriceList} onClose={handleFormClose} />}
    </div>
  )
}
