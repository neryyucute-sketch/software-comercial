import { db } from "../lib/db";
import { syncData } from "./sync";
import type { Combo, Kit, PriceList, Offer, AuthUser } from "../lib/types";

export async function getCachedCombos(): Promise<Combo[]> { return db.combos.toArray(); }
export async function getCachedKits(): Promise<Kit[]> { return db.kits.toArray(); }
export async function getCachedPrecios(): Promise<PriceList[]> { return db.precios.toArray(); }
export async function getCachedOfertas(): Promise<Offer[]> { return db.ofertas.toArray(); }

export async function syncCombos(user: AuthUser|null){ 
  const r = await syncData("catalogo-combos/porVendedor","Combos",20, buildParams(user));
  if (r) await db.combos.bulkPut(r as Combo[]);
}

export async function syncKits(user: AuthUser|null){ 
  const r = await syncData("catalogo-kits/porVendedor","Kits",20, buildParams(user));
  if (r) await db.kits.bulkPut(r as Kit[]);
}

export async function syncPrecios(user: AuthUser|null){ 
  const r = await syncData("listas-precio/porVendedor","Listas de precios",20, buildParams(user));
  if (r) await db.precios.bulkPut(r as PriceList[]);
}

export async function syncOfertas(user: AuthUser|null){ 
  const r = await syncData("ofertas/porVendedor","Ofertas",20, buildParams(user));
  if (r) await db.ofertas.bulkPut(r as Offer[]);
}

function buildParams(user: AuthUser|null){
  const ven = user?.usuarioConfiguracion.find((i:any)=>i.configuracion==="CODIGO_VENDEDOR");
  return { codigoEmpresa: ven?.codigoEmpresa??"", codigoVendedor: ven?.valor??"" };
}
