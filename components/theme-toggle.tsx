"use client"

import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/contexts/theme-context"

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <Button variant="outline" size="sm" onClick={toggleTheme} className="w-full justify-start bg-transparent">
      {theme === "light" ? (
        <>
          <Moon className="h-4 w-4 mr-2" />
          Modo Oscuro
        </>
      ) : (
        <>
          <Sun className="h-4 w-4 mr-2" />
          Modo Claro
        </>
      )}
    </Button>
  )
}
