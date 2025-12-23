"use client";

import { Document, Page, StyleSheet, Text, View, Image } from "@react-pdf/renderer";
import type { Order, OrderItem } from "@/lib/types";
import { groupOrderComboItems, type OrderComboGroup } from "@/lib/order-helpers";
import { formatCurrencyQ } from "@/lib/utils";

// Estilos básicos para el PDF
const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderColor: "#2563eb",
    marginBottom: 16,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  logo: { width: 140, height: 48, objectFit: "contain" },
  headerTitle: { fontSize: 12, fontWeight: "bold", color: "#1e3a8a" },
  headerSubtitle: { fontSize: 9, color: "#1e3a8a" },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#1e293b",
    marginTop: 10,
    marginBottom: 6,
  },
  row: { flexDirection: "row", gap: 8, marginBottom: 2 },
  col: { flex: 1 },
  infoLabel: { fontSize: 8, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 },
  infoValue: { fontSize: 10, fontWeight: "bold", color: "#0f172a" },
  table: {
    borderWidth: 1,
    borderColor: "#cbd5f5",
    borderRadius: 4,
    overflow: "hidden",
  },
  tableHead: {
    flexDirection: "row",
    backgroundColor: "#1d4ed8",
    color: "white",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "white",
  },
  tableRowAlt: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  cell: { paddingVertical: 6, paddingHorizontal: 6, borderRightWidth: 1, borderColor: "#e2e8f0", fontSize: 9 },
  cellLast: { paddingVertical: 6, paddingHorizontal: 6, fontSize: 9 },
  bold: { fontWeight: "bold" },
  comboChildRow: { backgroundColor: "#f1f5f9" },
  bonusRow: { backgroundColor: "#e0f2fe" },
  smallText: { fontSize: 8 },
  italic: { fontStyle: "italic" },
});

function logoForEmpresa(codigoEmpresa?: string) {
  if (codigoEmpresa === "E07") return "/logo_dimisa.jpg";
  return "/logo_codimisa.jpg";
}

function formatCurrency(value: number | null | undefined) {
  return formatCurrencyQ(value ?? 0);
}

function formatDate(value?: string | number) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

export default function OrderPdf({ order }: { order: Order }) {
  const logo = logoForEmpresa(order.codigoEmpresa);
  const items = [...(order.items || [])].sort((a, b) => {
    const aNum = a?.lineNumber ?? Number.POSITIVE_INFINITY;
    const bNum = b?.lineNumber ?? Number.POSITIVE_INFINITY;
    if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
    if (Number.isFinite(aNum)) return -1;
    if (Number.isFinite(bNum)) return 1;
    return 0;
  });
  const comboCandidates = items.filter((item) => item.comboId || item.kitId || item.comboCode);
  const comboGroups = groupOrderComboItems(comboCandidates);
  const comboLookup = new WeakMap<OrderItem, OrderComboGroup>();
  comboGroups.forEach((group) => {
    group.items.forEach((line) => comboLookup.set(line, group));
  });

  const byId = new Map<string, OrderItem>();
  items.forEach((item) => {
    if (item.id) byId.set(String(item.id), item);
  });

  const bonusByParent = new Map<string, OrderItem[]>();
  const unlinkedBonuses: OrderItem[] = [];

  items.forEach((item) => {
    if (!item.esBonificacion) return;
    const parentCandidates = [item.parentItemId, ...(item.relatedItemIds ?? [])].filter(Boolean).map(String);
    const parentId = parentCandidates.find((candidate) => byId.has(candidate));
    if (parentId) {
      const list = bonusByParent.get(parentId) ?? [];
      list.push(item);
      bonusByParent.set(parentId, list);
    } else {
      unlinkedBonuses.push(item);
    }
  });

  const sortBonuses = (entries?: OrderItem[]) =>
    entries
      ?.slice()
      .sort((a, b) => {
        const aNum = a?.lineNumber ?? Number.POSITIVE_INFINITY;
        const bNum = b?.lineNumber ?? Number.POSITIVE_INFINITY;
        if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
        if (Number.isFinite(aNum)) return -1;
        if (Number.isFinite(bNum)) return 1;
        return String(a.descripcion || "").localeCompare(String(b.descripcion || ""));
      }) ?? [];

  type DisplayRow =
    | { type: "single"; item: OrderItem; index: number }
    | { type: "combo-child"; group: OrderComboGroup; item: OrderItem; index: number }
    | { type: "bonus-child"; parentId: string; item: OrderItem; index: number };

  const tableRows: DisplayRow[] = [];
  const seenCombos = new Set<string>();
  items.forEach((item, index) => {
    if (item.esBonificacion) return;
    const group = comboLookup.get(item);
    if (group) {
      if (seenCombos.has(group.key)) return;
      seenCombos.add(group.key);
      const groupedBonuses: Array<{ parentId: string; item: OrderItem }> = [];
      group.items.forEach((line, lineIndex) => {
        tableRows.push({ type: "combo-child", group, item: line, index: lineIndex });
        const bonuses = sortBonuses(bonusByParent.get(line.id ? String(line.id) : ""));
        bonuses.forEach((bonus) => {
          groupedBonuses.push({ parentId: line.id ? String(line.id) : "", item: bonus });
        });
      });
      groupedBonuses.forEach((entry, bonusIndex) => {
        tableRows.push({ type: "bonus-child", parentId: entry.parentId, item: entry.item, index: bonusIndex });
      });
      return;
    }
    tableRows.push({ type: "single", item, index });
    const bonuses = sortBonuses(bonusByParent.get(item.id ? String(item.id) : ""));
    bonuses.forEach((bonus, bonusIndex) => {
      tableRows.push({ type: "bonus-child", parentId: item.id ? String(item.id) : "", item: bonus, index: bonusIndex });
    });
  });

  sortBonuses(unlinkedBonuses).forEach((bonus, bonusIndex) => {
    tableRows.push({ type: "bonus-child", parentId: "", item: bonus, index: bonusIndex });
  });

  const gross = items.reduce((acc, it) => acc + (it.subtotalSinDescuento ?? it.subtotal ?? it.cantidad * it.precioUnitario), 0);
  const net = items.reduce((acc, it) => acc + (it.total ?? it.subtotal ?? it.cantidad * it.precioUnitario), 0);
  const subtotal = gross;
  const total = Number.isFinite(net) ? net : subtotal;
  const descuento = Math.max(0, subtotal - total);

  const numero = order.numeroPedido || order.numeroPedidoTemporal || order.localId || "";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image src={logo} style={styles.logo} />
            <View>
              <Text style={styles.headerTitle}>Sistema Preventa</Text>
              <Text style={styles.headerSubtitle}>Resumen de pedido</Text>
            </View>
          </View>
          <View>
            <Text style={styles.infoLabel}>Pedido</Text>
            <Text style={styles.infoValue}>{numero}</Text>
            <Text style={styles.infoLabel}>Fecha emisión</Text>
            <Text style={styles.infoValue}>{formatDate(order.fecha || order.createdAt)}</Text>
            {order.estado && (
              <View style={{ marginTop: 6 }}>
                <Text style={styles.infoLabel}>Estado</Text>
                <Text style={styles.infoValue}>{order.estado}</Text>
              </View>
            )}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Cliente</Text>
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.infoLabel}>Nombre</Text>
            <Text style={styles.infoValue}>{order.nombreCliente || order.codigoCliente}</Text>
            <Text style={styles.infoLabel}>Código</Text>
            <Text>{order.codigoCliente}</Text>
            {order.nombreClienteEnvio && (
              <>
                <Text style={styles.infoLabel}>Envío</Text>
                <Text>{order.nombreClienteEnvio}</Text>
              </>
            )}
            {order.contactoEntrega && (
              <>
                <Text style={styles.infoLabel}>Contacto</Text>
                <Text>{order.contactoEntrega}</Text>
              </>
            )}
            {order.telefonoEntrega && (
              <>
                <Text style={styles.infoLabel}>Teléfono</Text>
                <Text>{order.telefonoEntrega}</Text>
              </>
            )}
          </View>
          <View style={styles.col}>
            <Text style={styles.infoLabel}>Dirección de entrega</Text>
            <Text>{order.direccionEntrega || ""}</Text>
            <Text style={styles.infoLabel}>Ubicación</Text>
            <Text>
              {(order.departamento || "").concat(order.municipio ? `, ${order.municipio}` : "")}
            </Text>
            {order.ordenCompra && (
              <>
                <Text style={styles.infoLabel}>Orden de compra</Text>
                <Text>{order.ordenCompra}</Text>
              </>
            )}
            {order.formaPago && (
              <>
                <Text style={styles.infoLabel}>Forma de pago</Text>
                <Text>{order.formaPago}</Text>
              </>
            )}
            {order.bodega && (
              <>
                <Text style={styles.infoLabel}>Bodega</Text>
                <Text>{order.bodega}</Text>
              </>
            )}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Items</Text>
        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={[styles.cell, { flex: 4, fontWeight: "bold", color: "white" }]}>Producto</Text>
            <Text style={[styles.cell, { flex: 2, textAlign: "right", fontWeight: "bold", color: "white" }]}>Cantidad</Text>
            <Text style={[styles.cell, { flex: 2, textAlign: "right", fontWeight: "bold", color: "white" }]}>Precio</Text>
            <Text style={[styles.cell, { flex: 2, textAlign: "right", fontWeight: "bold", color: "white" }]}>Bruto</Text>
              <Text style={[styles.cell, { flex: 1, textAlign: "right", fontWeight: "bold", color: "white" }]}>Desc Prod</Text>
              <Text style={[styles.cell, { flex: 1, textAlign: "right", fontWeight: "bold", color: "white" }]}>Bonif</Text>
              <Text style={[styles.cellLast, { flex: 1, textAlign: "right", fontWeight: "bold", color: "white" }]}>Total</Text>
          </View>
          {tableRows.map((row, idx) => {
            const rowBaseStyle = [styles.tableRow];
            if (idx % 2 === 1) rowBaseStyle.push(styles.tableRowAlt);
            if (row.type === "single") {
              const bruto = row.item.subtotalSinDescuento ?? row.item.subtotal ?? row.item.cantidad * row.item.precioUnitario;
              const neto = row.item.total ?? row.item.subtotal ?? row.item.cantidad * row.item.precioUnitario;
              const descBase = row.item.descuentoLinea ?? Math.max(0, bruto - neto);
              const desc = descBase < 0.005 ? 0 : descBase;
              const qty = row.item.cantidad ?? 0;
              const fallbackUnit = qty > 0 ? bruto / qty : bruto;
              const unit = row.item.precioUnitario && row.item.precioUnitario > 0 ? row.item.precioUnitario : fallbackUnit;
              const directDiscount = desc;
              return (
                <View key={row.item.id || `single-${idx}`} style={rowBaseStyle}>
                  <Text style={[styles.cell, { flex: 4 }]}>{row.item.descripcion}</Text>
                  <Text style={[styles.cell, { flex: 2, textAlign: "right" }]}>{row.item.cantidad}</Text>
                  <Text style={[styles.cell, { flex: 2, textAlign: "right" }]}>{formatCurrency(unit)}</Text>
                  <Text style={[styles.cell, { flex: 2, textAlign: "right" }]}>{formatCurrency(bruto)}</Text>
                  <Text style={[styles.cell, { flex: 1, textAlign: "right" }]}>{formatCurrency(directDiscount)}</Text>
                  <Text style={[styles.cell, { flex: 1, textAlign: "right" }]}>{formatCurrency(0)}</Text>
                  <Text style={[styles.cellLast, { flex: 1, textAlign: "right" }]}>{formatCurrency(neto)}</Text>
                </View>
              );
            }

            if (row.type === "combo-child") {
              const child = row.item;
              const bruto = child.subtotalSinDescuento ?? child.subtotal ?? child.cantidad * child.precioUnitario;
              const neto = child.total ?? child.subtotal ?? child.cantidad * child.precioUnitario;
              const descBase = child.descuentoLinea ?? Math.max(0, bruto - neto);
              const desc = descBase < 0.005 ? 0 : descBase;
              const qty = child.cantidad ?? 0;
              const fallbackUnit = qty > 0 ? bruto / qty : bruto;
              const unit = child.precioUnitario && child.precioUnitario > 0 ? child.precioUnitario : fallbackUnit;
              const directDiscount = desc;
              return (
                <View
                  key={child.id || `combo-child-${row.group.key}-${row.index}`}
                  style={[...rowBaseStyle, styles.comboChildRow]}
                >
                  <Text style={[styles.cell, { flex: 4 }]}>{child.descripcion}</Text>
                  <Text style={[styles.cell, { flex: 2, textAlign: "right" }]}>{child.cantidad}</Text>
                  <Text style={[styles.cell, { flex: 2, textAlign: "right" }]}>{formatCurrency(unit)}</Text>
                  <Text style={[styles.cell, { flex: 2, textAlign: "right" }]}>{formatCurrency(bruto)}</Text>
                  <Text style={[styles.cell, { flex: 1, textAlign: "right" }]}>{formatCurrency(directDiscount)}</Text>
                  <Text style={[styles.cell, { flex: 1, textAlign: "right" }]}>{formatCurrency(0)}</Text>
                  <Text style={[styles.cellLast, { flex: 1, textAlign: "right" }]}>{formatCurrency(neto)}</Text>
                </View>
              );
            }

            const bonus = row.item;
            const bruto = bonus.subtotalSinDescuento ?? bonus.subtotal ?? bonus.cantidad * bonus.precioUnitario;
            const neto = bonus.total ?? bonus.subtotal ?? bonus.cantidad * bonus.precioUnitario;
            const qty = bonus.cantidad ?? 0;
            const fallbackUnit = qty > 0 ? bruto / qty : bruto;
            const unit = bonus.precioUnitario && bonus.precioUnitario > 0 ? bonus.precioUnitario : fallbackUnit;
            const bonusDiscount = bruto;
            return (
              <View
                key={bonus.id || `bonus-child-${row.parentId}-${row.index}`}
                style={[...rowBaseStyle, styles.bonusRow]}
              >
                <Text style={[styles.cell, styles.smallText, styles.italic, { flex: 4 }]}>{`Bonificación: ${bonus.descripcion}`}</Text>
                <Text style={[styles.cell, styles.smallText, { flex: 2, textAlign: "right" }]}>{bonus.cantidad}</Text>
                <Text style={[styles.cell, styles.smallText, { flex: 2, textAlign: "right" }]}>{formatCurrency(unit)}</Text>
                <Text style={[styles.cell, styles.smallText, { flex: 2, textAlign: "right" }]}>{formatCurrency(bruto)}</Text>
                <Text style={[styles.cell, styles.smallText, { flex: 1, textAlign: "right" }]}>{formatCurrency(0)}</Text>
                <Text style={[styles.cell, styles.smallText, { flex: 1, textAlign: "right" }]}>{formatCurrency(bonusDiscount)}</Text>
                <Text style={[styles.cellLast, styles.smallText, { flex: 1, textAlign: "right", fontWeight: "bold" }]}>{formatCurrency(neto)}</Text>
              </View>
            );
          })}
        </View>

        <View style={{ marginTop: 16, flexDirection: "row", justifyContent: "flex-end" }}>
          <View style={{ minWidth: 200, padding: 12, borderWidth: 1, borderColor: "#1d4ed8", borderRadius: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
              <Text style={[styles.infoLabel, { color: "#1e293b" }]}>Subtotal</Text>
              <Text style={styles.infoValue}>{formatCurrency(subtotal)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
              <Text style={[styles.infoLabel, { color: "#1e293b" }]}>Descuento</Text>
              <Text style={styles.infoValue}>{formatCurrency(descuento)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 6, borderTopWidth: 1, borderColor: "#93c5fd" }}>
              <Text style={[styles.headerTitle, { fontSize: 11 }]}>Total</Text>
              <Text style={[styles.headerTitle, { fontSize: 11 }]}>{formatCurrency(total)}</Text>
            </View>
          </View>
        </View>

        {order.observaciones && (
          <View style={{ marginTop: 10 }}>
            <Text style={styles.sectionTitle}>Observaciones</Text>
            <Text>{order.observaciones}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}