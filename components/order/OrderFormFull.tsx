// components/order/OrderFormFull.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useOrders } from "@/contexts/OrdersContext";
import type { Order, OrderItem } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { getApplicableOffers, ApplicableOffer } from "@/lib/offers-engine";
import type { OfferDef } from "@/lib/types.offers";
import type { Product, Cliente } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MapPin, Camera, Gift, Package, User } from "lucide-react";
import CustomerSelectionModal from "./modals/CustomerSelectionModal";
import ProductSelectionModal from "./modals/ProductSelectionModal";
import ComboSelectionModal from "./modals/ComboSelectionModal";
import OrderPhotos from "./OrderPhotos";
import { db } from "@/lib/db";
import { useRef } from "react";

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

  // Aplicar descuentos combinados por ítem en un solo paso
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
  // Busca el producto en catálogo para evaluar scope
  const producto = productsAll.find((p) => String(p.codigoProducto) === String(item.productoId));
  const scope = offer.scope || {};

  // Producto explícito
  if (offer.products?.length && offer.products.includes(item.productoId)) return true;
  if (scope.codigosProducto?.length && scope.codigosProducto.includes(item.productoId)) return true;

  if (!producto) return false;

  const proveedor = String(producto.codigoProveedor ?? "");
  const familia = String(producto.codigoFamilia ?? producto.familia ?? "");
  const subfamilia = String(producto.codigoSubfamilia ?? producto.subfamilia ?? "");
  const linea = String(producto.codigoLinea ?? producto.codigoFiltroVenta ?? producto.linea ?? "");

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
  // Por omisión permitimos combinar si no se especifica (tolerante a ofertas antiguas sin campo)
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

  // Si ya está aplicada, la quitamos
  if (current.some((o) => (o.offer.id || o.offer.serverId) === targetId)) {
    return current.filter((o) => (o.offer.id || o.offer.serverId) !== targetId);
  }

  // Rebuild applicableItems for current list against clean items
  const rebuiltCurrent = current.map((o) => ({
    ...o,
    applicableItems: cleanItems.filter((it) => itemMatchesOffer(it, o.offer, productosAll)),
  }));

  const targetWithItems = {
    ...target,
    applicableItems: cleanItems.filter((it) => itemMatchesOffer(it, target.offer, productosAll)),
  };

  // Filtrar ofertas que chocan con la nueva y no son stackable
  const filtered = rebuiltCurrent.filter((o) => {
    const overlap = offersOverlap(o, targetWithItems);
    if (!overlap) return true;
    if (isStackableWithSameProduct(o.offer) && isStackableWithSameProduct(targetWithItems.offer)) return true;
    return false; // se elimina porque no se puede combinar
  });

  return [...filtered, targetWithItems];
}

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
  const [appliedOffers, setAppliedOffers] = useState<ApplicableOffer[]>([]);

  const [gpsLoading, setGpsLoading] = useState(false);
  const gpsRequested = useRef(false);
  const [showCloseModal, setShowCloseModal] = useState(false);

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

      const subtotalCalc = items.reduce((acc, it) => acc + (it.subtotal ?? it.cantidad * it.precioUnitario), 0);

      const orderForEngine: Partial<Order> = {
        codigoEmpresa,
        items,
        subtotal: subtotalCalc,
      };

      const clienteForEngine: Cliente | null = customer
        ? { codigoCliente: customer.codigoCliente, nombreCliente: customer.nombreCliente, canalVenta: (customer as any).tipoCliente, updatedAt: new Date().toISOString() } as any
        : null;

      const apps = getApplicableOffers(orderForEngine as any, clienteForEngine, productosAll, allOffers);
      console.debug("[OrderFormFull] applicable offers", { appsCount: apps.length, apps });

      if (!applicableEqual(apps, applicableOffers)) {
        setApplicableOffers(apps);
      }

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
  const itemsTotal = useMemo(
    () => items.reduce((acc, it) => acc + (it.subtotal ?? it.cantidad * it.precioUnitario), 0),
    [items]
  );

  const offersDiscount = useMemo(() => Math.max(0, itemsGross - itemsTotal), [itemsGross, itemsTotal]);
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
    const sourceItems = baseItems ?? items;
    const clean = stripDiscounts(sourceItems);
    const nextApplied = toggleWithStacking(app, appliedOffers, clean, productosAll);

    const { items: updated, perOfferDiscount } = applyOffersSequence(clean, nextApplied);

    if (!itemsEqual(sourceItems, updated)) {
      setItems(updated);
    }

    // guardar total en la primera como referencia
    const mapped = nextApplied.map((o) => ({ ...o, potentialDiscount: perOfferDiscount.get(offerKey(o.offer)) || 0 }));
    setAppliedOffers(mapped);
  };

  const handleRemoveOffer = () => {
    setAppliedOffers([]);
    setPendingAppliedOfferIds([]);
    // limpiar descuentos por línea
    setItems((prev) => prev.map((it) => {
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
              {items.map((it) => (
                <div key={it.id} className="grid grid-cols-12 gap-2 items-center border rounded-lg p-2 bg-yellow-50 dark:bg-yellow-900/20 shadow-sm">
                  <div className="col-span-5 space-y-1">
                    <div className="font-medium">{it.descripcion}</div>
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
                    <Button
                      size="icon"
                      variant="outline"
                      className="text-yellow-700 border-yellow-300 hover:bg-yellow-100 dark:text-yellow-200 dark:border-yellow-700"
                      onClick={() => {
                        if (it.cantidad > 1) {
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
                      disabled={it.cantidad <= 1}
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
                  </div>
                  <div className="col-span-2 text-right font-semibold text-yellow-800 dark:text-yellow-200">
                    Q{(it.subtotal ?? it.cantidad * it.precioUnitario).toFixed(2)}
                  </div>
                  <div className="col-span-1 text-right">
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
                  </div>
                </div>
              ))}
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
                          return (
                            <div key={it.id} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm">
                              <div className="col-span-5 font-medium text-foreground truncate">{it.descripcion}</div>
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
        onPick={(c) => {
          if (items.length > 0) {
            const ok = window.confirm(
              "Si cambias el cliente, se borrará todo el detalle del pedido. ¿Estás seguro?"
            );
            if (!ok) return;
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="font-semibold text-lg">Ofertas aplicables</div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setOffersOpen(false)}>Cerrar</Button>
              </div>
            </div>

            {applicableOffers.length === 0 ? (
              <div className="text-sm text-muted-foreground">No hay ofertas aplicables para este pedido.</div>
            ) : (
              <div className="space-y-3">
                {applicableOffers.map((app, idx) => (
                  <div
                    key={app.offer.id || idx}
                    className={`border rounded p-3 flex items-center justify-between ${appliedOffers.some((o) => (o.offer.id || o.offer.serverId) === (app.offer.id || app.offer.serverId)) ? 'border-green-400 bg-green-50 dark:bg-green-900/10' : ''}`}
                  >
                    <div>
                      <div className="font-medium">{app.offer.name}</div>
                      <div className="text-xs text-muted-foreground">{app.offer.description}</div>
                      <div className="text-sm mt-1">Ahorro estimado: Q{(app.potentialDiscount || 0).toFixed(2)}</div>
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
                      <Button variant="outline" onClick={() => { navigator.clipboard?.writeText(JSON.stringify(app.offer)); alert('Detalles copiados al portapapeles'); }}>Detalles</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

{showCloseModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-lg p-6 w-full max-w-sm">
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
          variant="outline"
          onClick={() => {
            setShowCloseModal(false);
            // Guardar como pendiente (el draft ya está en localStorage por autosave)
            onClose();
          }}
        >
          Sí
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            setShowCloseModal(false);
            localStorage.removeItem("pedido_draft");
            onClose();
          }}
        >
          No
        </Button>
      </div>
    </div>
  </div>
)}


    </div>

  );
}
