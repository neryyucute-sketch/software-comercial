import type { VendedorRestriccion } from "../lib/types";
import { getAccessToken } from "./auth";
import { saveData, getData } from "../lib/db";

/**
 * Sincroniza las restricciones de un vendedor desde el backend
 * y las guarda en IndexedDB.
 */
export async function syncVendedorRestriccion(
  codigoEmpresa: string = "E01",
  codigoVendedor: string = "7"
): Promise<VendedorRestriccion[]> {
  const token = await getAccessToken();
  let allVendedorRestriccion: VendedorRestriccion[] = [];

  const res = await fetch(
    `/api/backend/api/v1/restricciones-vendedor?codigoEmpresa=${codigoEmpresa}&codigoVendedor=${codigoVendedor}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    console.error("Error fetching vendedor restriccion:", res.status, errorText);
    throw new Error(
      `Error al traer restriccion vendedor: ${res.status} - ${errorText}`
    );
  }

  const data = await res.json();
  allVendedorRestriccion = allVendedorRestriccion.concat(data.content);

  // Guardar en IndexedDB usando Dexie
  await saveData("restricciones_vendedor", allVendedorRestriccion);

  return allVendedorRestriccion;
}

/**
 * Devuelve las restricciones de vendedor cacheadas de IndexedDB.
 */
export async function getCachedVendedorRestriccion(): Promise<VendedorRestriccion[]> {
  return await getData<VendedorRestriccion>("restricciones_vendedor");
}
