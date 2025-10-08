"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, Tag, Search } from "lucide-react"
import type { VendorClassification } from "@/lib/types"

export function VendorClassificationManagement() {
  const [classifications, setClassifications] = useState<VendorClassification[]>([
    {
      idt: "1",
      idt_empresa: "EMP001",
      codigo: "VEND_A",
      descripcion: "Vendedor Clase A - Premium",
    },
    {
      idt: "2",
      idt_empresa: "EMP001",
      codigo: "VEND_B",
      descripcion: "Vendedor Clase B - Estándar",
    },
    {
      idt: "3",
      idt_empresa: "EMP001",
      codigo: "VEND_C",
      descripcion: "Vendedor Clase C - Básico",
    },
    {
      idt: "4",
      idt_empresa: "EMP001",
      codigo: "SUP",
      descripcion: "Supervisor de Ventas",
    },
    {
      idt: "5",
      idt_empresa: "EMP001",
      codigo: "COORD",
      descripcion: "Coordinador Regional",
    },
  ])

  const [showForm, setShowForm] = useState(false)
  const [editingClassification, setEditingClassification] = useState<VendorClassification | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [formData, setFormData] = useState({
    codigo: "",
    descripcion: "",
  })

  const filteredClassifications = classifications.filter(
    (classification) =>
      classification.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      classification.descripcion.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.codigo.trim() || !formData.descripcion.trim()) {
      alert("Por favor completa todos los campos")
      return
    }

    if (editingClassification) {
      setClassifications(
        classifications.map((c) =>
          c.idt === editingClassification.idt
            ? { ...c, codigo: formData.codigo.trim(), descripcion: formData.descripcion.trim() }
            : c,
        ),
      )
    } else {
      const newClassification: VendorClassification = {
        idt: Date.now().toString(),
        idt_empresa: "EMP001",
        codigo: formData.codigo.trim(),
        descripcion: formData.descripcion.trim(),
      }
      setClassifications([...classifications, newClassification])
    }

    setFormData({ codigo: "", descripcion: "" })
    setEditingClassification(null)
    setShowForm(false)
  }

  const handleEdit = (classification: VendorClassification) => {
    setEditingClassification(classification)
    setFormData({
      codigo: classification.codigo,
      descripcion: classification.descripcion,
    })
    setShowForm(true)
  }

  const handleDelete = (id: string) => {
    if (confirm("¿Estás seguro de que deseas eliminar esta clasificación?")) {
      setClassifications(classifications.filter((c) => c.idt !== id))
    }
  }

  const openNewForm = () => {
    setEditingClassification(null)
    setFormData({ codigo: "", descripcion: "" })
    setShowForm(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Clasificaciones de Vendedores</h2>
          <p className="text-muted-foreground">Gestiona las clasificaciones para categorizar vendedores</p>
        </div>
        <Button onClick={openNewForm}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Clasificación
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar por código o descripción..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClassifications.map((classification) => (
          <Card key={classification.idt} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <Tag className="h-5 w-5 text-blue-600" />
                  <Badge variant="outline">{classification.codigo}</Badge>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(classification)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(classification.idt)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{classification.descripcion}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredClassifications.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Tag className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No se encontraron clasificaciones</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm
                  ? "No hay clasificaciones que coincidan con tu búsqueda."
                  : "Aún no hay clasificaciones creadas."}
              </p>
              {!searchTerm && (
                <Button onClick={openNewForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Primera Clasificación
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingClassification ? "Editar Clasificación" : "Nueva Clasificación"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="codigo">Código *</Label>
              <Input
                id="codigo"
                value={formData.codigo}
                onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                placeholder="Ej: VEND_A, SUP, COORD"
                required
              />
            </div>

            <div>
              <Label htmlFor="descripcion">Descripción *</Label>
              <Input
                id="descripcion"
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Ej: Vendedor Clase A - Premium"
                required
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" className="flex-1">
                {editingClassification ? "Actualizar" : "Crear"} Clasificación
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
