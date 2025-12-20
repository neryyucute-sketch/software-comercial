import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDateForInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const UUID_REGEX = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i
const HEX32_REGEX = /^[0-9A-F]{32}$/i
const CODE_KEYS = [
  "referenceCode",
  "codigoReferencia",
  "codigoOferta",
  "codigo",
  "code",
  "codigoCombo",
  "codigoKit",
  "comboCode",
  "kitCode",
  "clave",
  "valor",
  "value",
  "id",
  "idt",
  "uuid",
  "uuidOferta",
  "serverId",
]

export function isUuidLike(value: string | null | undefined): boolean {
  if (!value) return false
  const trimmed = value.trim()
  if (!trimmed) return false
  return UUID_REGEX.test(trimmed) || HEX32_REGEX.test(trimmed)
}

export function normalizeCodeCandidate(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const normalized = normalizeCodeCandidate(entry)
      if (normalized) return normalized
    }
    return undefined
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    for (const key of CODE_KEYS) {
      if (Object.prototype.hasOwnProperty.call(record, key)) {
        const normalized = normalizeCodeCandidate(record[key])
        if (normalized) return normalized
      }
    }
    return undefined
  }

  if (value === undefined || value === null) return undefined

  if (typeof value === "string" || typeof value === "number") {
    const raw = String(value).trim()
    if (!raw) return undefined
    if (isUuidLike(raw)) return undefined
    const normalized = raw.toUpperCase()
    if (!normalized) return undefined
    return normalized
  }

  return undefined
}

export function pickReferenceCode(...values: unknown[]): string | undefined {
  for (const value of values) {
    const normalized = normalizeCodeCandidate(value)
    if (normalized) return normalized
  }
  return undefined
}
