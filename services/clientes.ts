// services/clientes.ts
import { saveData, getData, db } from "../lib/db";
import type { Cliente, AuthUser } from "../lib/types";
import { syncData } from "./sync"

let allClientes: Cliente[] = [];

/**
 * Leer clientes cacheados desde IndexedDB
 */
export async function getCachedClientes(): Promise<Cliente[]> {
  try {
    return await db.clientes.toArray();
  } catch (err) {
    console.error("❌ Error leyendo clientes de IndexedDB:", err);
    return [];
  }
}

/**
 * Sincronizar clientes con el backend
 */
export async function syncClientes(user: AuthUser | null): Promise<void> {
  try {
    let results: Cliente[] = []
    const vendedorConf = user?.usuarioConfiguracion.find(
      (item: any) => item.configuracion === "CODIGO_VENDEDOR"
    );
    const codigoEmpresa = vendedorConf?.codigoEmpresa??"";
    const codigoVendedor = vendedorConf?.valor??"";
    const params: Record<string, string> = {  codigoEmpresa:codigoEmpresa, codigoVendedor: codigoVendedor };

    const result = await syncData("catalogo-clientes/porEmpresaVendedorRuta", "Clientes", 20, params)
    // 👇 si result es null, queda []

    allClientes = (result ?? []) as Cliente[];
    await saveData("clientes", allClientes);

  } catch (err) {
    console.error("❌ Error en syncClientes:", err);
    throw err;
  }
}
