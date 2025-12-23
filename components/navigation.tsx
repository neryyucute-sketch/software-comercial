"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  ShoppingCart,
  Package,
  Users,
  BarChart3,
  Tag,
  List,
  RefreshCw,
  Home,
  Menu,
  X,
  Settings,
  Truck,
  LogOut,
  User,
  ChevronDown,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"

const mainNavigation = [
  { name: "Inicio", href: "/", icon: Home },
  { name: "Pedidos", href: "/orders", icon: ShoppingCart },
  { name: "Clientes", href: "/customers", icon: Users },
  { name: "Productos", href: "/products", icon: Package },
  { name: "Precios", href: "/prices", icon: List },
]

const adminNavigation = [
  { name: "Ofertas y Promociones", href: "/offers", icon: Tag, roles: ["admin", "manager"] },
  { name: "Vendedores", href: "/vendors", icon: Truck, roles: ["admin", "manager"] },
  { name: "Estadísticas", href: "/stats", icon: BarChart3, roles: ["admin", "manager", "VENDEDOR"] },
  { name: "Sincronizar", href: "/sync", icon: RefreshCw, roles: ["admin", "manager", "VENDEDOR"] },
  { name: "Configuración", href: "/settings", icon: Settings, roles: ["admin", "manager", "VENDEDOR"] },
]

export function Navigation() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [avatarDropdownOpen, setAvatarDropdownOpen] = useState(false)

  const roleMapping: { [key: string]: string } = {
    Administrador: "admin",
    Manager: "manager",
    Vendedor: "vendedor",
  }

  const userRole = roleMapping[user?.rol || ""] || user?.rol || "vendedor"

  const isSuperUser = user?.rol === "JEFE_SISTEMAS";

  const filteredAdminNav = adminNavigation.filter(
    (item) => isSuperUser || !item.roles || item.roles.includes(userRole)
  );


  const allNavigationItems = [...mainNavigation, ...filteredAdminNav]

  return (
    <>
      <header className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-40">
        <div className="flex items-center justify-between h-14 px-3 sm:px-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 touch-manipulation"
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate">Sistema Preventa</h1>
          <div className="relative">
            <button
              onClick={() => setAvatarDropdownOpen(!avatarDropdownOpen)}
              className="flex items-center space-x-2 p-1 rounded-md hover:bg-gray-100 touch-manipulation"
            >
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">{user?.nombre?.charAt(0).toUpperCase() || "U"}</span>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-600" />
            </button>

            {avatarDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setAvatarDropdownOpen(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-20">
                  <div className="py-1">
                    <Link
                      href="/profile"
                      onClick={() => setAvatarDropdownOpen(false)}
                      className="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 touch-manipulation"
                    >
                      <User className="w-4 h-4 mr-3" />
                      Configurar mi usuario
                    </Link>
                    <button
                      onClick={() => {
                        setAvatarDropdownOpen(false)
                        logout()
                      }}
                      className="flex items-center w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 touch-manipulation"
                    >
                      <LogOut className="w-4 h-4 mr-3" />
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>
      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={() => setSidebarOpen(false)} />
      )}
      <div
        className={cn(
          "fixed top-0 left-0 h-full w-80 sm:w-80 bg-white shadow-xl transform transition-transform duration-300 ease-in-out z-50",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between h-14 px-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Menú Principal</h2>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 touch-manipulation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto py-4">
            <div className="flex items-center px-4 mb-6">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mr-3">
                <span className="text-white text-lg font-medium">{user?.nombre?.charAt(0).toUpperCase() || "U"}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.nombre}</p>
                <p className="text-xs text-gray-500 capitalize">Rol: {userRole}</p>
              </div>
            </div>

            <nav className="space-y-1">
              <div className="px-4 py-2">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Principal</h3>
              </div>
              {mainNavigation.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center px-4 py-3 text-sm font-medium rounded-none transition-colors touch-manipulation",
                      pathname === item.href
                        ? "bg-blue-50 text-blue-700 border-r-2 border-blue-500"
                        : "text-gray-700 hover:bg-gray-50 hover:text-gray-900",
                    )}
                  >
                    <Icon className="w-5 h-5 mr-3 shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </Link>
                )
              })}

              {filteredAdminNav.length > 0 && (
                <>
                  <div className="px-4 py-2 mt-4">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Administración</h3>
                  </div>
                  {filteredAdminNav.map((item) => {
                    const Icon = item.icon
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={cn(
                          "flex items-center px-4 py-3 text-sm font-medium rounded-none transition-colors touch-manipulation",
                          pathname === item.href
                            ? "bg-blue-50 text-blue-700 border-r-2 border-blue-500"
                            : "text-gray-700 hover:bg-gray-50 hover:text-gray-900",
                        )}
                      >
                        <Icon className="w-5 h-5 mr-3 shrink-0" />
                        <span className="truncate">{item.name}</span>
                      </Link>
                    )
                  })}
                </>
              )}

              <div className="px-4 py-2 mt-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sesión</h3>
              </div>
              <button
                onClick={() => {
                  setSidebarOpen(false)
                  logout()
                }}
                className="flex items-center w-full px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors touch-manipulation"
              >
                <LogOut className="w-5 h-5 mr-3 shrink-0" />
                <span>Salir</span>
              </button>
            </nav>
          </div>
        </div>
      </div>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 safe-area-pb">
        <div className="flex justify-around items-center h-16 px-1">
          {mainNavigation.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 py-2 px-1 rounded-lg transition-colors touch-manipulation min-h-[44px]",
                  isActive ? "text-blue-600 bg-blue-50" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
                )}
              >
                <Icon className={cn("w-6 h-6 mb-1 shrink-0", isActive && "text-blue-600")} />
                <span
                  className={cn(
                    "text-xs font-medium leading-tight text-center",
                    isActive ? "text-blue-600" : "text-gray-600",
                  )}
                >
                  {item.name}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
      {/* Content spacer */}
      <div className="h-14" /> {/* Top spacer for fixed header */}
      <div className="h-16" /> {/* Bottom spacer for fixed bottom nav */}
    </>
  )
}
