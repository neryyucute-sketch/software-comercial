// app/orders/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useOrders } from "@/contexts/OrdersContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Order } from "@/lib/types";
import OrderModal from "@/components/order/OrderModal";
import { PDFDownloadLink } from "@react-pdf/renderer";
import OrderPdf from "@/components/order/OrderPdf";

export default function OrdersPage() {
  const { orders, syncing, syncOrders } = useOrders();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<any>(null);
  const [viewing, setViewing] = useState<Order | null>(null);
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

  const handleNuevoPedido = () => {
    const draftStr = localStorage.getItem("pedido_draft");
    if (draftStr) {
      const data = JSON.parse(draftStr);
      if (data.customer || (Array.isArray(data.items) && data.items.length > 0)) {
        const ok = window.confirm("Tienes un pedido pendiente. ¿Deseas continuar?");
        if (ok) {
          console.log("Cargando draft", data);
          setDraft(data);
          setOpen(true);
          return;
        } else {
          localStorage.removeItem("pedido_draft");
        }
      } else {
        localStorage.removeItem("pedido_draft");
      }
    }
    setDraft(null);
    setOpen(true);
  };

  const formatDate = useMemo(() => (iso?: string | number) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) +
      " · " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }, []);

  const buildPdfName = useMemo(() => {
    const safe = (text: string) =>
      (text || "")
        .toString()
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-_]/gi, "");

    const datePart = (iso?: string | number) => {
      const d = new Date(iso || Date.now());
      if (Number.isNaN(d.getTime())) return "";
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}${mm}${dd}`;
    };

    return (o?: Order | null) => {
      if (!o) return "pedido.pdf";
      const cliente = safe(o.nombreCliente || o.codigoCliente || "cliente");
      const numero = safe(o.numeroPedido || o.numeroPedidoTemporal || o.localId || "pedido");
      const fecha = datePart(o.fecha || o.createdAt);
      return `pedido-${cliente || "cliente"}-${numero || "detalle"}-${fecha || ""}.pdf`;
    };
  }, []);

  const parseDateLocal = (value?: string | number | null) => {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return null;
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    }

    const text = value.toString().slice(0, 10); // YYYY-MM-DD o similar
    const parts = text.split("-").map((p) => Number(p));
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
    const [y, m, d] = parts;
    return new Date(y, m - 1, d).getTime(); // 00:00 local
  };

  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const fromTs = parseDateLocal(fromDate);
    const toTs = parseDateLocal(toDate);

    return orders.filter((o) => {
      const ts = parseDateLocal(o.fecha || o.createdAt);
      if (fromTs && ts !== null && ts < fromTs) return false;
      if (toTs && ts !== null && ts > toTs + 86_400_000 - 1) return false; // incluye el día final completo (hora local)

      if (!term) return true;

      const hayCliente = `${o.nombreCliente || ""} ${o.codigoCliente || ""}`.toLowerCase();
      const hayNumero = `${o.numeroPedido || ""} ${o.numeroPedidoTemporal || ""}`.toLowerCase();
      const hayProductos = Array.isArray(o.items)
        ? o.items.some((it) =>
            `${it.descripcion || ""} ${it.productoId || ""}`
              .toLowerCase()
              .includes(term)
          )
        : false;

      return (
        hayCliente.includes(term) ||
        hayNumero.includes(term) ||
        hayProductos
      );
    });
  }, [orders, searchTerm, fromDate, toDate]);

  const sortedOrders = useMemo(() => {
    const arr = [...filteredOrders];
    const byFecha = (a: Order, b: Order) => {
      const ta = parseDateLocal(a.fecha || a.createdAt) ?? 0;
      const tb = parseDateLocal(b.fecha || b.createdAt) ?? 0;
      return sortBy === "fecha_asc" ? ta - tb : tb - ta;
    };
    const byCliente = (a: Order, b: Order) => {
      const na = (a.nombreCliente || a.codigoCliente || "").toLowerCase();
      const nb = (b.nombreCliente || b.codigoCliente || "").toLowerCase();
      return na.localeCompare(nb, "es");
    };
    const byMonto = (a: Order, b: Order) => {
      const ta = Number(a.total) || 0;
      const tb = Number(b.total) || 0;
      return sortBy === "monto_asc" ? ta - tb : tb - ta;
    };

    switch (sortBy) {
      case "fecha_asc":
      case "fecha_desc":
        arr.sort(byFecha);
        break;
      case "cliente_asc":
        arr.sort(byCliente);
        break;
      case "monto_asc":
      case "monto_desc":
        arr.sort(byMonto);
        break;
      default:
        break;
    }
    return arr;
  }, [filteredOrders, sortBy]);

  const totalPages = useMemo(() => {
    const pages = Math.ceil(sortedOrders.length / pageSize);
    return pages > 0 ? pages : 1;
  }, [sortedOrders.length, pageSize]);

  // Asegurar página válida cuando cambian filtros o tamaño de página
  useEffect(() => {
    setPage((prev) => {
      const maxPage = Math.max(1, Math.ceil(sortedOrders.length / pageSize));
      return Math.min(prev, maxPage);
    });
  }, [sortedOrders.length, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [fromDate, toDate, searchTerm, sortBy]);

  const paginatedOrders = useMemo(() => {
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return sortedOrders.slice(start, end);
  }, [sortedOrders, page, pageSize, totalPages]);

  const renderStatus = (o: Order) => {
    const status = (o.estado || (o as any).status || "").toLowerCase();
    const synced = !!o.synced;
    const color = status === "ingresado" ? "bg-emerald-100 text-emerald-800" : status === "failed" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-700";
    return (
      <div className="flex items-center gap-2 text-sm">
        <Badge variant="secondary" className={color}>{status || "sin estado"}</Badge>
        {synced ? <Badge variant="outline" className="border-emerald-300 text-emerald-700">Sincronizado</Badge> : <Badge variant="outline" className="border-amber-300 text-amber-700">Pendiente</Badge>}
      </div>
    );
  };

  const canEdit = (o: Order) => {
    const status = (o.estado || (o as any).status || "").toLowerCase();
    const backendOk = !!o.synced || !!o.serverId;
    return backendOk && status === "ingresado";
  };

  return (
    <div className="container max-w-6xl mx-auto py-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Pedidos</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => syncOrders()} disabled={syncing}>
            {syncing ? "Sincronizando…" : "Sincronizar"}
          </Button>
          <Button onClick={handleNuevoPedido}>Nuevo pedido</Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Desde</label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Hasta</label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} max={todayISO} />
          </div>
          <div className="md:col-span-2 flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Buscar (cliente, número o producto)</label>
            <Input
              placeholder="Ej. nombre de cliente, código o descripción de producto"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Ordenar por</label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            >
              <option value="fecha_desc">Fecha (nuevo → viejo)</option>
              <option value="fecha_asc">Fecha (viejo → nuevo)</option>
              <option value="cliente_asc">Cliente (A → Z)</option>
              <option value="monto_desc">Monto (alto → bajo)</option>
              <option value="monto_asc">Monto (bajo → alto)</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Registros por página</label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={pageSize}
              onChange={(e) => {
                const val = Number(e.target.value) || 10;
                setPageSize(val);
                setPage(1);
              }}
            >
              {[5, 10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div>
            Mostrando {paginatedOrders.length} de {sortedOrders.length} pedidos
            {sortedOrders.length > 0 && (
              <span>
                {" "}({page}-{totalPages} páginas)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Anterior
            </Button>
            <span>Página {page} de {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Siguiente
            </Button>
          </div>
        </div>

        {sortedOrders.length === 0 && (
          <div className="text-sm text-muted-foreground">No hay pedidos en el rango o con ese filtro.</div>
        )}

        {paginatedOrders.map((o) => {
          const nombre = o.nombreCliente || o.codigoCliente || (o as any).customerId || "(sin cliente)";
          const direccion = o.direccionEntrega || o.municipio || o.departamento || "Sin dirección";
          const itemsLabel = `${o.items?.length || 0} ítem${(o.items?.length || 0) === 1 ? "" : "s"}`;
          const total = typeof o.total === "number" ? o.total.toFixed(2) : "0.00";
          const fecha = formatDate(o.fecha || o.createdAt);
          const editable = canEdit(o);
          return (
            <div key={o.localId || o.id} className="border border-gray-200 dark:border-neutral-800 rounded-xl p-4 bg-white dark:bg-neutral-900 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">#{o.numeroPedido || o.numeroPedidoTemporal || o.localId}</div>
                  <div className="text-lg font-semibold text-foreground">{nombre}</div>
                  <div className="text-sm text-muted-foreground">{direccion}</div>
                  {o.ordenCompra && <div className="text-xs text-muted-foreground">Orden compra: {o.ordenCompra}</div>}
                  {fecha && <div className="text-xs text-muted-foreground">{fecha}</div>}
                </div>
                <div className="flex flex-col gap-2 text-right min-w-[180px]">
                  <div className="text-sm text-muted-foreground">{itemsLabel}</div>
                  <div className="text-lg font-semibold text-blue-700 dark:text-blue-300">Q{total}</div>
                  {renderStatus(o)}
                </div>
              </div>

              {o.lastError && <div className="text-xs text-red-600 mt-2">Error: {o.lastError}</div>}

              <div className="mt-3 flex flex-wrap gap-2 justify-end">
                <Button variant="outline" onClick={() => setViewing(o)}>
                  Ver
                </Button>
                <Button
                  variant="secondary"
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

      <OrderModal open={open} onOpenChange={setOpen} draft={draft} />

      <Dialog open={!!viewing} onOpenChange={(v) => { if (!v) setViewing(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalle del pedido</DialogTitle>
            <DialogDescription>Consulta rápida del pedido seleccionado.</DialogDescription>
          </DialogHeader>
          {viewing && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Cliente</div>
                <div className="font-semibold">{viewing.nombreCliente || viewing.codigoCliente}</div>
                <div className="text-muted-foreground">{viewing.codigoCliente}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Fecha</div>
                <div>{formatDate(viewing.fecha || viewing.createdAt)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Dirección</div>
                <div>{viewing.direccionEntrega || viewing.municipio || viewing.departamento || "Sin dirección"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Pago / Bodega</div>
                <div>{viewing.formaPago || "(no definido)"} · {viewing.bodega || "(s/bodega)"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Totales</div>
                <div>Subtotal: Q{(viewing.subtotal ?? 0).toFixed(2)}</div>
                <div>Descuento: Q{(viewing.descuentoTotal ?? 0).toFixed(2)}</div>
                <div className="font-semibold">Total: Q{(viewing.total ?? 0).toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Estado</div>
                {renderStatus(viewing)}
              </div>
              {viewing.observaciones && (
                <div className="md:col-span-2">
                  <div className="text-xs text-muted-foreground">Observaciones</div>
                  <div className="text-sm whitespace-pre-wrap">{viewing.observaciones}</div>
                </div>
              )}
              {Array.isArray(viewing.items) && viewing.items.length > 0 && (
                <div className="md:col-span-2 space-y-2">
                  <div className="text-xs text-muted-foreground font-semibold">Productos</div>
                  <div className="rounded-lg border border-gray-200 dark:border-neutral-800 divide-y divide-gray-200 dark:divide-neutral-800 overflow-hidden">
                    {viewing.items.map((it, idx) => {
                      const bruto = it.subtotalSinDescuento ?? it.subtotal ?? it.cantidad * it.precioUnitario;
                      const desc = it.descuentoLinea ?? 0;
                      const neto = it.subtotal ?? bruto;
                      return (
                        <div key={it.id || idx} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm">
                          <div className="col-span-5 font-medium text-foreground truncate">{it.descripcion}</div>
                          <div className="col-span-2 text-right text-muted-foreground">Cant: {it.cantidad}</div>
                          <div className="col-span-2 text-right text-muted-foreground">Bruto: Q{bruto.toFixed(2)}</div>
                          <div className="col-span-2 text-right text-muted-foreground">Desc: Q{desc.toFixed(2)}</div>
                          <div className="col-span-1 text-right font-semibold text-foreground">Q{neto.toFixed(2)}</div>
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
                    <Button variant="outline" disabled={loading}>
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
