import Dexie, { Table } from "dexie";
import type { Product, VendedorRestriccion, AuthUser, DeviceCache, Cliente, Tokens, Order, Combo, Kit, PriceList, Vendedor, Offer } from "./types";
import { encryptData, decryptData } from "./crypto-utils";

// 🔹 Tipo para el token cacheado
export interface AuthCache {
  id: string; // siempre "auth"
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  user: AuthUser; // 👈 agregamos aquí el usuario completo
  deviceId : string;
}

// 🔹 Definimos la clase DB extendiendo Dexie
export class PreventaDB extends Dexie {
  // Tablas (stores)
  products!: Table<Product, string>;
  clientes!: Table<Cliente, string>;
  precios!: Table<any, string>;
  ofertas!: Table<any, string>;
  restricciones_vendedor!: Table<VendedorRestriccion, number>;
  auth!: Table<AuthCache, string>; // key: id fijo "auth"
  tokens!: Table<Tokens, String>; // 👈 nueva tabla
  devices!: Table<DeviceCache, String>;
  orders!: Dexie.Table<Order, number>;
  combos!: Dexie.Table<Combo, string>;
  offers!: Dexie.Table<Offer, String>;
  kits!: Dexie.Table<Kit, string>;
  priceLists!: Dexie.Table<PriceList, string>;
  vendedor!: Dexie.Table<Vendedor, string>;
  constructor() {
    super("preventa_offline");

    // ⚡️ Esquema de IndexedDB
    this.version(8).stores({
      products:
        "codigoProducto, descripcion, codigoProveedor, proveedor, codigoFamilia, familia, codigoSubfamilia, subfamilia, codigoFiltroVenta, filtroVenta, urlImg",
      clientes: "idt, codigoCliente, nombre, nit, telefono, correo, updatedAt",
      precios: "idt",
      ofertas: "idt",
      restricciones_vendedor: "idt, codigoEmpresa, codigoVendedor, codigoSublinea",
      auth: "id", // auth solo tendrá 1 registro
      credentials: "id", // 👈 nueva tabla
      tokens: "id", // 👈 nueva tabla
      devices: "id",   // nueva tabla para deviceId
      orders: "++id, localId, serverId, customerId, createdAt, status, synced, attempts",  // clave auto + índices
      combos:"idt, descripcion",
      kits:"idt,descripcion",
      priceLists:"idt,descripcion",
      vendedor:"idt,codigoVendedor",
      offers:"idt,descripcion"
    });
  }
}

// Instancia única
export const db = new PreventaDB();

// -------------------------------
// Helpers reutilizables
// -------------------------------
export async function saveData<T>(store: keyof PreventaDB, data: T[]) {
  const table = db[store] as Table<T, any>;
  await table.clear();
  await table.bulkPut(data);
}

export async function getData<T>(store: keyof PreventaDB): Promise<T[]> {
  const table = db[store] as Table<T, any>;
  return await table.toArray();
}

// -------------------------------
// Helpers específicos para auth
// -------------------------------
export async function saveToken(user: AuthUser, token: string, expiresAt: number, deviceId: string) {
  await db.auth.put({
    id: "auth",
    accessToken: await encryptData(token),
    expiresAt,
    user, // 👈 guardamos el usuario
    deviceId,
  });
}

export async function getToken(): Promise<AuthCache | null> {
  const record = await db.auth.get("auth");
  if (!record) return null;
  return record;
}

export async function clearToken() {
  await db.auth.clear();
}
