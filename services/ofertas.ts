import { db } from "../lib/db";
import { syncData } from "./sync";
import type { AuthUser } from "../lib/types";
import type { OfferDef } from "../lib/types.offers";
import { materializeOffer } from "./offers.materializer";

export async function syncOfertasPreventa(user: AuthUser | null): Promise<void> {
  const ven = user?.usuarioConfiguracion.find(
    (i: any) => i.configuracion === "CODIGO_VENDEDOR"
  );
  
  const params = {
    codigoEmpresa: ven?.codigoEmpresa ?? "",
  };

  // Usar endpoint de listado con paginación
  console.debug("[syncOfertasPreventa] params:", params);
  const result = await syncData("oferta-preventa", "Ofertas Preventa", 100, params);
  console.debug("[syncOfertasPreventa] raw result:", result && Array.isArray(result) ? `array(${result.length})` : result);

  if (result && Array.isArray(result)) {
    const ofertas: OfferDef[] = result.map((item: any) => {
      const detalle = item.detalle || item;
      
      return {
        id: item.uuidOferta || detalle.id,
        serverId: item.uuidOferta,
        codigoEmpresa: item.codigoEmpresa || detalle.codigoEmpresa,
        type: detalle.type || item.tipoOferta,
        name: detalle.name || "",
        description: detalle.description || "",
        status: detalle.status || item.estado || "draft",
        dates: {
          validFrom: detalle.dates?.validFrom || item.fechaDesde,
          validTo: detalle.dates?.validTo || item.fechaHasta,
        },
        scope: detalle.scope || {},
        products: detalle.products || [],
        familias: detalle.familias || [],
        subfamilias: detalle.subfamilias || [],
        proveedores: detalle.proveedores || [],
        discount: detalle.discount,
        bonus: detalle.bonus,
        pack: detalle.pack,
        version: item.version || 1,
        updatedAt: item.fechaModificacion || new Date().toISOString(),
        dirty: false,
        deleted: item.eliminado || false,
      };
    });

    // Guardar en IndexedDB
    try {
      await db.offer_defs.clear();
      await db.offer_defs.bulkPut(ofertas);
    } catch (e) {
      console.error("[syncOfertasPreventa] error writing offer_defs:", e);
      return; // abortamos la materialización si no podemos guardar
    }

    // Verificación inmediata: leer y loguear lo guardado
    try {
      const saved = await db.offer_defs.toArray();
      console.debug("[syncOfertasPreventa] saved in DB:", saved.length, saved.map((s) => s.id));
    } catch (e) {
      console.error("[syncOfertasPreventa] error reading offer_defs after bulkPut:", e);
    }

    // Materializar cada oferta (crear offer_targets)
    for (const oferta of ofertas) {
      await materializeOffer(oferta.id);
    }

    console.log(`✅ Sincronizadas ${ofertas.length} ofertas preventa`);
  }
}