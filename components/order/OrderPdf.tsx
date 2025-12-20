"use client";

import { Document, Page, StyleSheet, Text, View, Image } from "@react-pdf/renderer";
import type { Order, OrderItem } from "@/lib/types";
import { groupOrderComboItems, resolveComboGroupQuantity, resolveComboGroupUnitPrice, type OrderComboGroup } from "@/lib/order-helpers";
import { pickReferenceCode } from "@/lib/utils";

// Estilos básicos para el PDF
const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 10, fontFamily: "Helvetica" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  logo: { width: 140, height: 48, objectFit: "contain" },
  sectionTitle: { fontSize: 11, fontWeight: "bold", marginTop: 10, marginBottom: 4 },
  row: { flexDirection: "row", gap: 8, marginBottom: 2 },
  col: { flex: 1 },
  tableHead: { flexDirection: "row", backgroundColor: "#f1f5f9", borderBottomWidth: 1, borderColor: "#cbd5e1" },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#e2e8f0" },
  cell: { padding: 4, borderRightWidth: 1, borderColor: "#e2e8f0", fontSize: 9 },
  cellLast: { padding: 4, fontSize: 9 },
  bold: { fontWeight: "bold" },
  comboRow: { backgroundColor: "#eff6ff" },
  comboChildRow: { backgroundColor: "#f8fafc" },
  smallText: { fontSize: 8 },
  muted: { color: "#64748b" },
});

function logoForEmpresa(codigoEmpresa?: string) {
  if (codigoEmpresa === "E07") return "/logo_dimisa.jpg";
  return "/logo_codimisa.jpg";
}

function formatCurrency(value: number) {
  return `Q${(Number(value) || 0).toFixed(2)}`;
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

  type DisplayRow =
    | { type: "single"; item: OrderItem; index: number }
    | { type: "combo-parent"; group: OrderComboGroup }
    | { type: "combo-child"; group: OrderComboGroup; item: OrderItem; index: number };

  const tableRows: DisplayRow[] = [];
  const seenCombos = new Set<string>();
  items.forEach((item, index) => {
    const group = comboLookup.get(item);
    if (group) {
      if (seenCombos.has(group.key)) return;
      seenCombos.add(group.key);
      tableRows.push({ type: "combo-parent", group });
      group.items.forEach((line, lineIndex) => {
        tableRows.push({ type: "combo-child", group, item: line, index: lineIndex });
      });
      return;
    }
    tableRows.push({ type: "single", item, index });
  });

  const subtotal = order.subtotal ?? items.reduce((acc, it) => acc + (it.subtotal ?? it.cantidad * it.precioUnitario), 0);
  const descuento = order.descuentoTotal ?? 0;
  const total = order.total ?? subtotal - descuento;

  const numero = order.numeroPedido || order.numeroPedidoTemporal || order.localId || "";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Image src={logo} style={styles.logo} />
          <View>
            <Text style={styles.bold}>Pedido #{numero}</Text>
            <Text>Fecha: {formatDate(order.fecha || order.createdAt)}</Text>
            {order.estado && <Text>Estado: {order.estado}</Text>}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Cliente</Text>
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.bold}>{order.nombreCliente || order.codigoCliente}</Text>
            <Text>Código: {order.codigoCliente}</Text>
            {order.nombreClienteEnvio && <Text>Envío: {order.nombreClienteEnvio}</Text>}
            {order.contactoEntrega && <Text>Contacto: {order.contactoEntrega}</Text>}
            {order.telefonoEntrega && <Text>Tel: {order.telefonoEntrega}</Text>}
          </View>
          <View style={styles.col}>
            <Text>Dirección: {order.direccionEntrega || ""}</Text>
            <Text>Depto/Muni: {(order.departamento || "").concat(order.municipio ? `, ${order.municipio}` : "")}</Text>
            {order.ordenCompra && <Text>Orden de compra: {order.ordenCompra}</Text>}
            {order.formaPago && <Text>Forma de pago: {order.formaPago}</Text>}
            {order.bodega && <Text>Bodega: {order.bodega}</Text>}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Items</Text>
        <View>
          <View style={styles.tableHead}>
            <Text style={[styles.cell, { flex: 5, fontWeight: "bold" }]}>Producto</Text>
            <Text style={[styles.cell, { flex: 1, textAlign: "right", fontWeight: "bold" }]}>Cant</Text>
            <Text style={[styles.cell, { flex: 2, textAlign: "right", fontWeight: "bold" }]}>Bruto</Text>
            <Text style={[styles.cell, { flex: 2, textAlign: "right", fontWeight: "bold" }]}>Desc</Text>
            <Text style={[styles.cellLast, { flex: 2, textAlign: "right", fontWeight: "bold" }]}>Total</Text>
          </View>
          {tableRows.map((row, idx) => {
            if (row.type === "single") {
              const bruto = row.item.subtotalSinDescuento ?? row.item.subtotal ?? row.item.cantidad * row.item.precioUnitario;
              const desc = row.item.descuentoLinea ?? 0;
              const neto = row.item.subtotal ?? bruto;
              return (
                <View key={row.item.id || `single-${idx}`} style={styles.tableRow}>
                  <Text style={[styles.cell, { flex: 5 }]}>{row.item.descripcion}</Text>
                  <Text style={[styles.cell, { flex: 1, textAlign: "right" }]}>{row.item.cantidad}</Text>
                  <Text style={[styles.cell, { flex: 2, textAlign: "right" }]}>{formatCurrency(bruto)}</Text>
                  <Text style={[styles.cell, { flex: 2, textAlign: "right" }]}>{formatCurrency(desc)}</Text>
                  <Text style={[styles.cellLast, { flex: 2, textAlign: "right" }]}>{formatCurrency(neto)}</Text>
                </View>
              );
            }

            if (row.type === "combo-parent") {
              const comboGross = row.group.items.reduce((sum, line) => {
                const lineGross = line.subtotalSinDescuento ?? line.subtotal ?? line.cantidad * line.precioUnitario;
                return sum + lineGross;
              }, 0);
              const comboNet = row.group.totalPrice;
              const comboDiscount = comboGross - comboNet;
              const quantity = resolveComboGroupQuantity(row.group);
              const unitPrice = resolveComboGroupUnitPrice(row.group);
              const comboCode = pickReferenceCode(
                row.group.offerCode,
                row.group.comboCode,
                row.group.items[0]?.codigoOferta,
                row.group.items[0]?.ofertaCodigo,
                row.group.items[0]?.comboCode
              );
              const metaBits = [
                row.group.comboType === "kit" ? "Kit" : "Combo",
                comboCode ? `Código: ${comboCode}` : null,
                `Unit: ${formatCurrency(unitPrice)}`,
              ]
                .filter(Boolean)
                .join(" • ");
              const label = row.group.comboName || comboCode || "Combo / Kit";
              const comboText = metaBits ? `${label}
${metaBits}` : label;
              return (
                <View key={`combo-${row.group.key}`} style={[styles.tableRow, styles.comboRow]}>
                  <Text style={[styles.cell, { flex: 5 }]}>{comboText}</Text>
                  <Text style={[styles.cell, { flex: 1, textAlign: "right" }]}>{quantity}</Text>
                  <Text style={[styles.cell, { flex: 2, textAlign: "right" }]}>{formatCurrency(comboGross)}</Text>
                  <Text style={[styles.cell, { flex: 2, textAlign: "right" }]}>{formatCurrency(comboDiscount)}</Text>
                  <Text style={[styles.cellLast, { flex: 2, textAlign: "right" }]}>{formatCurrency(comboNet)}</Text>
                </View>
              );
            }

            const child = row.item;
            return (
              <View key={child.id || `combo-child-${row.group.key}-${row.index}`} style={[styles.tableRow, styles.comboChildRow]}>
                <Text style={[styles.cell, styles.smallText, styles.muted, { flex: 5, paddingLeft: 12 }]}>{child.descripcion}</Text>
                <Text style={[styles.cell, styles.smallText, styles.muted, { flex: 1, textAlign: "right" }]}>{child.cantidad}</Text>
                <Text style={[styles.cell, styles.smallText, styles.muted, { flex: 2, textAlign: "right" }]}>{"—"}</Text>
                <Text style={[styles.cell, styles.smallText, styles.muted, { flex: 2, textAlign: "right" }]}>{"—"}</Text>
                <Text style={[styles.cellLast, styles.smallText, styles.muted, { flex: 2, textAlign: "right" }]}>{"—"}</Text>
              </View>
            );
          })}
        </View>

        <View style={{ marginTop: 8, flexDirection: "row", justifyContent: "flex-end", gap: 12 }}>
          <View>
            <Text>Subtotal: {formatCurrency(subtotal)}</Text>
            <Text>Descuento: {formatCurrency(descuento)}</Text>
            <Text style={styles.bold}>Total: {formatCurrency(total)}</Text>
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