// components/order/OrderFormFull.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useOrders } from "@/contexts/OrdersContext";
import type { Order, OrderItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MapPin, Camera, Gift, Package, User } from "lucide-react";
import CustomerSelectionModal from "./modals/CustomerSelectionModal";
import ProductSelectionModal from "./modals/ProductSelectionModal";
import ComboSelectionModal from "./modals/ComboSelectionModal";
import OrderPhotos from "./OrderPhotos";
import { db } from "@/lib/db";

function uuidSimple(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

type ClienteLite = {
  codigoCliente: string;
  nombreCliente: string;
  nit?: string;
  tipoCliente?: string;
};

export default function OrderFormFull({ onClose }: { onClose: () => void }) {
  const { addOrder, syncOrders } = useOrders();

  const [customer, setCustomer] = useState<ClienteLite | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");

  const [photos, setPhotos] = useState<{ id: string; dataUrl: string; timestamp: number }[]>([]);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  const [openCustomer, setOpenCustomer] = useState(false);
  const [openProducts, setOpenProducts] = useState(false);
  const [openCombos, setOpenCombos] = useState(false);

    const existingItems = useMemo(
    () => items.reduce<Record<string, number>>((acc, it) => {
        acc[it.productoId] = (acc[it.productoId] || 0) + it.cantidad;
        return acc;
    }, {}),
    [items]
    );  

  useEffect(() => {
    if (!customer) return;
    (async () => {
      const c = await db.clientes.where("codigoCliente").equals(customer.codigoCliente).first();
      if (c && c.canalVenta && c.canalVenta !== customer.tipoCliente) {
        setCustomer((prev) => (prev ? { ...prev, tipoCliente: c.canalVenta as any } : prev));
      }
    })();
  }, [customer?.codigoCliente]);

  const itemsTotal = useMemo(
    () => items.reduce((acc, it) => acc + (it.subtotal ?? it.cantidad * it.precioUnitario), 0),
    [items]
  );
  const total = useMemo(
    () => Math.round(itemsTotal * (1 - Math.max(0, Math.min(100, discount)) / 100) * 100) / 100,
    [itemsTotal, discount]
  );

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
        next[idx] = {
          ...next[idx],
          cantidad: mergedQty,
          subtotal: Math.round(mergedQty * next[idx].precioUnitario * 100) / 100,
        };
      } else {
        next.push(ni);
      }
    }
    setItems(next);
  };

  const handlePickComboItems = (comboItems: OrderItem[]) => {
    setItems((prev) => [...prev, ...comboItems]);
  };

  const captureGeo = () => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
    );
  };

  const onConfirm = async () => {
    if (!canSave) return;
    const localId = uuidSimple();
    const payload: Omit<Order, "id" | "status" | "synced" | "attempts" | "createdAt"> = {
      localId,
      serverId: null,
      customerId: customer!.codigoCliente,
      items,
      discount,
      total,
      notes,
      photos,
      location,
    };
    await addOrder(payload);
    await syncOrders();
    onClose();
  };

  return (
    // 👇 Este contenedor llena la altura disponible del modal
    <div className="flex h-full flex-col">
      {/* Header sticky */}
      <div
        className="
          sticky top-0 z-10
          bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60
          border-b
        "
      >
        <div className="flex items-center justify-between px-4 py-3">
          <Badge variant="secondary">Nuevo Pedido</Badge>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>Cerrar</Button>
            <Button onClick={onConfirm} disabled={!canSave}>
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
            {/* Cliente */}
            <Card className="p-4 space-y-3 rounded-xl shadow-sm border">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                <div className="font-semibold">Cliente</div>
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

            {/* Fotos */}
            <Card className="p-4 space-y-3 rounded-xl shadow-sm border">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4" />
                <div className="font-semibold">Fotos</div>
              </div>
              <OrderPhotos photos={photos} onChange={setPhotos} />
            </Card>

            {/* Geolocalización */}
            <Card className="p-4 space-y-3 rounded-xl shadow-sm border">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <div className="font-semibold">Geoposición</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-x">
                  {location ? (
                    <span className="text-green-600">Ubicación capturada ✓</span>
                  ) : (
                    <span className="text-muted-foreground">Sin capturar</span>
                  )}
                </div>
                <Button size="sm" variant="secondary" onClick={captureGeo}>
                  Obtener
                </Button>
              </div>
              {location && (
                <div className="text-x text-muted-foreground">
                  lat: {location.lat.toFixed(5)} · lng: {location.lng.toFixed(5)}
                </div>
              )}
            </Card>
          </div>

          {/* Columna derecha (abajo en móvil) */}
          <div className="lg:col-span-2 space-y-3">
            {/* Productos / Combos */}
            <Card className="p-4 space-y-3 rounded-xl shadow-sm border">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  <div className="font-semibold">Productos / Combos / Kits</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={() => setOpenProducts(true)}>
                    Agregar productos
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setOpenCombos(true)}
                    disabled={!canUseCombos}
                  >
                    <Gift className="w-4 h-4 mr-1" /> Combos / Kits
                  </Button>
                </div>
              </div>

              {items.length === 0 && (
                <div className="text-sm text-muted-foreground">Aún no hay ítems agregados.</div>
              )}
              {items.map((it) => (
                <div key={it.id} className="grid grid-cols-12 gap-2 items-center border rounded-lg p-2">
                  <div className="col-span-6">
                    <div className="font-medium">{it.descripcion}</div>
                    <div className="text-xs text-muted-foreground">
                      Q{it.precioUnitario.toFixed(2)}
                    </div>
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      min={1}
                      value={it.cantidad}
                      onChange={(e) => {
                        const qty = Math.max(1, Number(e.target.value || 1));
                        setItems((prev) =>
                          prev.map((x) =>
                            x.id === it.id
                              ? { ...x, cantidad: qty, subtotal: Math.round(qty * x.precioUnitario * 100) / 100 }
                              : x
                          )
                        );
                      }}
                    />
                  </div>
                  <div className="col-span-2 text-right font-semibold">
                    Q{it.subtotal.toFixed(2)}
                  </div>
                  <div className="col-span-1 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setItems((prev) => prev.filter((x) => x.id !== it.id))}
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              ))}
            </Card>

            {/* Resumen */}
            <Card className="p-4 space-y-3 rounded-xl shadow-sm border">
              <div className="font-semibold">Resumen</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Descuento (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={discount}
                    onChange={(e) =>
                      setDiscount(Math.max(0, Math.min(100, Number(e.target.value || 0))))
                    }
                  />
                </div>
                <div>
                  <Label>Observaciones</Label>
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                Subtotal: Q{itemsTotal.toFixed(2)}
              </div>
              <div className="text-right text-lg font-semibold">
                Total: Q{total.toFixed(2)}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Modales hijos */}
      <CustomerSelectionModal
        open={openCustomer}
        onOpenChange={setOpenCustomer}
        onPick={(c) => setCustomer(c)}
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
    </div>
  );
}
