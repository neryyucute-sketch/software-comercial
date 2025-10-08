"use client"

import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Gift, Minus, Plus, X } from "lucide-react"
import type { Combo, Product } from "@/lib/types"
import { useMemo } from "react"

interface Props {
  open: boolean
  onClose: () => void
  combo: Combo
  products: Product[]
  quantity: number
  onQuantityChange: (q: number) => void
  selectedProducts: Array<{ productId: string; quantity: number }>
  onChangeSelected: (productId: string, qty: number) => void
  limitMessage?: string
  onConfirm: () => void
}

export function ComboConfigModal({
  open, onClose, combo, products, quantity, onQuantityChange,
  selectedProducts, onChangeSelected, limitMessage, onConfirm
}: Props) {
  if (!open) return null

  const fixedPerCombo = useMemo(
    () => combo.fixedProducts.reduce((s, p) => s + p.quantity, 0),
    [combo]
  )
  const optionalPerCombo = combo.totalProducts - fixedPerCombo
  const required = optionalPerCombo * quantity
  const selected = selectedProducts.reduce((s, p) => s + p.quantity, 0)
  const percent = Math.min(100, (selected / Math.max(1, required)) * 100)

  const optional = useMemo(() => {
    let opt: Product[] = []
    if (combo.optionalProductLines?.length) {
      opt = products.filter((p) => p.isActive && combo.optionalProductLines.includes(p.category))
    }
    if (combo.optionalProductIds?.length) {
      const specific = products.filter((p) => p.isActive && combo.optionalProductIds!.includes(p.id))
      opt = [...opt, ...specific]
    }
    const seen = new Set<string>()
    return opt.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
  }, [combo, products])

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-2 sm:p-4"
      onClick={onClose}
    >
      {/* 
        Contenedor responsive:
        - mobile: casi pantalla completa
        - desktop: un poco más grande (max-w-5xl) y alto 92vh
      */}
      <div
        className="bg-white rounded-lg w-full sm:w-[95vw] max-w-5xl max-h-[92vh] flex flex-col"
        onClick={(e)=>e.stopPropagation()}
      >
        {/* Header fijo */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b">
          <h3 className="text-base sm:text-lg font-semibold truncate">
            Configurar Combo: {combo.name}
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Contenido con scroll sólo aquí */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
          {/* Header informativo + cantidad */}
          <div className="bg-purple-50 p-3 sm:p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Gift className="w-5 h-5 text-purple-600" />
              <h4 className="font-medium">{combo.name}</h4>
            </div>
            <p className="text-sm text-gray-600 mb-3">{combo.description}</p>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <span className="text-lg font-bold text-purple-600">
                Q{combo.price.toLocaleString()}
              </span>

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Cantidad de combos:</span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    aria-label="Disminuir cantidad"
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                  <span className="w-10 text-center font-medium">{quantity}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onQuantityChange(quantity + 1)}
                    aria-label="Aumentar cantidad"
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <span className="text-sm text-gray-600">
                Ítems por combo: {combo.totalProducts}
              </span>
            </div>
          </div>

          {/* Tabs con contenido scrollable propio */}
          <Tabs defaultValue="fixed" className="w-full">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="fixed">Productos fijos</TabsTrigger>
              <TabsTrigger value="optional">
                Productos opcionales
              </TabsTrigger>
            </TabsList>

            {/* FIJOS */}
            <TabsContent value="fixed">
              {/* Área scrollable independiente (máximo 45vh) */}
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[45vh] overflow-y-auto pr-1">
                {combo.fixedProducts.length === 0 ? (
                  <div className="text-sm text-gray-500">No hay productos fijos</div>
                ) : (
                  combo.fixedProducts.map((fp) => {
                    const p = products.find((x) => x.id === fp.productId)
                    const totalQty = fp.quantity * quantity
                    return (
                      <div key={fp.productId} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                        <span className="text-sm">{p?.name}</span>
                        <span className="text-sm font-medium">
                          x{totalQty}{quantity > 1 ? ` (${fp.quantity}×${quantity})` : ""}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>
            </TabsContent>

            {/* OPCIONALES */}
            <TabsContent value="optional">
              <div className="mt-3 space-y-3">
                {/* Progreso */}
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span>Progreso de selección:</span>
                    <span className="font-semibold text-blue-700">
                      {selected} / {required}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  {!!limitMessage && (
                    <div className="mt-2 text-xs text-red-600 font-medium">{limitMessage}</div>
                  )}
                </div>

                {/* Lista con scroll propio (máximo 45vh) */}
                <div className="grid grid-cols-1 gap-2 max-h-[45vh] overflow-y-auto pr-1">
                  {optional.length === 0 ? (
                    <div className="text-sm text-gray-500">
                      No hay productos opcionales disponibles
                    </div>
                  ) : (
                    optional.map((p) => {
                      const sel = selectedProducts.find((x) => x.productId === p.id)
                      const qty = sel?.quantity || 0
                      return (
                        <div key={p.id} className="flex items-center justify-between p-2 border rounded">
                          <span className="text-sm">{p.name}</span>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => onChangeSelected(p.id, Math.max(0, qty - 1))}
                              disabled={qty <= 0}
                              aria-label={`Quitar ${p.name}`}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="w-8 text-center text-sm">{qty}</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => onChangeSelected(p.id, qty + 1)}
                              aria-label={`Agregar ${p.name}`}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer fijo */}
        <div className="p-3 sm:p-4 border-t">
          <div className="bg-gray-50 p-3 sm:p-4 rounded-lg mb-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">Total del combo:</span>
              <span className="text-xl font-bold text-purple-600">
                Q{(combo.price * quantity).toLocaleString()}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="button" onClick={onConfirm} className="flex-1 bg-green-600 hover:bg-green-700">
              Agregar al pedido
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
