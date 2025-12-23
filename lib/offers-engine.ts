import type { OfferDef, DiscountTier, BonusConfig, BonusTargetType } from "./types.offers";
import type { Order, OrderItem, Cliente, Product } from "./types";

/**
 * 🎯 Motor de validación de ofertas
 * Determina qué ofertas aplican a un pedido según productos y cliente
 */

export interface ApplicableOffer {
  offer: OfferDef;
  applicableItems: OrderItem[];
  potentialDiscount: number;
  potentialBonusQty?: number;
  bonusApplications?: BonusApplication[];
}

export type BonusApplication = {
  mode: "acumulado" | "por_linea";
  bonusQty: number;
  targetType: BonusTargetType;
  resolvedProductId?: string;
  requiresSelection?: boolean;
  sourceItemIds: Array<string | number>;
};

const normalizeBool = (val: any, defaultValue = false): boolean => {
  if (val === undefined || val === null) return defaultValue;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val === 1;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    if (['1', 'true', 'yes', 'si', 'sí', 'y'].includes(s)) return true;
    if (['0', 'false', 'no', 'n'].includes(s)) return false;
  }
  return defaultValue;
};

const normalizeStackable = (val: any): boolean => {
  if (val === undefined || val === null) return true; // default permisivo para ofertas antiguas sin campo
  if (val === true) return true;
  if (val === false) return false;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    if (['1', 'true', 'yes', 'si', 'sí', 'stackable'].includes(s)) return true;
    if (['0', 'false', 'no'].includes(s)) return false;
  }
  if (typeof val === 'number') return val === 1;
  return true;
};

const getPercent = (discountConfig: any): number | undefined => {
  if (discountConfig?.type === 'percentage' && discountConfig?.value !== undefined) return Number(discountConfig.value);
  if (discountConfig?.percent !== undefined) return Number(discountConfig.percent);
  if (discountConfig?.value !== undefined && discountConfig?.type === 'percentage') return Number(discountConfig.value);
  return undefined as unknown as number;
};

const getFixed = (discountConfig: any): number | undefined => {
  if (discountConfig?.type === 'fixed' && discountConfig?.value !== undefined) return Number(discountConfig.value);
  if (discountConfig?.amount !== undefined) return Number(discountConfig.amount);
  return undefined as unknown as number;
};

const parseTiers = (discountConfig: any): DiscountTier[] => {
  const tiersRaw = discountConfig?.tiers;
  if (!Array.isArray(tiersRaw)) return [];
  const mapped = tiersRaw
    .map((t: any) => ({
      from: t?.from !== undefined && t?.from !== null ? Number(t.from) : undefined,
      to: t?.to !== undefined && t?.to !== null ? Number(t.to) : undefined,
      percent: t?.percent !== undefined ? Number(t.percent) : undefined,
      amount: t?.amount !== undefined ? Number(t.amount) : undefined,
    }))
    .filter((t: DiscountTier) => t.percent !== undefined || t.amount !== undefined);

  return mapped.sort((a: DiscountTier, b: DiscountTier) => (a.from ?? 0) - (b.from ?? 0));
};

const pickTierForQty = (tiers: DiscountTier[], qty: number): DiscountTier | undefined => {
  const q = Number(qty) || 0;
  for (const tier of tiers) {
    const fromOk = tier.from === undefined || q >= tier.from;
    const toOk = tier.to === undefined || q <= tier.to;
    if (fromOk && toOk) return tier;
  }
  return undefined;
};

/**
 * Obtiene todas las ofertas aplicables a un pedido
 */
export function getApplicableOffers(
  order: Order,
  cliente: Cliente | null,
  productos: Product[],
  allOffers: OfferDef[]
): ApplicableOffer[] {
  if (!cliente || !order.items || order.items.length === 0) {
    return [];
  }
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0); // comparar solo por fecha, sin desfases de huso horario
  const applicableOffers: ApplicableOffer[] = [];

  console.log('🔍 Analizando ofertas para:', {
    cliente: cliente.codigoCliente,
    empresa: order.codigoEmpresa,
    items: order.items.length,
    totalOfertas: allOffers.length,
  });

  for (const offer of allOffers) {
    const reasons: string[] = [];

    // Normalizar payload cuando la API incrusta detalles en `raw.ofertaDetalle` (string JSON)
    let normalizedOffer: any = offer;
    try {
      const raw = (offer as any).raw;
      if (raw && raw.ofertaDetalle) {
        const det = typeof raw.ofertaDetalle === 'string' ? JSON.parse(raw.ofertaDetalle) : raw.ofertaDetalle;
        normalizedOffer = {
          ...offer,
          dates: det.dates || offer.dates,
          scope: det.scope || offer.scope || {},
          products: det.products || offer.products || det.codigosProducto || [],
          discount: det.discount || offer.discount || det.discountConfig || offer.discount,
          codigosLinea: det.codigosLinea || det.lineas || (offer as any).codigosLinea || (offer as any).lineas || [],
          subfamilias: det.subfamilias || offer.subfamilias || [],
          familias: det.familias || offer.familias || [],
          proveedores: det.proveedores || offer.proveedores || [],
          stackableWithSameProduct: normalizeStackable(det.stackableWithSameProduct ?? offer.stackableWithSameProduct),
        };
        console.debug('[offers-engine] normalized offer from raw.ofertaDetalle', { id: offer.id || offer.serverId, normalizedOffer });
      }
    } catch (e) {
      console.debug('[offers-engine] failed to parse raw.ofertaDetalle for offer', offer.id || offer.serverId, e);
    }

    const offerToUse = {
      ...(normalizedOffer as OfferDef),
      stackableWithSameProduct: normalizeStackable((normalizedOffer as any).stackableWithSameProduct),
    } as OfferDef;

    // Visible logging per-offer to diagnose matching
    console.log('[offers-engine] checking offer', { id: offerToUse.id || offerToUse.serverId, status: offerToUse.status, codigoEmpresa: offerToUse.codigoEmpresa });
    console.log('[offers-engine] offer scope/products:', { scope: offerToUse.scope, products: offerToUse.products, codigosLinea: (offerToUse as any).codigosLinea });
    const statusNormalized = (offerToUse.status || '').toString().trim().toLowerCase();
    const inactiveStatuses = ['inactive', 'inactiva', 'draft', 'borrador', 'cerrada', 'cerrado', 'vencida', 'expired'];
    if (statusNormalized && inactiveStatuses.includes(statusNormalized)) {
      reasons.push(`status:${offerToUse.status}`);
      console.log(`[offers-engine] skipping ${offerToUse.id} - ${reasons.join(',')}`);
      continue;
    }
    // Normalizar y comparar fechas robustamente (soportar dd/mm/yyyy y yyyy-mm-dd)
    const parseDate = (s: string | undefined) => {
      if (!s) return null;
      const trimmed = s.trim();
      // yyyy-mm-dd → fecha local (evita adelantar un día por UTC)
      const ymd = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (ymd) {
        const y = Number(ymd[1]);
        const mo = Number(ymd[2]) - 1;
        const d = Number(ymd[3]);
        return new Date(y, mo, d);
      }
      // dd/mm/yyyy
      const dmy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (dmy) {
        const d = Number(dmy[1]);
        const mo = Number(dmy[2]) - 1;
        const y = Number(dmy[3]);
        return new Date(y, mo, d);
      }
      // fallback ISO con hora
      const iso = new Date(trimmed);
      if (!isNaN(iso.getTime())) return iso;
      return null;
    };

    const vf = parseDate(offerToUse.dates?.validFrom);
    const vt = parseDate(offerToUse.dates?.validTo);
    let dateOk = true;
    if (vf && todayDate < vf) {
      reasons.push(`date-before-start:${vf?.toISOString()}`);
      dateOk = false;
    }
    if (vt && todayDate > vt) {
      reasons.push(`date-after-end:${vt?.toISOString()}`);
      dateOk = false;
    }
    const empresaMatch = !offerToUse.codigoEmpresa || !order.codigoEmpresa
      ? true
      : String(offerToUse.codigoEmpresa).trim().toLowerCase() === String(order.codigoEmpresa).trim().toLowerCase();
    if (!empresaMatch) {
      reasons.push(`empresa:${offerToUse.codigoEmpresa}`);
    }
    const clientMatch = validateClientRestrictions(offerToUse, cliente);
    if (!clientMatch) {
      reasons.push('client-scope-mismatch');
    }
    if (reasons.length > 0) {
      console.log(`[offers-engine] skipping ${offerToUse.id} - ${reasons.join(',')}`, { offer: offerToUse, cliente, order });
      continue;
    }

    const applicableItems = findApplicableItems(offerToUse, order.items, productos);
    if (applicableItems.length === 0) {
      console.log(`[offers-engine] skipping ${offerToUse.id} - no matching items`, { offer: offerToUse, orderItems: order.items, productos });
      continue;
    }

    if (offerToUse.type === 'discount') {
      const potentialDiscount = calculateDiscount(offerToUse, applicableItems);

      if (!potentialDiscount || potentialDiscount <= 0) {
        console.log(`[offers-engine] skipping ${offerToUse.id} - discount=0 (no escala cumple)`, { offer: offerToUse, applicableItems });
        continue;
      }

      console.log(`[offers-engine] applicable ${offerToUse.id} -> discount:${potentialDiscount}`, { offer: offerToUse, applicableItems });
      applicableOffers.push({
        offer: offerToUse,
        applicableItems,
        potentialDiscount,
      });
      continue;
    }

    if (offerToUse.type === 'bonus') {
      const { totalBonusQty, applications } = calculateBonus(offerToUse, applicableItems, productos);
      if (!totalBonusQty || totalBonusQty <= 0) {
        console.log(`[offers-engine] skipping ${offerToUse.id} - bonus=0 (no aplica)`, { offer: offerToUse, applicableItems });
        continue;
      }

      console.log(`[offers-engine] applicable ${offerToUse.id} -> bonusQty:${totalBonusQty}`, { offer: offerToUse, applications });
      applicableOffers.push({
        offer: offerToUse,
        applicableItems,
        potentialDiscount: 0,
        potentialBonusQty: totalBonusQty,
        bonusApplications: applications,
      });
      continue;
    }
  }

  return applicableOffers;
}

// Garantiza que ofertas que impactan el mismo producto solo se acumulen si todas son marcadas como stackableWithSameProduct.
function resolveStackingRules(applicableOffers: ApplicableOffer[]): ApplicableOffer[] {
  const byProduct = new Map<string, ApplicableOffer[]>();

  for (const entry of applicableOffers) {
    // agrupamos por producto para detectar cruces
    const productIds = new Set<string>();
    for (const item of entry.applicableItems) {
      const pid = item.productoId ?? item.id ?? item.productoId;
      if (pid !== undefined && pid !== null) {
        productIds.add(String(pid));
      }
    }

    for (const pid of productIds) {
      const list = byProduct.get(pid) ?? [];
      list.push(entry);
      byProduct.set(pid, list);
    }
  }

  const blocked = new Set<ApplicableOffer>();

  for (const [, entries] of byProduct) {
    if (entries.length <= 1) continue;

    const allStackable = entries.every((e) => normalizeStackable(e.offer.stackableWithSameProduct));
    if (allStackable) {
      continue; // todas permiten combinar
    }

    // Si alguna no es stackable, dejamos solo la de mayor descuento potencial para ese grupo
    const winner = entries.reduce((best, current) => {
      return current.potentialDiscount > best.potentialDiscount ? current : best;
    }, entries[0]);

    for (const e of entries) {
      if (e !== winner) {
        blocked.add(e);
      }
    }
  }

  const result = applicableOffers.filter((e) => !blocked.has(e));

  if (blocked.size > 0) {
    console.log('[offers-engine] stackable filter removed offers for conflicts', {
      blocked: Array.from(blocked).map((b) => b.offer.id || b.offer.serverId),
      kept: result.map((r) => r.offer.id || r.offer.serverId),
    });
  }

  return result;
}

function validateClientRestrictions(offer: OfferDef, cliente: Cliente): boolean {
  const scope = offer.scope || {};
  if (!scope || Object.keys(scope).length === 0) return true;

  const normalizeValue = (value: unknown): string | null => {
    if (value === undefined || value === null) return null;
    const raw = String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
    return raw.length ? raw : null;
  };

  const expandVariants = (value: unknown, bucket: Set<string>) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => expandVariants(entry, bucket));
      return;
    }
    const normalized = normalizeValue(value);
    if (!normalized) return;
    bucket.add(normalized);

    const parts = normalized.split(/[\s\-_/|\u2013\u2014]+/).filter(Boolean);
    for (const part of parts) {
      bucket.add(part);
      if (/^\d+$/.test(part)) {
        bucket.add(part.replace(/^0+/, "") || "0");
      }
    }

    if (/^\d+$/.test(normalized)) {
      bucket.add(normalized.replace(/^0+/, "") || "0");
    }
  };

  const matchesAny = (candidates: unknown[] | undefined, rawValues: unknown[], label: string): boolean => {
    if (!candidates || candidates.length === 0) return true;

    const candidateVariants = new Set<string>();
    candidates.forEach((candidate) => expandVariants(candidate, candidateVariants));
    if (candidateVariants.size === 0) return true;

    const valueVariants = new Set<string>();
    rawValues.forEach((value) => expandVariants(value, valueVariants));

    if (valueVariants.size === 0) {
      console.debug('[offers-engine] client scope missing data for', label, { candidates, rawValues });
      return false;
    }

    for (const variant of valueVariants) {
      if (candidateVariants.has(variant)) return true;
    }

    console.debug('[offers-engine] client scope mismatch on', label, {
      candidates,
      rawValues,
      normalizedCandidates: Array.from(candidateVariants),
      normalizedValues: Array.from(valueVariants),
    });
    return false;
  };

  const clientCodes = [
    cliente.codigoCliente,
    (cliente as any).codigo,
    (cliente as any).idt,
  ];
  if (!matchesAny(scope.codigosCliente, clientCodes, 'codigosCliente')) return false;

  const clientChannels = [
    (cliente as any).canalVenta,
    (cliente as any).canal,
    (cliente as any).codigoCanal,
    (cliente as any).canalCodigo,
  ];
  if (!matchesAny(scope.canales, clientChannels, 'canales')) return false;

  const clientSubChannels = [
    (cliente as any).subCanalVenta,
    (cliente as any).subCanal,
    (cliente as any).codigoSubCanal,
  ];
  if (!matchesAny(scope.subCanales, clientSubChannels, 'subCanales')) return false;

  return true;
}

function findApplicableItems(
  offer: OfferDef,
  orderItems: OrderItem[],
  productos: Product[]
): OrderItem[] {
  const applicable: OrderItem[] = [];

  const findProductWithReason = (pid: string) => {
    let reason = "";
    const producto = productos.find((p) => {
      if (!pid) return false;
      if (String(p.codigoProducto ?? "") === pid) {
        reason = "codigoProducto";
        return true;
      }
      if (String(p.idt ?? "") === pid) {
        reason = "idt";
        return true;
      }
      if (String((p as any).codigo_upc ?? "") === pid) {
        reason = "codigo_upc";
        return true;
      }
      if (String((p as any).codigoFiltroVenta ?? "") === pid) {
        reason = "codigoFiltroVenta";
        return true;
      }
      if ((p.codigoProducto || "").includes(pid)) {
        reason = "codigoProducto-contains";
        return true;
      }
      if ((p.descripcion || "").toLowerCase().includes(pid.toLowerCase())) {
        reason = "descripcion-contains";
        return true;
      }
      return false;
    });
    return { producto, reason };
  };

  for (const item of orderItems) {
    const pid = String(item.productoId ?? '');
    const { producto, reason } = findProductWithReason(pid);

    if (!producto) {
      console.debug(`[offers-engine] no product match for item.productoId=${pid}`, { item });
      continue;
    }

    const matchesScope = productMatchesOffer(offer, producto);
    console.debug("[offers-engine] item match check", {
      offer: offer.id || offer.serverId,
      pid,
      matchBy: reason,
      producto: {
        codigoProducto: producto.codigoProducto,
        proveedor: (producto as any).codigoProveedor,
        familia: (producto as any).codigoFamilia || (producto as any).familia,
        subfamilia: (producto as any).codigoSubfamilia || (producto as any).subfamilia,
        linea: (producto as any).codigoLinea || (producto as any).codigoFiltroVenta || (producto as any).lineaVenta,
      },
      matchesScope,
    });

    if (matchesScope) {
      applicable.push(item);
    }
  }

  return applicable;
}

function productMatchesOffer(offer: OfferDef, producto: Product): boolean {
  const scope = offer.scope || {};

  // Fallback: if no scope/products present, try to parse raw.ofertaDetalle to enrich matching keys
  try {
    if ((!offer.products || offer.products.length === 0) && (!scope || Object.keys(scope).length === 0)) {
      const raw = (offer as any).raw;
      if (raw && raw.ofertaDetalle) {
        const det = typeof raw.ofertaDetalle === 'string' ? JSON.parse(raw.ofertaDetalle) : raw.ofertaDetalle;
        if (det) {
          (offer as any).products = det.products || det.codigosProducto || offer.products || [];
          (offer as any).scope = det.scope || scope || {};
          (offer as any).codigosLinea = det.codigosLinea || det.lineas || (offer as any).codigosLinea || [];
          Object.assign(scope as any, det.scope || {});
        }
      }
    }
  } catch (e) {
    // ignore parse errors
  }

  // Build sets of allowed identifiers coming from offer (either top-level or scope)
  const allowedProducts = new Set<string>((offer.products || []).map(String));
  for (const v of (scope.codigosProducto || [])) allowedProducts.add(String(v));

  const allowedProveedores = new Set<string>((offer.proveedores || []).map(String));
  for (const v of (scope.codigosProveedor || [])) allowedProveedores.add(String(v));

  const allowedFamilias = new Set<string>((offer.familias || []).map(String));
  for (const v of (scope.codigosFamilia || [])) allowedFamilias.add(String(v));

  // Treat 'subfamilias' and 'lineas' as equivalent (some backends use different names)
  const allowedSubfamilias = new Set<string>((offer.subfamilias || []).map(String));
  for (const v of (scope.codigosSubfamilia || [])) allowedSubfamilias.add(String(v));

  const allowedLineas = new Set<string>(((offer as any).codigosLinea || []).map(String));
  for (const v of (scope.codigosLinea || [])) allowedLineas.add(String(v));

  // Merge both ways so either field in the offer matches either product property
  for (const v of Array.from(allowedSubfamilias)) allowedLineas.add(String(v));
  for (const v of Array.from(allowedLineas)) allowedSubfamilias.add(String(v));

  const hasAnyConstraint =
    allowedProducts.size > 0 ||
    allowedProveedores.size > 0 ||
    allowedFamilias.size > 0 ||
    allowedSubfamilias.size > 0 ||
    allowedLineas.size > 0;

  // Producto identifiers
  const prodCodigo = String(producto.codigoProducto ?? "");
  const prodProveedor = String((producto as any).codigoProveedor ?? "");
  const prodFamilia = String((producto as any).codigoFamilia ?? (producto as any).familia ?? "");
  const prodSubfamilia = String((producto as any).codigoSubfamilia ?? (producto as any).subfamilia ?? "");
  const prodLinea = String((producto as any).codigoLinea ?? (producto as any).codigoFiltroVenta ?? (producto as any).lineaVenta ?? "");

  // If the offer has no constraints, it applies to all products
  if (!hasAnyConstraint) return true;

  // Check product code
  if (prodCodigo && allowedProducts.size > 0 && allowedProducts.has(prodCodigo)) return true;

  // Check proveedor
  if (prodProveedor && allowedProveedores.size > 0 && allowedProveedores.has(prodProveedor)) return true;

  // Check familia/subfamilia
  if (prodFamilia && allowedFamilias.size > 0 && allowedFamilias.has(prodFamilia)) return true;
  if (prodSubfamilia && (allowedSubfamilias.size > 0 || allowedLineas.size > 0) && (allowedSubfamilias.has(prodSubfamilia) || allowedLineas.has(prodSubfamilia))) return true;

  // Check linea
  if (prodLinea && (allowedLineas.size > 0 || allowedSubfamilias.size > 0)) {
    if (allowedLineas.has(prodLinea) || allowedSubfamilias.has(prodLinea)) return true;
  }

  return false;
}

function calculateDiscount(offer: OfferDef, applicableItems: OrderItem[]): number {
  if (offer.type !== 'discount') return 0;

  const discountConfig = offer.discount || (offer as any).discountConfig;
  if (!discountConfig) return 0;

  const applyPerLineConfig = normalizeBool((discountConfig as any).perLine ?? (discountConfig as any).byLine ?? (discountConfig as any).applyPerLine ?? (discountConfig as any).aplicarPorLinea ?? (discountConfig as any).porLinea, false);

  const pctBase = getPercent(discountConfig);
  const fixedBase = getFixed(discountConfig);
  const tiers = parseTiers(discountConfig);
  const applyPerLine = tiers.length > 0 ? true : applyPerLineConfig;

  // Evaluar por línea
  if (applyPerLine) {
    let totalDiscount = 0;
    for (const item of applicableItems) {
      const qty = Number(item.cantidad || 0);
      const lineAmount = qty * item.precioUnitario;
      const tier = pickTierForQty(tiers, qty);
      if (tiers.length > 0 && !tier) continue; // no escala alcanzada
      const pct = tier?.percent ?? pctBase;
      const fixed = tier?.amount ?? fixedBase;
      if (pct === undefined && fixed === undefined) continue;

      const lineDisc = (pct !== undefined && !isNaN(pct) ? (lineAmount * pct) / 100 : 0) + (fixed !== undefined && !isNaN(fixed) ? fixed * qty : 0);
      totalDiscount += lineDisc;

      console.debug('[offers-engine] discount calc per-line', {
        offer: offer.id || offer.serverId,
        itemId: item.id,
        productoId: item.productoId,
        qty,
        fixed,
        lineDisc,
        runningDiscount: totalDiscount,
      });
    }
    return totalDiscount;
  }

  // Evaluar por mezcla (sumar cantidades)
  const totalQty = applicableItems.reduce((acc, it) => acc + Number(it.cantidad || 0), 0);
  const tier = pickTierForQty(tiers, totalQty);
  if (tiers.length > 0 && !tier) return 0; // no escala alcanzada
  const pct = tier?.percent ?? pctBase;
  const fixed = tier?.amount ?? fixedBase;
  if (pct === undefined && fixed === undefined) return 0;

  let totalDiscount = 0;
  for (const item of applicableItems) {
    const subtotal = item.cantidad * item.precioUnitario;
    const lineDisc = (pct !== undefined && !isNaN(pct) ? (subtotal * pct) / 100 : 0) + (fixed !== undefined && !isNaN(fixed) ? fixed * item.cantidad : 0);
    totalDiscount += lineDisc;

    console.debug('[offers-engine] discount calc mix', {
      offer: offer.id || offer.serverId,
      subtotal,
      totalQty,
      pct,
      fixed,
      lineDisc,
      runningDiscount: totalDiscount,
    });
  }

  return totalDiscount;
}

export function applyOfferToOrder(
  order: Order,
  applicableOffer: ApplicableOffer
): Order {
  const { offer } = applicableOffer;
  const { items: itemsConDescuento, totalDiscount, bruto } = applyOfferToItems(order.items, applicableOffer);
  const neto = Math.max(0, bruto - totalDiscount);

  return {
    ...order,
    items: itemsConDescuento,
    ofertaAplicada: {
      uuidOferta: offer.serverId || offer.id,
      nombreOferta: offer.name,
      tipoOferta: offer.type,
      descuentoPorcentaje: offer.discount?.type === 'percentage' ? offer.discount.value : undefined,
      descuentoMonto: totalDiscount,
    },
    descuentoTotal: totalDiscount,
    subtotalSinDescuento: bruto,
    subtotal: neto,
    total: neto + (order.impuestos || 0),
  };
}

export function removeOfferFromOrder(order: Order): Order {
  const cleanItems = (order.items || []).map((it) => {
    const bruto = it.subtotalSinDescuento ?? (it.cantidad * it.precioUnitario);
    return {
      ...it,
      subtotal: bruto,
      total: bruto,
      subtotalSinDescuento: undefined,
      descuentoLinea: undefined,
    };
  });

  const subtotalOriginal = cleanItems.reduce((acc, it) => acc + (it.subtotal ?? 0), 0);

  return {
    ...order,
    items: cleanItems,
    ofertaAplicada: undefined,
    descuentoTotal: 0,
    subtotalSinDescuento: undefined,
    subtotal: subtotalOriginal,
    total: subtotalOriginal + (order.impuestos || 0),
  };
}

// Aplica la oferta a los ítems devolviendo montos por línea y total de descuento
export function applyOfferToItems(
  orderItems: OrderItem[],
  applicableOffer: ApplicableOffer
): { items: OrderItem[]; totalDiscount: number; bruto: number } {
  const { offer, applicableItems } = applicableOffer;

  const discountConfig = offer.discount || (offer as any).discountConfig;
  const applyPerLineConfig = normalizeBool((discountConfig as any)?.perLine ?? (discountConfig as any)?.byLine ?? (discountConfig as any)?.applyPerLine ?? (discountConfig as any)?.aplicarPorLinea ?? (discountConfig as any)?.porLinea, false);
  const pctBase = getPercent(discountConfig);
  const fixedBase = getFixed(discountConfig);
  const tiers = parseTiers(discountConfig);
  const applyPerLine = tiers.length > 0 ? true : applyPerLineConfig;
  const applicableSet = new Set((applicableItems || []).map((ai) => ai.id ?? ai.productoId));
  const hasExplicitApplicables = (applicableItems || []).length > 0;

  let totalDiscount = 0;
  const updated = orderItems.map((item) => {
    const bruto = item.subtotalSinDescuento ?? item.subtotal ?? (item.cantidad * item.precioUnitario);
    const isApplicable = !hasExplicitApplicables || applicableSet.has(item.id) || applicableSet.has(item.productoId);
    if (!isApplicable) {
      return {
        ...item,
        subtotalSinDescuento: bruto,
        subtotal: bruto,
        total: bruto,
      };
    }

    const qty = Number(item.cantidad || 0);
    const lineAmount = qty * item.precioUnitario;

    if (applyPerLine) {
      const tier = pickTierForQty(tiers, qty);
      if (tiers.length > 0 && !tier) {
        return { ...item, subtotalSinDescuento: bruto, subtotal: bruto, total: bruto };
      }
      const pct = tier?.percent ?? pctBase;
      const fixed = tier?.amount ?? fixedBase;
      if (pct === undefined && fixed === undefined) {
        return { ...item, subtotalSinDescuento: bruto, subtotal: bruto, total: bruto };
      }

      const lineDisc = (pct !== undefined && !isNaN(pct) ? (bruto * pct) / 100 : 0) + (fixed !== undefined && !isNaN(fixed) ? fixed * qty : 0);
      totalDiscount += lineDisc;
      const neto = Math.max(0, bruto - lineDisc);
      return {
        ...item,
        subtotalSinDescuento: bruto,
        descuentoLinea: lineDisc,
        subtotal: neto,
        total: neto,
      };
    }

    // Evaluación por mezcla: aplicamos un único tier a todos los ítems aplicables
    return item; // placeholder, replaced below
  });

  // Mezcla: necesitamos aplicar después de conocer el tier global
  if (!applyPerLine) {
    const applicableOrderItems = hasExplicitApplicables ? orderItems.filter((item) => applicableSet.has(item.id) || applicableSet.has(item.productoId)) : orderItems;
    const totalQty = applicableOrderItems.reduce((acc, it) => acc + Number(it.cantidad || 0), 0);

    const tier = pickTierForQty(tiers, totalQty);
    if (tiers.length > 0 && !tier) {
      const untouched = orderItems.map((item) => {
        const bruto = item.subtotalSinDescuento ?? item.subtotal ?? (item.cantidad * item.precioUnitario);
        return { ...item, subtotalSinDescuento: bruto, subtotal: bruto, total: bruto };
      });
      const brutoTotal = untouched.reduce((acc, it) => acc + (it.subtotalSinDescuento ?? it.subtotal ?? 0), 0);
      return { items: untouched, totalDiscount: 0, bruto: brutoTotal };
    }
    const pct = tier?.percent ?? pctBase;
    const fixed = tier?.amount ?? fixedBase;
    if (pct === undefined && fixed === undefined) {
      const untouched = orderItems.map((item) => {
        const bruto = item.subtotalSinDescuento ?? item.subtotal ?? (item.cantidad * item.precioUnitario);
        return { ...item, subtotalSinDescuento: bruto, subtotal: bruto, total: bruto };
      });
      const brutoTotal = untouched.reduce((acc, it) => acc + (it.subtotalSinDescuento ?? it.subtotal ?? 0), 0);
      return { items: untouched, totalDiscount: 0, bruto: brutoTotal };
    }

    totalDiscount = 0;
    const updatedMix = orderItems.map((item) => {
      const bruto = item.subtotalSinDescuento ?? item.subtotal ?? (item.cantidad * item.precioUnitario);
      const isApplicable = applicableSet.has(item.id) || applicableSet.has(item.productoId);
      if (!isApplicable) {
        return { ...item, subtotalSinDescuento: bruto, subtotal: bruto, total: bruto };
      }

      const lineDisc = (pct !== undefined && !isNaN(pct) ? (bruto * pct) / 100 : 0) + (fixed !== undefined && !isNaN(fixed) ? fixed * item.cantidad : 0);
      totalDiscount += lineDisc;
      const neto = Math.max(0, bruto - lineDisc);
      return {
        ...item,
        subtotalSinDescuento: bruto,
        descuentoLinea: lineDisc,
        subtotal: neto,
        total: neto,
      };
    });

    const brutoMix = updatedMix.reduce((acc, it) => acc + (it.subtotalSinDescuento ?? it.subtotal ?? 0), 0);
    return { items: updatedMix, totalDiscount, bruto: brutoMix };
  }

  const bruto = updated.reduce((acc, it) => acc + (it.subtotalSinDescuento ?? it.subtotal ?? 0), 0);

  return { items: updated, totalDiscount, bruto };
}

// DEV helpers: exponer funciones útiles para depuración en la consola
try {
  if (typeof window !== "undefined") {
    (window as any).getApplicableOffers = getApplicableOffers;
    (window as any).applyOfferToOrder = applyOfferToOrder;
    (window as any).removeOfferFromOrder = removeOfferFromOrder;
  }
} catch (e) {
  // noop
}

// DEV helper: normalize a single offer (parse raw.ofertaDetalle when present)
export function normalizeOffer(offer: OfferDef): any {
  try {
    const raw = (offer as any).raw;
    if (raw && raw.ofertaDetalle) {
      const det = typeof raw.ofertaDetalle === 'string' ? JSON.parse(raw.ofertaDetalle) : raw.ofertaDetalle;
      return {
        id: offer.id || offer.serverId,
        name: offer.name,
        status: offer.status,
        codigoEmpresa: offer.codigoEmpresa,
        dates: det.dates || offer.dates,
        scope: det.scope || offer.scope,
        products: det.products || offer.products || det.codigosProducto || [],
        discount: det.discount || offer.discount || det.discountConfig || null,
        raw: raw,
      };
    }
  } catch (e) {
    // fallthrough
  }
  return {
    id: offer.id || offer.serverId,
    name: offer.name,
    status: offer.status,
    codigoEmpresa: offer.codigoEmpresa,
    dates: offer.dates,
    scope: offer.scope,
    products: offer.products || [],
    discount: offer.discount || null,
    raw: (offer as any).raw,
  };
}

export function listNormalizedOffers(allOffers: OfferDef[]) {
  return (allOffers || []).map(normalizeOffer);
}

try {
  if (typeof window !== 'undefined') {
    (window as any).normalizeOffer = normalizeOffer;
    (window as any).listNormalizedOffers = listNormalizedOffers;
  }
} catch (e) {
  // noop
}

function calculateBonus(offer: OfferDef, applicableItems: OrderItem[], productos: Product[]): { totalBonusQty: number; applications: BonusApplication[] } {
  if (offer.type !== 'bonus') return { totalBonusQty: 0, applications: [] };

  const bonusConfig: BonusConfig | undefined = (offer as any).bonus || (offer as any).bonusConfig || offer.bonus;
  if (!bonusConfig) return { totalBonusQty: 0, applications: [] };

  const everyN = Number(bonusConfig.everyN ?? bonusConfig.buyQty ?? 0);
  const givesM = Number(bonusConfig.givesM ?? bonusConfig.bonusQty ?? 0);
  if (!everyN || everyN <= 0 || !givesM || givesM <= 0) return { totalBonusQty: 0, applications: [] };

  const mode: "acumulado" | "por_linea" = bonusConfig.mode === 'por_linea' ? 'por_linea' : 'acumulado';
  const maxApps = bonusConfig.maxApplications ?? undefined;

  const targetType: BonusTargetType = bonusConfig.target?.type
    ?? (bonusConfig.sameAsQualifier ? 'same' : bonusConfig.target?.productId ? 'sku' : 'same');

  const resolveProduct = (sourceItem?: OrderItem): { productId?: string; requiresSelection?: boolean } => {
    if (targetType === 'same') {
      return { productId: sourceItem?.productoId, requiresSelection: false };
    }
    if (targetType === 'sku') {
      return { productId: bonusConfig.target?.productId, requiresSelection: !bonusConfig.target?.productId };
    }

    const requiresSelection = !!bonusConfig.target?.requiereSeleccionUsuario;
    const lineaIds = (bonusConfig.target as any)?.lineaIds as string[] | undefined;
    const familiaIds = (bonusConfig.target as any)?.familiaIds as string[] | undefined;
    const lineaId = bonusConfig.target?.lineaId;
    const familiaId = bonusConfig.target?.familiaId;

    // Si se exige selección de usuario en línea/familia, no resolvemos automáticamente
    if (requiresSelection) {
      return { productId: undefined, requiresSelection: true };
    }

    const lineasSet = new Set<string>();
    (lineaIds || []).forEach((v) => lineasSet.add(String(v)));
    if (lineaId) lineasSet.add(String(lineaId));

    const familiasSet = new Set<string>();
    (familiaIds || []).forEach((v) => familiasSet.add(String(v)));
    if (familiaId) familiasSet.add(String(familiaId));

    const candidate = productos.find((p) => {
      const lineaVal = String(p.codigoLinea ?? p.codigoFiltroVenta ?? p.lineaVenta ?? '');
      const famVal = String(p.codigoFamilia ?? p.familia ?? '');
      const lineaMatch = lineasSet.size ? Array.from(lineasSet).some((id) => lineaVal === id || lineaVal.includes(id)) : false;
      const famMatch = familiasSet.size ? Array.from(familiasSet).some((id) => famVal === id || famVal.includes(id)) : false;
      return lineaMatch || famMatch;
    });
    if (candidate) {
      return { productId: candidate.codigoProducto, requiresSelection: false };
    }
    // Fallback: usa el mismo producto que calificó si no hay candidato y no se exige selección manual
    if (sourceItem && !requiresSelection) {
      return { productId: sourceItem.productoId, requiresSelection: false };
    }
    return { productId: undefined, requiresSelection: true };
  };

  const applications: BonusApplication[] = [];

  if (mode === 'por_linea') {
    let remainingApps = maxApps ?? Number.POSITIVE_INFINITY;
    for (const item of applicableItems) {
      if (remainingApps <= 0) break;
      const qty = Number(item.cantidad || 0);
      const appsForLine = Math.floor(qty / everyN);
      if (appsForLine <= 0) continue;
      const cappedApps = Math.min(appsForLine, remainingApps);
      const bonusQty = cappedApps * givesM;
      const { productId, requiresSelection } = resolveProduct(item);
      applications.push({
        mode,
        bonusQty,
        targetType,
        resolvedProductId: productId,
        requiresSelection,
        sourceItemIds: [item.id ?? item.productoId],
      });
      if (maxApps !== undefined) {
        remainingApps -= cappedApps;
      }
    }
  } else {
    const totalQty = applicableItems.reduce((acc, it) => acc + Number(it.cantidad || 0), 0);
    const totalApps = Math.floor(totalQty / everyN);
    const cappedApps = maxApps !== undefined ? Math.min(totalApps, maxApps) : totalApps;
    const bonusQty = cappedApps * givesM;
    if (bonusQty > 0) {
      const { productId, requiresSelection } = resolveProduct(applicableItems[0]);
      applications.push({
        mode,
        bonusQty,
        targetType,
        resolvedProductId: productId,
        requiresSelection,
        sourceItemIds: applicableItems.map((it) => it.id ?? it.productoId),
      });
    }
  }

  const totalBonusQty = applications.reduce((acc, a) => acc + a.bonusQty, 0);
  return { totalBonusQty, applications };
}