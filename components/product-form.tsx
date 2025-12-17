"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Product } from "@/lib/types"
import { X } from "lucide-react"
import { z } from "zod"

// 🔒 Seguridad: Validación con Zod
const productSchema = z.object({
  descripcion_corta: z.string().min(2, "Nombre muy corto").max(200, "Nombre muy largo"),
  descripcion: z.string().min(5, "Descripción muy corta").max(1000, "Descripción muy larga"),
  categoria: z.string().min(1, "Categoría requerida").max(100, "Categoría muy larga"),
  price: z.number().min(0.01, "Precio debe ser mayor a 0").max(999999999, "Precio inválido"),
  stock: z.number().min(0, "Stock no puede ser negativo").max(999999999, "Stock inválido"),
  imageUrl: z.string().max(500, "URL de imagen muy larga"),
  codigo_producto: z.string().max(50),
  codigo_fabricante: z.string().max(50),
  proveedor: z.string().max(200),
  familia: z.string().max(100),
  subfamilia: z.string().max(100),
  presentacion: z.string().max(100),
});

type ProductPayload = Omit<Product, "id" | "createdAt">

interface ProductFormProps {
  product?: Product | null
  onClose: () => void
  onSubmit: (data: ProductPayload) => void
}

export function ProductForm({ product, onClose, onSubmit }: ProductFormProps) {
  // Prefill traduciendo desde Product al esquema del formulario
  const [formData, setFormData] = useState({
    // “código” solo vive en el form; si luego quieres guardarlo, agrega campo al tipo Product.
    codigo_producto: "",
    codigo_fabricante: "",
    proveedor: "",
    familia: "",
    subfamilia: "",
    presentacion: "",

    // Campos que sí mapean a Product
    descripcion: product?.description ?? "",
    descripcion_corta: product?.name ?? "",
    categoria: product?.category ?? "",
    price: product?.price ?? 0,
    stock: product?.stock ?? 0,
    imageUrl: product?.imageUrl ?? "",
    isActive: product?.isActive ?? true,

    // Otros opcionales del form (solo UI)
    registro_sanitario: "",
    codigo_upc: "",
    cantidad_master: 0,
    cantidad_inner: 0,
    cantidad_pieza: 1,
    maneja_inventario: true,
    servicio: false,
  })

  const handleChange = (field: string, value: string | number | boolean) =>
    setFormData((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // 🔒 Seguridad: Validación con Zod
    const validation = productSchema.safeParse({
      descripcion_corta: formData.descripcion_corta,
      descripcion: formData.descripcion,
      categoria: formData.categoria,
      price: formData.price,
      stock: formData.stock,
      imageUrl: formData.imageUrl,
      codigo_producto: formData.codigo_producto,
      codigo_fabricante: formData.codigo_fabricante,
      proveedor: formData.proveedor,
      familia: formData.familia,
      subfamilia: formData.subfamilia,
      presentacion: formData.presentacion,
    });

    if (!validation.success) {
      const firstError = validation.error.errors[0];
      alert(firstError.message);
      return;
    }

    // Normalización al shape de Product
    const payload: ProductPayload = {
      name: formData.descripcion_corta,            // ← name
      description: formData.descripcion,           // ← description
      category: formData.categoria,                // ← category
      price: Number(formData.price) || 0,          // ← price
      stock: Number(formData.stock) || 0,          // ← stock
      imageUrl: formData.imageUrl || "",           // ← imageUrl
      isActive: !!formData.isActive,               // ← isActive
    }

    onSubmit(payload)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <CardHeader className="pb-4">
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg sm:text-xl">
                {product ? "Editar Producto" : "Nuevo Producto"}
              </CardTitle>
              <CardDescription className="text-sm">
                {product ? "Modifica los datos del producto" : "Agrega un nuevo producto al catálogo"}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="shrink-0">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="px-4 sm:px-6">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label htmlFor="codigo_producto">Código de Producto</Label>
                <Input
                  id="codigo_producto"
                  value={formData.codigo_producto}
                  onChange={(e) => handleChange("codigo_producto", e.target.value)}
                  placeholder="Ej: BAT-MXL-D-2PK"
                  maxLength={25}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="codigo_fabricante">Código Fabricante</Label>
                <Input
                  id="codigo_fabricante"
                  value={formData.codigo_fabricante}
                  onChange={(e) => handleChange("codigo_fabricante", e.target.value)}
                  placeholder="Ej: MXL-D-2"
                  maxLength={25}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="descripcion">Descripción *</Label>
              <Input
                id="descripcion"
                value={formData.descripcion}
                onChange={(e) => handleChange("descripcion", e.target.value)}
                placeholder="Descripción completa del producto"
                maxLength={75}
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="descripcion_corta">Descripción Corta (Nombre) *</Label>
              <Input
                id="descripcion_corta"
                value={formData.descripcion_corta}
                onChange={(e) => handleChange("descripcion_corta", e.target.value)}
                placeholder="Nombre corto"
                maxLength={40}
                required
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <div>
                <Label htmlFor="familia">Familia</Label>
                <Input
                  id="familia"
                  value={formData.familia}
                  onChange={(e) => handleChange("familia", e.target.value)}
                  placeholder="Ej: BATERIAS"
                  maxLength={25}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="subfamilia">Subfamilia</Label>
                <Input
                  id="subfamilia"
                  value={formData.subfamilia}
                  onChange={(e) => handleChange("subfamilia", e.target.value)}
                  placeholder="Ej: ALCALINAS"
                  maxLength={25}
                  className="mt-1"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-1">
                <Label htmlFor="categoria">Categoría *</Label>
                <Input
                  id="categoria"
                  value={formData.categoria}
                  onChange={(e) => handleChange("categoria", e.target.value)}
                  placeholder="Ej: Electrónicos"
                  maxLength={25}
                  required
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label htmlFor="proveedor">Proveedor</Label>
                <Input
                  id="proveedor"
                  value={formData.proveedor}
                  onChange={(e) => handleChange("proveedor", e.target.value)}
                  placeholder="Ej: MAXELL"
                  maxLength={25}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="presentacion">Presentación</Label>
                <Input
                  id="presentacion"
                  value={formData.presentacion}
                  onChange={(e) => handleChange("presentacion", e.target.value)}
                  placeholder="Ej: PACK 2 UNIDADES"
                  maxLength={25}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label htmlFor="price">Precio *</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => handleChange("price", Number(e.target.value) || 0)}
                  placeholder="0.00"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="stock">Stock *</Label>
                <Input
                  id="stock"
                  type="number"
                  min="0"
                  value={formData.stock}
                  onChange={(e) => handleChange("stock", Number(e.target.value) || 0)}
                  placeholder="0"
                  required
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label htmlFor="codigo_upc">Código UPC</Label>
                <Input
                  id="codigo_upc"
                  value={formData.codigo_upc}
                  onChange={(e) => handleChange("codigo_upc", e.target.value)}
                  placeholder="Ej: 025215625022"
                  maxLength={25}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="registro_sanitario">Registro Sanitario</Label>
                <Input
                  id="registro_sanitario"
                  value={formData.registro_sanitario}
                  onChange={(e) => handleChange("registro_sanitario", e.target.value)}
                  placeholder="Ej: RS-MED-2023-001"
                  maxLength={25}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <label className="inline-flex items-center gap-2">
                <input
                  id="maneja_inventario"
                  type="checkbox"
                  checked={formData.maneja_inventario}
                  onChange={(e) => handleChange("maneja_inventario", e.target.checked)}
                  className="rounded border-gray-300 h-4 w-4"
                />
                <span className="text-sm">Maneja Inventario</span>
              </label>

              <label className="inline-flex items-center gap-2">
                <input
                  id="servicio"
                  type="checkbox"
                  checked={formData.servicio}
                  onChange={(e) => handleChange("servicio", e.target.checked)}
                  className="rounded border-gray-300 h-4 w-4"
                />
                <span className="text-sm">Es Servicio</span>
              </label>

              <label className="inline-flex items-center gap-2">
                <input
                  id="isActive"
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => handleChange("isActive", e.target.checked)}
                  className="rounded border-gray-300 h-4 w-4"
                />
                <span className="text-sm">Producto Activo</span>
              </label>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4 border-t">
              <Button type="submit" className="flex-1 h-11 text-base">
                {product ? "Actualizar" : "Crear"} Producto
              </Button>
              <Button type="button" variant="outline" onClick={onClose} className="flex-1 sm:flex-none h-11 bg-transparent">
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
