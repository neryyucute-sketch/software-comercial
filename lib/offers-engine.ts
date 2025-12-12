import type { OfferDef } from "./types.offers";
import type { Order, OrderItem, Cliente, Product } from "./types";

/**
 * 🎯 Motor de validación de ofertas
 * Determina qué ofertas aplican a un pedido según productos y cliente
 */

export interface ApplicableOffer {
  offer: OfferDef;
  applicableItems: OrderItem[];
  potentialDiscount: number;
}

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
      // yyyy-mm-dd or ISO
      const iso = new Date(s);
      if (!isNaN(iso.getTime())) return iso;
      // try dd/mm/yyyy
      const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m) {
        const d = Number(m[1]);
        const mo = Number(m[2]) - 1;
        const y = Number(m[3]);
        return new Date(y, mo, d);
      }
      return null;
    };

    const vf = parseDate(offerToUse.dates?.validFrom);
    const vt = parseDate(offerToUse.dates?.validTo);
    let dateOk = true;
    if (vf && vt) {
      if (todayDate < vf || todayDate > vt) {
        reasons.push(`date-out:${vf?.toISOString()}->${vt?.toISOString()}`);
        dateOk = false;
      }
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

    const potentialDiscount = calculateDiscount(offerToUse, applicableItems);

    console.log(`[offers-engine] applicable ${offerToUse.id} -> discount:${potentialDiscount}`, { offer: offerToUse, applicableItems });
    applicableOffers.push({
      offer: offerToUse,
      applicableItems,
      potentialDiscount,
    });
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

  // Helper: compare tolerantemente (codigo o descripcion), case-insensitive
  const matchesAny = (candidates: any[] | undefined, valueCandidates: any[], label: string) => {
    if (!candidates || candidates.length === 0) return true;
    const lowCandidates = candidates.map((x: any) => String(x).trim().toLowerCase());
    const hasAnyValue = valueCandidates.some((v) => v !== undefined && v !== null && String(v).trim() !== "");
    // Si no tenemos datos del cliente para ese campo, no descartamos la oferta (evitamos falsos negativos)
    if (!hasAnyValue) {
      console.debug('[offers-engine] client scope no data for', label, { candidates, valueCandidates });
      return true;
    }
    for (const v of valueCandidates) {
      if (v === undefined || v === null) continue;
      const s = String(v).trim().toLowerCase();
      if (lowCandidates.includes(s)) return true;
      // sometimes candidates contain numeric codes while value is text with code+desc ("1 — MAYOREO")
      for (const c of lowCandidates) {
        if (c.includes(s) || s.includes(c)) return true;
      }
    }
    console.debug('[offers-engine] client scope mismatch on', label, { candidates, valueCandidates });
    return false;
  };

  if (scope.codigosCliente && scope.codigosCliente.length > 0) {
    const matches = scope.codigosCliente.map(String).some((c) => String(c).trim() === String(cliente.codigoCliente).trim());
    if (!matches) {
      console.debug('[offers-engine] client scope mismatch on codigosCliente', { expected: scope.codigosCliente, got: cliente.codigoCliente });
      return false;
    }
  }

  if (scope.canales && scope.canales.length > 0) {
    const clienteCanalCandidates = [
      (cliente as any).canalVenta,
      (cliente as any).canal,
      (cliente as any).tipoCliente,
      (cliente as any).codigoCanal,
      (cliente as any).canalCodigo,
    ];
    if (!matchesAny(scope.canales, clienteCanalCandidates, 'canales')) return false;
  }

  if (scope.subCanales && scope.subCanales.length > 0) {
    const clienteSubCandidates = [
      (cliente as any).subCanalVenta,
      (cliente as any).subCanal,
      (cliente as any).codigoSubCanal,
    ];
    if (!matchesAny(scope.subCanales, clienteSubCandidates, 'subCanales')) return false;
  }

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

  // soportar varias formas: { type:'percentage', value:10 } o { percent:10 } o { amount:5 }
  const getPercent = () => {
    if ((discountConfig as any).type === 'percentage' && (discountConfig as any).value !== undefined) return Number((discountConfig as any).value);
    if ((discountConfig as any).percent !== undefined) return Number((discountConfig as any).percent);
    if ((discountConfig as any).value !== undefined && (discountConfig as any).type === 'percentage') return Number((discountConfig as any).value);
    return undefined as unknown as number;
  };

  const getFixed = () => {
    if ((discountConfig as any).type === 'fixed' && (discountConfig as any).value !== undefined) return Number((discountConfig as any).value);
    if ((discountConfig as any).amount !== undefined) return Number((discountConfig as any).amount);
    return undefined as unknown as number;
  };

  const pct = getPercent();
  const fixed = getFixed();

  let totalDiscount = 0;
  for (const item of applicableItems) {
    const subtotal = item.cantidad * item.precioUnitario;
    if (pct !== undefined && !isNaN(pct)) {
      totalDiscount += (subtotal * pct) / 100;
    } else if (fixed !== undefined && !isNaN(fixed)) {
      totalDiscount += fixed * item.cantidad;
    }

    console.debug('[offers-engine] discount calc', {
      offer: offer.id || offer.serverId,
      itemId: item.id,
      productoId: item.productoId,
      subtotal,
      pct,
      fixed,
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
  const pct = (() => {
    if ((discountConfig as any)?.type === 'percentage' && (discountConfig as any).value !== undefined) return Number((discountConfig as any).value);
    if ((discountConfig as any)?.percent !== undefined) return Number((discountConfig as any).percent);
    return undefined as unknown as number;
  })();

  const fixed = (() => {
    if ((discountConfig as any)?.type === 'fixed' && (discountConfig as any).value !== undefined) return Number((discountConfig as any).value);
    if ((discountConfig as any)?.amount !== undefined) return Number((discountConfig as any).amount);
    return undefined as unknown as number;
  })();

  let totalDiscount = 0;
  const updated = orderItems.map((item) => {
    const bruto = item.subtotalSinDescuento ?? item.subtotal ?? (item.cantidad * item.precioUnitario);
    const isApplicable = applicableItems.some((ai) => ai.id === item.id || ai.productoId === item.productoId);
    if (!isApplicable) {
      return {
        ...item,
        subtotal: bruto,
        total: bruto,
      };
    }

    let lineDisc = 0;
    if (pct !== undefined && !isNaN(pct)) {
      lineDisc = (bruto * pct) / 100;
    } else if (fixed !== undefined && !isNaN(fixed)) {
      lineDisc = fixed * item.cantidad;
    }

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