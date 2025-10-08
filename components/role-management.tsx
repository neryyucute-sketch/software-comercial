"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useLocalStorage } from "@/hooks/use-local-storage"
import { useAuth } from "@/contexts/AuthContext"
import type { Role, Permission } from "@/lib/types"
import { Plus, Edit, Trash2, Shield, Eye, Edit3, Trash, Ban, PlusCircle } from "lucide-react"

export function RoleManagement() {
  const { hasPermission } = useAuth()
  const [roles, setRoles] = useLocalStorage<Role[]>("preventa_roles", [])
  const [permissions] = useLocalStorage<Permission[]>("preventa_permissions", [])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    permissions: [] as string[],
  })

  const canCreate = hasPermission("users", "create")
  const canUpdate = hasPermission("users", "update")
  const canDelete = hasPermission("users", "delete")

  const moduleConfig = {
    products: {
      name: "Productos",
      description: "Gestión del catálogo de productos",
      actions: [
        { key: "read", name: "Ver Productos", icon: Eye, description: "Acceso a la pantalla de productos" },
        { key: "create", name: "Crear Productos", icon: PlusCircle, description: "Agregar nuevos productos" },
        { key: "update", name: "Modificar Productos", icon: Edit3, description: "Editar productos existentes" },
        { key: "delete", name: "Eliminar Productos", icon: Trash, description: "Eliminar productos del catálogo" },
      ],
    },
    orders: {
      name: "Pedidos",
      description: "Gestión de pedidos de venta",
      actions: [
        { key: "read", name: "Ver Pedidos", icon: Eye, description: "Acceso a la pantalla de pedidos" },
        { key: "create", name: "Crear Pedidos", icon: PlusCircle, description: "Generar nuevos pedidos" },
        { key: "update", name: "Modificar Pedidos", icon: Edit3, description: "Editar pedidos existentes" },
        { key: "cancel", name: "Anular Pedidos", icon: Ban, description: "Cancelar pedidos" },
      ],
    },
    customers: {
      name: "Clientes",
      description: "Gestión de base de clientes",
      actions: [
        { key: "read", name: "Ver Clientes", icon: Eye, description: "Acceso a la pantalla de clientes" },
        { key: "create", name: "Crear Clientes", icon: PlusCircle, description: "Agregar nuevos clientes" },
        { key: "update", name: "Modificar Clientes", icon: Edit3, description: "Editar información de clientes" },
        { key: "delete", name: "Eliminar Clientes", icon: Trash, description: "Eliminar clientes del sistema" },
      ],
    },
    offers: {
      name: "Ofertas",
      description: "Gestión de ofertas y promociones",
      actions: [
        { key: "read", name: "Ver Ofertas", icon: Eye, description: "Acceso a la pantalla de ofertas" },
        { key: "create", name: "Crear Ofertas", icon: PlusCircle, description: "Crear combos, kits y promociones" },
        { key: "update", name: "Modificar Ofertas", icon: Edit3, description: "Editar ofertas existentes" },
        { key: "delete", name: "Eliminar Ofertas", icon: Trash, description: "Eliminar ofertas del sistema" },
      ],
    },
    prices: {
      name: "Listas de Precios",
      description: "Gestión de precios y tarifas",
      actions: [
        { key: "read", name: "Ver Precios", icon: Eye, description: "Acceso a listas de precios" },
        { key: "create", name: "Crear Listas", icon: PlusCircle, description: "Crear nuevas listas de precios" },
        { key: "update", name: "Modificar Precios", icon: Edit3, description: "Editar precios y tarifas" },
        { key: "delete", name: "Eliminar Listas", icon: Trash, description: "Eliminar listas de precios" },
      ],
    },
    stats: {
      name: "Estadísticas",
      description: "Reportes y análisis de ventas",
      actions: [
        {
          key: "read",
          name: "Ver Estadísticas Generales",
          icon: Eye,
          description: "Acceso al dashboard de estadísticas",
        },
        { key: "sales", name: "Ver Ventas por Cliente", icon: Eye, description: "Estadísticas detalladas por cliente" },
        {
          key: "products",
          name: "Ver Ventas por Producto",
          icon: Eye,
          description: "Análisis de productos más vendidos",
        },
        {
          key: "categories",
          name: "Ver Ventas por Categoría",
          icon: Eye,
          description: "Estadísticas por línea de producto",
        },
      ],
    },
    users: {
      name: "Administración",
      description: "Gestión de usuarios y sistema",
      actions: [
        { key: "read", name: "Ver Usuarios", icon: Eye, description: "Acceso a la pantalla de administración" },
        { key: "create", name: "Crear Usuarios", icon: PlusCircle, description: "Agregar nuevos usuarios al sistema" },
        { key: "update", name: "Modificar Usuarios", icon: Edit3, description: "Editar usuarios y roles" },
        { key: "delete", name: "Eliminar Usuarios", icon: Trash, description: "Eliminar usuarios del sistema" },
      ],
    },
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (editingRole) {
      const updatedRoles = roles.map((role) =>
        role.id === editingRole.id
          ? {
              ...role,
              name: formData.name,
              description: formData.description,
              permissions: formData.permissions,
            }
          : role,
      )
      setRoles(updatedRoles)
    } else {
      const newRole: Role = {
        id: Date.now().toString(),
        name: formData.name,
        description: formData.description,
        permissions: formData.permissions,
        isActive: true,
        createdAt: new Date(),
      }
      setRoles([...roles, newRole])
    }

    setIsDialogOpen(false)
    setEditingRole(null)
    setFormData({ name: "", description: "", permissions: [] })
  }

  const handleEdit = (role: Role) => {
    setEditingRole(role)
    setFormData({
      name: role.name,
      description: role.description,
      permissions: role.permissions,
    })
    setIsDialogOpen(true)
  }

  const handleDelete = (roleId: string) => {
    if (confirm("¿Estás seguro de que quieres eliminar este rol?")) {
      setRoles(roles.filter((role) => role.id !== roleId))
    }
  }

  const handlePermissionChange = (permissionId: string, checked: boolean) => {
    if (checked) {
      setFormData({
        ...formData,
        permissions: [...formData.permissions, permissionId],
      })
    } else {
      setFormData({
        ...formData,
        permissions: formData.permissions.filter((id) => id !== permissionId),
      })
    }
  }

  const isModuleFullySelected = (module: string) => {
    const moduleActions = moduleConfig[module as keyof typeof moduleConfig]?.actions || []
    return moduleActions.every((action) => formData.permissions.includes(`${module}_${action.key}`))
  }

  const handleModuleToggle = (module: string, checked: boolean) => {
    const moduleActions = moduleConfig[module as keyof typeof moduleConfig]?.actions || []
    const modulePermissions = moduleActions.map((action) => `${module}_${action.key}`)

    if (checked) {
      // Agregar todos los permisos del módulo
      const newPermissions = [...formData.permissions]
      modulePermissions.forEach((perm) => {
        if (!newPermissions.includes(perm)) {
          newPermissions.push(perm)
        }
      })
      setFormData({ ...formData, permissions: newPermissions })
    } else {
      // Remover todos los permisos del módulo
      setFormData({
        ...formData,
        permissions: formData.permissions.filter((perm) => !modulePermissions.includes(perm)),
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Gestión de Roles</CardTitle>
            <CardDescription>Configura roles y permisos específicos por pantalla y acción</CardDescription>
          </div>
          {canCreate && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setEditingRole(null)
                    setFormData({ name: "", description: "", permissions: [] })
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Rol
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingRole ? "Editar Rol" : "Nuevo Rol"}</DialogTitle>
                  <DialogDescription>
                    {editingRole
                      ? "Modifica el rol y configura permisos específicos"
                      : "Crea un nuevo rol y define sus permisos por pantalla"}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nombre del Rol</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Descripción</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-base font-semibold">Configuración de Permisos por Pantalla</Label>
                    <div className="grid gap-4">
                      {Object.entries(moduleConfig).map(([module, config]) => (
                        <div key={module} className="border rounded-lg p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium text-lg">{config.name}</h4>
                              <p className="text-sm text-muted-foreground">{config.description}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`module-${module}`}
                                checked={isModuleFullySelected(module)}
                                onCheckedChange={(checked) => handleModuleToggle(module, checked as boolean)}
                              />
                              <Label htmlFor={`module-${module}`} className="text-sm font-medium">
                                Seleccionar Todo
                              </Label>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {config.actions.map((action) => {
                              const permissionId = `${module}_${action.key}`
                              const ActionIcon = action.icon
                              return (
                                <div
                                  key={permissionId}
                                  className="flex items-start space-x-3 p-2 rounded border bg-gray-50"
                                >
                                  <Checkbox
                                    id={permissionId}
                                    checked={formData.permissions.includes(permissionId)}
                                    onCheckedChange={(checked) =>
                                      handlePermissionChange(permissionId, checked as boolean)
                                    }
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-2">
                                      <ActionIcon className="h-4 w-4 text-gray-600" />
                                      <Label htmlFor={permissionId} className="text-sm font-medium">
                                        {action.name}
                                      </Label>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">{action.description}</p>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">{editingRole ? "Actualizar Rol" : "Crear Rol"}</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {roles.map((role) => (
            <div key={role.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <h3 className="font-medium text-lg">{role.name}</h3>
                  <Badge variant={role.isActive ? "default" : "secondary"}>
                    {role.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {canUpdate && (
                    <Button variant="outline" size="sm" onClick={() => handleEdit(role)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                  {canDelete && !["admin", "vendedor", "supervisor"].includes(role.id) && (
                    <Button variant="outline" size="sm" onClick={() => handleDelete(role.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{role.description}</p>

              <div className="space-y-2">
                {Object.entries(moduleConfig).map(([module, config]) => {
                  const modulePermissions = role.permissions.filter((p) => p.startsWith(`${module}_`))
                  if (modulePermissions.length === 0) return null

                  return (
                    <div key={module} className="flex items-center gap-2">
                      <Badge variant="outline" className="font-medium">
                        {config.name}
                      </Badge>
                      <div className="flex flex-wrap gap-1">
                        {modulePermissions.map((permissionId) => {
                          const actionKey = permissionId.split("_")[1]
                          const action = config.actions.find((a) => a.key === actionKey)
                          return action ? (
                            <Badge key={permissionId} variant="secondary" className="text-xs">
                              {action.name}
                            </Badge>
                          ) : null
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
