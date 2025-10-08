"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useLocalStorage } from "@/hooks/use-local-storage"
import { useAuth } from "@/contexts/AuthContext"
import type { User, Role } from "@/lib/types"
import { Plus, Edit, Trash2, UserCheck, UserX } from "lucide-react"

export function UserManagement() {
  const { hasPermission } = useAuth()
  const [users, setUsers] = useLocalStorage<User[]>("preventa_users", [])
  const [roles] = useLocalStorage<Role[]>("preventa_roles", [])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    roleId: "",
  })

  const canCreate = hasPermission("users", "create")
  const canUpdate = hasPermission("users", "update")
  const canDelete = hasPermission("users", "delete")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (editingUser) {
      // Editar usuario existente
      const updatedUsers = users.map((user) =>
        user.id === editingUser.id
          ? {
              ...user,
              username: formData.username,
              email: formData.email,
              roleId: formData.roleId,
              ...(formData.password && { password: formData.password }),
            }
          : user,
      )
      setUsers(updatedUsers)
    } else {
      // Crear nuevo usuario
      const newUser: User = {
        id: Date.now().toString(),
        username: formData.username,
        email: formData.email,
        password: formData.password,
        roleId: formData.roleId,
        isActive: true,
        createdAt: new Date(),
      }
      setUsers([...users, newUser])
    }

    setIsDialogOpen(false)
    setEditingUser(null)
    setFormData({ username: "", email: "", password: "", roleId: "" })
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setFormData({
      username: user.username,
      email: user.email,
      password: "",
      roleId: user.roleId,
    })
    setIsDialogOpen(true)
  }

  const handleDelete = (userId: string) => {
    if (confirm("¿Estás seguro de que quieres eliminar este usuario?")) {
      setUsers(users.filter((user) => user.id !== userId))
    }
  }

  const toggleUserStatus = (userId: string) => {
    const updatedUsers = users.map((user) => (user.id === userId ? { ...user, isActive: !user.isActive } : user))
    setUsers(updatedUsers)
  }

  const getRoleName = (roleId: string) => {
    return roles.find((role) => role.id === roleId)?.name || "Sin rol"
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Gestión de Usuarios</CardTitle>
            <CardDescription>Administra los usuarios del sistema</CardDescription>
          </div>
          {canCreate && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setEditingUser(null)
                    setFormData({ username: "", email: "", password: "", roleId: "" })
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Usuario
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingUser ? "Editar Usuario" : "Nuevo Usuario"}</DialogTitle>
                  <DialogDescription>
                    {editingUser ? "Modifica los datos del usuario" : "Crea un nuevo usuario del sistema"}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Usuario</Label>
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Contraseña {editingUser && "(dejar vacío para mantener actual)"}</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required={!editingUser}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Rol</Label>
                    <Select
                      value={formData.roleId}
                      onValueChange={(value) => setFormData({ ...formData, roleId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un rol" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles
                          .filter((role) => role.isActive)
                          .map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                              {role.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">{editingUser ? "Actualizar" : "Crear"}</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {users.map((user) => (
            <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{user.username}</h3>
                  <Badge variant={user.isActive ? "default" : "secondary"}>
                    {user.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                <p className="text-sm text-muted-foreground">Rol: {getRoleName(user.roleId)}</p>
              </div>
              <div className="flex items-center gap-2">
                {canUpdate && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => toggleUserStatus(user.id)}>
                      {user.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(user)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </>
                )}
                {canDelete && user.id !== "admin-user" && (
                  <Button variant="outline" size="sm" onClick={() => handleDelete(user.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
