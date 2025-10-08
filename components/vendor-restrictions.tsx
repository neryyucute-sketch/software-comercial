"use client"
import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

// Esto debe venir del backend
const vendedores = [
  { id: 101, nombre: "Carlos Pérez" },
  { id: 102, nombre: "Ana López" },
]
const sublineas = ["BEBIDAS", "SNACKS", "MEDICINAS", "HIGIENE"]

export function VendorRestrictions() {
  const [selectedVendedor, setSelectedVendedor] = useState<number | null>(null)
  const [permisos, setPermisos] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (selectedVendedor) {
      // 🚀 Aquí debes llamar a la API: /api/vendedores/:id/permisos
      setPermisos({ BEBIDAS: true, SNACKS: false, MEDICINAS: false, HIGIENE: true })
    }
  }, [selectedVendedor])

  const togglePermiso = (sub: string) => {
    setPermisos((prev) => ({ ...prev, [sub]: !prev[sub] }))
  }

  const guardar = async () => {
    if (!selectedVendedor) return
    const seleccionados = Object.entries(permisos)
      .filter(([_, val]) => val)
      .map(([sub]) => sub)

    await fetch(`/api/vendedores/${selectedVendedor}/permisos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(seleccionados),
    })
    alert("Permisos guardados ✅")
  }

  return (
    <Card className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Restricciones por Vendedor</h2>

      <select
        className="border p-2 rounded"
        onChange={(e) => setSelectedVendedor(Number(e.target.value))}
      >
        <option value="">Selecciona un vendedor</option>
        {vendedores.map((v) => (
          <option key={v.id} value={v.id}>
            {v.nombre}
          </option>
        ))}
      </select>

      {selectedVendedor && (
        <div className="space-y-2">
          {sublineas.map((s) => (
            <label key={s} className="flex items-center gap-2">
              <Checkbox
                checked={permisos[s] || false}
                onCheckedChange={() => togglePermiso(s)}
              />
              {s}
            </label>
          ))}
          <Button onClick={guardar}>Guardar permisos</Button>
        </div>
      )}
    </Card>
  )
}
