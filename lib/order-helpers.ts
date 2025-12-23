// lib/order-helpers.ts
import type { Combo, Product, OrderItem } from "@/lib/types"
import { pickReferenceCode } from "@/lib/utils"

export function getComboOptionalProducts(combo: Combo, products: Product[]): Product[] {
  let optional: Product[] = []

  if (combo.optionalProductLines?.length) {
    optional = products.filter((p) => {
      const categoria = p.categoria ?? p.codigoCategoria ?? p.codigoLinea ?? p.codigoFiltroVenta ?? ""
      return p.isActive !== false && combo.optionalProductLines.includes(categoria)
    })
  }

  if (combo.optionalProductIds?.length) {
    const specific = products.filter((p) => {
      const pid = p.codigoProducto ?? p.idt ?? (p as any).id ?? ""
      return p.isActive !== false && combo.optionalProductIds!.includes(pid)
    })
    optional = [...optional, ...specific]
  }

  const seen = new Set<string>()
  return optional.filter((p) => {
    const pid = p.codigoProducto ?? p.idt ?? (p as any).id ?? ""
    if (!pid) return false
    if (seen.has(pid)) return false
    seen.add(pid)
    return true
  })
}

export function dateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export type OrderComboGroup = {
  key: string;
  comboGroupId?: string | null;
  comboId?: string | null;
  kitId?: string | null;
  comboCode?: string | null;
  offerCode?: string | null;
  comboName?: string | null;
  comboType?: "combo" | "kit";
  packPrice?: number;
  packsQty?: number;
  totalPrice: number;
  items: OrderItem[];
};

export function getComboGroupKey(item: OrderItem): string | null {
  if (!item.comboId && !item.kitId && !item.comboCode) return null;
  const base = item.comboGroupId || `${item.comboId || item.kitId || item.comboCode || item.id || ""}`;
  const packInfo = `${item.comboPacksQty ?? ""}-${item.comboPackPrice ?? ""}`;
  const code = item.comboCode ?? "";
  return `${base}::${packInfo}::${code}`;
}

export function groupOrderComboItems(items: OrderItem[] = []): OrderComboGroup[] {
  const map = new Map<string, OrderComboGroup>();
  const order: string[] = [];
  items.forEach((item) => {
    const key = getComboGroupKey(item);
    if (!key) return;
    if (!map.has(key)) {
      const initialComboCode = pickReferenceCode(item.comboCode, item.codigoOferta, item.ofertaCodigo, item.comboId, item.kitId);
      const initialOfferCode = pickReferenceCode(
        item.codigoOferta,
        item.ofertaCodigo,
        item.comboCode,
        item.priceListCode,
        item.ofertaIdAplicada,
        item.comboId,
        item.kitId
      );
      order.push(key);
      map.set(key, {
        key,
        comboGroupId: item.comboGroupId ?? null,
        comboId: item.comboId ?? null,
        kitId: item.kitId ?? null,
        comboCode: initialComboCode ?? null,
        offerCode: initialOfferCode ?? null,
        comboName: item.comboName || item.ofertaNombre || item.descripcion,
        comboType: (item.comboType as "combo" | "kit") || (item.kitId ? "kit" : "combo"),
        packPrice: item.comboPackPrice,
        packsQty: item.comboPacksQty,
        totalPrice: 0,
        items: [],
      });
    }
    const group = map.get(key)!;
    group.items.push(item);
    const lineTotal = item.subtotal ?? item.cantidad * item.precioUnitario;
    group.totalPrice = Math.round((group.totalPrice + lineTotal) * 100) / 100;
    if (item.comboPackPrice != null) group.packPrice = item.comboPackPrice;
    if (item.comboPacksQty != null) group.packsQty = item.comboPacksQty;
    if (!group.comboCode) {
      const code = pickReferenceCode(item.comboCode, item.codigoOferta, item.ofertaCodigo, item.comboId, item.kitId);
      if (code) group.comboCode = code;
    }
    if (!group.offerCode) {
      const code = pickReferenceCode(
        item.codigoOferta,
        item.ofertaCodigo,
        item.comboCode,
        item.priceListCode,
        item.ofertaIdAplicada,
        item.comboId,
        item.kitId
      );
      if (code) group.offerCode = code;
    }
    if (!group.comboName && (item.comboName || item.ofertaNombre)) {
      group.comboName = item.comboName || item.ofertaNombre;
    }
    if (!group.comboType) {
      group.comboType = (item.comboType as "combo" | "kit") || (item.kitId ? "kit" : "combo");
    }
  });

  return order.map((key) => map.get(key)!);
}

export function resolveComboGroupQuantity(group: OrderComboGroup): number {
  const candidate = group.packsQty ?? group.items[0]?.comboPacksQty;
  if (candidate != null && candidate > 0) return candidate;
  const packPrice = group.packPrice ?? group.items[0]?.comboPackPrice;
  if (packPrice != null && packPrice > 0) {
    const approx = group.totalPrice / packPrice;
    if (approx > 0) return Math.max(1, Math.round(approx));
  }
  const fallbackItem = group.items[0];
  if (fallbackItem?.comboPacksQty && fallbackItem.comboPacksQty > 0) return fallbackItem.comboPacksQty;
  return 1;
}

export function resolveComboGroupUnitPrice(group: OrderComboGroup): number {
  const base = group.packPrice ?? group.items[0]?.comboPackPrice;
  if (base != null && base > 0) return base;
  const quantity = resolveComboGroupQuantity(group);
  if (!quantity) return group.totalPrice;
  return Math.round((group.totalPrice / quantity) * 100) / 100;
}

const normalizeSortValue = (value?: string | null) => {
  if (value === undefined || value === null) return "";
  const str = String(value).trim().toLowerCase();
  return str;
};

type ProductLookup = (productoId: string) => Partial<Product> | undefined;

const toOptionalString = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str.length ? str : null;
};

const inferOfferType = (item: OrderItem): OrderItem["tipoOferta"] | undefined => {
  if (item.tipoOferta) return item.tipoOferta;
  if (item.comboType === "combo" || item.comboId) return "combo";
  if (item.comboType === "kit" || item.kitId) return "kit";
  if (item.priceListCode) return "pricelist";
  return undefined;
};

const cloneItem = (item: OrderItem): OrderItem => ({ ...item, relatedItemIds: item.relatedItemIds ? [...item.relatedItemIds] : undefined });

type PrepareOptions = {
  lookupProduct?: ProductLookup;
};

export function prepareOrderItemsForPersistence(items: OrderItem[], options?: PrepareOptions): OrderItem[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  const lookup: ProductLookup | undefined = options?.lookupProduct;

  const enriched = items.map((item) => {
    const product = lookup?.(item.productoId);
    const codigoProveedor = item.codigoProveedor ?? toOptionalString(product?.codigoProveedor);
    const nombreProveedor = item.nombreProveedor ?? toOptionalString((product as any)?.proveedor ?? (product as any)?.nombreProveedor);
    const codigoLinea = item.codigoLinea ?? toOptionalString((product as any)?.codigoLinea ?? (product as any)?.codigoFiltroVenta ?? (product as any)?.lineaVenta);
    const nombreLinea = item.nombreLinea ?? toOptionalString((product as any)?.linea ?? (product as any)?.filtroVenta);
    const comboCode = pickReferenceCode(item.comboCode, item.ofertaCodigo, item.comboId, item.kitId);
    const offerCode = pickReferenceCode(
      item.ofertaCodigo,
      item.priceListCode,
      comboCode,
      item.ofertaIdAplicada,
      item.comboId,
      item.kitId
    );
    const tipoOferta = inferOfferType(item);

    return {
      ...item,
      comboCode: comboCode ?? null,
      codigoProveedor: codigoProveedor ?? null,
      nombreProveedor: nombreProveedor ?? null,
      codigoLinea: codigoLinea ?? null,
      nombreLinea: nombreLinea ?? null,
      ofertaCodigo: offerCode ?? null,
      tipoOferta,
    } as OrderItem;
  });

  const byId = new Map<string, OrderItem>();
  enriched.forEach((item) => {
    if (item.id) byId.set(item.id, item);
  });

  const isComboItem = (item: OrderItem) => Boolean(item.comboId || item.kitId || item.comboCode || item.comboType);
  const isBonusItem = (item: OrderItem) => Boolean(item.esBonificacion);

  const combos = enriched.filter(isComboItem);
  const nonCombos = enriched.filter((item) => !isComboItem(item));
  const bonusItems = nonCombos.filter(isBonusItem);
  const primaryItems = nonCombos.filter((item) => !isBonusItem(item));

  const bonusByParent = new Map<string, OrderItem[]>();
  const orphanBonuses: OrderItem[] = [];

  bonusItems.forEach((bonus) => {
    const candidateIds = [bonus.parentItemId, ...(bonus.relatedItemIds || [])]
      .filter(Boolean)
      .map((id) => id != null ? String(id) : "");

    let parent: OrderItem | undefined;
    for (const candidate of candidateIds) {
      const found = byId.get(candidate);
      if (found && found !== bonus) {
        parent = found;
        break;
      }
    }

    if (!parent && bonus.promoBonificacionId) {
      parent = primaryItems.find((item) => item.promoBonificacionId === bonus.promoBonificacionId) ?? undefined;
    }

    if (!parent) {
      parent = primaryItems.find((item) => item.productoId === bonus.productoId);
    }

    if (!parent) {
      parent = combos.find((item) => item.productoId === bonus.productoId);
    }

    if (parent && parent.id) {
      const existing = bonusByParent.get(parent.id) ?? [];
      existing.push(bonus);
      bonusByParent.set(parent.id, existing);
    } else {
      orphanBonuses.push(bonus);
    }
  });

  const compareRegular = (a: OrderItem, b: OrderItem) => {
    const provA = normalizeSortValue(a.codigoProveedor) || normalizeSortValue(a.nombreProveedor);
    const provB = normalizeSortValue(b.codigoProveedor) || normalizeSortValue(b.nombreProveedor);
    if (provA !== provB) return provA.localeCompare(provB);

    const lineaA = normalizeSortValue(a.codigoLinea) || normalizeSortValue(a.nombreLinea);
    const lineaB = normalizeSortValue(b.codigoLinea) || normalizeSortValue(b.nombreLinea);
    if (lineaA !== lineaB) return lineaA.localeCompare(lineaB);

    const descA = normalizeSortValue(a.descripcion);
    const descB = normalizeSortValue(b.descripcion);
    if (descA !== descB) return descA.localeCompare(descB);

    const prodA = normalizeSortValue(a.productoId);
    const prodB = normalizeSortValue(b.productoId);
    if (prodA !== prodB) return prodA.localeCompare(prodB);

    return 0;
  };

  const compareBonuses = (a: OrderItem, b: OrderItem) => {
    const descA = normalizeSortValue(a.descripcion);
    const descB = normalizeSortValue(b.descripcion);
    if (descA !== descB) return descA.localeCompare(descB);
    return compareRegular(a, b);
  };

  const takeBonuses = (parentId?: string | null): OrderItem[] => {
    if (!parentId) return [];
    const list = bonusByParent.get(parentId);
    if (!list || !list.length) return [];
    bonusByParent.delete(parentId);
    return [...list].sort(compareBonuses);
  };

  const sortedPrimaries = [...primaryItems].sort(compareRegular);
  const finalItems: OrderItem[] = [];

  const pushItem = (item: OrderItem) => {
    finalItems.push(cloneItem(item));
  };

  sortedPrimaries.forEach((item) => {
    pushItem(item);
    takeBonuses(item.id).forEach(pushItem);
  });

  if (orphanBonuses.length) {
    orphanBonuses.sort(compareBonuses).forEach(pushItem);
  }

  const comboGroups = groupOrderComboItems(combos);
  const sortedComboGroups = comboGroups.sort((a, b) => {
    const firstA = a.items[0];
    const firstB = b.items[0];
    const itemA = (firstA && byId.get(firstA.id)) || firstA;
    const itemB = (firstB && byId.get(firstB.id)) || firstB;
    const provA = normalizeSortValue(itemA?.codigoProveedor) || normalizeSortValue(itemA?.nombreProveedor) || normalizeSortValue(a.comboName);
    const provB = normalizeSortValue(itemB?.codigoProveedor) || normalizeSortValue(itemB?.nombreProveedor) || normalizeSortValue(b.comboName);
    if (provA !== provB) return provA.localeCompare(provB);
    const nameA = normalizeSortValue(a.comboName) || normalizeSortValue(itemA?.descripcion) || normalizeSortValue(itemA?.comboCode);
    const nameB = normalizeSortValue(b.comboName) || normalizeSortValue(itemB?.descripcion) || normalizeSortValue(itemB?.comboCode);
    if (nameA !== nameB) return nameA.localeCompare(nameB);
    return 0;
  });

  sortedComboGroups.forEach((group) => {
    group.items.forEach((comboItem) => {
      const resolved = byId.get(comboItem.id) ?? comboItem;
      pushItem(resolved);
      takeBonuses(resolved.id).forEach(pushItem);
    });
  });

  if (bonusByParent.size) {
    Array.from(bonusByParent.values()).flat().sort(compareBonuses).forEach(pushItem);
  }

  return finalItems.map((item, idx) => ({
    ...item,
    lineNumber: idx + 1,
  }));
}
