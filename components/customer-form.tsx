"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { usePreventa } from "@/contexts/preventa-context"
import { X } from "lucide-react"
import type { Customer } from "@/lib/types"
import { sampleRegions } from "@/lib/sample-data"

const sampleChannels = ["Mayorista", "Minorista", "Distribuidor", "Farmacia", "Supermercado", "Tienda", "Bodega"]

interface CustomerFormProps {
  customer?: Customer | null
  onClose: () => void
}

export function CustomerForm({ customer, onClose }: CustomerFormProps) {
  const { addCustomer, updateCustomer, vendors } = usePreventa()

  const [formData, setFormData] = useState({
    name: customer?.name || "",
    email: customer?.email || "",
    phone: customer?.phone || "",
    address: customer?.address || "",
    code: customer?.code || "",
    nit: customer?.nit || "",
    businessName: customer?.businessName || "",
    tradeName: customer?.tradeName || "",
    contact: customer?.contact || "",
    vendorId: String(customer?.vendorId || ""),
    region: customer?.region || "",
    department: customer?.department || "",
    municipality: customer?.municipality || "",
    channel: customer?.channel || "",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      alert("El nombre del cliente es requerido")
      return
    }

    if (!formData.code.trim()) {
      alert("El código del cliente es requerido")
      return
    }

    if (!formData.nit.trim()) {
      alert("El NIT del cliente es requerido")
      return
    }

    if (!formData.businessName.trim()) {
      alert("La razón social es requerida")
      return
    }

    if (!formData.vendorId) {
      alert("Debe seleccionar un vendedor")
      return
    }

    if (!formData.region) {
      alert("Debe seleccionar una región")
      return
    }

    if (!formData.channel) {
      alert("Debe seleccionar un canal")
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (formData.email && !emailRegex.test(formData.email)) {
      alert("Por favor ingresa un email válido")
      return
    }

    if (customer) {
      updateCustomer(customer.id, formData)
    } else {
      addCustomer(formData)
    }

    onClose()
  }

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>{customer ? "Editar Cliente" : "Nuevo Cliente"}</CardTitle>
              <CardDescription>
                {customer ? "Modifica los datos del cliente" : "Agrega un nuevo cliente"}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nombre Completo *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Juan Pérez"
                  required
                />
              </div>

              <div>
                <Label htmlFor="code">Código Cliente *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => handleChange("code", e.target.value)}
                  placeholder="CLI001"
                  required
                />
              </div>

              <div>
                <Label htmlFor="nit">NIT *</Label>
                <Input
                  id="nit"
                  value={formData.nit}
                  onChange={(e) => handleChange("nit", e.target.value)}
                  placeholder="12345678-9"
                  required
                />
              </div>

              <div>
                <Label htmlFor="contact">Contacto</Label>
                <Input
                  id="contact"
                  value={formData.contact}
                  onChange={(e) => handleChange("contact", e.target.value)}
                  placeholder="Persona de contacto"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Información Comercial</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="businessName">Razón Social *</Label>
                  <Input
                    id="businessName"
                    value={formData.businessName}
                    onChange={(e) => handleChange("businessName", e.target.value)}
                    placeholder="Empresa S.A."
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="tradeName">Razón Comercial</Label>
                  <Input
                    id="tradeName"
                    value={formData.tradeName}
                    onChange={(e) => handleChange("tradeName", e.target.value)}
                    placeholder="Nombre comercial"
                  />
                </div>

                <div>
                  <Label htmlFor="channel">Canal *</Label>
                  <Select value={formData.channel} onValueChange={(value) => handleChange("channel", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar canal" />
                    </SelectTrigger>
                    <SelectContent>
                      {sampleChannels.map((channel) => (
                        <SelectItem key={channel} value={channel}>
                          {channel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Asignación y Ubicación</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="vendorId">Vendedor *</Label>
                  <Select value={formData.vendorId} onValueChange={(value) => handleChange("vendorId", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar vendedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map((vendor) => (
                        <SelectItem key={vendor.idt} value={vendor.idt}>
                          {vendor.codigo} - {vendor.primer_nombre} {vendor.primer_apellido}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="region">Región *</Label>
                  <Select value={formData.region} onValueChange={(value) => handleChange("region", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar región" />
                    </SelectTrigger>
                    <SelectContent>
                      {sampleRegions.map((region) => (
                        <SelectItem key={region.id} value={region.name}>
                          {region.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="department">Departamento</Label>
                  <Input
                    id="department"
                    value={formData.department}
                    onChange={(e) => handleChange("department", e.target.value)}
                    placeholder="Guatemala"
                  />
                </div>

                <div>
                  <Label htmlFor="municipality">Municipio</Label>
                  <Input
                    id="municipality"
                    value={formData.municipality}
                    onChange={(e) => handleChange("municipality", e.target.value)}
                    placeholder="Guatemala"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Información de Contacto</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    placeholder="+502 1234-5678"
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    placeholder="cliente@ejemplo.com"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="address">Dirección</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleChange("address", e.target.value)}
                    placeholder="Dirección completa"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" className="flex-1">
                {customer ? "Actualizar" : "Crear"} Cliente
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
