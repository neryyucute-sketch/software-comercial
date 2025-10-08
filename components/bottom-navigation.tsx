"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { ShoppingCart, Package, Users, BarChart3, Tag, List, Home, Settings, LogOut, UserCheck } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"

const navigation = [
  { name: "Inicio", href: "/", icon: Home },
  { name: "Pedidos", href: "/orders", icon: ShoppingCart },
  { name: "Productos", href: "/products", icon: Package },
  { name: "Clientes", href: "/customers", icon: Users },
  { name: "Vendedores", href: "/vendors", icon: UserCheck },
  { name: "Ofertas", href: "/offers", icon: Tag },
  { name: "Precios", href: "/prices", icon: List },
  { name: "Stats", href: "/stats", icon: BarChart3 },
  {
    name: "Configuración",
    href: "/admin",
    icon: Settings,
    requiresPermission: { module: "users" as const, action: "read" as const },
  },
]

export function BottomNavigation() {
  const pathname = usePathname()
  const { hasPermission, logout } = useAuth()

  const visibleNavigation = navigation.filter((item) => {
    if (item.requiresPermission) {
      return hasPermission(item.requiresPermission.module, item.requiresPermission.action)
    }
    return true
  })

  const totalItems = visibleNavigation.length + 1 // +1 para el botón de logout

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50">
      <div className={cn("grid h-16", `grid-cols-${totalItems}`)}>
        {visibleNavigation.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center space-y-1 text-xs font-medium transition-colors",
                isActive ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-accent",
              )}
            >
              <Icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-muted-foreground")} />
              <span className="truncate">{item.name}</span>
            </Link>
          )
        })}

        <Button
          variant="ghost"
          onClick={logout}
          className="flex flex-col items-center justify-center space-y-1 text-xs font-medium text-destructive hover:text-destructive hover:bg-destructive/10 h-full rounded-none"
        >
          <LogOut className="w-5 h-5" />
          <span className="truncate">Salir</span>
        </Button>
      </div>
    </nav>
  )
}
