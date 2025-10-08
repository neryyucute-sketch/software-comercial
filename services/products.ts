import { saveData, getData, db } from "../lib/db";
import type { Product, AuthUser } from "../lib/types";
import { syncData } from "./sync"

let allProducts: Product[] = [];
const API_BASE = process.env.NEXT_PUBLIC_API_URL;
const LABEL_PRODUCTOS = process.env.LABEL_PRODUCTOS || "products";


export async function syncProducts(user: AuthUser | null): Promise<Product[]> {

  try {
    const vendedorConf = user?.usuarioConfiguracion.find(
      (item: any) => item.configuracion === "CODIGO_VENDEDOR"
    );
    const codigoEmpresa = vendedorConf?.codigoEmpresa??"";
    const codigoVendedor = vendedorConf?.valor??"";
    const params: Record<string, string> = {  codigoEmpresa:codigoEmpresa, codigoVendedor: codigoVendedor };

    const result = await syncData("catalogo-productos/porVendedor", "Productos", 20, params)
    // 👇 si result es null, queda []
    allProducts = (result ?? []) as Product[]
    await saveData("products", allProducts);
  } catch (error) {
    console.error("❌ Error sincronizando productos:", error)
  }
    return allProducts;
}

/**
 * Devuelve todos los productos cacheados de IndexedDB.
 */
export async function getCachedProducts(): Promise<Product[]> {
  try {
    return await db.products.toArray();
  } catch {
    return [];
  }
}

/**
 * Devuelve productos filtrados por proveedor.
 */
export async function getProductsByProvider(proveedorId: string): Promise<Product[]> {
  return await db.products.where("codigoProveedor").equals(proveedorId).toArray();
}

/**
 * Devuelve productos filtrados por línea.
 */
export async function getProductsByLine(lineaId: string): Promise<Product[]> {
  return await db.products.where("codigoSubfamilia").equals(lineaId).toArray();
  // 👆 cámbialo si tu campo real es `linea_id` en vez de `codigoSubfamilia`
}

/**
 * Busca productos en cache por texto libre.
 */
export async function searchProducts(term: string): Promise<Product[]> {
  const q = term.toLowerCase();
  const all = await db.products.toArray();
  return all.filter((p) =>
    [
      p.descripcion,
      p.descripcionCorta,
      p.codigoProducto,
      p.codigoProducto,
      p.proveedor,
      p.codigoFamilia,
      p.familia,
      p.codigoSubfamilia,
      p.subfamilia,
      p.categoria,
      p.codigoFiltroVenta,
      p.filtroVenta,
      p.urlImg,
    ]
      .join(" ")
      .toLowerCase()
      .includes(q)
  );
}
