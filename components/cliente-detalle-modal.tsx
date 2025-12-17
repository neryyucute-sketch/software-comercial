"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Cliente } from "@/lib/types";
import { getAccessToken } from "@/services/auth";

type CatalogoItem = {
  codigo: string;
  descripcion: string;
};

const safeDate = (value: any) => {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
};

export default function ClienteDetalleModal({
  cliente,
  onClose,
}: {
  cliente: Cliente;
  onClose: () => void;
}) {
  const [catalogos, setCatalogos] = useState<{
    precio: CatalogoItem[];
    canal: CatalogoItem[];
    subcanal: CatalogoItem[];
    clasifCuenta: CatalogoItem[];
    depto: CatalogoItem[];
    muni: CatalogoItem[];
    zona: CatalogoItem[];
    ruta: CatalogoItem[];
  }>({ precio: [], canal: [], subcanal: [], clasifCuenta: [], depto: [], muni: [], zona: [], ruta: [] });

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10931/preventa/api/v1";
    const load = async (slug: string) => {
      let headers: Record<string, string> = {};
      try {
        const token = await getAccessToken();
        headers = { Authorization: `Bearer ${token}` };
      } catch (e) {
        // sin sesión activa, intentamos sin token
      }
      try {
        const res = await fetch(`${base}/catalogos-generales/E01/${slug}`, { headers });
        if (!res.ok) return [] as CatalogoItem[];
        const data = await res.json();
        if (!Array.isArray(data)) return [] as CatalogoItem[];
        return data.map((d: any) => ({ codigo: d.codigo ?? d.id ?? "", descripcion: d.descripcion ?? d.nombre ?? "" }));
      } catch (e) {
        return [] as CatalogoItem[];
      }
    };

    (async () => {
      const [precio, canal, subcanal, clasifCuenta, depto, muni, zona, ruta] = await Promise.all([
        load("clasificacion_precios"),
        load("canal_venta"),
        load("sub_canal_venta"),
        load("clasificacion_cuenta"),
        load("departamento"),
        load("municipio"),
        load("zona"),
        load("ruta"),
      ]);
      setCatalogos({ precio, canal, subcanal, clasifCuenta, depto, muni, zona, ruta });
    })();
  }, [cliente?.codigoCliente]);

  const creditLimit =
    (cliente as any).limiteCredito ?? (cliente as any).limite_credito ?? (cliente as any).limiteCreditoCliente;
  const creditDays =
    (cliente as any).diasCredito ?? (cliente as any).dias_credito ?? (cliente as any).diasCreditoCliente;
  const priceList =
    (cliente as any).listaPrecio ??
    (cliente as any).lista_precio ??
    (cliente as any).listaPrecioCliente ??
    (cliente as any).listaPrecioCodigo ??
    (cliente as any).clasificacionPrecios;
  const priceListDesc = (cliente as any).listaPrecioDescripcion || (cliente as any).listaPrecioDesc || "";
  const corporateCode = (cliente as any).codigoClienteCorporativo || (cliente as any).codigoClienteCorp;
  const razonSocial = (cliente as any).razonSocial || cliente.nombreCliente;
  const razonComercial = (cliente as any).razonComercial || razonSocial;
  const status = (cliente as any).estado || (cliente as any).estatus || "—";
  const fiscalAddress = cliente.direccionList?.[0];

  const lookup = (list: CatalogoItem[], code?: string | null) => {
    if (code === undefined || code === null || code === "") return "—";
    const normalize = (v: any) => String(v).trim();
    const stripZeros = (v: string) => v.replace(/^0+/, "") || "0";
    const codeNorm = normalize(code);
    const codeNoZeros = stripZeros(codeNorm);
    const item = list.find((i) => {
      const a = normalize(i.codigo);
      return a === codeNorm || stripZeros(a) === codeNoZeros;
    });
    if (!item) return codeNorm;
    const descr = item.descripcion || "";
    return descr ? `${item.codigo} · ${descr}` : item.codigo;
  };

  const priceListLabel = useMemo(() => {
    const fromCatalog = lookup(catalogos.precio, priceList);
    if (fromCatalog !== "—" && fromCatalog !== priceList) return fromCatalog;
    if (priceList && priceListDesc) return `${priceList} · ${priceListDesc}`;
    if (priceList) return priceList;
    return "—";
  }, [catalogos.precio, priceList, priceListDesc]);

  const canalCode = (cliente as any).canalVenta || (cliente as any).canal_venta || (cliente as any).codigoCanal;
  const canalDesc = (cliente as any).canalVentaDescripcion || (cliente as any).descCanalVenta || (cliente as any).canal_descripcion;
  const canalLabel = useMemo(() => {
    const fromCatalog = lookup(catalogos.canal, canalCode);
    if (fromCatalog !== "—" && fromCatalog !== canalCode) return fromCatalog;
    if (canalCode && canalDesc) return `${canalCode} · ${canalDesc}`;
    if (canalCode) return canalCode;
    return "—";
  }, [catalogos.canal, canalCode, canalDesc]);

  const subcanalCode = (cliente as any).subCanalVenta || (cliente as any).sub_canal_venta || (cliente as any).codigoSubcanal;
  const subcanalDesc = (cliente as any).subCanalVentaDescripcion || (cliente as any).descSubCanal || (cliente as any).subcanal_descripcion;
  const subcanalLabel = useMemo(() => {
    const fromCatalog = lookup(catalogos.subcanal, subcanalCode);
    if (fromCatalog !== "—" && fromCatalog !== subcanalCode) return fromCatalog;
    if (subcanalCode && subcanalDesc) return `${subcanalCode} · ${subcanalDesc}`;
    if (subcanalCode) return subcanalCode;
    return "—";
  }, [catalogos.subcanal, subcanalCode, subcanalDesc]);

  const clasifCuentaCode =
    (cliente as any).clasificacionCuenta ||
    (cliente as any).clasificacion_cuenta ||
    (cliente as any).clasificacionCuentaCodigo;
  const clasifCuentaDesc = (cliente as any).clasificacionCuentaDescripcion || (cliente as any).clasificacion_cuenta_desc;
  const clasifCuentaLabel = useMemo(() => {
    const fromCatalog = lookup(catalogos.clasifCuenta, clasifCuentaCode);
    if (fromCatalog !== "—" && fromCatalog !== clasifCuentaCode) return fromCatalog;
    if (clasifCuentaCode && clasifCuentaDesc) return `${clasifCuentaCode} · ${clasifCuentaDesc}`;
    if (clasifCuentaCode) return clasifCuentaCode;
    return "—";
  }, [catalogos.clasifCuenta, clasifCuentaCode, clasifCuentaDesc]);

  const clasifPrecioCode = (cliente as any).clasificacionPrecios || (cliente as any).clasificacion_precios;
  const clasifPrecioLabel = useMemo(() => lookup(catalogos.precio, clasifPrecioCode), [catalogos.precio, clasifPrecioCode]);

  const rutaCode = cliente.rutaVenta || (cliente as any).codigoRuta || (cliente as any).ruta;
  const rutaLabel = useMemo(() => {
    const fromCatalog = lookup(catalogos.ruta, rutaCode);
    if (fromCatalog !== "—" && fromCatalog !== rutaCode) return fromCatalog;
    if (rutaCode) return `Ruta ${rutaCode}`;
    return "—";
  }, [catalogos.ruta, rutaCode]);
  const deptoLabel = useMemo(() => lookup(catalogos.depto, fiscalAddress?.departamento as any), [catalogos.depto, fiscalAddress?.departamento]);
  const muniLabel = useMemo(() => lookup(catalogos.muni, fiscalAddress?.municipio as any), [catalogos.muni, fiscalAddress?.municipio]);
  const zonaLabel = useMemo(() => lookup(catalogos.zona, (fiscalAddress as any)?.zona), [catalogos.zona, fiscalAddress]);

  const infoBlocks = [
    { label: "Código", value: cliente.codigoCliente },
    { label: "Código corporativo", value: corporateCode || "—" },
    { label: "NIT", value: cliente.nit || "—" },
    { label: "Razón social", value: razonSocial },
    { label: "Razón comercial", value: razonComercial },
    { label: "Teléfono", value: cliente.telefono || "—" },
    { label: "Correo", value: cliente.correo || "—" },
    { label: "Canal", value: canalLabel },
    { label: "Subcanal", value: subcanalLabel },
    { label: "Clasificación cuenta", value: clasifCuentaLabel },
    { label: "Clasificación de precios", value: clasifPrecioLabel },
    { label: "Lista de precios", value: priceListLabel },
    { label: "Límite de crédito", value: creditLimit ? `Q${Number(creditLimit).toLocaleString()}` : "—" },
    { label: "Días de crédito", value: creditDays ?? "—" },
    { label: "Ruta", value: rutaLabel },
    { label: "Departamento fiscal", value: deptoLabel },
    { label: "Municipio fiscal", value: muniLabel },
    { label: "Zona", value: zonaLabel },
    { label: "Estado", value: status },
    { label: "Última sync", value: safeDate(cliente.updatedAt) },
  ];
  return (
    <Dialog open={!!cliente} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {cliente?.nombreCliente}
          </DialogTitle>
        </DialogHeader>

        {cliente && (
          <Tabs defaultValue="general" className="mt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">Información General</TabsTrigger>
              <TabsTrigger value="direcciones">Direcciones + Georreferencia</TabsTrigger>
              <TabsTrigger value="documentos">Documentos</TabsTrigger>
            </TabsList>

            {/* TAB 1 - INFO GENERAL */}
            <TabsContent value="general" className="mt-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {infoBlocks.map((info) => (
                  <div
                    key={info.label}
                    className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white px-4 py-3 shadow-sm"
                  >
                    <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
                      {info.label}
                    </p>
                    <p className="mt-1 text-slate-900 font-semibold break-words">{info.value}</p>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* TAB 2 - DIRECCIONES */}
            <TabsContent value="direcciones" className="mt-4 space-y-4">
              {cliente.direccionList?.length ? (
                <ul className="space-y-3">
                  {cliente.direccionList.map((d, idx) => (
                    <li
                      key={d.idt || `${d.direccion}-${idx}`}
                      className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{d.direccion}</p>
                          <p className="text-sm text-slate-600">
                            {d.municipio || "—"}, {d.departamento || "—"}
                          </p>
                          {d.codigoPostal && (
                            <p className="text-xs text-slate-500 mt-1">CP: {d.codigoPostal}</p>
                          )}
                        </div>
                        {d.tipo && (
                          <span className="text-[11px] uppercase tracking-wide rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 border border-emerald-100">
                            {d.tipo}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500">No hay direcciones registradas.</p>
              )}

              {/* Placeholder para georreferencia */}
              <div className="w-full h-64 bg-gray-100 border rounded-lg flex items-center justify-center">
                <span className="text-gray-500">[Mapa / Georreferencia aquí]</span>
              </div>
            </TabsContent>

            {/* TAB 3 - DOCUMENTOS */}
            <TabsContent value="documentos" className="mt-4 space-y-4">
              {cliente.documentoList?.length ? (
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {cliente.documentoList.map((doc, idx) => (
                    <li
                      key={doc.idt || `${doc.tipo}-${doc.numero}-${idx}`}
                      className="border rounded-lg p-3 flex flex-col gap-2"
                    >
                      <p className="font-medium">{doc.tipo}</p>
                      <p className="text-sm text-gray-500">
                        {doc.numero} • {doc.fecha}
                      </p>

                      {/* Simulación: PDF o Imagen */}
                      {doc.tipo === "pdf" ? (
                        <iframe
                          src="/docs/sample.pdf"
                          className="w-full h-48 border rounded"
                        />
                      ) : (
                        <img
                          src="/docs/sample.jpg"
                          alt="Documento"
                          className="w-full h-48 object-cover rounded"
                        />
                      )}

                      <a
                        href={doc.tipo === "pdf" ? "/docs/sample.pdf" : "/docs/sample.jpg"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Ver completo
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Ejemplos de prueba */}
                  <div className="border rounded-lg p-3">
                    <p className="font-medium">Factura escaneada</p>
                    <iframe
                      src="https://fotos.codimisa.com/logo_codimisa.jpg"
                      className="w-full h-48 border rounded"
                    />
                    <a
                      href="https://fotos.codimisa.com/logo_codimisa.jpg"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Ver completo
                    </a>
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="font-medium">DPI cliente</p>
                    <img
                      src="https://fotos.codimisa.com/logo_codimisa.jpg"
                      alt="DPI"
                      className="w-full h-48 object-cover rounded"
                    />
                    <a
                      href="https://fotos.codimisa.com/logo_codimisa.jpg"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Ver completo
                    </a>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
