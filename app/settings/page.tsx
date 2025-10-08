"use client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UserManagement } from "@/components/user-management"
import { RoleManagement } from "@/components/role-management"
import { VendorClassificationManagement } from "@/components/vendor-classification-management"
import { ThemeToggle } from "@/components/theme-toggle"
import { useAuth } from "@/contexts/AuthContext"
import { LogOut, Shield, Users, Palette, Tag, Settings } from "lucide-react"
import { VendorRestrictions } from "@/components/vendor-restrictions"

export default function SettingsPage() {
  const { user, logout, hasPermission } = useAuth()

  if (!hasPermission("users", "read")) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Shield className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Acceso Denegado</h3>
              <p className="text-muted-foreground">No tienes permisos para acceder a esta sección.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="h-8 w-8" />
            Configuración
          </h1>
          <p className="text-muted-foreground">Gestión de usuarios, roles, permisos y configuraciones del sistema</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-medium">{user?.username}</p>
            <p className="text-sm text-muted-foreground">{user?.role.name}</p>
          </div>
          <Button variant="outline" onClick={logout}>
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar Sesión
          </Button>
        </div>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">
            <Users className="h-4 w-4 mr-2" />
            Usuarios
          </TabsTrigger>
          <TabsTrigger value="roles">
            <Shield className="h-4 w-4 mr-2" />
            Roles y Permisos
          </TabsTrigger>
          <TabsTrigger value="classifications">
            <Tag className="h-4 w-4 mr-2" />
            Clasificaciones
          </TabsTrigger>
          <TabsTrigger value="restrictions">
            Restricciones
          </TabsTrigger> 
          <TabsTrigger value="appearance">
            <Palette className="h-4 w-4 mr-2" />
            Apariencia
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UserManagement />
        </TabsContent>

        <TabsContent value="roles">
          <RoleManagement />
        </TabsContent>

        <TabsContent value="classifications">
          <VendorClassificationManagement />
        </TabsContent>

        <TabsContent value="restrictions">
          <VendorRestrictions />
        </TabsContent>

        <TabsContent value="appearance">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Tema de la Aplicación</h3>
                  <p className="text-muted-foreground mb-4">
                    Personaliza la apariencia de la aplicación según tus preferencias.
                  </p>
                </div>
                <div className="max-w-xs">
                  <ThemeToggle />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
