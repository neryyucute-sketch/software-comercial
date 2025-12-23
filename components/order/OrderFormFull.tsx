// components/order/OrderFormFull.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useOrders } from "@/contexts/OrdersContext";
import type { Order, OrderItem } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { usePreventa } from "@/contexts/preventa-context";
import { getApplicableOffers, ApplicableOffer, type BonusApplication } from "@/lib/offers-engine";
import type { OfferDef, DiscountTier } from "@/lib/types.offers";
import type { Product, Cliente } from "@/lib/types";
import { extractCustomerPriceCode } from "@/lib/price-list-utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MapPin, Camera, Gift, Package, User, Search, ChevronUp, ChevronDown } from "lucide-react";
import CustomerSelectionModal from "./modals/CustomerSelectionModal";
import ProductSelectionModal from "./modals/ProductSelectionModal";
import ComboSelectionModal, {
  OfferPackConfigurator,
  type OfferPackRow,
  matchesOfferScope,
  isOfferInDateRange,
  resolvePackType,
  isOfferActive,
} from "./modals/ComboSelectionModal";
import OrderPhotos from "./OrderPhotos";
import { db } from "@/lib/db";
import { useToast } from "@/hooks/use-toast";
import { groupOrderComboItems, resolveComboGroupQuantity, resolveComboGroupUnitPrice, prepareOrderItemsForPersistence, type OrderComboGroup } from "@/lib/order-helpers";
import { pickReferenceCode, formatCurrencyQ } from "@/lib/utils";

function extractDiscountConfig(offer: OfferDef) {
  const discountConfig = offer.discount || (offer as any).discountConfig;
  const getPercent = () => {
    if ((discountConfig as any)?.type === "percentage" && (discountConfig as any).value !== undefined) return Number((discountConfig as any).value);
    if ((discountConfig as any)?.percent !== undefined) return Number((discountConfig as any).percent);
    return undefined as unknown as number;
  };
  const getFixed = () => {
    if ((discountConfig as any)?.type === "fixed" && (discountConfig as any).value !== undefined) return Number((discountConfig as any).value);
    if ((discountConfig as any)?.amount !== undefined) return Number((discountConfig as any).amount);
    return undefined as unknown as number;
  };
  return { pct: getPercent(), fixed: getFixed() };
}

// Aplica todas las ofertas acumulando porcentajes y montos en los ítems que correspondan
function applyOffersSequence(baseItems: OrderItem[], offers: ApplicableOffer[]) {
  const working: OrderItem[] = baseItems.map((it) => {
    if (it.esBonificacion) {
      const baseGross = Math.max(it.subtotalSinDescuento ?? 0, it.subtotal ?? 0, it.cantidad * it.precioUnitario);
      const net = it.subtotal ?? baseGross;
      const discount = it.descuentoLinea ?? Math.max(0, baseGross - net);
      return {
        ...it,
        subtotalSinDescuento: baseGross,
        subtotal: net,
        total: it.total ?? net,
        descuentoLinea: discount,
      } as OrderItem;
    }

    const baseGross = Math.max(it.cantidad * it.precioUnitario, it.subtotalSinDescuento ?? 0, it.subtotal ?? 0);
    return {
      ...it,
      subtotal: baseGross,
      total: baseGross,
      subtotalSinDescuento: baseGross,
      descuentoLinea: undefined,
    } as OrderItem;
  });

  let totalDiscount = 0;

  const perOfferDiscount = new Map<string, number>();

  const resolvePctFixed = (offer: OfferDef, qty: number) => {
    const discountConfig = offer.discount || (offer as any).discountConfig || {};
    const { pct: pctBase, fixed: fixedBase } = extractDiscountConfig(offer);
    const tiers = parseTiers(discountConfig);
    const tier = pickTierForQty(tiers, qty);
    const pct = tier?.percent ?? pctBase;
    const fixed = tier?.amount ?? fixedBase;
    return { pct, fixed };
  };

  for (const offer of offers) {
    const applicableIds = new Set((offer.applicableItems || []).map((it) => String(it.productoId)));

    let offerDisc = 0;

    working.forEach((it) => {
      if (it.esBonificacion) return;
      if (!applicableIds.has(String(it.productoId))) return;
      const { pct, fixed } = resolvePctFixed(offer.offer, Number(it.cantidad || 0));
      const base = Math.max(it.subtotalSinDescuento ?? 0, it.subtotal ?? 0, it.cantidad * it.precioUnitario);
      let lineDisc = 0;
      if (pct !== undefined && !isNaN(pct)) {
        lineDisc += (base * pct) / 100;
      }
      if (fixed !== undefined && !isNaN(fixed)) {
        lineDisc += Math.max(0, fixed) * it.cantidad;
      }
      offerDisc += lineDisc;
    });

    perOfferDiscount.set(offerKey(offer.offer), offerDisc);
    totalDiscount += offerDisc;
  }

  const discounted = working.map((it) => {
    if (it.esBonificacion) {
      return it;
    }

    const base = Math.max(it.subtotalSinDescuento ?? 0, it.subtotal ?? 0, it.cantidad * it.precioUnitario);
    let lineDiscTotal = 0;

    offers.forEach((offer) => {
      const applicableIds = new Set((offer.applicableItems || []).map((ai) => String(ai.productoId)));
      if (!applicableIds.has(String(it.productoId))) return;
      const { pct, fixed } = resolvePctFixed(offer.offer, Number(it.cantidad || 0));
      const pctPart = pct !== undefined && !isNaN(pct) ? (base * pct) / 100 : 0;
      const fixedPart = fixed !== undefined && !isNaN(fixed) ? Math.max(0, fixed) * it.cantidad : 0;
      lineDiscTotal += pctPart + fixedPart;
    });

    const net = Math.max(0, base - lineDiscTotal);
    return {
      ...it,
      subtotalSinDescuento: base,
    descuentoLinea: lineDiscTotal,
      subtotal: net,
      total: net,
    } as OrderItem;
  });

  return { items: discounted, totalDiscount, perOfferDiscount };
}

const offerKey = (offer: OfferDef) => offer.id || offer.serverId || offer.name;

// Elimina descuentos de las líneas para recalcular desde el bruto original
function stripDiscounts(items: OrderItem[]): OrderItem[] {
  return items.map((it) => {
    const baseGross = Math.max(
      it.cantidad * it.precioUnitario,
      it.subtotalSinDescuento ?? 0,
      it.subtotal ?? 0
    );
    return {
      ...it,
      subtotal: baseGross,
      total: baseGross,
      subtotalSinDescuento: baseGross,
      descuentoLinea: undefined,
    } as OrderItem;
  });
}

function toggleOffer(app: ApplicableOffer, current: ApplicableOffer[]) {
  const exists = current.find((o) => (o.offer.id || o.offer.serverId) === (app.offer.id || app.offer.serverId));
  if (exists) {
    return current.filter((o) => (o.offer.id || o.offer.serverId) !== (app.offer.id || app.offer.serverId));
  }
  return [...current, app];
}

function normalizeCode(value: any): string {
  const s = String(value ?? "").trim();
  if (!s) return "";
  // Remover ceros a la izquierda para que "0002" coincida con "2"
  const noLeading = s.replace(/^0+/, "");
  return noLeading.length ? noLeading : "0";
}

function itemMatchesOffer(item: OrderItem, offer: OfferDef, productsAll: Product[]): boolean {
  const producto = productsAll.find((p) => normalizeCode(p.codigoProducto) === normalizeCode(item.productoId));
  const scope = offer.scope || {};

  const pid = normalizeCode(item.productoId);
  const offerProducts = (offer.products || []).map((v) => normalizeCode(v));
  const scopeProducts = (scope.codigosProducto || []).map((v: any) => normalizeCode(v));

  if (offerProducts.length && offerProducts.includes(pid)) return true;
  if (scopeProducts.length && scopeProducts.includes(pid)) return true;

  if (!producto) return false;

  const proveedor = normalizeCode(producto.codigoProveedor);
  const familia = normalizeCode(producto.codigoFamilia ?? producto.familia);
  const subfamilia = normalizeCode(producto.codigoSubfamilia ?? producto.subfamilia);
  const linea = normalizeCode(producto.codigoLinea ?? producto.codigoFiltroVenta ?? (producto as any).lineaVenta ?? producto.linea);

  // Aceptar coincidencias tanto en scope.codigos* como en campos top-level de la oferta
  const scopeProveedores = (scope.codigosProveedor || []).map((v: any) => normalizeCode(v));
  const scopeFamilias = (scope.codigosFamilia || []).map((v: any) => normalizeCode(v));
  const scopeSubfamilias = (scope.codigosSubfamilia || []).map((v: any) => normalizeCode(v));
  const scopeLineas = (scope.codigosLinea || []).map((v: any) => normalizeCode(v));

  const offerProveedores = (offer as any).proveedores ? (offer as any).proveedores.map((v: any) => normalizeCode(v)) : [];
  const offerFamilias = (offer as any).familias ? (offer as any).familias.map((v: any) => normalizeCode(v)) : [];
  const offerSubfamilias = (offer as any).subfamilias ? (offer as any).subfamilias.map((v: any) => normalizeCode(v)) : [];
  const offerLineas = (offer as any).codigosLinea ? (offer as any).codigosLinea.map((v: any) => normalizeCode(v)) : [];

  const lineCodes = [...scopeLineas, ...offerLineas, ...offerSubfamilias];
  if ([...scopeProveedores, ...offerProveedores].includes(proveedor)) return true;
  if ([...scopeFamilias, ...offerFamilias].includes(familia)) return true;
  if ([...scopeSubfamilias, ...offerSubfamilias].includes(subfamilia)) return true;
  if (lineCodes.includes(linea)) return true;

  return false;
}

function isStackableWithSameProduct(offer: OfferDef): boolean {
  const flag = (offer as any).stackableWithSameProduct;
  if (flag === true) return true;
  if (typeof flag === "string") return flag.toLowerCase() === "true" || flag === "1";
  if (typeof flag === "number") return flag === 1;
  return flag === undefined || flag === null;
}

function offersOverlap(a: ApplicableOffer, b: ApplicableOffer): boolean {
  const setA = new Set((a.applicableItems || []).map((it) => it.productoId));
  return (b.applicableItems || []).some((it) => setA.has(it.productoId));
}

function toggleWithStacking(
  target: ApplicableOffer,
  current: ApplicableOffer[],
  cleanItems: OrderItem[],
  productosAll: Product[]
): ApplicableOffer[] {
  const targetId = target.offer.id || target.offer.serverId;

  if (current.some((o) => (o.offer.id || o.offer.serverId) === targetId)) {
    return current.filter((o) => (o.offer.id || o.offer.serverId) !== targetId);
  }

  const rebuiltCurrent = current.map((o) => ({
    ...o,
    applicableItems: cleanItems.filter((it) => itemMatchesOffer(it, o.offer, productosAll)),
  }));

  const targetWithItems = {
    ...target,
    applicableItems: cleanItems.filter((it) => itemMatchesOffer(it, target.offer, productosAll)),
  };

  const filtered = rebuiltCurrent.filter((o) => {
    const overlap = offersOverlap(o, targetWithItems);
    if (!overlap) return true;
    if (isStackableWithSameProduct(o.offer) && isStackableWithSameProduct(targetWithItems.offer)) return true;
    return false;
  });

  return [...filtered, targetWithItems];
}

const normalizeBool = (val: any, defaultValue = false): boolean => {
  if (val === undefined || val === null) return defaultValue;
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val === 1;
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    if (["1", "true", "yes", "si", "sí", "y"].includes(s)) return true;
    if (["0", "false", "no", "n"].includes(s)) return false;
  }
  return defaultValue;
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

const describeTier = (tier?: DiscountTier): string => {
  if (!tier) return "N/A";
  const bounds: string[] = [];
  if (tier.from !== undefined) bounds.push(`desde ${tier.from}`);
  if (tier.to !== undefined) bounds.push(`hasta ${tier.to}`);
  const benefit = tier.percent !== undefined ? `${tier.percent}%` : tier.amount !== undefined ? `Q${tier.amount}` : "";
  const span = bounds.join(" ").trim();
  return `${span ? `${span} → ` : ""}${benefit || "sin beneficio"}`;
};

function offersEqual(a: ApplicableOffer[], b: ApplicableOffer[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const aid = a[i].offer.id || a[i].offer.serverId;
    const bid = b[i].offer.id || b[i].offer.serverId;
    if (aid !== bid) return false;
    const ap = a[i].potentialDiscount ?? 0;
    const bp = b[i].potentialDiscount ?? 0;
    if (ap !== bp) return false;
  }
  return true;
}

function applicableEqual(a: ApplicableOffer[], b: ApplicableOffer[]) {
  if (a.length !== b.length) return false;
  const idsA = a.map((o) => o.offer.id || o.offer.serverId).join('|');
  const idsB = b.map((o) => o.offer.id || o.offer.serverId).join('|');
  return idsA === idsB;
}

function itemsEqual(a: OrderItem[], b: OrderItem[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const p = a[i];
    const n = b[i];
    if (!n || !p) return false;
    if (
      p.productoId !== n.productoId ||
      p.cantidad !== n.cantidad ||
      p.precioUnitario !== n.precioUnitario ||
      p.subtotal !== n.subtotal ||
      p.total !== n.total ||
      (p.subtotalSinDescuento ?? null) !== (n.subtotalSinDescuento ?? null) ||
      (p.descuentoLinea ?? null) !== (n.descuentoLinea ?? null)
    ) {
      return false;
    }
  }
  return true;
}

function uuidSimple(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const round2 = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

function nextTempOrderNumber(vendorCode: string, serie?: string, companyCode?: string) {
  const key = `pedido_seq_${companyCode || 'cmp'}_${vendorCode || 'V'}_${serie || 'def'}`;
  const current = Number(localStorage.getItem(key) || '0');
  const next = current + 1;
  localStorage.setItem(key, String(next));
  const seriePart = serie ? `${serie}-` : '';
  return `temp-${seriePart}${vendorCode || 'V'}-${next}`;
}

function peekTempOrderNumber(vendorCode: string, serie?: string, companyCode?: string) {
  const key = `pedido_seq_${companyCode || 'cmp'}_${vendorCode || 'V'}_${serie || 'def'}`;
  const current = Number(localStorage.getItem(key) || '0');
  const next = current + 1;
  const seriePart = serie ? `${serie}-` : '';
  return `temp-${seriePart}${vendorCode || 'V'}-${next}`;
}

const asId = (v?: string | number | null) => (v ?? '').toString().trim().toLowerCase().replace(/\s+/g, '_');
const normalizeCompanyId = (value?: string | null) => (value ?? 'general').toString().trim().toLowerCase();

type PriceListScopeCategory = "client" | "subcanal" | "canal" | "vendor" | "region" | "general";

type PriceListScopeSummary = {
  category: PriceListScopeCategory;
  rank: number;
};

const parseOfferPriority = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 5;
};

const parseOfferUpdatedAt = (offer: OfferDef): number => {
  const updated = Date.parse(offer.updatedAt ?? "");
  if (!Number.isNaN(updated)) return updated;
  const created = Date.parse((offer as any)?.createdAt ?? "");
  if (!Number.isNaN(created)) return created;
  const validFrom = Date.parse(offer.dates?.validFrom ?? "");
  if (!Number.isNaN(validFrom)) return validFrom;
  return 0;
};

const scopeHasValues = (values?: unknown): boolean => {
  if (Array.isArray(values)) {
    return values.some((value) => {
      if (value === null || value === undefined) return false;
      const normalized = String(value).trim();
      return normalized.length > 0;
    });
  }
  if (typeof values === "string") {
    return values
      .split(",")
      .map((chunk) => chunk.trim())
      .some((chunk) => chunk.length > 0);
  }
  return false;
};

const resolvePriceListScope = (offer: OfferDef): PriceListScopeSummary => {
  const scope = offer.scope ?? {};
  if (scopeHasValues(scope.codigosCliente)) {
    return { category: "client", rank: 1 };
  }
  if (scopeHasValues(scope.subCanales)) {
    return { category: "subcanal", rank: 2 };
  }
  if (scopeHasValues(scope.canales)) {
    return { category: "canal", rank: 3 };
  }
  if (scopeHasValues(scope.vendedores) || scopeHasValues((scope as any).tiposVendedor)) {
    return { category: "vendor", rank: 4 };
  }
  if (scopeHasValues(scope.regiones) || scopeHasValues(scope.departamentos)) {
    return { category: "region", rank: 5 };
  }
  return { category: "general", rank: 6 };
};

type ClienteLite = {
  codigoCliente: string;
  nombreCliente: string;
  nit?: string;
  tipoCliente?: string;
  clasificacionPrecios?: number | string | null;
  listaPrecio?: string | null;
  lista_precio?: string | null;
  listaPrecioCodigo?: string | null;
  priceListCode?: string | null;
};

type NegotiatedPriceEntry = {
  price: number;
  offerId?: string;
  offerName?: string;
  offerCode?: string | null;
  priority: number;
  scopeRank: number;
  scopeCategory: PriceListScopeCategory;
  updatedAt?: number;
};

const shouldOverrideNegotiatedPrice = (
  current: NegotiatedPriceEntry | undefined,
  candidate: NegotiatedPriceEntry,
) => {
  if (!current) return true;
  if (candidate.scopeRank < current.scopeRank) return true;
  if (candidate.scopeRank > current.scopeRank) return false;

  if (candidate.priority < current.priority) return true;
  if (candidate.priority > current.priority) return false;

  const priceDiff = candidate.price - current.price;
  if (Math.abs(priceDiff) > 0.0001) {
    return priceDiff < 0;
  }

  return (candidate.updatedAt ?? 0) > (current.updatedAt ?? 0);
};

type OrderPayload = Omit<Order, "id" | "status" | "synced" | "attempts" | "createdAt"> & {
  customerId?: string;
};

export default function OrderFormFull({ onClose, draft, open }: { onClose: () => void; draft?: any; open: boolean }) {
      // Estado para mostrar/ocultar paneles en móvil
      const [showLeftPanel, setShowLeftPanel] = useState(true);
      const [showProductsPanel, setShowProductsPanel] = useState(true);
    // Considera draft como "borrador" si existe la prop draft
    const isDraft = !!draft;
  const { addOrder, syncOrders } = useOrders();
  const { priceLists, syncPriceLists } = usePreventa();

  const [customer, setCustomer] = useState<ClienteLite | null>(null);
  const [customerDetails, setCustomerDetails] = useState<Cliente | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");
  const [purchaseOrder, setPurchaseOrder] = useState<string>("");
  const [customerAddress, setCustomerAddress] = useState<string>("");
  const [customerDept, setCustomerDept] = useState<string>("");
  const [customerMunicipio, setCustomerMunicipio] = useState<string>("");
  const [customerContact, setCustomerContact] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("Contado");
  const [warehouse, setWarehouse] = useState<string>("");
  const [addressOptions, setAddressOptions] = useState<Array<{ id: string; direccion: string; departamento?: string; municipio?: string; contacto?: string; telefono?: string }>>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [summaryOpen, setSummaryOpen] = useState<boolean>(true);
  const [pendingAppliedOfferIds, setPendingAppliedOfferIds] = useState<string[]>([]);
  const [priceListLoading, setPriceListLoading] = useState(false);
  const [priceListError, setPriceListError] = useState<string | null>(null);
  const priceListSyncedCompanies = useRef<Set<string>>(new Set());
  const priceListRequestRef = useRef<string | null>(null);
  const priceListCompaniesRef = useRef<Set<string>>(new Set());
  const priceListErroredCompanies = useRef<Set<string>>(new Set());

  const [photos, setPhotos] = useState<{ id: string; dataUrl: string; timestamp: number }[]>([]);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  const [openCustomer, setOpenCustomer] = useState(false);
  const [openProducts, setOpenProducts] = useState(false);
  const [openCombos, setOpenCombos] = useState(false);
  const [activePackOffer, setActivePackOffer] = useState<OfferPackRow | null>(null);

  const comboItems = useMemo(() => items.filter((it) => it.comboId || it.kitId || it.comboCode), [items]);
  const normalItems = useMemo(() => items.filter((it) => !(it.comboId || it.kitId || it.comboCode)), [items]);
  const comboGroups = useMemo(() => groupOrderComboItems(comboItems), [comboItems]);
  const [openComboDetails, setOpenComboDetails] = useState<Record<string, boolean>>({});
  const toggleComboDetail = useCallback((key: string) => {
    setOpenComboDetails((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  useEffect(() => {
    setOpenComboDetails((prev) => {
      const allowed = new Set(comboGroups.map((group) => group.key));
      let changed = false;
      const next: Record<string, boolean> = {};
      Object.entries(prev).forEach(([key, value]) => {
        if (allowed.has(key)) {
          next[key] = value;
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [comboGroups]);

  // Ofertas
  const [allOffers, setAllOffers] = useState<OfferDef[]>([]);
  const [productosAll, setProductosAll] = useState<Product[]>([]);
  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    productosAll.forEach((p) => {
      if (p?.codigoProducto) {
        map.set(String(p.codigoProducto), p);
      }
    });
    return map;
  }, [productosAll]);
  const [applicableOffers, setApplicableOffers] = useState<ApplicableOffer[]>([]);
  const [offersOpen, setOffersOpen] = useState(false);
  const [expandedOfferId, setExpandedOfferId] = useState<string | null>(null);
  const [appliedOffers, setAppliedOffers] = useState<ApplicableOffer[]>([]);
  const [offersTab, setOffersTab] = useState<"discounts" | "bonuses" | "packs">("discounts");
  const [offersSearch, setOffersSearch] = useState("");
  const [offersStatusFilter, setOffersStatusFilter] = useState<"all" | "active" | "inactive" | "draft">("all");
  const [offersTypeFilter, setOffersTypeFilter] = useState<"all" | "discount" | "bonus">("all");

  const [gpsLoading, setGpsLoading] = useState(false);
  const gpsRequested = useRef(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showChangeCustomerModal, setShowChangeCustomerModal] = useState(false);
  const [pendingCustomerChange, setPendingCustomerChange] = useState<ClienteLite | null>(null);
  const [showBonusPicker, setShowBonusPicker] = useState(false);
  const [pendingBonus, setPendingBonus] = useState<{ app: ApplicableOffer; applications: BonusApplication[]; draftQuantities?: Record<string, number> } | null>(null);
  const [bonusOptions, setBonusOptions] = useState<Product[]>([]);
  const [bonusSearch, setBonusSearch] = useState("");
  const [bonusProviderFilter, setBonusProviderFilter] = useState<string | null>(null);
  const [bonusLineFilter, setBonusLineFilter] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { toast } = useToast();
  const bonusAlertKeyRef = useRef<string>("");
  const bonusDraftQuantities = pendingBonus?.draftQuantities || {};
  const totalBonusToAssign = pendingBonus?.applications.reduce((acc, a) => acc + a.bonusQty, 0) || 0;
  const assignedBonusQty = Object.values(bonusDraftQuantities).reduce((acc: number, v: any) => acc + Number(v || 0), 0);
  const pendingBonusQty = Math.max(totalBonusToAssign - assignedBonusQty, 0);

  const canUseDOM = typeof window !== "undefined" && typeof document !== "undefined";

  // Avisar cuando con las cantidades actuales se alcanza más bonificación que la aplicada
  useEffect(() => {
    if (!applicableOffers.length) {
      bonusAlertKeyRef.current = "";
      return;
    }

    const bonusOffersList = applicableOffers.filter((o) => o.offer.type === "bonus");
    if (!bonusOffersList.length) {
      bonusAlertKeyRef.current = "";
      return;
    }

    const appliedBonusQtyByOffer = items
      .filter((it) => it.esBonificacion && it.promoBonificacionId)
      .reduce<Record<string, number>>((acc, it) => {
        const key = String(it.promoBonificacionId);
        acc[key] = (acc[key] || 0) + Number(it.cantidad || 0);
        return acc;
      }, {});

    for (const app of bonusOffersList) {
      const oid = app.offer.id || app.offer.serverId || app.offer.name;
      const potential = app.potentialBonusQty
        ?? app.bonusApplications?.reduce((acc, b) => acc + (b.bonusQty || 0), 0)
        ?? 0;
      const appliedQty = appliedBonusQtyByOffer[oid] || 0;
      if (potential > appliedQty) {
        const key = `${oid}-${potential}-${appliedQty}`;
        if (bonusAlertKeyRef.current !== key) {
          bonusAlertKeyRef.current = key;
          toast({
            duration: 1000,
            title: "Tienes más bonificación disponible",
            description: `La oferta ${app.offer.name} permite ${potential - appliedQty} unds extra. Reaplica para agregarlas.`,
          });
        }
        return;
      }
    }

    // Si no hay diferencias, limpiar clave para futuros avisos
    bonusAlertKeyRef.current = "";
  }, [applicableOffers, items, toast]);

  useEffect(() => {
    if (showBonusPicker) return;
    setBonusSearch("");
    setBonusProviderFilter(null);
    setBonusLineFilter(null);
  }, [showBonusPicker]);

  useEffect(() => {
    const companies = new Set<string>();
    priceLists.forEach((pl) => companies.add(normalizeCompanyId(pl.companyId)));
    priceListCompaniesRef.current = companies;
  }, [priceLists]);

  const updateBonusDraftQuantity = (pid: string | number, qtyRaw: number) => {
    setPendingBonus((prev) => {
      if (!prev) return prev;
      const draft = { ...(prev.draftQuantities || {}) };
      const others = Object.entries(draft).reduce((acc, [id, val]) => (id === String(pid) ? acc : acc + Number(val || 0)), 0);
      const maxAllowed = Math.max(0, totalBonusToAssign - others);
      const nextQty = Math.max(0, Math.min(maxAllowed, Math.floor(Number(qtyRaw) || 0)));
      draft[pid] = nextQty;
      return { ...prev, draftQuantities: draft };
    });
  };

  const discountOffers = useMemo(() => applicableOffers.filter((o) => o.offer.type !== "bonus"), [applicableOffers]);
  const bonusOffers = useMemo(() => applicableOffers.filter((o) => o.offer.type === "bonus"), [applicableOffers]);
  const packOffers = useMemo<OfferPackRow[]>(() => {
    if (!customer) return [];
    const today = new Date();
    return (allOffers || [])
      .filter((off) => {
        const packType = resolvePackType(off.type);
        return packType && !off.deleted && off.pack && isOfferActive(off.status);
      })
      .filter((off) => isOfferInDateRange(off, today))
      .filter((off) => matchesOfferScope(off, customer, { skipCustomerCodes: true }))
      .map((off) => {
        const pack = off.pack!;
        const packType = resolvePackType(off.type) ?? "combo";
        const preview = [
          ...(pack.itemsFijos ?? []).map((item) => ({
            productoId: item.productoId,
            descripcion: item.descripcion ?? item.productoId,
            cantidad: item.unidades,
            precioUnitario: 0,
          })),
          ...(pack.itemsVariablesPermitidos ?? []).map((item) => ({
            productoId: item.productoId,
            descripcion: `${item.descripcion ?? item.productoId} · variable`,
            cantidad: 0,
            precioUnitario: 0,
          })),
        ];
        return {
          idt: off.id,
          descripcion: off.name || off.description || `Oferta ${off.id}`,
          items: preview,
          _type: packType,
          source: "offer",
          offer: off,
          packConfig: pack,
          price: pack.precioFijo,
        } satisfies OfferPackRow;
      });
  }, [allOffers, customer]);

  const filteredOffersByTab = useMemo(() => {
    if (offersTab === "packs") return [] as ApplicableOffer[];
    const term = offersSearch.trim().toLowerCase();
    const source = offersTab === "discounts" ? discountOffers : bonusOffers;

    return source.filter((app) => {
      const statusRaw = (app.offer.status || "").toString().trim().toLowerCase();
      if (offersStatusFilter !== "all" && statusRaw && statusRaw !== offersStatusFilter) return false;
      if (offersTypeFilter !== "all" && app.offer.type !== offersTypeFilter) return false;
      if (!term) return true;

      const offerAny = app.offer as any;
      const haystackParts = [
        app.offer.name || "",
        app.offer.description || "",
        (app.offer.scope?.codigosLinea || offerAny.codigosLinea || []).join(" "),
        (app.offer.scope?.codigosProveedor || app.offer.proveedores || offerAny.codigosProveedor || []).join(" "),
        (app.offer.scope?.codigosProducto || app.offer.products || []).join(" "),
      ];

      return haystackParts.some((p) => p && p.toString().toLowerCase().includes(term));
    });
  }, [offersTab, discountOffers, bonusOffers, offersSearch, offersStatusFilter, offersTypeFilter]);

  const applyCustomerChange = (nextCustomer: ClienteLite) => {
    setItems([]);
    setDiscount(0);
    setNotes("");
    setPhotos([]);
    setLocation(null);
    setPurchaseOrder("");
    setCustomerAddress("");
    setCustomerDept("");
    setCustomerMunicipio("");
    setCustomerContact("");
    setCustomerPhone("");
    setPaymentMethod("Contado");
    setAddressOptions([]);
    setSelectedAddressId("");
    setPendingAppliedOfferIds([]);
    setAppliedOffers([]);
    setOffersOpen(false);
    setExpandedOfferId(null);
    setCustomer(nextCustomer);
  };

  const confirmCustomerChange = () => {
    if (pendingCustomerChange) {
      applyCustomerChange(pendingCustomerChange);
    }
    setPendingCustomerChange(null);
    setShowChangeCustomerModal(false);
  };

  const cancelCustomerChange = () => {
    setPendingCustomerChange(null);
    setShowChangeCustomerModal(false);
  };

  // Helper: recalcula ítems aplicando oferta si existe
  const recalcItemsWithOffer = (nextItems: OrderItem[]) => {
    if (appliedOffers.length) {
      const { items: updated, perOfferDiscount } = applyOffersSequence(nextItems, appliedOffers);
      setItems(updated);
      setAppliedOffers((prev) =>
        prev.map((o) => ({ ...o, potentialDiscount: perOfferDiscount.get(offerKey(o.offer)) || 0 }))
      );
    } else {
      setItems(nextItems);
    }
  };

  const removeComboGroup = useCallback((group: OrderComboGroup) => {
    const idsToRemove = new Set(group.items.map((item) => item.id));
    const filtered = items.filter((item) => !idsToRemove.has(item.id));
    recalcItemsWithOffer(filtered);
  }, [items, recalcItemsWithOffer]);

  const { user } = useAuth();

  const vendorCode = useMemo(() => {
    const entry = user?.usuarioConfiguracion?.find((i: any) => i.configuracion === "CODIGO_VENDEDOR");
    return (entry?.valor as string) || "";
  }, [user]);

  const defaultWarehouse = useMemo(() => {
    const entry = user?.usuarioConfiguracion?.find((i: any) => i.configuracion === "BODEGA_DESPACHO")
      || user?.usuarioConfiguracion?.find((i: any) => i.configuracion === "BODEGA" || i.configuracion === "CODIGO_BODEGA");
    return (entry?.valor as string) || "";
  }, [user]);

  const companyCode = useMemo(() => {
    const entry = user?.usuarioConfiguracion?.find((i: any) => i.configuracion === "CODIGO_VENDEDOR");
    return (entry?.codigoEmpresa as string) || "E01";
  }, [user]);

  const orderSeries = useMemo(() => {
    const entry = user?.usuarioConfiguracion?.find((i: any) => i.configuracion === "SERIE PEDIDO" || i.configuracion === "SERIE_PEDIDO");
    return (entry?.valor as string) || undefined;
  }, [user]);

  const existingItems = useMemo(
    () => items.reduce<Record<string, number>>((acc, it) => {
        if (it.comboId || it.kitId || it.comboCode || it.comboType === "combo" || it.comboType === "kit") {
          return acc;
        }
        acc[it.productoId] = (acc[it.productoId] || 0) + it.cantidad;
        return acc;
    }, {}),
    [items]
    );  

  const selectedCount = useMemo(() => items.reduce((acc, it) => acc + (it.cantidad || 0), 0), [items]);

  const negotiatedPriceMap = useMemo(() => {
    if (!customer) return {} as Record<string, NegotiatedPriceEntry>;
    const scopeCustomer = (customerDetails as Cliente | null) ?? (customer as any) ?? null;
    if (!scopeCustomer) return {} as Record<string, NegotiatedPriceEntry>;

    const today = new Date();
    const normalizedCompany = companyCode ? normalizeCompanyId(companyCode) : null;
    const output: Record<string, NegotiatedPriceEntry> = {};

    for (const offer of allOffers) {
      if (!offer) continue;
      const offerType = (offer.type || "").toString().toLowerCase();
      if (offerType !== "pricelist") continue;
      if (offer.deleted) continue;
      if (!isOfferActive(offer.status)) continue;
      if (!isOfferInDateRange(offer, today)) continue;

      if (offer.codigoEmpresa) {
        const offerCompany = normalizeCompanyId(offer.codigoEmpresa);
        if (normalizedCompany && offerCompany && normalizedCompany !== offerCompany) {
          continue;
        }
      }

      if (!matchesOfferScope(offer, scopeCustomer, { skipCustomerCodes: false })) continue;

      const overrides = offer.priceList?.products ?? [];
      if (!Array.isArray(overrides) || overrides.length === 0) continue;

      for (const entry of overrides) {
        const pidRaw = entry?.productId;
        if (pidRaw === undefined || pidRaw === null) continue;
        const pid = String(pidRaw).trim();
        if (!pid) continue;
        const price = Number(entry?.price);
        if (!Number.isFinite(price)) continue;

        const offerCode = pickReferenceCode(
          offer.codigoOferta,
          offer.referenceCode,
          (offer as any)?.codigoOferta,
          (offer as any)?.codigoReferencia,
          offer.serverId,
          offer.id
        );

        const scopeSummary = resolvePriceListScope(offer);
        const candidate: NegotiatedPriceEntry = {
          price,
          offerId: offer.id || offer.serverId,
          offerName: offer.name || offer.description || "Lista negociada",
          offerCode: offerCode ?? null,
          priority: parseOfferPriority(offer.priority),
          scopeRank: scopeSummary.rank,
          scopeCategory: scopeSummary.category,
          updatedAt: parseOfferUpdatedAt(offer),
        };

        if (!shouldOverrideNegotiatedPrice(output[pid], candidate)) {
          continue;
        }

        output[pid] = candidate;
      }
    }

    return output;
  }, [customer, customerDetails, allOffers, companyCode]);

  const resolveBonusUnitPrice = useCallback(
    (pid: string, prod?: Product) => {
      const negotiated = negotiatedPriceMap[pid];
      if (negotiated && Number.isFinite(Number(negotiated.price))) {
        const price = Number(negotiated.price);
        return {
          price,
          priceSource: "negotiated" as OrderItem["priceSource"],
          priceListName: negotiated.offerName ?? "Precio negociado",
          priceListCode: negotiated.offerCode ?? undefined,
          priceOfferId: negotiated.offerId,
          priceOfferCode: negotiated.offerCode ?? null,
          priceOfferName: negotiated.offerName ?? "Precio negociado",
        };
      }

      const base = Number(prod?.precio ?? 0);
      const price = Number.isFinite(base) ? base : 0;
      return {
        price,
        priceSource: "base" as OrderItem["priceSource"],
        priceListName: prod && prod.descripcion ? undefined : undefined,
        priceListCode: undefined,
        priceOfferId: undefined,
        priceOfferCode: undefined,
        priceOfferName: undefined,
      };
    },
    [negotiatedPriceMap]
  );

  useEffect(() => {
    if (!customer) return;
    if (!items.length) return;
    const overrideKeys = Object.keys(negotiatedPriceMap || {});
    if (!overrideKeys.length) return;

    let changed = false;
    const updated = items.map((item) => {
      if (item.comboId || item.kitId || item.esBonificacion) return item;
      const pid = String(item.productoId ?? "").trim();
      if (!pid) return item;
      const override = negotiatedPriceMap[pid];
      if (!override) {
        return item;
      }

      const negotiatedUnit = Number(override.price);
      if (!Number.isFinite(negotiatedUnit)) return item;

      const targetSubtotal = Math.round(item.cantidad * negotiatedUnit * 100) / 100;
      const samePrice = Math.abs((item.precioUnitario ?? 0) - negotiatedUnit) < 0.001;
      const sameSource = item.priceSource === "negotiated";
      const sameName = (item.priceListName || "") === (override.offerName || item.priceListName || "");
      const sameCode = (item.priceListCode || "") === (override.offerCode || item.priceListCode || "");

      if (samePrice && sameSource && sameName && sameCode) {
        return item;
      }

      changed = true;
      return {
        ...item,
        precioUnitario: negotiatedUnit,
        subtotal: targetSubtotal,
        subtotalSinDescuento: targetSubtotal,
        total: targetSubtotal,
        descuentoLinea: undefined,
        priceSource: "negotiated",
        priceListName: override.offerName ?? "Precio negociado",
        priceListCode: override.offerCode ?? item.priceListCode ?? undefined,
        ofertaCodigo: override.offerCode ?? item.ofertaCodigo ?? null,
        ofertaIdAplicada: override.offerId ?? item.ofertaIdAplicada ?? undefined,
        ofertaNombre: override.offerName ?? item.ofertaNombre ?? "Precio negociado",
        tipoOferta: "pricelist",
      } as OrderItem;
    });

    if (changed) {
      recalcItemsWithOffer(updated);
    }
  }, [customer, items, negotiatedPriceMap]);

  useEffect(() => {
    const draft = {
      customer,
      items,
      discount,
      notes,
      photos,
      location,
      purchaseOrder,
      customerAddress,
      customerDept,
      customerMunicipio,
      customerContact,
      customerPhone,
      paymentMethod,
      warehouse,
      selectedAddressId,
      summaryOpen,
      appliedOfferIds: appliedOffers.map((o) => o.offer.id || o.offer.serverId).filter(Boolean),
    };
    localStorage.setItem("pedido_draft", JSON.stringify(draft));
  }, [customer, items, discount, notes, photos, location, purchaseOrder, customerAddress, customerDept, customerMunicipio, customerContact, customerPhone, paymentMethod, warehouse, selectedAddressId, summaryOpen, appliedOffers]);

  const ensurePriceLists = useCallback(
    async (targetCompany?: string | null) => {
      const fallbackCompany = targetCompany || companyCode || "general";
      if (!fallbackCompany) return;
      const normalized = normalizeCompanyId(fallbackCompany);

      if (priceListCompaniesRef.current.has(normalized)) {
        priceListSyncedCompanies.current.add(normalized);
        priceListErroredCompanies.current.delete(normalized);
        setPriceListError(null);
        return;
      }

      if (priceListSyncedCompanies.current.has(normalized)) return;
      if (priceListErroredCompanies.current.has(normalized)) return;
      if (priceListRequestRef.current === normalized) return;

      try {
        priceListRequestRef.current = normalized;
        setPriceListLoading(true);
        await syncPriceLists(fallbackCompany);
        priceListSyncedCompanies.current.add(normalized);
        priceListErroredCompanies.current.delete(normalized);
        setPriceListError(null);
      } catch (err: any) {
        priceListErroredCompanies.current.add(normalized);
        setPriceListError(err?.message || "No se pudieron cargar las listas de precio.");
      } finally {
        priceListRequestRef.current = null;
        setPriceListLoading(false);
      }
    },
    [companyCode, syncPriceLists]
  );

  useEffect(() => {
    if (!companyCode) return;
    const targetCompany =
      (customer as any)?.codigoEmpresa || (customer as any)?.companyId || companyCode;
    void ensurePriceLists(targetCompany);
  }, [companyCode, customer, ensurePriceLists]);

  const retryPriceLists = useCallback(() => {
    const targetCompany =
      (customer as any)?.codigoEmpresa || (customer as any)?.companyId || companyCode;
    if (!targetCompany) return;
    const normalized = normalizeCompanyId(targetCompany);
    priceListSyncedCompanies.current.delete(normalized);
    priceListErroredCompanies.current.delete(normalized);
    void ensurePriceLists(targetCompany);
  }, [companyCode, customer, ensurePriceLists]);


  // Cargar ofertas y productos locales para evaluar aplicabilidad
  useEffect(() => {
    let mounted = true;
    const loadOffersAndProducts = async () => {
      try {
        const [ofs, prods] = await Promise.all([db.offer_defs.filter((o: any) => !o.deleted).toArray(), db.products.toArray()]);
        if (!mounted) return;
        setAllOffers(ofs ?? []);
        setProductosAll(prods ?? []);
      } catch (e) {
        console.error("Error cargando ofertas/productos locales:", e);
      }
    };

    loadOffersAndProducts();

    const onOffersSynced = () => {
      loadOffersAndProducts();
    };
    window.addEventListener("offers:synced", onOffersSynced);

    return () => {
      mounted = false;
      window.removeEventListener("offers:synced", onOffersSynced);
    };
  }, []);


  useEffect(() => {
    if (!location && !gpsRequested.current) {
      gpsRequested.current = true;
      setGpsLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setGpsLoading(false);
        },
        () => setGpsLoading(false),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
      );
    }
  }, [location]);    

  useEffect(() => {
    if (open) {
      setCustomer(draft?.customer ?? null);
      setItems(draft?.items ?? []);
      setDiscount(draft?.discount ?? 0);
      setNotes(draft?.notes ?? "");
      setPhotos(draft?.photos ?? []);
      setLocation(draft?.location ?? null);
      setPurchaseOrder(draft?.purchaseOrder ?? "");
      setCustomerAddress(draft?.customerAddress ?? "");
      setCustomerDept(draft?.customerDept ?? "");
      setCustomerMunicipio(draft?.customerMunicipio ?? "");
      setCustomerContact(draft?.customerContact ?? "");
      setCustomerPhone(draft?.customerPhone ?? "");
      setPaymentMethod(draft?.paymentMethod ?? "Contado");
      setWarehouse(draft?.warehouse ?? defaultWarehouse);
      setSelectedAddressId(draft?.selectedAddressId ?? "");
      setSummaryOpen(draft?.summaryOpen ?? true);
      setPendingAppliedOfferIds(draft?.appliedOfferIds ?? []);
      setAppliedOffers([]);
      setOffersOpen(false);
    }
  }, [draft, open, defaultWarehouse]);

  useEffect(() => {
    const updateStatus = () => setIsOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    updateStatus();
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);
    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  useEffect(() => {
    if (!warehouse && defaultWarehouse) {
      setWarehouse(defaultWarehouse);
    } else if (!warehouse) {
      setWarehouse("01");
    }
  }, [defaultWarehouse, warehouse]);

  // Recalcular ofertas aplicables cuando cambian cliente/items/ofertas/productos
  useEffect(() => {
    try {
      const codigoEmpresa =
        user?.usuarioConfiguracion?.find((i: any) => i.configuracion === "CODIGO_VENDEDOR")?.codigoEmpresa ?? "E01";

      const itemsForEngine = items.filter((it) => !(it as any).esBonificacion);
      const subtotalCalc = itemsForEngine.reduce((acc, it) => acc + (it.subtotal ?? it.cantidad * it.precioUnitario), 0);

      const orderForEngine: Partial<Order> = {
        codigoEmpresa,
        items: itemsForEngine,
        subtotal: subtotalCalc,
      };

      const clienteForEngine: Cliente | null = customer
        ? {
            codigoCliente: customer.codigoCliente,
            nombreCliente: customer.nombreCliente,
            canalVenta: (customer as any).canalVenta ?? (customer as any).canal ?? (customer as any).tipoCliente,
            tipoCliente: (customer as any).tipoCliente ?? (customer as any).canalVenta ?? (customer as any).canal,
            codigoCanal: (customer as any).codigoCanal ?? (customer as any).canalCodigo,
            canalCodigo: (customer as any).canalCodigo ?? (customer as any).codigoCanal,
            subCanalVenta: (customer as any).subCanalVenta ?? (customer as any).subCanal,
            codigoSubCanal: (customer as any).codigoSubCanal,
            updatedAt: new Date().toISOString(),
          } as any
        : null;

      const apps = getApplicableOffers(orderForEngine as any, clienteForEngine, productosAll, allOffers);
      console.debug("[OrderFormFull] applicable offers", { appsCount: apps.length, apps });

      // Siempre refrescamos la lista para que cantidades/tiers reflejen el estado actual
      setApplicableOffers(apps);

      if (appliedOffers.length) {
        const stillApplicable = appliedOffers
          .map((a) => apps.find((b) => (b.offer.id || b.offer.serverId) === (a.offer.id || a.offer.serverId)))
          .filter((x): x is ApplicableOffer => !!x);

        if (!stillApplicable.length) {
          handleRemoveOffer();
        } else if (!offersEqual(stillApplicable, appliedOffers)) {
          setAppliedOffers(stillApplicable);
        }
      }

      // Reaplicar ofertas guardadas en draft al abrir
      if (!appliedOffers.length && pendingAppliedOfferIds.length && apps.length) {
        const toApply = apps.filter((app) => {
          const id = app.offer.id || app.offer.serverId;
          return id ? pendingAppliedOfferIds.includes(id) : false;
        });
        if (toApply.length) {
          const clean = stripDiscounts(items);
          const { items: updated, perOfferDiscount } = applyOffersSequence(clean, toApply);
          setItems(updated);
          setAppliedOffers(toApply.map((o) => ({ ...o, potentialDiscount: perOfferDiscount.get(offerKey(o.offer)) || 0 })));
          setPendingAppliedOfferIds([]);
        }
      }
    } catch (e) {
      console.error("Error evaluando ofertas aplicables:", e);
    }
  }, [items, customer, allOffers, productosAll, user, appliedOffers, pendingAppliedOfferIds]);

  const captureGeo = () => {
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsLoading(false);
      },
      () => setGpsLoading(false),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
    );
  };

  useEffect(() => {
    if (!customer) {
      setCustomerDetails(null);
      return;
    }
    (async () => {
      const c = await db.clientes.where("codigoCliente").equals(customer.codigoCliente).first();
      if (c) {
        setCustomerDetails(c as Cliente);
        setCustomer((prev) => {
          if (!prev) return prev;
          let changed = false;
          const next: ClienteLite = { ...prev };

          if (c.canalVenta && c.canalVenta !== prev.tipoCliente) {
            next.tipoCliente = c.canalVenta as any;
            changed = true;
          }

          const fetchedPriceCode = extractCustomerPriceCode(c);
          if (fetchedPriceCode) {
            const currentCode = extractCustomerPriceCode(prev);
            if (currentCode !== fetchedPriceCode) {
              next.clasificacionPrecios = fetchedPriceCode;
              changed = true;
            }
          }

          return changed ? next : prev;
        });

        const dir = (c as any).direccionList?.[0] || (c as any).direccionEntrega || (c as any).direccion;
        const dept = dir?.departamento || (c as any).departamento || "";
        const muni = dir?.municipio || (c as any).municipio || "";
        const dirText = typeof dir === "string" ? dir : dir?.direccion || "";
        const direccionList = ((c as any).direccionList as any[]) || [];
        const mapped = direccionList.map((d, idx) => ({
          id: String(d.idt || d.id || idx),
          direccion: d.direccion || d.descripcion || "",
          departamento: d.departamento || "",
          municipio: d.municipio || "",
          contacto: d.contacto || d.personaContacto || "",
          telefono: d.telefono || d.telefonoContacto || d.telefono1 || "",
        })).filter((d) => d.direccion);

        setAddressOptions(mapped);
        if (mapped.length > 0) {
          const selected = mapped.find((d) => d.id === selectedAddressId) || mapped[0];
          setSelectedAddressId(selected.id);
          setCustomerAddress(selected.direccion);
          setCustomerDept(selected.departamento || dept);
          setCustomerMunicipio(selected.municipio || muni);
          setCustomerContact(selected.contacto || "");
          setCustomerPhone(selected.telefono || "");
        } else {
          setCustomerAddress((prev) => (prev ? prev : dirText || ""));
          setCustomerDept((prev) => (prev ? prev : dept));
          setCustomerMunicipio((prev) => (prev ? prev : muni));
        }

        const diasCred = (c as any).diasCredito || (c as any).dias_credito || (c as any).diasCreditoCliente;
        if (diasCred && Number(diasCred) > 1) {
          setPaymentMethod("Credito");
        }
      } else {
        setCustomerDetails(null);
      }
    })();
  }, [customer, selectedAddressId]);

  const itemsGross = useMemo(
    () => items.reduce((acc, it) => acc + (it.subtotalSinDescuento ?? it.subtotal ?? it.cantidad * it.precioUnitario), 0),
    [items]
  );

  const itemsGrossWithoutBonus = useMemo(
    () => items
      .filter((it) => !(it as any).esBonificacion)
      .reduce((acc, it) => acc + (it.subtotalSinDescuento ?? it.subtotal ?? it.cantidad * it.precioUnitario), 0),
    [items]
  );

  const itemsTotal = useMemo(
    () => items
      .filter((it) => !(it as any).esBonificacion)
      .reduce((acc, it) => acc + (it.subtotal ?? it.cantidad * it.precioUnitario), 0),
    [items]
  );

  const bonusValue = useMemo(
    () => items.filter((it) => (it as any).esBonificacion).reduce((acc, it) => acc + (it.subtotalSinDescuento ?? it.subtotal ?? 0), 0),
    [items]
  );

  const bonusProviders = useMemo(() => {
    const acc = new Map<string, { id: string; label: string; count: number }>();
    bonusOptions.forEach((p) => {
      const id = asId(p.codigoProveedor);
      if (!id) return;
      const label = p.proveedor || p.codigoProveedor || "Proveedor";
      const prev = acc.get(id)?.count ?? 0;
      acc.set(id, { id, label, count: prev + 1 });
    });
    return Array.from(acc.values());
  }, [bonusOptions]);

  const bonusLines = useMemo(() => {
    if (!bonusProviderFilter) return [] as { id: string; label: string; count: number }[];
    const list = bonusOptions.filter((p) => asId(p.codigoProveedor) === bonusProviderFilter);
    const acc = new Map<string, { id: string; label: string; count: number }>();
    list.forEach((p) => {
      const id = asId((p as any).codigoFiltroVenta ?? (p as any).lineaVenta ?? p.linea ?? "");
      if (!id) return;
      const label = (p as any).filtroVenta || (p as any).lineaVenta || (p as any).linea || "Línea";
      const prev = acc.get(id)?.count ?? 0;
      acc.set(id, { id, label, count: prev + 1 });
    });
    return Array.from(acc.values());
  }, [bonusOptions, bonusProviderFilter]);

  const filteredBonusOptions = useMemo(() => {
    let list = bonusOptions;
    if (bonusProviderFilter) {
      list = list.filter((p) => asId(p.codigoProveedor) === bonusProviderFilter);
    }
    if (bonusLineFilter) {
      list = list.filter((p) => asId((p as any).codigoFiltroVenta ?? (p as any).lineaVenta ?? p.linea ?? "") === bonusLineFilter);
    }
    const term = bonusSearch.trim().toLowerCase();
    if (term) {
      list = list.filter((p) =>
        (p.descripcion || "").toLowerCase().includes(term) ||
        (p.codigoProducto || "").toLowerCase().includes(term)
      );
    }
    return list;
  }, [bonusOptions, bonusProviderFilter, bonusLineFilter, bonusSearch]);

  const offersDiscount = useMemo(
    () => Math.max(0, itemsGrossWithoutBonus - itemsTotal),
    [itemsGrossWithoutBonus, itemsTotal]
  );
  const generalDiscountPct = useMemo(
    () => Math.max(0, Math.min(100, Number.isFinite(discount) ? Number(discount) : 0)),
    [discount]
  );
  const generalDiscountAmount = useMemo(
    () => Math.round(itemsTotal * (generalDiscountPct / 100) * 100) / 100,
    [itemsTotal, generalDiscountPct]
  );

  const total = useMemo(() => {
    const net = Math.max(0, itemsTotal - generalDiscountAmount);
    return Math.round(net * 100) / 100;
  }, [itemsTotal, generalDiscountAmount]);

  const tempOrderPreview = useMemo(() => {
    if (isOnline) return undefined;
    return peekTempOrderNumber(vendorCode, orderSeries, companyCode);
  }, [isOnline, vendorCode, orderSeries, companyCode]);

  const canUseCombos = !!customer;
  const canSave = !!customer && items.length > 0;
  const saveBlockedReason = useMemo(() => {
    if (!customer) return "Selecciona un cliente";
    if (items.length === 0) return "Agrega al menos un producto";
    return null;
  }, [customer, items.length]);

  // Marcar hidratación/montaje en consola para detectar falta de bindings de eventos
  useEffect(() => {
    console.debug("[OrderFormFull] montado/hidratado", { hasCustomer: !!customer, items: items.length });
  }, [customer, items.length]);

  const handlePickProducts = (newItems: OrderItem[]) => {
    const next = [...items];
    for (const ni of newItems) {
      const idx = next.findIndex(
        (x) => x.productoId === ni.productoId && !x.comboId && !x.kitId
      );
      if (idx >= 0) {
        const unit = Number.isFinite(ni.precioUnitario) ? ni.precioUnitario : next[idx].precioUnitario;
        const bruto = Math.round(ni.cantidad * unit * 100) / 100;
        next[idx] = {
          ...next[idx],
          ...ni,
          id: next[idx].id,
          cantidad: ni.cantidad,
          precioUnitario: unit,
          subtotal: bruto,
          subtotalSinDescuento: bruto,
        };
      } else {
        const bruto = Math.round(ni.cantidad * ni.precioUnitario * 100) / 100;
        next.push({ ...ni, subtotal: bruto, subtotalSinDescuento: bruto });
      }
    }
    recalcItemsWithOffer(next);
    // No cerrar el modal automáticamente, el usuario debe cerrarlo manualmente
  };

  const handlePickComboItems = (comboItems: OrderItem[]) => {
    const prepared = comboItems.map((it) => {
      const bruto =
        typeof it.subtotal === "number"
          ? Math.round(it.subtotal * 100) / 100
          : Math.round(it.cantidad * it.precioUnitario * 100) / 100;
      return { ...it, subtotal: bruto, subtotalSinDescuento: bruto };
    });
    recalcItemsWithOffer([...items, ...prepared]);
  };


  const handleApplyOffer = (app: ApplicableOffer, baseItems?: OrderItem[]) => {
    // Bonificación: crea líneas bonificadas con 100% de descuento y marca de trazabilidad
    if (app.offer.type === "bonus") {
      const promoId = app.offer.id || app.offer.serverId || app.offer.name;
      const alreadyApplied = appliedOffers.some((o) => (o.offer.id || o.offer.serverId) === (app.offer.id || app.offer.serverId));

      if (alreadyApplied) {
        setItems((prev) => prev.filter((it) => it.promoBonificacionId !== promoId));
        setAppliedOffers((prev) => prev.filter((o) => (o.offer.id || o.offer.serverId) !== (app.offer.id || app.offer.serverId)));
        return;
      }

      const applications = app.bonusApplications || [];
      if (!applications.length) return;

      // Si alguna bonificación no tiene producto resuelto, pedimos selección del usuario.
      const needsSelection = applications.some((ap) => !ap.resolvedProductId);

      if (needsSelection) {
        const target = (app.offer as any).bonus?.target || {};
        const lineaIds: string[] = (target as any).lineaIds?.map(String) || [];
        const famIds: string[] = (target as any).familiaIds?.map(String) || [];
        const provIds: string[] = (target as any).proveedorIds?.map(String) || [];

        const normalizeCode = (value: unknown): string => {
          const raw = String(value ?? "").trim();
          if (!raw) return "";
          if (/^-?\d+$/.test(raw)) {
            return String(parseInt(raw, 10));
          }
          return raw.toUpperCase();
        };

        const normalizedLineaIds = lineaIds.map(normalizeCode).filter(Boolean);
        const normalizedFamIds = famIds.map(normalizeCode).filter(Boolean);
        const normalizedProvIds = provIds.map(normalizeCode).filter(Boolean);
        const fallbackLineaId = normalizeCode((target as any).lineaId);
        const fallbackFamId = normalizeCode((target as any).familiaId);
        const fallbackProvId = normalizeCode((target as any).proveedorId);

        const options = productosAll.filter((p) => {
          const lineaVal = normalizeCode(p.codigoLinea ?? p.codigoFiltroVenta ?? (p as any)?.lineaVenta);
          const famVal = normalizeCode(p.codigoFamilia ?? p.familia);
          const provVal = normalizeCode((p as any)?.codigoProveedor ?? (p as any)?.proveedorId);

          const lineaMatch = normalizedLineaIds.length
            ? normalizedLineaIds.includes(lineaVal)
            : fallbackLineaId
              ? lineaVal === fallbackLineaId
              : false;

          const famMatch = normalizedFamIds.length
            ? normalizedFamIds.includes(famVal)
            : fallbackFamId
              ? famVal === fallbackFamId
              : false;

          const provMatch = normalizedProvIds.length
            ? normalizedProvIds.includes(provVal)
            : fallbackProvId
              ? provVal === fallbackProvId
              : false;

          return lineaMatch || famMatch || provMatch;
        });
        setBonusOptions(options);
        const totalBonusQty = applications.reduce((acc, a) => acc + a.bonusQty, 0);
        const defaultPid = options[0]?.codigoProducto;
        const draft: Record<string, number> = defaultPid ? { [defaultPid]: totalBonusQty } : {};
        setPendingBonus({ app, applications, draftQuantities: draft });
        setOffersOpen(false); // cerrar el modal de ofertas para que el picker quede al frente
        setShowBonusPicker(true);
        return;
      }

      const bonusLines: OrderItem[] = [];
      applications.forEach((ap, idx) => {
        const targetPid = ap.resolvedProductId;
        if (!targetPid) return;
        const prod = productosAll.find((p) => String(p.codigoProducto) === String(targetPid));
        const qty = ap.bonusQty;
        const priceInfo = resolveBonusUnitPrice(String(targetPid), prod);
        const price = priceInfo.price;
        const bruto = Math.round(price * qty * 100) / 100;
        const codigoProveedor = prod?.codigoProveedor != null ? String(prod.codigoProveedor) : undefined;
        const nombreProveedor = prod?.proveedor ?? undefined;
        const codigoLinea = prod?.codigoLinea ?? prod?.codigoFiltroVenta ?? (prod as any)?.lineaVenta ?? undefined;
        const nombreLinea = prod?.linea ?? prod?.filtroVenta ?? undefined;
        const offerCode = pickReferenceCode(
          app.offer.codigoOferta,
          app.offer.referenceCode,
          (app.offer as any)?.codigoReferencia,
          (app.offer as any)?.codigoOferta,
          app.offer.id,
          app.offer.serverId
        );
        const sourceIds = (ap.sourceItemIds || []).map((sid) => String(sid));
        const resolvedParentId = sourceIds
          .map((sid) => items.find((it) => it.id === sid || String(it.productoId) === sid)?.id)
          .find((val): val is string => Boolean(val));
        bonusLines.push({
          id: `${promoId}-bonus-${idx}-${Date.now()}`,
          productoId: targetPid,
          descripcion: prod?.descripcion || `Descuento por bonificación – ${app.offer.name}`,
          cantidad: qty,
          precioUnitario: price,
          subtotalSinDescuento: bruto,
          subtotal: 0,
          descuentoLinea: bruto,
          total: 0,
          esBonificacion: true,
          promoBonificacionId: promoId,
          ofertaIdAplicada: promoId,
          ofertaNombre: app.offer.name,
          tipoOferta: "bonus",
          ofertaCodigo: offerCode ?? null,
          codigoOferta: offerCode ?? null,
          priceSource: priceInfo.priceSource,
          priceListName: priceInfo.priceListName,
          priceListCode: priceInfo.priceListCode,
          codigoProveedor: codigoProveedor ?? null,
          nombreProveedor: nombreProveedor ?? null,
          codigoLinea: codigoLinea ?? null,
          nombreLinea: nombreLinea ?? null,
          parentItemId: resolvedParentId ?? null,
          relatedItemIds: sourceIds.length ? sourceIds : undefined,
        });
      });

      if (!bonusLines.length) return;
      setItems((prev) => [...prev, ...bonusLines]);
      setAppliedOffers((prev) => [...prev, { ...app, potentialDiscount: 0, potentialBonusQty: bonusLines.reduce((acc, b) => acc + b.cantidad, 0) }]);
      return;
    }

    // Descuentos: flujo existente
    const sourceItems = baseItems ?? items;
    const clean = stripDiscounts(sourceItems);
    const currentDiscounts = appliedOffers.filter((o) => o.offer.type === "discount");
    const nextApplied = toggleWithStacking(app, currentDiscounts, clean, productosAll);

    const { items: updated, perOfferDiscount } = applyOffersSequence(clean, nextApplied);

    if (!itemsEqual(sourceItems, updated)) {
      setItems(updated);
    }

    const mapped = nextApplied.map((o: ApplicableOffer) => ({ ...o, potentialDiscount: perOfferDiscount.get(offerKey(o.offer)) || 0 }));
    const bonusesKept = appliedOffers.filter((o) => o.offer.type === "bonus");
    setAppliedOffers([...mapped, ...bonusesKept]);
  };

  const handleRemoveOffer = () => {
    setAppliedOffers([]);
    setPendingAppliedOfferIds([]);
    setPendingBonus(null);
    setShowBonusPicker(false);
    // limpiar descuentos por línea
    setItems((prev) => prev
      .filter((it) => !it.esBonificacion)
      .map((it) => {
        const bruto = it.subtotalSinDescuento ?? it.subtotal ?? (it.cantidad * it.precioUnitario);
        return { ...it, subtotal: bruto, total: bruto, subtotalSinDescuento: undefined, descuentoLinea: undefined };
      }));
  };

  const resetOrderState = () => {
    setCustomer(null);
    setItems([]);
    setDiscount(0);
    setNotes("");
    setPhotos([]);
    setLocation(null);
    setPurchaseOrder("");
    setCustomerAddress("");
    setCustomerDept("");
    setCustomerMunicipio("");
    setCustomerContact("");
    setCustomerPhone("");
    setPaymentMethod("Contado");
    setWarehouse(defaultWarehouse || warehouse || "01");
    setAddressOptions([]);
    setSelectedAddressId("");
    setSummaryOpen(true);
    setPendingAppliedOfferIds([]);
    setApplicableOffers([]);
    setAppliedOffers([]);
    setOffersOpen(false);
    setExpandedOfferId(null);
    setPendingBonus(null);
    setBonusOptions([]);
    setBonusSearch("");
    setBonusProviderFilter(null);
    setBonusLineFilter(null);
    setShowBonusPicker(false);
    setPendingCustomerChange(null);
    setShowChangeCustomerModal(false);
    setShowCloseModal(false);
    setOpenCustomer(false);
    setOpenProducts(false);
    setOpenCombos(false);
    bonusAlertKeyRef.current = "";
    gpsRequested.current = false;
    setGpsLoading(false);
  };

  const handleConfirmOrder = async () => {
    if (isSaving) return;
    if (!canSave || !customer) {
      toast({
        variant: "destructive",
        title: "Completa el pedido",
        description: saveBlockedReason || "Selecciona un cliente y productos para continuar.",
      });
      return;
    }
    if (pendingBonus && pendingBonusQty > 0) {
      toast({
        variant: "destructive",
        title: "Bonificación pendiente",
        description: "Distribuye todas las unidades bonificadas antes de confirmar.",
      });
      return;
    }

    try {
      setIsSaving(true);
      const normalizedItems = items.map((it) => {
        const lineSubtotal = round2(it.subtotal ?? it.cantidad * it.precioUnitario);
        const lineSubtotalRaw = round2(it.subtotalSinDescuento ?? it.subtotal ?? it.cantidad * it.precioUnitario);
        const lineTotal = round2(it.total ?? lineSubtotal);
        return {
          ...it,
          subtotal: lineSubtotal,
          subtotalSinDescuento: lineSubtotalRaw,
          total: lineTotal,
        } as OrderItem;
      });

      const preparedItems = prepareOrderItemsForPersistence(normalizedItems, {
        lookupProduct: (pid) => productMap.get(String(pid)) ?? undefined,
      });

      const now = new Date();
      const numeroTemporal = !isOnline ? nextTempOrderNumber(vendorCode, orderSeries, companyCode) : undefined;
      const sanitizedNotes = (notes || "").trim().slice(0, 500);
      const cleanPurchaseOrder = purchaseOrder.trim();
      const cleanAddress = customerAddress.trim();
      const cleanDept = customerDept.trim();
      const cleanMunicipio = customerMunicipio.trim();
      const cleanContact = customerContact.trim();
      const cleanPhone = customerPhone.trim();
      const subtotal = round2(preparedItems.reduce((acc, it) => acc + (it.subtotal ?? 0), 0));
      const subtotalSinDescuento = round2(itemsGrossWithoutBonus);
      const discountTotal = round2(offersDiscount + generalDiscountAmount);
      const payload: OrderPayload = {
        localId: uuidSimple(),
        serverId: null,
        codigoEmpresa: companyCode || "E01",
        codigoCliente: customer.codigoCliente,
        nombreCliente: customer.nombreCliente,
        codigoVendedor: vendorCode || user?.usuario || "VND",
        fecha: now.toISOString(),
        estado: "ingresado",
        items: preparedItems,
        subtotal,
        total: round2(total),
        impuestos: 0,
        observaciones: sanitizedNotes || undefined,
        discount: generalDiscountPct,
        notes: sanitizedNotes,
        photos: photos.slice(0, 10),
        location,
        ordenCompra: cleanPurchaseOrder || undefined,
        formaPago: paymentMethod,
        bodega: (warehouse || defaultWarehouse || "01").toString(),
        direccionEntrega: cleanAddress || undefined,
        departamento: cleanDept || undefined,
        municipio: cleanMunicipio || undefined,
        telefonoEntrega: cleanPhone || undefined,
        contactoEntrega: cleanContact || undefined,
        nombreClienteEnvio: customer.nombreCliente,
        nombreVendedor: user?.nombre ?? user?.usuario ?? undefined,
        seriePedido: orderSeries,
        numeroPedidoTemporal: numeroTemporal,
        subtotalSinDescuento,
        descuentoTotal: discountTotal,
        customerId: customer.codigoCliente,
      };

      await addOrder(payload);
      try {
        await syncOrders();
      } catch (syncError) {
        console.warn("[OrderFormFull] syncOrders error", syncError);
      }

      toast({
        title: "Pedido guardado",
        description: numeroTemporal
          ? `Se almacenó como ${numeroTemporal} y se enviará al reconectar.`
          : "Estamos sincronizando con el servidor.",
      });

      resetOrderState();
      localStorage.removeItem("pedido_draft");
      onClose();
    } catch (error: any) {
      console.error("[OrderFormFull] error confirmando pedido", error);
      toast({
        variant: "destructive",
        title: "No se pudo guardar",
        description: error?.message || "Revisa tu conexión e inténtalo nuevamente.",
      });
    } finally {
      setIsSaving(false);
    }
  };


  return (
    // 👇 Contenedor principal con fondo y padding
    <div className="flex h-full flex-col bg-gray-50 dark:bg-neutral-900 rounded-xl shadow-lg border border-gray-200 dark:border-neutral-800">
      {/* Header sticky */}
      <div
        className="sticky top-0 z-10 bg-white/95 dark:bg-neutral-900/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-neutral-900/60 border-b border-gray-200 dark:border-neutral-800"
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              onClick={() => setShowCloseModal(true)}
            >
              Cerrar
            </Button>
            <Button
              variant="secondary"
              onClick={() => setOffersOpen(true)}
              className={appliedOffers.length ? "border-emerald-500 bg-emerald-50 text-emerald-800 hover:bg-emerald-100" : undefined}
              title={applicableOffers.length ? `${applicableOffers.length} ofertas aplicables` : "Revisar ofertas"}
            >
              <Gift className="w-4 h-4 mr-2 text-pink-600" />
              {appliedOffers.length ? `Ofertas (${appliedOffers.length})` : "Ofertas"}
              {appliedOffers.length > 0 && (
                <span className="ml-2 h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.25)]"></span>
              )}
              {applicableOffers.length > 0 && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-pink-100 text-pink-800">{applicableOffers.length}</span>
              )}
            </Button>
            <Button
              onClick={handleConfirmOrder}
              disabled={!canSave || isSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow"
              aria-busy={isSaving}
            >
              {isSaving ? "Guardando..." : `Confirmar · ${formatCurrencyQ(total)}`}
            </Button>
          </div>
        </div>
      </div>

      {/* Controles de panel en móvil */}
      <div className="md:hidden px-4 pt-3 space-y-2">
        <Card className="p-0 rounded-xl border border-blue-100 shadow-sm">
          <button
            type="button"
            className="w-full flex items-center justify-between px-4 py-3 text-left"
            onClick={() => setShowLeftPanel((v) => !v)}
            aria-expanded={showLeftPanel}
          >
            <div>
              <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5">
                Encabezado
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 uppercase tracking-wide">
              {showLeftPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>
        </Card>
      </div>
      {/* Cuerpo con scroll interno */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-4">
        {/* Layout responsive: una columna en móvil, 2/3 en desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Columna izquierda (arriba en móvil) */}
          <div className={(showLeftPanel ? "" : "hidden ") + "md:block space-y-3"}>
            {/* Geolocalización */}
            <Card className="p-2 space-y-2 rounded-xl shadow border border-green-100 dark:border-green-900 bg-white dark:bg-neutral-800">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4 text-green-600" />
                <span className="font-semibold text-green-900 dark:text-green-100 text-sm">Geoposición</span>
                {location && (
                  <span className="ml-2 text-green-600 text-xs">✓</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div className="text-xs">
                  {gpsLoading ? (
                    <span className="flex items-center gap-2 text-green-600">Obteniendo ubicación…</span>
                  ) : location ? (
                    <span className="text-green-600">Ubicación capturada</span>
                  ) : (
                    <span className="text-muted-foreground">Sin capturar</span>
                  )}
                </div>
                {!isDraft && !location && (
                  <Button size="sm" variant="secondary" onClick={captureGeo} disabled={gpsLoading}>
                    Obtener
                  </Button>
                )}
              </div>
              {location && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  <span>lat: <span className="font-mono text-green-800 dark:text-green-200">{location.lat.toFixed(5)}</span></span>
                  <span>lng: <span className="font-mono text-green-800 dark:text-green-200">{location.lng.toFixed(5)}</span></span>
                  <a
                    href={`https://maps.google.com/?q=${location.lat},${location.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-green-700 dark:text-green-300 hover:underline text-xs font-medium"
                  >
                    <MapPin className="w-3 h-3" />
                    Ver en Google Maps
                  </a>
                </div>
              )}
            </Card>
            {/* Fotos */}
            <Card className="p-4 space-y-3 rounded-xl shadow border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-800">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-purple-600" />
                <div className="font-semibold text-purple-900 dark:text-purple-100">Fotos</div>
              </div>
              <OrderPhotos photos={photos} onChange={setPhotos} />
            </Card>
            {/* Cliente */}
            <Card className="p-4 space-y-3 rounded-xl shadow border border-blue-100 dark:border-blue-900 bg-white dark:bg-neutral-800">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                <div className="font-semibold text-blue-900 dark:text-blue-100">Cliente</div>
              </div>
              {!customer ? (
                <Button variant="secondary" onClick={() => setOpenCustomer(true)}>
                  Seleccionar cliente
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="text-sm font-medium">{customer.nombreCliente}</div>
                  <div className="text-xs text-muted-foreground">
                    {customer.codigoCliente} {customer.nit && `· NIT ${customer.nit}`}
                  </div>
                  {customer.tipoCliente && (
                    <div className="text-xs">Tipo: <strong>{customer.tipoCliente}</strong></div>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setOpenCustomer(true)}>
                    Cambiar
                  </Button>
                </div>
              )}
            </Card>
          </div>
          <div className="lg:col-span-2 space-y-3">
            <Card className="p-0 rounded-xl shadow border border-yellow-100 dark:border-yellow-900 bg-white dark:bg-neutral-800">
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 text-left"
                onClick={() => setShowProductsPanel((v) => !v)}
                aria-expanded={showProductsPanel}
              >
                <div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 text-yellow-700 text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5">
                    <Package className="w-3 h-3" />
                    Productos
                  </span>
                  <div className="mt-1 text-sm font-semibold text-yellow-900 dark:text-yellow-100">Productos / Combos / Kits</div>
                  <div className="text-xs text-muted-foreground">{items.length} seleccionados · {selectedCount} unidades</div>
                </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 uppercase tracking-wide">
              {showLeftPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>

              </button>
              {showProductsPanel && (
                <div className="p-4 space-y-3 border-t border-yellow-100 dark:border-yellow-900">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-100 font-semibold text-sm">
                      <Package className="w-4 h-4" />
                      <span>Carrito de productos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => setOpenProducts(true)}
                        disabled={!customer || priceListLoading}
                        title={!customer ? "Selecciona un cliente" : priceListLoading ? "Sincronizando listas de precio" : "Agregar productos"}
                      >
                        Agregar productos
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setOpenCombos(true)}
                        disabled={!canUseCombos}
                      >
                        <Gift className="w-4 h-4 mr-1 text-pink-600" /> Combos / Kits
                      </Button>
                    </div>
                    {priceListLoading && (
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        Sincronizando listas de precio…
                      </div>
                    )}
                    {priceListError && (
                      <div className="text-xs text-red-600 flex items-center gap-2">
                        {priceListError}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={retryPriceLists}
                        >
                          Reintentar
                        </Button>
                      </div>
                    )}
                  </div>
                  {items.length === 0 && (
                    <div className="text-sm text-muted-foreground">Aún no hay ítems agregados.</div>
                  )}

                  {comboGroups.map((group) => {
                    const resolvedComboCode = pickReferenceCode(
                      group.offerCode,
                      group.comboCode,
                      group.items[0]?.codigoOferta,
                      group.items[0]?.ofertaCodigo,
                      group.items[0]?.comboCode
                    );
                    const comboCode = resolvedComboCode ?? "-";
                    const comboName = group.comboName || group.items[0]?.descripcion || "Combo/Kit";
                    const quantity = resolveComboGroupQuantity(group);
                    const unitPrice = resolveComboGroupUnitPrice(group);
                    const detailOpen = !!openComboDetails[group.key];
                    return (
                      <div
                        key={group.key}
                        className="border rounded-lg p-3 shadow-sm bg-yellow-50 dark:bg-yellow-900/20"
                      >
                        <div className="grid grid-cols-12 gap-2 items-center text-sm text-yellow-900 dark:text-yellow-100">
                          <div className="col-span-2 font-mono text-xs">{comboCode}</div>
                          <div className="col-span-5 font-semibold">{comboName}</div>
                          <div className="col-span-1 text-center">{quantity}</div>
                          <div className="col-span-2 text-right">{formatCurrencyQ(unitPrice)}</div>
                          <div className="col-span-2 text-right font-semibold">{formatCurrencyQ(group.totalPrice)}</div>
                        </div>
                        <div className="mt-3 flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-yellow-300 text-yellow-800 hover:bg-yellow-100 dark:border-yellow-700 dark:text-yellow-100 dark:hover:bg-yellow-900/40"
                            onClick={() => toggleComboDetail(group.key)}
                          >
                            {detailOpen ? "Ocultar detalle" : "Mostrar detalle"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/40"
                            onClick={() => removeComboGroup(group)}
                          >
                            Quitar
                          </Button>
                        </div>
                        {detailOpen && (
                          <div className="mt-3 border-l-2 border-yellow-200 dark:border-yellow-800 pl-4 space-y-1">
                            {group.items.map((line) => {
                              const detailCode = pickReferenceCode(
                                line.codigoOferta,
                                line.ofertaCodigo,
                                line.comboCode,
                                resolvedComboCode
                              ) ?? comboCode;
                              const detailProduct = productMap.get(String(line.productoId));
                              const detailName = line.descripcion || detailProduct?.descripcion || String(line.productoId);
                              return (
                                <div
                                  key={line.id}
                                  className="grid grid-cols-12 gap-2 items-center text-xs text-muted-foreground"
                                >
                                  <div className="col-span-3 font-mono">{detailCode}</div>
                                  <div className="col-span-7">{detailName}</div>
                                  <div className="col-span-2 text-center text-yellow-900 dark:text-yellow-100">{line.cantidad}</div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {normalItems.map((it) => {
                    const isBonus = !!it.esBonificacion;
                    const isNegotiated = !isBonus && (it.priceSource === "negotiated" || it.tipoOferta === "pricelist");
                    const canDecrease = it.cantidad > 1 && !isBonus; // evitamos bajar/romper bonificaciones
                    const appearanceClass = isBonus
                      ? "bg-amber-50 border-amber-200 dark:bg-amber-900/15 dark:border-amber-800"
                      : isNegotiated
                        ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-700"
                        : "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800";
                    return (
                      <div
                        key={it.id}
                        className={`grid grid-cols-12 gap-2 items-center border rounded-lg p-2 shadow-sm ${appearanceClass}`}
                      >
                        <div className="col-span-5 space-y-1">
                          <div className="font-medium flex items-center gap-2">
                            {isBonus && (
                              <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50">Boni</Badge>
                            )}
                            {isNegotiated && (
                              <Badge variant="outline" className="border-emerald-400 text-emerald-700 bg-emerald-50">Negociado</Badge>
                            )}
                            <span>{it.descripcion}</span>
                          </div>
                          <div className={`text-xs ${isNegotiated ? "text-emerald-700 font-semibold" : "text-muted-foreground"}`}>
                            Precio: {formatCurrencyQ(it.precioUnitario)}
                          </div>
                          {isNegotiated && it.priceListName && (
                            <div className="text-[11px] text-emerald-600">
                              Lista: {it.priceListName}
                            </div>
                          )}
                          <div className={`text-[11px] ${isNegotiated ? "text-emerald-600" : "text-muted-foreground"}`}>
                            Bruto: {formatCurrencyQ(it.subtotalSinDescuento ?? it.cantidad * it.precioUnitario)}
                            {it.descuentoLinea ? ` · Desc: ${formatCurrencyQ(it.descuentoLinea)}` : ""}
                            {it.descuentoLinea ? ` · Neto: ${formatCurrencyQ(it.subtotal ?? it.cantidad * it.precioUnitario)}` : ""}
                          </div>
                        </div>
                        <div className="col-span-4 flex items-center gap-1">
                          {isBonus ? (
                            <div className="flex items-center gap-2 text-yellow-900 dark:text-yellow-100 font-semibold">
                              <span className="px-2">{it.cantidad}</span>
                              <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300">Fijo por boni</Badge>
                            </div>
                          ) : (
                            <>
                              <Button
                                size="icon"
                                variant="outline"
                                className="text-yellow-700 border-yellow-300 hover:bg-yellow-100 dark:text-yellow-200 dark:border-yellow-700"
                                onClick={() => {
                                  if (canDecrease) {
                                    const next = items.map((x) =>
                                      x.id === it.id
                                        ? (() => {
                                            const nuevaCantidad = x.cantidad - 1;
                                            const bruto = Math.round(nuevaCantidad * x.precioUnitario * 100) / 100;
                                            return {
                                              ...x,
                                              cantidad: nuevaCantidad,
                                              subtotal: bruto,
                                              subtotalSinDescuento: bruto,
                                              descuentoLinea: undefined,
                                            };
                                          })()
                                        : x
                                    );
                                    recalcItemsWithOffer(next);
                                  }
                                }}
                                disabled={!canDecrease}
                                title="Menos"
                              >
                                –
                              </Button>
                              <span className="px-2 font-semibold text-yellow-900 dark:text-yellow-100">{it.cantidad}</span>
                              <Button
                                size="icon"
                                variant="outline"
                                className="text-yellow-700 border-yellow-300 hover:bg-yellow-100 dark:text-yellow-200 dark:border-yellow-700"
                                onClick={() => {
                                  const next = items.map((x) =>
                                    x.id === it.id
                                      ? (() => {
                                          const nuevaCantidad = x.cantidad + 1;
                                          const bruto = Math.round(nuevaCantidad * x.precioUnitario * 100) / 100;
                                          return {
                                            ...x,
                                            cantidad: nuevaCantidad,
                                            subtotal: bruto,
                                            subtotalSinDescuento: bruto,
                                            descuentoLinea: undefined,
                                          };
                                        })()
                                      : x
                                  );
                                  recalcItemsWithOffer(next);
                                }}
                                title="Más"
                              >
                                +
                              </Button>
                            </>
                          )}
                        </div>
                        <div className="col-span-2 text-right font-semibold text-yellow-800 dark:text-yellow-200">
                          {formatCurrencyQ(it.subtotal ?? it.cantidad * it.precioUnitario)}
                        </div>
                        <div className="col-span-1 text-right flex justify-end">
                          {isBonus ? (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300">Boni</Badge>
                          ) : (
                            <Button
                              variant="destructive"
                              size="icon"
                              className="bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-800"
                              onClick={() => {
                                const filtered = items.filter((x) => x.id !== it.id);
                                recalcItemsWithOffer(filtered);
                              }}
                              title="Quitar"
                            >
                              ✕
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
            {/* Resumen */}
            <Card className="p-0 rounded-xl shadow border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-800">
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 text-left"
                onClick={() => setSummaryOpen((v) => !v)}
              >
                <div className="font-semibold">Resumen</div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 uppercase tracking-wide">
              {showLeftPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
              </button>
              {summaryOpen && (
                <div className="p-4 space-y-3 border-t border-gray-200 dark:border-neutral-800">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>Descuento general (%)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={Number(generalDiscountPct)}
                        onChange={(e) =>
                          setDiscount(Math.max(0, Math.min(100, Number(e.target.value || 0))))
                        }
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label>Serie / Número</Label>
                      <div className="flex flex-col gap-1 text-sm text-muted-foreground border rounded-md px-3 py-2">
                        <div><span className="font-semibold text-foreground">Serie:</span> {orderSeries || "(servidor)"}</div>
                        {tempOrderPreview ? (
                          <div><span className="font-semibold text-foreground">Número temporal:</span> {tempOrderPreview}</div>
                        ) : (
                          <div><span className="font-semibold text-foreground">Número:</span> lo asigna el servidor</div>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label>Forma de pago</Label>
                      <select
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        disabled={true}
                      >
                        {["Contado", "Credito", "Transferencia", "Tarjeta", "Cheque"].map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Bodega</Label>
                      <select
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={warehouse}
                        onChange={(e) => setWarehouse(e.target.value)}
                        disabled={true}
                      >
                        {([defaultWarehouse, "01", "02", "04", "09"].filter(Boolean) as string[])
                          .filter((v, idx, arr) => arr.indexOf(v) === idx)
                          .map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <Label>Dirección</Label>
                      {addressOptions.length > 1 ? (
                        <select
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={selectedAddressId}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSelectedAddressId(val);
                            const found = addressOptions.find((a) => a.id === val);
                            if (found) {
                              setCustomerAddress(found.direccion);
                              setCustomerDept(found.departamento || "");
                              setCustomerMunicipio(found.municipio || "");
                              setCustomerContact(found.contacto || "");
                              setCustomerPhone(found.telefono || "");
                            }
                          }}
                          disabled={true}
                        >
                          {addressOptions.map((opt) => (
                            <option key={opt.id} value={opt.id}>{opt.direccion}</option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          value={customerAddress}
                          onChange={(e) => setCustomerAddress(e.target.value)}
                          placeholder="Dirección de entrega"
                          disabled={true}
                        />
                      )}
                    </div>
                    <div>
                      <Label>Departamento</Label>
                      <Input
                        value={customerDept}
                        onChange={(e) => setCustomerDept(e.target.value)}
                        placeholder="Departamento"
                        disabled={true}
                      />
                    </div>
                    <div>
                      <Label>Municipio</Label>
                      <Input
                        value={customerMunicipio}
                        onChange={(e) => setCustomerMunicipio(e.target.value)}
                        placeholder="Municipio"
                        disabled={true}
                      />
                    </div>
                    <div>
                      <Label>Contacto</Label>
                      <Input
                        value={customerContact}
                        onChange={(e) => setCustomerContact(e.target.value)}
                        placeholder="Persona de contacto"
                        disabled={true}
                      />
                    </div>
                    <div>
                      <Label>Teléfono</Label>
                      <Input
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="Teléfono de entrega"
                        disabled={true}
                      />
                    </div>
                    <div>
                      <Label>Orden de compra</Label>
                      <Input
                        value={purchaseOrder}
                        onChange={(e) => setPurchaseOrder(e.target.value)}
                        placeholder="Opcional"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Observaciones</Label>
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Mensaje u observación"
                        rows={3}
                      />
                    </div>
                  </div>
                  {items.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-muted-foreground">Detalle de productos</div>
                      <div className="divide-y divide-gray-200 dark:divide-neutral-800 rounded-md border border-gray-200 dark:border-neutral-800 overflow-hidden">
                        {comboGroups.map((group) => {
                          if (!group.items.length) return null;
                          const resolvedComboCode = pickReferenceCode(
                            group.offerCode,
                            group.comboCode,
                            group.items[0]?.codigoOferta,
                            group.items[0]?.ofertaCodigo,
                            group.items[0]?.comboCode
                          );
                          const comboCode = resolvedComboCode ?? "-";
                          const comboName = group.comboName || group.items[0]?.descripcion || "Combo/Kit";
                          const quantity = resolveComboGroupQuantity(group);
                          const gross = group.items.reduce((acc, line) => {
                            const lineGross = line.subtotalSinDescuento ?? line.subtotal ?? line.cantidad * line.precioUnitario;
                            return acc + lineGross;
                          }, 0);
                          const net = group.totalPrice;
                          const discount = Math.max(0, Math.round((gross - net) * 100) / 100);
                          const unitPrice = resolveComboGroupUnitPrice(group);
                          return (
                            <div key={`summary-${group.key}`} className="bg-yellow-50/60 dark:bg-yellow-900/20">
                              <div className="grid grid-cols-12 gap-2 px-3 py-2 text-sm">
                                <div className="col-span-5 flex items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className={group.comboType === "kit" ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-blue-300 text-blue-700 bg-blue-50"}
                                  >
                                    {group.comboType === "kit" ? "Kit" : "Combo"}
                                  </Badge>
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-foreground">{comboName}</span>
                                    <span className="text-[11px] font-mono text-muted-foreground">{comboCode} · {formatCurrencyQ(unitPrice)}</span>
                                  </div>
                                </div>
                                <div className="col-span-1 text-right text-muted-foreground">Cant: {quantity}</div>
                                <div className="col-span-2 text-right text-muted-foreground">Bruto: {formatCurrencyQ(gross)}</div>
                                <div className="col-span-2 text-right text-muted-foreground">Desc: {formatCurrencyQ(discount)}</div>
                                <div className="col-span-2 text-right font-semibold text-foreground">{formatCurrencyQ(net)}</div>
                              </div>
                              {group.items.map((line) => {
                                const detailCode = pickReferenceCode(
                                  line.codigoOferta,
                                  line.ofertaCodigo,
                                  line.comboCode,
                                  resolvedComboCode
                                ) ?? comboCode;
                                const detailProduct = productMap.get(String(line.productoId));
                                const detailName = line.descripcion || detailProduct?.descripcion || String(line.productoId);
                                return (
                                  <div
                                    key={`${line.id}-summary`}
                                    className="grid grid-cols-12 gap-2 px-3 py-1 text-xs text-muted-foreground"
                                  >
                                    <div className="col-span-5 pl-6 flex flex-col">
                                      <span className="font-medium text-muted-foreground/90">{detailName}</span>
                                      <span className="font-mono text-[11px] text-muted-foreground/70">{detailCode} · {line.productoId}</span>
                                    </div>
                                    <div className="col-span-1 text-right">Cant: {line.cantidad}</div>
                                    <div className="col-span-2" />
                                    <div className="col-span-2" />
                                    <div className="col-span-2" />
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}

                        {normalItems.map((it) => {
                          const bruto = it.subtotalSinDescuento ?? it.subtotal ?? it.cantidad * it.precioUnitario;
                          const descuento = it.descuentoLinea ?? 0;
                          const neto = it.subtotal ?? bruto;
                          const isBonus = !!it.esBonificacion;
                          const isNegotiated = !isBonus && (it.priceSource === "negotiated" || it.tipoOferta === "pricelist");
                          const badgeLabel = isBonus ? "Boni" : isNegotiated ? "Neg" : descuento > 0 ? "Desc" : undefined;
                          const badgeClass = isBonus
                            ? "border-amber-400 text-amber-700 bg-amber-50"
                            : isNegotiated
                              ? "border-emerald-400 text-emerald-700 bg-emerald-50"
                              : "border-blue-300 text-blue-700 bg-blue-50";
                          const rowHighlight = isBonus
                            ? "bg-amber-50/80 dark:bg-amber-900/10"
                            : isNegotiated
                              ? "bg-emerald-50/70 dark:bg-emerald-900/15"
                              : "";
                          return (
                            <div
                              key={it.id}
                              className={`grid grid-cols-12 gap-2 px-3 py-2 text-sm ${rowHighlight}`}
                            >
                              <div className="col-span-5 font-medium text-foreground truncate flex items-center gap-2">
                                {badgeLabel ? (
                                  <Badge variant="outline" className={badgeClass}>
                                    {badgeLabel}
                                  </Badge>
                                ) : null}
                                <span className="font-xs">{it.descripcion}</span>
                              </div>
                              <div className="col-span-1 text-right text-muted-foreground">Cant: {it.cantidad}</div>
                              <div className="col-span-2 text-right text-muted-foreground">Bruto: {formatCurrencyQ(bruto)}</div>
                              <div className="col-span-2 text-right text-muted-foreground">Desc: {formatCurrencyQ(descuento)}</div>
                              <div className="col-span-2 text-right font-semibold text-foreground">{formatCurrencyQ(neto)}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="text-right text-sm text-muted-foreground space-y-1">
                    <div>Subtotal sin descuento: {formatCurrencyQ(itemsGross)}</div>
                    <div>Bonificación: {formatCurrencyQ(bonusValue)}</div>
                    <div>Descuento por ofertas: {formatCurrencyQ(offersDiscount)}</div>
                    <div>Subtotal neto (tras ofertas): {formatCurrencyQ(itemsTotal)}</div>
                    <div>Descuento general: {formatCurrencyQ(generalDiscountAmount)}</div>
                  </div>
                  <div className="text-right text-lg font-semibold text-blue-700 dark:text-blue-300">
                    Total: {formatCurrencyQ(total)}
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Modales hijos */}
      <CustomerSelectionModal
        open={openCustomer}
        onOpenChange={setOpenCustomer}
        onPick={(c: ClienteLite) => {
          if (items.length > 0) {
            setPendingCustomerChange(c);
            setShowChangeCustomerModal(true);
            return;
          }
          setCustomer(c);
        }}
      />
      
        <ProductSelectionModal
        open={openProducts}
        onOpenChange={setOpenProducts}
        onPick={handlePickProducts}
        existingItems={existingItems}
        customer={customer}
        priceLists={priceLists}
        companyId={companyCode}
        negotiatedPrices={negotiatedPriceMap}
        />

        <ComboSelectionModal
        open={openCombos}
        onOpenChange={setOpenCombos}
        onPick={handlePickComboItems}
        disabled={!canUseCombos}
        customer={customer}
          existingItems={existingItems}
          products={productosAll}
        />

        {activePackOffer && (
          <OfferPackConfigurator
            open={!!activePackOffer}
            pack={activePackOffer}
            onOpenChange={(v) => {
              if (!v) setActivePackOffer(null);
            }}
            onConfirm={(items) => {
              handlePickComboItems(items);
              setActivePackOffer(null);
            }}
            productMap={productMap}
          />
        )}

      {/* Modal de ofertas */}
      {canUseDOM && offersOpen
        ? createPortal(
          <div
            className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/40 py-8 px-4 pointer-events-auto"
            style={{ touchAction: "pan-y" }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setOffersOpen(false);
            }}
          >
            <div
              className="bg-white dark:bg-neutral-900 rounded-xl shadow-lg w-full max-w-4xl h-[88vh] min-h-0 flex flex-col overflow-hidden"
              style={{ WebkitOverflowScrolling: "touch" }}
              onClick={(e) => e.stopPropagation()}
            >
           {/* HEADER */}
            <div className="flex-none mb-4">
              <div className="flex items-center justify-between mb-4">
                <div className="font-semibold text-lg">Ofertas aplicables</div>
                <div className="font-semibold text-sm">Asegurate de haber finalizado el pedido para aplicar las ofertas</div>
                <div className="flex items-center gap-2">
                  <Button variant="destructive" onClick={() => setOffersOpen(false)}>Cerrar</Button>
                </div>
              </div>
            </div>

            {/* TABS */}
            <div className="flex-none mb-4">
              <div className="flex items-center gap-2 mb-4">
                <Button
                  variant={offersTab === "discounts" ? "default" : "ghost"}
                  onClick={() => { setOffersTab("discounts"); setExpandedOfferId(null); setOffersTypeFilter("discount"); }}
                >
                  Descuentos ({discountOffers.length})
                </Button>
                <Button
                  variant={offersTab === "bonuses" ? "default" : "ghost"}
                  onClick={() => { setOffersTab("bonuses"); setExpandedOfferId(null); setOffersTypeFilter("bonus"); }}
                >
                  Bonificaciones ({bonusOffers.length})
                </Button>
                <Button
                  variant={offersTab === "packs" ? "default" : "ghost"}
                  onClick={() => { setOffersTab("packs"); setExpandedOfferId(null); setOffersTypeFilter("all"); }}
                >
                  Combos / Kits ({packOffers.length})
                </Button>
              </div>
            </div>

  {/* 👉 ESTA ES LA ÚNICA ZONA CON SCROLL */}
  <div
    className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1"
    style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
  >
              {offersTab === "packs" ? (
                packOffers.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    {customer
                      ? "No hay combos o kits aplicables para este cliente."
                      : "Selecciona un cliente para ver combos y kits disponibles."}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {packOffers.map((pack) => {
                      const totalUnits = pack.packConfig.cantidadTotalProductos;
                      const fixedUnits = (pack.packConfig.itemsFijos ?? []).reduce((acc, it) => acc + Number(it.unidades ?? 0), 0);
                      const variableUnits = Math.max(0, totalUnits - fixedUnits);
                      const vigencia = `${pack.offer.dates?.validFrom ?? "N/D"} → ${pack.offer.dates?.validTo ?? "N/D"}`;
                      return (
                        <div key={pack.idt} className="border rounded p-3 bg-amber-50/40 dark:bg-amber-900/10">
                          <div className="flex flex-col gap-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <Badge variant="outline" className="border-amber-400 text-amber-800 bg-amber-50">
                                  {pack._type === "combo" ? "Combo" : "Kit"}
                                </Badge>
                                <div className="font-semibold text-foreground">{pack.descripcion}</div>
                                {pack.offer.description && (
                                  <div className="text-xs text-muted-foreground">{pack.offer.description}</div>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-semibold text-amber-700">{formatCurrencyQ(pack.price ?? pack.packConfig.precioFijo)}</div>
                                <div className="text-xs text-muted-foreground">Precio fijo por pack</div>
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                              <span>{totalUnits} productos por pack</span>
                              <span>{fixedUnits} fijos</span>
                              {variableUnits > 0 && <span>{variableUnits} variables</span>}
                              <span>Vigencia: {vigencia}</span>
                            </div>
                            <div className="text-xs text-muted-foreground line-clamp-2">
                              {(pack.items || []).slice(0, 4).map((it) => it.descripcion).join(", ")}
                              {(pack.items || []).length > 4 ? "…" : ""}
                            </div>
                            <div className="flex justify-end">
                              <Button
                                variant="secondary"
                                onClick={() => setActivePackOffer(pack)}
                              >
                                Configurar
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : filteredOffersByTab.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  {offersTab === "discounts" ? "No hay descuentos aplicables para este pedido." : "No hay bonificaciones aplicables para este pedido."}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredOffersByTab.map((app, idx) => {
                    const oid = app.offer.id || app.offer.serverId || `offer-${idx}`;
                    const isBonus = app.offer.type === "bonus";
                    const discountConfig = app.offer.discount || (app.offer as any).discountConfig || {};
                    const tiers = parseTiers(discountConfig);
                    const applyPerLine = tiers.length > 0 ? true : normalizeBool((discountConfig as any).perLine ?? (discountConfig as any).byLine ?? (discountConfig as any).applyPerLine ?? (discountConfig as any).aplicarPorLinea ?? (discountConfig as any).porLinea, false);
                    const quantities = (app.applicableItems || []).map((it) => Number(it.cantidad || 0));
                    const metric = applyPerLine
                      ? (quantities.length ? Math.max(...quantities) : 0)
                      : quantities.reduce((acc, qty) => acc + qty, 0);
                    const matchedTier = pickTierForQty(tiers, metric);
                    const bonusQty = app.potentialBonusQty || 0;
                    const typeLabel = isBonus ? "Bonificación" : "Descuento";

                    return (
                      <div
                        key={oid}
                        className={`border rounded p-3 ${appliedOffers.some((o) => (o.offer.id || o.offer.serverId) === (app.offer.id || app.offer.serverId)) ? 'border-green-400 bg-green-50 dark:bg-green-900/10' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={isBonus ? 'border-amber-400 text-amber-700 bg-amber-50' : 'border-blue-300 text-blue-700 bg-blue-50'}>
                                {typeLabel}
                              </Badge>
                              <div className="font-medium">{app.offer.name}</div>
                            </div>
                            <div className="text-xs text-muted-foreground">{app.offer.description}</div>
                            {isBonus ? (
                              <div className="text-sm mt-1 text-emerald-700">
                                Bonificación estimada: {bonusQty} unds
                              </div>
                            ) : (
                              <div className="text-sm mt-1 text-emerald-700">
                                Descuento aplicable ahora: {formatCurrencyQ(app.potentialDiscount || 0)}
                              </div>
                            )}
                            {!isBonus && tiers.length > 0 && (
                              <div className="text-xs text-slate-600 mt-1">
                                Escala alcanzada ({applyPerLine ? 'por línea' : 'por mezcla'}): {describeTier(matchedTier)} {metric ? `(cantidad usada: ${metric})` : ''}
                              </div>
                            )}
                            {isBonus && app.bonusApplications?.length ? (
                              <div className="text-xs text-slate-600 mt-1">
                                Modo: {app.bonusApplications[0].mode === 'por_linea' ? 'Por línea' : 'Acumulado'} · Aplicaciones: {app.bonusApplications.length}
                              </div>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() => {
                                handleApplyOffer(app);
                                setOffersOpen(true); // mantener el modal abierto tras aplicar
                              }}
                              variant={appliedOffers.some((o) => (o.offer.id || o.offer.serverId) === (app.offer.id || app.offer.serverId)) ? 'secondary' : 'default'}
                            >
                              {appliedOffers.some((o) => (o.offer.id || o.offer.serverId) === (app.offer.id || app.offer.serverId)) ? 'Quitar' : 'Aplicar'}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setExpandedOfferId((prev) => (prev === oid ? null : oid))}
                            >
                              {expandedOfferId === oid ? 'Ocultar' : 'Detalles'}
                            </Button>
                          </div>
                        </div>

                        {expandedOfferId === oid && (
                          <div className="mt-3 rounded bg-slate-50 border border-slate-200 p-3 text-xs space-y-2">
                            <div><span className="font-semibold">Vigencia:</span> {app.offer.dates?.validFrom} → {app.offer.dates?.validTo}</div>
                            {!isBonus && (
                              <div><span className="font-semibold">Modo:</span> {applyPerLine ? 'Por línea (cada producto evalúa su escala)' : 'Por mezcla de cantidades'}</div>
                            )}
                            {isBonus && app.bonusApplications?.length ? (
                              <div>
                                <span className="font-semibold">Bonificación:</span>
                                <ul className="list-disc list-inside mt-1 space-y-1">
                                  {app.bonusApplications.map((b, i) => (
                                    <li key={i}>+{b.bonusQty} unds · {b.mode === 'por_linea' ? 'por línea' : 'acumulado'}{b.resolvedProductId ? ` → SKU ${b.resolvedProductId}` : ' (requiere selección)'}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                            {!isBonus && tiers.length > 0 && (
                              <div>
                                <span className="font-semibold">Escalas:</span>
                                <ul className="list-disc list-inside mt-1 space-y-1">
                                  {tiers.map((t: any, i: number) => (
                                    <li key={i}>
                                      {describeTier(t)}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {app.offer.scope && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {app.offer.scope.codigosProducto?.length ? (
                                  <div><span className="font-semibold">Productos:</span> {app.offer.scope.codigosProducto.join(', ')}</div>
                                ) : null}
                                {app.offer.scope.canales?.length ? (
                                  <div><span className="font-semibold">Canales:</span> {app.offer.scope.canales.join(', ')}</div>
                                ) : null}
                                {app.offer.scope.subCanales?.length ? (
                                  <div><span className="font-semibold">Sub-canales:</span> {app.offer.scope.subCanales.join(', ')}</div>
                                ) : null}
                                {app.offer.scope.codigosCliente?.length ? (
                                  <div><span className="font-semibold">Clientes:</span> {app.offer.scope.codigosCliente.join(', ')}</div>
                                ) : null}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            </div>
          </div>,
          document.body,
        )
        : null}

{showChangeCustomerModal && pendingCustomerChange && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-lg p-6 w-full max-w-sm">
      <div className="font-semibold text-lg mb-2">Cambiar cliente</div>
      <div className="mb-4 text-sm text-muted-foreground">
        Cambiar el cliente a <span className="font-semibold text-foreground">{pendingCustomerChange.nombreCliente}</span> borrará el detalle y las ofertas aplicadas. ¿Deseas continuar?
      </div>
      <div className="flex justify-end gap-2">
        <Button
          variant="secondary"
          onClick={cancelCustomerChange}
        >
          Mantener pedido
        </Button>
        <Button
          variant="destructive"
          onClick={confirmCustomerChange}
        >
          Cambiar cliente
        </Button>
      </div>
    </div>
  </div>
)}

{showCloseModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-lg p-6 w-full max-w-lg">
      <div className="font-semibold text-lg mb-2">¿Cerrar pedido?</div>
      <div className="mb-4 text-sm text-muted-foreground">
        ¿Quieres guardar el pedido como pendiente para continuarlo después?
      </div>
      <div className="flex justify-end gap-2">
        <Button
          variant="secondary"
          onClick={() => setShowCloseModal(false)}
        >
          Cancelar
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            setShowCloseModal(false);
            localStorage.removeItem("pedido_draft");
            onClose();
          }}
        >
          No, descartar
        </Button>
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow"
          onClick={() => {
            setShowCloseModal(false);
            onClose();
          }}
        >
          Sí, Continuar
        </Button>
      </div>
    </div>
  </div>
)}

{typeof document !== "undefined" && showBonusPicker && pendingBonus
  ? createPortal(
      <div
        className="fixed inset-0 z-[100002] flex items-start justify-center bg-black/40 py-6 px-3 pointer-events-auto overflow-y-auto overscroll-contain"
        style={{ touchAction: "pan-y", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowBonusPicker(false);
            setPendingBonus(null);
          }
        }}
      >
        <div
          className="bg-white dark:bg-neutral-900 rounded-xl shadow-lg w-full max-w-3xl max-h-[85vh] min-h-[45vh] flex flex-col min-h-0 p-6 pointer-events-auto overflow-y-auto md:overflow-hidden"
          style={{ maxHeight: "calc(100vh - 2.5rem)", WebkitOverflowScrolling: "touch" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between mb-3 gap-4 flex-none sticky top-0 bg-white dark:bg-neutral-900 z-10 pb-2">
            <div>
              <div className="font-semibold text-lg">Bonificar</div>
            </div>
            <div className="text-sm font-semibold text-blue-700 dark:text-blue-300 whitespace-nowrap">
              Total a bonificar: {totalBonusToAssign} uds
            </div>
          </div>

          <div
            className="flex-1 overflow-y-auto pr-1 min-h-0 pb-6 touch-pan-y"
            style={{
              touchAction: "pan-y",
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: "contain",
              maxHeight: "max(260px, calc(100vh - 18rem))",
            }}
          >
            {bonusOptions.length === 0 ? (
              <div className="text-sm text-red-600">No se encontraron productos para bonificar en el alcance definido.</div>
            ) : (
              <>
                <div className="space-y-2 mb-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Buscar por SKU o descripción"
                      value={bonusSearch}
                      onChange={(e) => setBonusSearch(e.target.value)}
                    />
                  </div>
                </div>

                {filteredBonusOptions.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Sin coincidencias para los filtros seleccionados.</div>
                ) : (
                  <div className="space-y-2 pb-2">
                    {filteredBonusOptions.map((p) => {
                      const current = Number(bonusDraftQuantities[p.codigoProducto] || 0);
                      return (
                        <div key={p.codigoProducto} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
                          <div className="flex-1">
                            <div className="font-medium text-sm text-foreground">{p.descripcion || p.codigoProducto}</div>
                            <div className="text-xs text-muted-foreground">SKU {p.codigoProducto} </div>
                            <div className="text-[11px] text-muted-foreground flex gap-2 flex-wrap">
                              {p.proveedor ? <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">{p.proveedor}</span> : null}
                              {p.filtroVenta ? <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">{p.filtroVenta}</span> : null}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => {
                                  updateBonusDraftQuantity(p.codigoProducto, current - 1);
                                }}
                              >
                                -
                              </Button>
                              <Input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                className="w-16 text-center"
                                value={Number.isFinite(current) ? current : 0}
                                onChange={(e) => {
                                  const nextVal = Number(e.target.value);
                                  updateBonusDraftQuantity(p.codigoProducto, isNaN(nextVal) ? 0 : nextVal);
                                }}
                                onBlur={(e) => {
                                  const nextVal = Number(e.target.value);
                                  updateBonusDraftQuantity(p.codigoProducto, isNaN(nextVal) ? 0 : nextVal);
                                }}
                              />
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => {
                                  updateBonusDraftQuantity(p.codigoProducto, current + 1);
                                }}
                              >
                                +
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex justify-between items-center py-3 border-t mt-3 text-sm text-muted-foreground flex-none sticky bottom-16 bg-white dark:bg-neutral-900">
            <span>Asigna las unidades hasta completar el total bonificado.</span>
            <span className="font-medium text-foreground">
              Asignado: {assignedBonusQty} uds · Pendiente: {Math.max(totalBonusToAssign - assignedBonusQty, 0)} uds
            </span>
          </div>

          <div className="flex justify-end gap-2 flex-none sticky bottom-4 bg-white dark:bg-neutral-900 pt-3 pb-1">
            <Button variant="secondary" onClick={() => { setShowBonusPicker(false); setPendingBonus(null); }}>
              Cancelar
            </Button>
            <Button
              disabled={bonusOptions.length === 0 || assignedBonusQty === 0 || assignedBonusQty !== totalBonusToAssign}
              onClick={() => {
                if (!pendingBonus) return;
                const promoId = pendingBonus.app.offer.id || pendingBonus.app.offer.serverId || pendingBonus.app.offer.name;
                const applications = pendingBonus.applications;
                const totalBonus = applications.reduce((acc, a) => acc + a.bonusQty, 0);
                const quantities = pendingBonus.draftQuantities || {};
                const assignedTotal = assignedBonusQty;
                if (assignedTotal === 0) return;

                const bonusLines: OrderItem[] = [];
                let remaining = totalBonus;
                Object.entries(quantities).forEach(([pid, qtyRaw]) => {
                  const qty = Math.min(Number(qtyRaw || 0), Math.max(remaining, 0));
                  if (!qty) return;
                  const prod = productosAll.find((p) => String(p.codigoProducto) === String(pid));
                  const priceInfo = resolveBonusUnitPrice(String(pid), prod);
                  const price = priceInfo.price;
                  const bruto = Math.round(price * qty * 100) / 100;
                  const codigoProveedor = prod?.codigoProveedor != null ? String(prod.codigoProveedor) : undefined;
                  const nombreProveedor = prod?.proveedor ?? undefined;
                  const codigoLinea = prod?.codigoLinea ?? prod?.codigoFiltroVenta ?? (prod as any)?.lineaVenta ?? undefined;
                  const nombreLinea = prod?.linea ?? prod?.filtroVenta ?? undefined;
                  const offerCode = pickReferenceCode(
                    pendingBonus.app.offer.codigoOferta,
                    pendingBonus.app.offer.referenceCode,
                    (pendingBonus.app.offer as any)?.codigoReferencia,
                    (pendingBonus.app.offer as any)?.codigoOferta,
                    pendingBonus.app.offer.id,
                    pendingBonus.app.offer.serverId
                  );
                  const relatedApplications = applications.filter((ap) => {
                    if (!ap.resolvedProductId) return true;
                    return String(ap.resolvedProductId) === String(pid);
                  });
                  const sourceIds = relatedApplications.flatMap((ap) => (ap.sourceItemIds || []).map((sid) => String(sid)));
                  const resolvedParentId = sourceIds
                    .map((sid) => items.find((it) => it.id === sid || String(it.productoId) === sid)?.id)
                    .find((val): val is string => Boolean(val));
                  remaining -= qty;
                  bonusLines.push({
                    id: `${promoId}-bonus-${pid}-${Date.now()}`,
                    productoId: pid,
                    descripcion: prod?.descripcion || `Descuento por bonificación – ${pendingBonus.app.offer.name}`,
                    cantidad: qty,
                    precioUnitario: price,
                    subtotalSinDescuento: bruto,
                    subtotal: 0,
                    descuentoLinea: bruto,
                    total: 0,
                    esBonificacion: true,
                    promoBonificacionId: promoId,
                    ofertaIdAplicada: promoId,
                    ofertaNombre: pendingBonus.app.offer.name,
                    tipoOferta: "bonus",
                    ofertaCodigo: offerCode ?? null,
                    codigoOferta: offerCode ?? null,
                    priceSource: priceInfo.priceSource,
                    priceListName: priceInfo.priceListName,
                    priceListCode: priceInfo.priceListCode,
                    codigoProveedor: codigoProveedor ?? null,
                    nombreProveedor: nombreProveedor ?? null,
                    codigoLinea: codigoLinea ?? null,
                    nombreLinea: nombreLinea ?? null,
                    parentItemId: resolvedParentId ?? null,
                    relatedItemIds: sourceIds.length ? sourceIds : undefined,
                  });
                });

                if (bonusLines.length) {
                  setItems((prev) => [...prev, ...bonusLines]);
                  setAppliedOffers((prev) => [...prev, { ...pendingBonus.app, potentialDiscount: 0, potentialBonusQty: bonusLines.reduce((acc, b) => acc + b.cantidad, 0) }]);
                }
                setShowBonusPicker(false);
                setPendingBonus(null);
              }}
            >
              Aplicar bonificación
            </Button>
          </div>
        </div>
      </div>,
      document.body,
    )
  : null}


    </div>

  );
}
