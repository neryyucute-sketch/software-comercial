// components/order/OrderFormFull.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useOrders } from "@/contexts/OrdersContext";
import type { Order, OrderItem } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { getApplicableOffers, ApplicableOffer, type BonusApplication } from "@/lib/offers-engine";
import type { OfferDef, DiscountTier } from "@/lib/types.offers";
import type { Product, Cliente } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MapPin, Camera, Gift, Package, User, Search } from "lucide-react";
import CustomerSelectionModal from "./modals/CustomerSelectionModal";
import ProductSelectionModal from "./modals/ProductSelectionModal";
import ComboSelectionModal from "./modals/ComboSelectionModal";
import OrderPhotos from "./OrderPhotos";
import { db } from "@/lib/db";
import { useToast } from "@/hooks/use-toast";

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

  for (const offer of offers) {
    const { pct, fixed } = extractDiscountConfig(offer.offer);
    const applicableIds = new Set((offer.applicableItems || []).map((it) => it.productoId));

    let offerDisc = 0;

    working.forEach((it) => {
      if (!applicableIds.has(it.productoId)) return;
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
    const base = Math.max(it.subtotalSinDescuento ?? 0, it.subtotal ?? 0, it.cantidad * it.precioUnitario);
    let pctSum = 0;
    let fixedSum = 0;

    offers.forEach((offer) => {
      const applicableIds = new Set((offer.applicableItems || []).map((ai) => ai.productoId));
      if (!applicableIds.has(it.productoId)) return;
      const { pct, fixed } = extractDiscountConfig(offer.offer);
      if (pct !== undefined && !isNaN(pct)) pctSum += pct;
      if (fixed !== undefined && !isNaN(fixed)) fixedSum += fixed;
    });

    const pctTotal = Math.min(100, Math.max(0, pctSum));
    const lineDisc = (base * pctTotal) / 100 + Math.max(0, fixedSum) * it.cantidad;
    const net = Math.max(0, base - lineDisc);
    return {
      ...it,
      subtotalSinDescuento: base,
      descuentoLinea: lineDisc,
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

function itemMatchesOffer(item: OrderItem, offer: OfferDef, productsAll: Product[]): boolean {
  const producto = productsAll.find((p) => String(p.codigoProducto) === String(item.productoId));
  const scope = offer.scope || {};

  if (offer.products?.length && offer.products.includes(item.productoId)) return true;
  if (scope.codigosProducto?.length && scope.codigosProducto.includes(item.productoId)) return true;

  if (!producto) return false;

  const proveedor = String(producto.codigoProveedor ?? "");
  const familia = String(producto.codigoFamilia ?? producto.familia ?? "");
  const subfamilia = String(producto.codigoSubfamilia ?? producto.subfamilia ?? "");
  const linea = String(producto.codigoLinea ?? producto.codigoFiltroVenta ?? (producto as any).lineaVenta ?? producto.linea ?? "");

  if (scope.codigosProveedor?.length && scope.codigosProveedor.includes(proveedor)) return true;
  if (scope.codigosFamilia?.length && scope.codigosFamilia.includes(familia)) return true;
  if (scope.codigosSubfamilia?.length && scope.codigosSubfamilia.includes(subfamilia)) return true;
  if (scope.codigosLinea?.length && scope.codigosLinea.includes(linea)) return true;

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

type ClienteLite = {
  codigoCliente: string;
  nombreCliente: string;
  nit?: string;
  tipoCliente?: string;
};

export default function OrderFormFull({ onClose, draft, open }: { onClose: () => void; draft?: any; open: boolean }) {
  const { addOrder } = useOrders();

  const [customer, setCustomer] = useState<ClienteLite | null>(null);
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

  const [photos, setPhotos] = useState<{ id: string; dataUrl: string; timestamp: number }[]>([]);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  const [openCustomer, setOpenCustomer] = useState(false);
  const [openProducts, setOpenProducts] = useState(false);
  const [openCombos, setOpenCombos] = useState(false);

  // Ofertas
  const [allOffers, setAllOffers] = useState<OfferDef[]>([]);
  const [productosAll, setProductosAll] = useState<Product[]>([]);
  const [applicableOffers, setApplicableOffers] = useState<ApplicableOffer[]>([]);
  const [offersOpen, setOffersOpen] = useState(false);
  const [expandedOfferId, setExpandedOfferId] = useState<string | null>(null);
  const [appliedOffers, setAppliedOffers] = useState<ApplicableOffer[]>([]);
  const [offersTab, setOffersTab] = useState<"discounts" | "bonuses">("discounts");
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

  const { toast } = useToast();
  const bonusAlertKeyRef = useRef<string>("");
  const bonusDraftQuantities = pendingBonus?.draftQuantities || {};
  const totalBonusToAssign = pendingBonus?.applications.reduce((acc, a) => acc + a.bonusQty, 0) || 0;
  const assignedBonusQty = Object.values(bonusDraftQuantities).reduce((acc: number, v: any) => acc + Number(v || 0), 0);

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

  const filteredOffersByTab = useMemo(() => {
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

  const existingItems = useMemo(
    () => items.reduce<Record<string, number>>((acc, it) => {
        acc[it.productoId] = (acc[it.productoId] || 0) + it.cantidad;
        return acc;
    }, {}),
    [items]
    );  

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
    if (!customer) return;
    (async () => {
      const c = await db.clientes.where("codigoCliente").equals(customer.codigoCliente).first();
      if (c && c.canalVenta && c.canalVenta !== customer.tipoCliente) {
        setCustomer((prev) => (prev ? { ...prev, tipoCliente: c.canalVenta as any } : prev));
      }
      if (c) {
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
      }
    })();
  }, [customer?.codigoCliente, selectedAddressId]);

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

  const canUseCombos = !!customer && customer.tipoCliente === "Mayorista";
  const canSave = !!customer && items.length > 0;

  const handlePickProducts = (newItems: OrderItem[]) => {
    const next = [...items];
    for (const ni of newItems) {
      const idx = next.findIndex(
        (x) => x.productoId === ni.productoId && !x.comboId && !x.kitId
      );
      if (idx >= 0) {
        const mergedQty = next[idx].cantidad + ni.cantidad;
        const bruto = Math.round(mergedQty * next[idx].precioUnitario * 100) / 100;
        next[idx] = {
          ...next[idx],
          cantidad: mergedQty,
          subtotal: bruto,
          subtotalSinDescuento: bruto,
        };
      } else {
        const bruto = Math.round(ni.cantidad * ni.precioUnitario * 100) / 100;
        next.push({ ...ni, subtotal: bruto, subtotalSinDescuento: bruto });
      }
    }
    recalcItemsWithOffer(next);
  };

  const handlePickComboItems = (comboItems: OrderItem[]) => {
    const prepared = comboItems.map((it) => {
      const bruto = Math.round(it.cantidad * it.precioUnitario * 100) / 100;
      return { ...it, subtotal: bruto, subtotalSinDescuento: bruto };
    });
    recalcItemsWithOffer([...items, ...prepared]);
  };

  const onConfirm = async () => {
    if (!canSave) return;
    try {
      const localId = uuidSimple();
      const codigoEmpresa = user?.usuarioConfiguracion?.find((i: any) => i.configuracion === "CODIGO_VENDEDOR")?.codigoEmpresa ?? "E01";
      const codigoVendedor = user?.usuarioConfiguracion?.find((i: any) => i.configuracion === "CODIGO_VENDEDOR")?.valor ?? "";
      const onlineStatus = typeof navigator !== "undefined" ? navigator.onLine : true;
      const numeroPedidoTemporal = onlineStatus ? undefined : nextTempOrderNumber(codigoVendedor, orderSeries, codigoEmpresa);

      const payload: Omit<Order, "id" | "status" | "synced" | "attempts" | "createdAt"> = {
        localId,
        serverId: null,
        codigoEmpresa,
        codigoVendedor,
        seriePedido: orderSeries,
        nombreVendedor: user?.nombre || user?.nombre || codigoVendedor,
        fecha: new Date().toISOString(),
        estado: "ingresado",
        codigoCliente: customer!.codigoCliente,
        nombreCliente: customer?.nombreCliente,
        nombreClienteEnvio: customer?.nombreCliente,
        items,
        discount,
        subtotal: itemsTotal,
        total,
        ordenCompra: purchaseOrder || undefined,
        observaciones: notes || undefined,
        direccionEntrega: customerAddress || undefined,
        departamento: customerDept || undefined,
        municipio: customerMunicipio || undefined,
        formaPago: paymentMethod || undefined,
        bodega: warehouse || defaultWarehouse || undefined,
        telefonoEntrega: customerPhone || undefined,
        contactoEntrega: customerContact || undefined,
        numeroPedidoTemporal,
        // Incluir metadata de oferta si existe (se mantiene compatibilidad con el primer elemento)
        ofertaAplicada: appliedOffers[0]
          ? {
              uuidOferta: appliedOffers[0].offer.serverId || appliedOffers[0].offer.id,
              nombreOferta: appliedOffers[0].offer.name,
              tipoOferta: appliedOffers[0].offer.type,
              descuentoPorcentaje: appliedOffers[0].offer.discount?.type === "percentage" ? (appliedOffers[0].offer.discount?.value as any) : undefined,
              descuentoMonto: appliedOffers.reduce((acc, o) => acc + (o.potentialDiscount || 0), 0),
            }
          : undefined,
        descuentoTotal: Math.max(0, offersDiscount + generalDiscountAmount),
        subtotalSinDescuento: itemsGross || undefined,
        notes,
        photos,
        location,
      };
      await addOrder(payload);
      // await syncOrders();
    } catch (e) {
      console.error("Error al guardar el pedido:", e);
    } finally {
      localStorage.removeItem("pedido_draft"); // <-- limpia el draft
      onClose();
    }
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

        const options = productosAll.filter((p) => {
          const lineaVal = String(p.codigoLinea ?? p.codigoFiltroVenta ?? (p as any).lineaVenta ?? "");
          const famVal = String(p.codigoFamilia ?? p.familia ?? "");
          const provVal = String((p as any).codigoProveedor ?? "");

          const lineaMatch = lineaIds.length
            ? lineaIds.some((id) => lineaVal === id || lineaVal.includes(id))
            : target.lineaId
              ? (lineaVal === String(target.lineaId) || lineaVal.includes(String(target.lineaId)))
              : false;

          const famMatch = famIds.length
            ? famIds.some((id) => famVal === id || famVal.includes(id))
            : target.familiaId
              ? (famVal === String(target.familiaId) || famVal.includes(String(target.familiaId)))
              : false;

          const provMatch = provIds.length
            ? provIds.some((id) => provVal === id || provVal.includes(id))
            : (target as any).proveedorId
              ? (provVal === String((target as any).proveedorId) || provVal.includes(String((target as any).proveedorId)))
              : false;

          return lineaMatch || famMatch || provMatch;
        });
        setBonusOptions(options);
        const totalBonusQty = applications.reduce((acc, a) => acc + a.bonusQty, 0);
        const defaultPid = options[0]?.codigoProducto;
        const draft: Record<string, number> = defaultPid ? { [defaultPid]: totalBonusQty } : {};
        setPendingBonus({ app, applications, draftQuantities: draft });
        setShowBonusPicker(true);
        return;
      }

      const bonusLines: OrderItem[] = [];
      applications.forEach((ap, idx) => {
        const targetPid = ap.resolvedProductId;
        if (!targetPid) return;
        const prod = productosAll.find((p) => String(p.codigoProducto) === String(targetPid));
        const qty = ap.bonusQty;
        const price = prod?.precio ?? 0;
        const bruto = Math.round(price * qty * 100) / 100;
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

  return (
    // 👇 Contenedor principal con fondo y padding
    <div className="flex h-full flex-col bg-gray-50 dark:bg-neutral-900 rounded-xl shadow-lg border border-gray-200 dark:border-neutral-800">
      {/* Header sticky */}
      <div
        className="sticky top-0 z-10 bg-white/95 dark:bg-neutral-900/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-neutral-900/60 border-b border-gray-200 dark:border-neutral-800"
      >
        <div className="flex items-center justify-between px-4 py-3">
          <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 border-blue-200 dark:border-blue-800">
            Nuevo Pedido
          </Badge>
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
              onClick={onConfirm}
              disabled={!canSave}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow"
            >
              Confirmar · Q{total.toFixed(2)}
            </Button>
          </div>
        </div>
      </div>

      {/* Cuerpo con scroll interno */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-4">
        {/* Layout responsive: una columna en móvil, 2/3 en desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Columna izquierda (arriba en móvil) */}
          <div className="space-y-3">

            {/* Geolocalización */}
          <Card className="p-4 space-y-3 rounded-xl shadow border border-green-100 dark:border-green-900 bg-white dark:bg-neutral-800">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-green-600" />
              <div className="font-semibold text-green-900 dark:text-green-100">Geoposición</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-x">
                {gpsLoading ? (
                  <span className="flex items-center gap-2 text-green-600">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Obteniendo ubicación…
                  </span>
                ) : location ? (
                  <span className="text-green-600">Ubicación capturada ✓</span>
                ) : (
                  <span className="text-muted-foreground">Sin capturar</span>
                )}
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={captureGeo}
                disabled={gpsLoading}
              >
                {gpsLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Cargando…
                  </span>
                ) : (
                  "Obtener"
                )}
              </Button>
            </div>
            {location && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>lat: <span className="font-mono text-green-800 dark:text-green-200">{location.lat.toFixed(5)}</span></span>
                  <span>lng: <span className="font-mono text-green-800 dark:text-green-200">{location.lng.toFixed(5)}</span></span>
                </div>
                {/* Mini-mapa estático */}
                <div className="rounded-lg overflow-hidden border border-green-200 dark:border-green-800 shadow w-full max-w-xs">
                </div>
                {/* Link a Google Maps */}
                <a
                  href={`https://maps.google.com/?q=${location.lat},${location.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-green-700 dark:text-green-300 hover:underline text-xs font-medium mt-1"
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

          {/* Columna derecha (abajo en móvil) */}
          <div className="lg:col-span-2 space-y-3">
            {/* Productos / Combos */}
            <Card className="p-4 space-y-3 rounded-xl shadow border border-yellow-100 dark:border-yellow-900 bg-white dark:bg-neutral-800">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-yellow-600" />
                  <div className="font-semibold text-yellow-900 dark:text-yellow-100">
                    Productos / Combos / Kits
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={() => setOpenProducts(true)} disabled={!customer}>
                    Agregar productos
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setOpenCombos(true)}
                    disabled={!canUseCombos || !customer}
                  >
                    <Gift className="w-4 h-4 mr-1 text-pink-600" /> Combos / Kits
                  </Button>
                </div>
              </div>

              {items.length === 0 && (
                <div className="text-sm text-muted-foreground">Aún no hay ítems agregados.</div>
              )}
              {items.map((it) => {
                const isBonus = !!it.esBonificacion;
                const canDecrease = it.cantidad > 1 && !isBonus; // evitamos bajar/romper bonificaciones
                return (
                  <div
                    key={it.id}
                    className={`grid grid-cols-12 gap-2 items-center border rounded-lg p-2 shadow-sm ${
                      isBonus ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/15 dark:border-amber-800' : 'bg-yellow-50 dark:bg-yellow-900/20'
                    }`}
                  >
                    <div className="col-span-5 space-y-1">
                      <div className="font-medium flex items-center gap-2">
                        {isBonus ? (
                          <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50">Boni</Badge>
                        ) : null}
                        <span>{it.descripcion}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Precio: Q{it.precioUnitario.toFixed(2)}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Bruto: Q{(it.subtotalSinDescuento ?? it.cantidad * it.precioUnitario).toFixed(2)}
                        {it.descuentoLinea ? ` · Desc: Q${it.descuentoLinea.toFixed(2)}` : ""}
                        {it.descuentoLinea ? ` · Neto: Q${(it.subtotal ?? it.cantidad * it.precioUnitario).toFixed(2)}` : ""}
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
                      Q{(it.subtotal ?? it.cantidad * it.precioUnitario).toFixed(2)}
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
            </Card>

            {/* Resumen */}
            <Card className="p-0 rounded-xl shadow border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-800">
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 text-left"
                onClick={() => setSummaryOpen((v) => !v)}
              >
                <div className="font-semibold">Resumen</div>
                <span className="text-sm text-muted-foreground">{summaryOpen ? "Ocultar" : "Mostrar"}</span>
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
                      <Label>Orden de compra</Label>
                      <Input
                        value={purchaseOrder}
                        onChange={(e) => setPurchaseOrder(e.target.value)}
                        placeholder="Opcional"
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
                        />
                      )}
                    </div>
                    <div>
                      <Label>Departamento</Label>
                      <Input
                        value={customerDept}
                        onChange={(e) => setCustomerDept(e.target.value)}
                        placeholder="Departamento"
                      />
                    </div>
                    <div>
                      <Label>Municipio</Label>
                      <Input
                        value={customerMunicipio}
                        onChange={(e) => setCustomerMunicipio(e.target.value)}
                        placeholder="Municipio"
                      />
                    </div>
                    <div>
                      <Label>Contacto</Label>
                      <Input
                        value={customerContact}
                        onChange={(e) => setCustomerContact(e.target.value)}
                        placeholder="Persona de contacto"
                      />
                    </div>
                    <div>
                      <Label>Teléfono</Label>
                      <Input
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="Teléfono de entrega"
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
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-muted-foreground">Detalle de productos</div>
                      <div className="divide-y divide-gray-200 dark:divide-neutral-800 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden">
                        {items.map((it) => {
                          const bruto = it.subtotalSinDescuento ?? it.subtotal ?? it.cantidad * it.precioUnitario;
                          const descuento = it.descuentoLinea ?? 0;
                          const neto = it.subtotal ?? bruto;
                          const isBonus = !!it.esBonificacion;
                          const badgeLabel = isBonus ? "Boni" : descuento > 0 ? "Desc" : undefined;
                          return (
                            <div
                              key={it.id}
                              className={`grid grid-cols-12 gap-2 px-3 py-2 text-sm ${isBonus ? 'bg-amber-50/80 dark:bg-amber-900/10' : ''}`}
                            >
                              <div className="col-span-5 font-medium text-foreground truncate flex items-center gap-2">
                                {badgeLabel ? (
                                  <Badge variant="outline" className={isBonus ? 'border-amber-400 text-amber-700 bg-amber-50' : 'border-blue-300 text-blue-700 bg-blue-50'}>
                                    {badgeLabel}
                                  </Badge>
                                ) : null}
                                <span className="truncate">{it.descripcion}</span>
                              </div>
                              <div className="col-span-2 text-right text-muted-foreground">Cant: {it.cantidad}</div>
                              <div className="col-span-2 text-right text-muted-foreground">Bruto: Q{bruto.toFixed(2)}</div>
                              <div className="col-span-2 text-right text-muted-foreground">Desc: Q{descuento.toFixed(2)}</div>
                              <div className="col-span-1 text-right font-semibold text-foreground">Q{neto.toFixed(2)}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="text-right text-sm text-muted-foreground space-y-1">
                    <div>Subtotal sin descuento: Q{itemsGross.toFixed(2)}</div>
                    <div>Bonificación: Q{bonusValue.toFixed(2)}</div>
                    <div>Descuento por ofertas: Q{offersDiscount.toFixed(2)}</div>
                    <div>Subtotal neto (tras ofertas): Q{itemsTotal.toFixed(2)}</div>
                    <div>Descuento general: Q{generalDiscountAmount.toFixed(2)}</div>
                  </div>
                  <div className="text-right text-lg font-semibold text-blue-700 dark:text-blue-300">
                    Total: Q{total.toFixed(2)}
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
        />

        <ComboSelectionModal
        open={openCombos}
        onOpenChange={setOpenCombos}
        onPick={handlePickComboItems}
        disabled={!canUseCombos}
        customer={customer}
        existingItems={existingItems}
        />

      {/* Modal de ofertas */}
      {offersOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8 px-4">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-lg p-6 w-full max-w-4xl max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="font-semibold text-lg">Ofertas aplicables</div>
              <div className="font-semibold text-sm">Asegurate de haber finalizado tu pedido para aplicar las ofertas</div>
              <div className="flex items-center gap-2">
                <Button variant="destructive" onClick={() => setOffersOpen(false)}>Cerrar</Button>
              </div>
            </div>

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
            </div>

            {filteredOffersByTab.length === 0 ? (
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
                              Descuento aplicable ahora: Q{(app.potentialDiscount || 0).toFixed(2)}
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
      )}

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
          No, mejor descartar
        </Button>
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow"
          onClick={() => {
            setShowCloseModal(false);
            onClose();
          }}
        >
          Sí, continuar después
        </Button>
      </div>
    </div>
  </div>
)}

{showBonusPicker && pendingBonus && (
  <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-6 px-3">
    <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-lg w-full max-w-3xl max-h-[55vh] min-h-[35vh] flex flex-col overflow-hidden p-6">
      <div className="flex items-start justify-between mb-3 gap-4 flex-none sticky top-0 bg-white dark:bg-neutral-900 z-10 pb-2">
        <div>
          <div className="font-semibold text-lg">Selecciona productos a bonificar</div>
          <div className="text-sm text-muted-foreground">Distribuye la cantidad bonificada total entre los SKUs del alcance.</div>
        </div>
        <div className="text-sm font-semibold text-blue-700 dark:text-blue-300 whitespace-nowrap">
          Total a bonificar: {totalBonusToAssign} uds
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 min-h-0 pb-6">
        {bonusOptions.length === 0 ? (
          <div className="text-sm text-red-600">No se encontraron productos para bonificar en el alcance definido.</div>
        ) : (
          <>
            <div className="space-y-2 mb-3">
              <div className="flex flex-wrap gap-2">
                {bonusProviders.map((prov) => (
                  <button
                    key={prov.id}
                    onClick={() => {
                      const next = bonusProviderFilter === prov.id ? null : prov.id;
                      setBonusProviderFilter(next);
                      setBonusLineFilter(null);
                    }}
                    className={`px-3 py-1.5 rounded-full text-sm border transition ${bonusProviderFilter === prov.id ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-muted text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground'}`}
                  >
                    {prov.label} {typeof prov.count === 'number' ? `(${prov.count})` : ''}
                  </button>
                ))}
              </div>
              {bonusProviderFilter && bonusLines.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {bonusLines.map((line) => (
                    <button
                      key={line.id}
                      onClick={() => setBonusLineFilter(bonusLineFilter === line.id ? null : line.id)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition ${bonusLineFilter === line.id ? 'bg-yellow-100 text-yellow-800 border-yellow-300' : 'bg-muted text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground'}`}
                    >
                      {line.label} {typeof line.count === 'number' ? `(${line.count})` : ''}
                    </button>
                  ))}
                </div>
              )}
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
                        <div className="text-xs text-muted-foreground">SKU {p.codigoProducto} · Precio: Q{(p.precio ?? 0).toFixed(2)}</div>
                        <div className="text-[11px] text-muted-foreground flex gap-2 flex-wrap">
                          {p.proveedor ? <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">{p.proveedor}</span> : null}
                          {p.filtroVenta ? <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">{p.filtroVenta}</span> : null}
                        </div>
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
              const price = prod?.precio ?? 0;
              const bruto = Math.round(price * qty * 100) / 100;
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
  </div>
)}


    </div>

  );
}
