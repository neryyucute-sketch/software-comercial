// app/orders/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useOrders } from "@/contexts/OrdersContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Order } from "@/lib/types";
import OrderModal from "@/components/order/OrderModal";
import { PDFDownloadLink } from "@react-pdf/renderer";
import OrderPdf from "@/components/order/OrderPdf";
import { groupOrderComboItems, resolveComboGroupQuantity, resolveComboGroupUnitPrice, type OrderComboGroup } from "@/lib/order-helpers";
import { pickReferenceCode } from "@/lib/utils";

export default function OrdersPage() {
    // Estados para mostrar/ocultar paneles en móvil
    const [showLeftPanel, setShowLeftPanel] = useState(true);
    const [showProductsPanel, setShowProductsPanel] = useState(true);
  const { orders, syncing, syncOrders } = useOrders();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<any>(null);
  const [viewing, setViewing] = useState<Order | null>(null);
  const [pendingDraft, setPendingDraft] = useState<any>(null);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const defaultFromISO = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 60);
    return d.toISOString().slice(0, 10);
  }, []);
  const [fromDate, setFromDate] = useState<string>(defaultFromISO);
  const [toDate, setToDate] = useState<string>(todayISO);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortBy, setSortBy] = useState<"fecha_desc" | "fecha_asc" | "cliente_asc" | "monto_desc" | "monto_asc">("fecha_desc");
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

  const viewingSortedItems = useMemo(() => {
    if (!viewing?.items?.length) return [] as Order["items"];
    return [...viewing.items].sort((a, b) => {
      const aNum = a?.lineNumber ?? Number.POSITIVE_INFINITY;
      const bNum = b?.lineNumber ?? Number.POSITIVE_INFINITY;
      if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
      if (Number.isFinite(aNum)) return -1;
      if (Number.isFinite(bNum)) return 1;
      return 0;
    });
  }, [viewing]);

  const viewingComboData = useMemo(() => {
    type OrderItem = NonNullable<Order["items"]>[number];
    if (!viewingSortedItems.length) {
      return { groups: [] as OrderComboGroup[], byItem: new WeakMap<OrderItem, OrderComboGroup>() };
    }
    const comboCandidates = viewingSortedItems.filter((item): item is OrderItem => Boolean(item.comboId || item.kitId || item.comboCode));
    const groups = groupOrderComboItems(comboCandidates);
    const map = new WeakMap<OrderItem, OrderComboGroup>();
    groups.forEach((group) => {
      group.items.forEach((line) => map.set(line, group));
    });
    return { groups, byItem: map };
  }, [viewingSortedItems]);

  const viewingRows = useMemo(() => {
    type OrderItem = NonNullable<Order["items"]>[number];
    if (!viewingSortedItems.length) return [] as Array<
      | { type: "single"; item: OrderItem; idx: number }
      | { type: "combo-parent"; group: OrderComboGroup }
      | { type: "combo-child"; group: OrderComboGroup; item: OrderItem; idx: number }
    >;
    const rows: Array<
      | { type: "single"; item: OrderItem; idx: number }
      | { type: "combo-parent"; group: OrderComboGroup }
      | { type: "combo-child"; group: OrderComboGroup; item: OrderItem; idx: number }
    > = [];
    const seenGroups = new Set<string>();
    viewingSortedItems.forEach((item, idx) => {
      const group = viewingComboData.byItem.get(item);
      if (group) {
        if (seenGroups.has(group.key)) {
          return;
        }
        seenGroups.add(group.key);
        rows.push({ type: "combo-parent", group });
        group.items.forEach((child, childIdx) => {
          rows.push({ type: "combo-child", group, item: child, idx: childIdx });
        });
        return;
      }
      rows.push({ type: "single", item, idx });
    });
    return rows;
  }, [viewingSortedItems, viewingComboData]);

  // Lógica de filtrado, orden y paginación
  const filteredOrders = useMemo(() => {
    const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
    const to = toDate ? new Date(`${toDate}T23:59:59.999`) : null;

    let filtered = orders || [];
    if (searchTerm) {
      filtered = filtered.filter((o: any) =>
        (o.nombreCliente || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.codigoCliente || "").toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    filtered = filtered.filter((o: any) => {
      const rawDate = o.fecha ?? o.createdAt;
      const parsed = rawDate ? new Date(rawDate) : null;
      if (!parsed || isNaN(parsed.getTime())) return false;
      if (from && parsed < from) return false;
      if (to && parsed > to) return false;
      return true;
    });
    return filtered;
  }, [orders, searchTerm, fromDate, toDate]);

  const sortedOrders = useMemo(() => {
    let sorted = [...filteredOrders];
    switch (sortBy) {
      case "fecha_asc":
        sorted.sort((a, b) => String(a.fecha || a.createdAt).localeCompare(String(b.fecha || b.createdAt)));
        break;
      case "fecha_desc":
        sorted.sort((a, b) => String(b.fecha || a.createdAt).localeCompare(String(a.fecha || a.createdAt)));
        break;
      case "cliente_asc":
        sorted.sort((a, b) => (a.nombreCliente || "").localeCompare(b.nombreCliente || ""));
        break;
      case "monto_asc":
        sorted.sort((a, b) => (a.total ?? 0) - (b.total ?? 0));
        break;
      case "monto_desc":
        sorted.sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
        break;
    }
    return sorted;
  }, [filteredOrders, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sortedOrders.length / pageSize));
  const paginatedOrders = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedOrders.slice(start, start + pageSize);
  }, [sortedOrders, page, pageSize]);

  // Logs de depuración para revisar el filtrado y fechas
  useEffect(() => {
    console.debug("[OrdersPage] Pedidos cargados:", orders);
    console.debug("[OrdersPage] Fechas de filtro:", { fromDate, toDate });
    console.debug("[OrdersPage] Pedidos después de filtrar:", filteredOrders);
  }, [orders, fromDate, toDate, filteredOrders]);

  // Log de ejemplo para validar fechas de un pedido específico
  useEffect(() => {
    console.debug("[OrdersPage] Pedido de ejemplo:", {
      localId: "zexa94hqhjnmj9eicbz",
      fecha: new Date(1765939040495).toISOString(),
      createdAt: new Date(1765939040495).toISOString(),
    });
  }, []);

    function handleNuevoPedido() {
    const draftStr = localStorage.getItem("pedido_draft");
    if (draftStr) {
      try {
        const data = JSON.parse(draftStr);
        if (data.customer || (Array.isArray(data.items) && data.items.length > 0)) {
          setDraft(data);
          setShowDraftModal(true);
          return;
        } else {
          localStorage.removeItem("pedido_draft");
        }
      } catch {
        localStorage.removeItem("pedido_draft");
      }
    }
    setDraft(null);
    setOpen(true);
  }
  // Funciones auxiliares
  function formatDate(date: string | number | undefined) {
    if (!date) return "";
    return new Date(String(date)).toLocaleDateString();
  }
  function canEdit(o: any) {
    return o.estado === "ingresado";
  }
  function discardDraft() {
    localStorage.removeItem("pedido_draft");
    setDraft(null);
    setShowDraftModal(false);
    setOpen(true);
  }
  function continueDraft() {
    setOpen(true);
    setShowDraftModal(false);
  }
  function renderStatus(o: any) {
    return <Badge>{o.estado || "-"}</Badge>;
  }
  function buildPdfName(o: any) {
    return `Pedido_${o.numeroPedido || o.localId || ""}.pdf`;
  }

  // UI principal
  return (
    <div className="max-w-3xl mx-auto px-2 pt-3">
      {/* Botones para ocultar/mostrar paneles en móvil */}
      <div className="md:hidden flex gap-2 mb-2">
        <Button size="sm" variant="outline" onClick={() => setShowLeftPanel((v) => !v)}>
          {showLeftPanel ? "Ocultar info" : "Mostrar info"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowProductsPanel((v) => !v)}>
          {showProductsPanel ? "Ocultar productos" : "Mostrar productos"}
        </Button>
      </div>

      {/* Panel izquierdo: Geoposición, Fotos, Cliente */}
      <div className={(showLeftPanel ? "" : "hidden ") + "md:block"}>
        {/* ...aquí va el panel izquierdo original... */}
      </div>

      {/* Sección de productos */}
      <div className={(showProductsPanel ? "" : "hidden ") + "md:block"}>
        {/* ...aquí va la sección de productos original... */}
        {/* El resumen y el resto del contenido siguen igual debajo */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div className="flex flex-col gap-2 w-full md:w-auto">
            <label className="text-sm font-medium text-blue-700">Buscar cliente</label>
            <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Nombre o código..." className="w-full md:w-64" />
          </div>
          <div className="flex flex-col gap-2 w-full md:w-auto">
            <label className="text-sm font-medium text-blue-700">Rango de fechas</label>
            <div className="flex gap-2">
              <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
              <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-2 w-full md:w-auto">
            <label className="text-sm font-medium text-blue-700">Ordenar por</label>
            <select className="border rounded px-2 py-1" value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
              <option value="fecha_desc">Fecha ↓</option>
              <option value="fecha_asc">Fecha ↑</option>
              <option value="cliente_asc">Cliente A-Z</option>
              <option value="monto_desc">Monto ↓</option>
              <option value="monto_asc">Monto ↑</option>
            </select>
          </div>
        </div>
        <div className="flex justify-between items-center mb-4">
          <Button onClick={handleNuevoPedido} className="bg-blue-600 text-white hover:bg-blue-700 shadow">Nuevo pedido</Button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-blue-700">Pedidos:</span>
            <Badge>{filteredOrders.length}</Badge>
          </div>
        </div>
        <div className="rounded-xl bg-white dark:bg-neutral-900 shadow p-4">
          {sortedOrders.length === 0 && (
            <div className="text-center text-base text-blue-400 py-8">No hay pedidos en el rango o con ese filtro.</div>
          )}
          <div className="space-y-4">
            {paginatedOrders.map((o) => {
              const nombre = o.nombreCliente || o.codigoCliente || (o as any).customerId || "(sin cliente)";
              const direccion = o.direccionEntrega || o.municipio || o.departamento || "Sin dirección";
              const itemsLabel = `${o.items?.length || 0} ítem${(o.items?.length || 0) === 1 ? "" : "s"}`;
              const total = typeof o.total === "number" ? o.total.toFixed(2) : "0.00";
              const fecha = formatDate(o.fecha || o.createdAt);
              const editable = canEdit(o);
              return (
                <div key={o.localId || o.id} className="transition-all duration-200 border border-blue-100 dark:border-blue-900 rounded-2xl p-5 bg-gradient-to-br from-blue-50 via-white to-blue-100 dark:from-blue-950 dark:via-neutral-900 dark:to-blue-950 shadow hover:shadow-lg hover:scale-[1.01]">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <div className="text-sm text-blue-400">#{o.numeroPedido || o.numeroPedidoTemporal || o.localId}</div>
                      <div className="text-lg font-bold text-blue-700 dark:text-blue-200">{nombre}</div>
                      <div className="text-sm text-blue-400">{direccion}</div>
                      {o.ordenCompra && <div className="text-xs text-blue-300">Orden compra: {o.ordenCompra}</div>}
                      {fecha && <div className="text-xs text-blue-300">{fecha}</div>}
                    </div>
                    <div className="flex flex-col gap-2 text-right min-w-[180px]">
                      <div className="text-sm text-blue-400">{itemsLabel}</div>
                      <div className="text-lg font-bold text-blue-700 dark:text-blue-200">Q{total}</div>
                      {renderStatus(o)}
                    </div>
                  </div>
                  {(o as any).lastError && <div className="text-xs text-red-600 mt-2">Error: {(o as any).lastError}</div>}
                  <div className="mt-3 flex flex-wrap gap-2 justify-end">
                    <Button variant="outline" className="border-blue-200 text-blue-700 dark:border-blue-700 dark:text-blue-200" onClick={() => setViewing(o)}>
                      Ver
                    </Button>
                    <Button
                      variant="secondary"
                      className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-700"
                      disabled={!editable}
                      title={editable ? "Pronto podrás editar" : "Solo editable si el backend responde y el estado es 'ingresado'"}
                      onClick={() => {
                        if (!editable) return;
                        alert("La edición se habilitará cuando el flujo esté listo.");
                      }}
                    >
                      Editar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Paginación */}
          <div className="flex items-center gap-2 justify-center mt-6">
            <Button
              variant="outline"
              size="sm"
              className="border-blue-200 text-blue-700 dark:border-blue-700 dark:text-blue-200"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Anterior
            </Button>
            <span className="text-blue-700">Página {page} de {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              className="border-blue-200 text-blue-700 dark:border-blue-700 dark:text-blue-200"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </div>
      {/* Modals y dialogs */}
      <OrderModal open={open} onOpenChange={setOpen} draft={draft} />
      <Dialog open={showDraftModal} onOpenChange={setShowDraftModal}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-blue-700 dark:text-blue-200">Tienes un pedido pendiente</DialogTitle>
              <DialogDescription className="text-sm text-blue-400 dark:text-blue-200">
                Continúa donde lo dejaste o empieza uno nuevo y descarta el borrador actual.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 rounded-lg border border-blue-100 dark:border-blue-900 bg-white dark:bg-neutral-900 px-4 py-3 text-sm text-blue-700 dark:text-blue-200 shadow-sm">
              <div className="font-medium text-blue-900 dark:text-blue-100">{draft?.cliente}</div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-blue-400 dark:text-blue-200 mt-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900 px-3 py-1 font-medium text-blue-800 dark:text-blue-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  {draft?.items?.length || 0} productos
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900 px-3 py-1 font-medium text-blue-800 dark:text-blue-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                  Total estimado: Q{draft?.total?.toFixed(2) || "0.00"}
                </span>
              </div>
            </div>
          </div>
          <div className="border-t border-blue-100 dark:border-blue-900 bg-blue-50 dark:bg-blue-950 px-5 py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <Button variant="secondary" onClick={() => setShowDraftModal(false)} className="w-full sm:w-auto bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200">
                Cancelar
              </Button>
              <Button variant="outline" onClick={discardDraft} className="w-full sm:w-auto border-red-200 text-red-700 hover:bg-red-50 dark:border-red-400 dark:text-red-300 dark:hover:bg-red-950">
                Descartar y empezar nuevo
              </Button>
              <Button onClick={continueDraft} className="w-full sm:w-auto bg-blue-600 text-white hover:bg-blue-700 shadow">
                Continuar borrador
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!viewing} onOpenChange={(v: boolean) => { if (!v) setViewing(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-blue-700 dark:text-blue-200">Detalle del pedido</DialogTitle>
            <DialogDescription className="text-blue-400 dark:text-blue-200">Consulta rápida del pedido seleccionado.</DialogDescription>
          </DialogHeader>
          {viewing && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-blue-400">Cliente</div>
                <div className="font-semibold text-blue-700 dark:text-blue-200">{viewing.nombreCliente || viewing.codigoCliente}</div>
                <div className="text-blue-400">{viewing.codigoCliente}</div>
              </div>
              <div>
                <div className="text-xs text-blue-400">Fecha</div>
                <div>{formatDate(viewing.fecha || viewing.createdAt)}</div>
              </div>
              <div>
                <div className="text-xs text-blue-400">Dirección</div>
                <div>{viewing.direccionEntrega || viewing.municipio || viewing.departamento || "Sin dirección"}</div>
              </div>
              <div>
                <div className="text-xs text-blue-400">Pago / Bodega</div>
                <div>{viewing.formaPago || "(no definido)"} · {viewing.bodega || "(s/bodega)"}</div>
              </div>
              <div>
                <div className="text-xs text-blue-400">Totales</div>
                <div>Subtotal: Q{(viewing.subtotal ?? 0).toFixed(2)}</div>
                <div>Descuento: Q{(viewing.descuentoTotal ?? 0).toFixed(2)}</div>
                <div className="font-semibold text-blue-700 dark:text-blue-200">Total: Q{(viewing.total ?? 0).toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-blue-400">Estado</div>
                {renderStatus(viewing)}
              </div>
              {viewing.observaciones && (
                <div className="md:col-span-2">
                  <div className="text-xs text-blue-400">Observaciones</div>
                  <div className="text-sm whitespace-pre-wrap">{viewing.observaciones}</div>
                </div>
              )}
              {viewingRows.length > 0 && (
                <div className="md:col-span-2 space-y-2">
                  <div className="text-xs text-blue-400 font-semibold">Productos</div>
                  <div className="rounded-lg border border-blue-100 dark:border-blue-900 divide-y divide-blue-100 dark:divide-blue-900 overflow-hidden">
                    {viewingRows.map((row, idx) => {
                      if (row.type === "single") {
                        const bruto = row.item.subtotalSinDescuento ?? row.item.subtotal ?? row.item.cantidad * row.item.precioUnitario;
                        const desc = row.item.descuentoLinea ?? 0;
                        const neto = row.item.subtotal ?? bruto;
                        return (
                          <div key={row.item.id || `single-${idx}`} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm">
                            <div className="col-span-5 font-medium text-blue-700 dark:text-blue-200 truncate">{row.item.descripcion}</div>
                            <div className="col-span-2 text-right text-blue-400">Cant: {row.item.cantidad}</div>
                            <div className="col-span-2 text-right text-blue-400">Bruto: Q{bruto.toFixed(2)}</div>
                            <div className="col-span-2 text-right text-blue-400">Desc: Q{desc.toFixed(2)}</div>
                            <div className="col-span-1 text-right font-semibold text-blue-700 dark:text-blue-200">Q{neto.toFixed(2)}</div>
                          </div>
                        );
                      }

                      if (row.type === "combo-parent") {
                        const comboGross = row.group.items.reduce((sum, line) => {
                          const lineGross = line.subtotalSinDescuento ?? line.subtotal ?? line.cantidad * line.precioUnitario;
                          return sum + lineGross;
                        }, 0);
                        const comboNet = row.group.totalPrice;
                        const comboDiscount = comboGross - comboNet;
                        const groupQuantity = resolveComboGroupQuantity(row.group);
                        const groupUnitPrice = resolveComboGroupUnitPrice(row.group);
                        const displayCode = pickReferenceCode(
                          row.group.offerCode,
                          row.group.comboCode,
                          row.group.items[0]?.ofertaCodigo,
                          row.group.items[0]?.comboCode
                        ) ?? "-";
                        return (
                          <div key={`combo-${row.group.key}`} className="grid grid-cols-12 gap-2 px-3 py-3 text-sm bg-blue-50/70 dark:bg-blue-950/40">
                            <div className="col-span-5 flex flex-col gap-1">
                              <div className="font-semibold text-blue-700 dark:text-blue-200 truncate">{row.group.comboName || displayCode || "Combo / Kit"}</div>
                              <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase text-blue-400">
                                <span>{row.group.comboType === "kit" ? "Kit" : "Combo"}</span>
                                {displayCode !== "-" && <span className="tracking-wide">Código: {displayCode}</span>}
                                <span>Unitario: Q{groupUnitPrice.toFixed(2)}</span>
                              </div>
                            </div>
                            <div className="col-span-2 text-right text-blue-500">Cant: {groupQuantity}</div>
                            <div className="col-span-2 text-right text-blue-500">Bruto: Q{comboGross.toFixed(2)}</div>
                            <div className="col-span-2 text-right text-blue-500">Desc: Q{comboDiscount.toFixed(2)}</div>
                            <div className="col-span-1 text-right font-semibold text-blue-700 dark:text-blue-200">Q{comboNet.toFixed(2)}</div>
                          </div>
                        );
                      }

                      const item = row.item;
                      return (
                        <div key={item.id || `combo-child-${row.group.key}-${row.idx}`} className="grid grid-cols-12 gap-2 px-3 py-2 text-xs bg-white dark:bg-neutral-900">
                          <div className="col-span-5 pl-6 text-blue-500 dark:text-blue-200 truncate">{item.descripcion}</div>
                          <div className="col-span-2 text-right text-blue-300">Cant: {item.cantidad}</div>
                          <div className="col-span-2 text-right text-blue-300">—</div>
                          <div className="col-span-2 text-right text-blue-300">—</div>
                          <div className="col-span-1 text-right text-blue-300">—</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="md:col-span-2 flex justify-end">
                <PDFDownloadLink
                  document={<OrderPdf order={viewing} />}
                  fileName={buildPdfName(viewing)}
                >
                  {({ loading }) => (
                    <Button variant="outline" className="border-blue-200 text-blue-700 dark:border-blue-700 dark:text-blue-200" disabled={loading}>
                      {loading ? "Generando PDF…" : "Descargar PDF"}
                    </Button>
                  )}
                </PDFDownloadLink>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
