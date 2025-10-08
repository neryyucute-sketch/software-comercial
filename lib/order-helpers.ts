// lib/order-helpers.ts
import type { Combo, Product } from "@/lib/types"

export function getComboOptionalProducts(combo: Combo, products: Product[]): Product[] {
  let optional: Product[] = []

  if (combo.optionalProductLines?.length) {
    optional = products.filter((p) => p.isActive && combo.optionalProductLines.includes(p.category))
  }

  if (combo.optionalProductIds?.length) {
    const specific = products.filter((p) => p.isActive && combo.optionalProductIds.includes(p.id))
    optional = [...optional, ...specific]
  }

  const seen = new Set<string>()
  return optional.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
}

export function dateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
