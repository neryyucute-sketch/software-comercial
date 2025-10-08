// lib/permissions.ts
export type Role =
  | "Administrador"
  | "Manager"
  | "Vendedor"
  | "Invitado"
  | undefined
  | null;

type Resource = "orders" | "customers" | "products" | "combos" | "kits";
type Action = "read" | "create" | "update" | "cancel" | "delete";

const ROLE_MATRIX: Record<
  Exclude<Role, undefined | null>,
  Partial<Record<Resource, Action[]>>
> = {
  Administrador: {
    orders:   ["read", "create", "update", "cancel", "delete"],
    customers:["read", "create", "update", "delete"],
    products: ["read", "create", "update", "delete"],
    combos:   ["read", "create", "update", "delete"],
    kits:     ["read", "create", "update", "delete"],
  },
  Manager: {
    orders:   ["read", "create", "update", "cancel"],
    customers:["read", "create", "update"],
    products: ["read", "create", "update"],
    combos:   ["read", "create", "update"],
    kits:     ["read", "create", "update"],
  },
  Vendedor: {
    orders:   ["read", "create", "update"],
    customers:["read"],
    products: ["read"],
    combos:   ["read"],
    kits:     ["read"],
  },
  Invitado: {
    orders:   ["read"],
    customers:["read"],
    products: ["read"],
    combos:   ["read"],
    kits:     ["read"],
  },
};

/**
 * Devuelve true/false según permisos del rol.
 * Si el rol viene vacío/undefined, se trata como "Invitado".
 */
export function hasPermission(
  role: Role,
  resource: Resource,
  action: Action
): boolean {
  const resolvedRole = (role ?? "Invitado") as Exclude<Role, undefined | null>;
  const allowed = ROLE_MATRIX[resolvedRole]?.[resource] ?? [];
  return allowed.includes(action);
}
