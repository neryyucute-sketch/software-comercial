"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/contexts/AuthContext"
import { User, Mail, Phone, Lock, Save } from "lucide-react"

export default function ProfilePage() {
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    name: user?.usuario || "",
    email: user?.usuario || "",
    phone: user?.nombre || "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage("")

    try {
      // Validar contraseñas si se está cambiando
      if (formData.newPassword) {
        if (formData.newPassword !== formData.confirmPassword) {
          setMessage("Las contraseñas no coinciden")
          return
        }
        if (formData.newPassword.length < 6) {
          setMessage("La nueva contraseña debe tener al menos 6 caracteres")
          return
        }
      }

      // Actualizar perfil
      const updateData: any = {}
      if (formData.name !== user?.nombre) updateData.name = formData.name
      if (formData.email !== user?.nombre) updateData.email = formData.email
      if (formData.phone !== user?.nombre) updateData.phone = formData.phone
      if (formData.newPassword) updateData.password = formData.newPassword

      setMessage("Perfil actualizado correctamente")

      // Limpiar campos de contraseña
      setFormData((prev) => ({
        ...prev,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      }))
    } catch (error) {
      setMessage("Error al actualizar el perfil")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-3">
      <main className="max-w-2xl mx-auto py-2 sm:px-2 lg:px-4">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Mi Perfil</h1>
            <p className="mt-2 text-gray-600">Gestiona tu información personal y configuración de cuenta</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Información Personal
              </CardTitle>
              <CardDescription>Actualiza tu información de perfil y configuración de seguridad</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Información básica */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Nombre completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        id="name"
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                        className="pl-10"
                        placeholder="Tu nombre completo"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="email">Correo electrónico</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                        className="pl-10"
                        placeholder="tu@email.com"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="phone">Teléfono</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                        className="pl-10"
                        placeholder="+502 1234-5678"
                      />
                    </div>
                  </div>
                </div>

                {/* Información de rol (solo lectura) */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Información de cuenta</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Usuario:</span>
                      <div className="font-medium">{user?.nombre}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Rol:</span>
                      <div className="font-medium">{user?.rol}</div>
                    </div>
                  </div>
                </div>

                {/* Cambio de contraseña */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Cambiar contraseña</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="currentPassword">Contraseña actual</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          id="currentPassword"
                          type="password"
                          value={formData.currentPassword}
                          onChange={(e) => setFormData((prev) => ({ ...prev, currentPassword: e.target.value }))}
                          className="pl-10"
                          placeholder="Contraseña actual"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="newPassword">Nueva contraseña</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          id="newPassword"
                          type="password"
                          value={formData.newPassword}
                          onChange={(e) => setFormData((prev) => ({ ...prev, newPassword: e.target.value }))}
                          className="pl-10"
                          placeholder="Nueva contraseña (mínimo 6 caracteres)"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="confirmPassword">Confirmar nueva contraseña</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          id="confirmPassword"
                          type="password"
                          value={formData.confirmPassword}
                          onChange={(e) => setFormData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                          className="pl-10"
                          placeholder="Confirmar nueva contraseña"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mensaje de estado */}
                {message && (
                  <div
                    className={`p-3 rounded-lg text-sm ${
                      message.includes("Error")
                        ? "bg-red-50 text-red-700 border border-red-200"
                        : "bg-green-50 text-green-700 border border-green-200"
                    }`}
                  >
                    {message}
                  </div>
                )}

                {/* Botón de guardar */}
                <div className="flex justify-end">
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Guardar cambios
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
