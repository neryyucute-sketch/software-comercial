import { db } from "../lib/db";
import type { OfferDef } from "../lib/types.offers";

export async function materializeOffer(offerId: string) {
  const off = await db.offer_defs.get(offerId);
  if (!off) return;

  // limpiar lo anterior
  await db.offer_targets.where("offerId").equals(offerId).delete();
  await db.pack_items.where("offerId").equals(offerId).delete();

  if (off.deleted) return;

  const status: "active" | "inactive" =
    off.status === "active" ? "active" : "inactive";
  const vf = off.dates.validFrom;
  const vt = off.dates.validTo;

  // Combos / kits → pack_items + targets por cada producto del pack
  if (off.type === "combo" || off.type === "kit") {
    for (const item of off.pack?.items ?? []) {
      await db.pack_items.add({
        offerId: off.id,
        productId: item.productId,
        qty: item.qty,
        description: item.description,
      });

      await db.offer_targets.add({
        offerId: off.id,
        type: off.type,
        productId: item.productId,
        validFrom: vf,
        validTo: vt,
        status,
      });
    }
    return;
  }

  // Descuentos / bonificaciones → targets por producto
  const productTargets = new Set<string>();
  for (const p of off.products ?? []) productTargets.add(p);

  for (const productId of productTargets) {
    await db.offer_targets.add({
      offerId: off.id,
      type: "bonus",
      productId,
      validFrom: vf,
      validTo: vt,
      status,
    });
  }
}

export async function dematerializeOffer(offerId: string) {
  await db.offer_targets.where("offerId").equals(offerId).delete();
  await db.pack_items.where("offerId").equals(offerId).delete();
}
