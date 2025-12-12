// services/pricelists.repo.ts
import { db } from "../lib/db";
import type { PriceListRow, PriceListItemRow } from "../lib/types";


function nowIso() { return new Date().toISOString(); }

type PriceListMeta = Omit<PriceListRow, "updatedAt" | "version"> & {
  version?: number;
};

export async function upsertPriceList(
  meta: PriceListMeta,
  items: Array<{ productId: string; price: number }>
) {
  const row: PriceListRow = {
    ...meta,
    updatedAt: nowIso(),
    version: (meta.version ?? 0) + 1,
    dirty: true,
    deleted: meta.deleted ?? false,
  };

  await db.transaction("rw", db.price_lists, db.price_list_items, async () => {
    await db.price_lists.put(row);
    await db.price_list_items.where("priceListId").equals(row.id).delete();
    const bulk: PriceListItemRow[] = items.map((it) => ({
      priceListId: row.id,
      productId: it.productId,
      price: it.price,
    }));
    if (bulk.length) await db.price_list_items.bulkAdd(bulk);
  });

  return row.id;
}

