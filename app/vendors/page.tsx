"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, Edit, Trash2, UserCheck, Phone, Mail, MapPin, Shield } from "lucide-react"
import { usePreventa } from "@/contexts/preventa-context"
import { useAuth } from "@/contexts/AuthContext"
import type { Vendor } from "@/lib/types"

export default function VendorsPage() {
  const preventa = usePreventa() as any
  const vendors: Vendor[] = preventa?.vendors ?? preventa?.vendedor ?? []
  const addVendor: (v: any) => void = preventa?.addVendor ?? (() => {})
  const updateVendor: (id: any, v: any) => void = preventa?.updateVendor ?? (() => {})
  const deleteVendor: (id: any) => void = preventa?.deleteVendor ?? (() => {})
  const { hasPermission } = useAuth()
  const [searchTerm, setSearchTerm] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [formData, setFormData] = useState({
    codigo: "",
    idt_clasificacion: "",
    primer_nombre: "",
    segundo_nombre: "",
    primer_apellido: "",
    segundo_apellido: "",
    direccion: "",
    correo: "",
    telefono: "",
    activo: true,
    codigo_empresa: "EMP001",
    tiene_supervisor: false,
    id_supervisor: "",
    limite_comision: 0,
    maneja_cobro: false,
    es_supervisor: false,
    numero_ruta: "",
  })

  if (!hasPermission("vendors", "read")) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Shield className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Acceso Denegado</h3>
          <p className="text-muted-foreground">No tienes permisos para ver los vendedores.</p>
        </div>
      </div>
    )
  }

  const filteredVendors = (vendors ?? []).filter(
    (vendor) =>
      vendor.primer_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.primer_apellido.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.correo.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.codigo.trim() || !formData.primer_nombre.trim() || !formData.primer_apellido.trim()) {
      alert("Por favor completa los campos obligatorios")
      return
    }

    if (editingVendor) {
      updateVendor(editingVendor.idt, {
        ...formData,
        codigo: formData.codigo.trim(),
        primer_nombre: formData.primer_nombre.trim(),
        segundo_nombre: formData.segundo_nombre.trim(),
        primer_apellido: formData.primer_apellido.trim(),
        segundo_apellido: formData.segundo_apellido.trim(),
      })
    } else {
      addVendor({
        ...formData,
        idt_empresa: "EMP001",
        codigo: formData.codigo.trim(),
        primer_nombre: formData.primer_nombre.trim(),
        segundo_nombre: formData.segundo_nombre.trim(),
        primer_apellido: formData.primer_apellido.trim(),
        segundo_apellido: formData.segundo_apellido.trim(),
        total_comision: 0,
        cobro: 0,
        venta: 0,
      })
    }

    resetForm()
  }

  const resetForm = () => {
    setFormData({
      codigo: "",
      idt_clasificacion: "",
      primer_nombre: "",
      segundo_nombre: "",
      primer_apellido: "",
      segundo_apellido: "",
      direccion: "",
      correo: "",
      telefono: "",
      activo: true,
      codigo_empresa: "EMP001",
      tiene_supervisor: false,
      id_supervisor: "",
      limite_comision: 0,
      maneja_cobro: false,
      es_supervisor: false,
      numero_ruta: "",
    })
    setEditingVendor(null)
    setShowForm(false)
  }

  const handleEdit = (vendor: Vendor) => {
    setEditingVendor(vendor)
    setFormData({
      codigo: vendor.codigo,
      idt_clasificacion: vendor.idt_clasificacion,
      primer_nombre: vendor.primer_nombre,
      segundo_nombre: vendor.segundo_nombre || "",
      primer_apellido: vendor.primer_apellido,
      segundo_apellido: vendor.segundo_apellido || "",
      direccion: vendor.direccion || "",
      correo: vendor.correo || "",
      telefono: vendor.telefono || "",
      activo: vendor.activo,
      codigo_empresa: vendor.codigo_empresa,
      tiene_supervisor: vendor.tiene_supervisor,
      id_supervisor: vendor.id_supervisor || "",
      limite_comision: vendor.limite_comision || 0,
      maneja_cobro: vendor.maneja_cobro,
      es_supervisor: vendor.es_supervisor,
      numero_ruta: vendor.numero_ruta || "",
    })
    setShowForm(true)
  }

  const handleDelete = (id: string) => {
    if (confirm("¿Estás seguro de que deseas eliminar este vendedor?")) {
      deleteVendor(id)
    }
  }

  const openNewForm = () => {
    resetForm()
    setShowForm(true)
  }

  return (
    <div className="container mx-auto p-2 pt-3 pb-20">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Vendedores</h1>
          <p className="text-muted-foreground">Gestiona el equipo de ventas</p>
        </div>
        {hasPermission("vendors", "create") && (
          <Button onClick={openNewForm}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Vendedor
          </Button>
        )}
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar vendedores..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVendors.map((vendor) => (
          <Card key={vendor.idt} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-blue-600" />
                  <div>
                    <CardTitle className="text-lg">
                      {vendor.primer_nombre} {vendor.primer_apellido}
                    </CardTitle>
                    <Badge variant="outline">{vendor.codigo}</Badge>
                  </div>
                </div>
                <div className="flex gap-1">
                  {hasPermission("vendors", "update") && (
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(vendor)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                  {hasPermission("vendors", "delete") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(vendor.idt)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{vendor.correo || "Sin email"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{vendor.telefono || "Sin teléfono"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{vendor.numero_ruta || "Sin ruta"}</span>
              </div>
              <div className="flex gap-2 mt-3">
                <Badge variant={vendor.activo ? "default" : "secondary"}>{vendor.activo ? "Activo" : "Inactivo"}</Badge>
                {vendor.es_supervisor && <Badge variant="outline">Supervisor</Badge>}
                {vendor.maneja_cobro && <Badge variant="outline">Maneja Cobro</Badge>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredVendors.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <UserCheck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No se encontraron vendedores</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm ? "No hay vendedores que coincidan con tu búsqueda." : "Aún no hay vendedores registrados."}
              </p>
              {!searchTerm && hasPermission("vendors", "create") && (
                <Button onClick={openNewForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Primer Vendedor
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingVendor ? "Editar Vendedor" : "Nuevo Vendedor"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="codigo">Código *</Label>
                <Input
                  id="codigo"
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  placeholder="V001"
                  required
                />
              </div>
              <div>
                <Label htmlFor="clasificacion">Clasificación</Label>
                <Select
                  value={formData.idt_clasificacion}
                  onValueChange={(value) => setFormData({ ...formData, idt_clasificacion: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar clasificación" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Vendedor Clase A</SelectItem>
                    <SelectItem value="2">Vendedor Clase B</SelectItem>
                    <SelectItem value="3">Vendedor Clase C</SelectItem>
                    <SelectItem value="4">Supervisor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="primer_nombre">Primer Nombre *</Label>
                <Input
                  id="primer_nombre"
                  value={formData.primer_nombre}
                  onChange={(e) => setFormData({ ...formData, primer_nombre: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="segundo_nombre">Segundo Nombre</Label>
                <Input
                  id="segundo_nombre"
                  value={formData.segundo_nombre}
                  onChange={(e) => setFormData({ ...formData, segundo_nombre: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="primer_apellido">Primer Apellido *</Label>
                <Input
                  id="primer_apellido"
                  value={formData.primer_apellido}
                  onChange={(e) => setFormData({ ...formData, primer_apellido: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="segundo_apellido">Segundo Apellido</Label>
                <Input
                  id="segundo_apellido"
                  value={formData.segundo_apellido}
                  onChange={(e) => setFormData({ ...formData, segundo_apellido: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="direccion">Dirección</Label>
              <Input
                id="direccion"
                value={formData.direccion}
                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="correo">Correo Electrónico</Label>
                <Input
                  id="correo"
                  type="email"
                  value={formData.correo}
                  onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="numero_ruta">Número de Ruta</Label>
                <Input
                  id="numero_ruta"
                  value={formData.numero_ruta}
                  onChange={(e) => setFormData({ ...formData, numero_ruta: e.target.value })}
                  placeholder="R001"
                />
              </div>
              <div>
                <Label htmlFor="limite_comision">Límite de Comisión</Label>
                <Input
                  id="limite_comision"
                  type="number"
                  value={formData.limite_comision}
                  onChange={(e) => setFormData({ ...formData, limite_comision: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="activo"
                  checked={formData.activo}
                  onCheckedChange={(checked) => setFormData({ ...formData, activo: checked as boolean })}
                />
                <Label htmlFor="activo">Vendedor Activo</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="es_supervisor"
                  checked={formData.es_supervisor}
                  onCheckedChange={(checked) => setFormData({ ...formData, es_supervisor: checked as boolean })}
                />
                <Label htmlFor="es_supervisor">Es Supervisor</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="maneja_cobro"
                  checked={formData.maneja_cobro}
                  onCheckedChange={(checked) => setFormData({ ...formData, maneja_cobro: checked as boolean })}
                />
                <Label htmlFor="maneja_cobro">Maneja Cobro</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="tiene_supervisor"
                  checked={formData.tiene_supervisor}
                  onCheckedChange={(checked) => setFormData({ ...formData, tiene_supervisor: checked as boolean })}
                />
                <Label htmlFor="tiene_supervisor">Tiene Supervisor</Label>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" className="flex-1">
                {editingVendor ? "Actualizar" : "Crear"} Vendedor
              </Button>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
