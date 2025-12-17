"use client";

import { Document, Page, StyleSheet, Text, View, Image } from "@react-pdf/renderer";
import type { Order, OrderItem } from "@/lib/types";

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
  const items = order.items || [];
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
          {items.map((it: OrderItem, idx) => {
            const bruto = it.subtotalSinDescuento ?? it.subtotal ?? it.cantidad * it.precioUnitario;
            const desc = it.descuentoLinea ?? 0;
            const neto = it.subtotal ?? bruto;
            return (
              <View key={it.id || idx} style={styles.tableRow}>
                <Text style={[styles.cell, { flex: 5 }]}>{it.descripcion}</Text>
                <Text style={[styles.cell, { flex: 1, textAlign: "right" }]}>{it.cantidad}</Text>
                <Text style={[styles.cell, { flex: 2, textAlign: "right" }]}>{formatCurrency(bruto)}</Text>
                <Text style={[styles.cell, { flex: 2, textAlign: "right" }]}>{formatCurrency(desc)}</Text>
                <Text style={[styles.cellLast, { flex: 2, textAlign: "right" }]}>{formatCurrency(neto)}</Text>
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