"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Cliente } from "@/lib/types";

export default function ClienteDetalleModal({
  cliente,
  onClose,
}: {
  cliente: Cliente;
  onClose: () => void;
}) {
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
            <TabsContent value="general" className="mt-4 space-y-3 text-sm">
              <p><span className="font-medium">Código Cliente:</span> {cliente.codigoCliente}</p>
              <p><span className="font-medium">NIT:</span> {cliente.nit || "—"}</p>
              <p><span className="font-medium">Teléfono:</span> {cliente.telefono || "—"}</p>
              <p><span className="font-medium">Correo:</span> {cliente.correo || "—"}</p>
              <p><span className="font-medium">Última Sync:</span> {new Date(cliente.updatedAt).toLocaleDateString()}</p>
            </TabsContent>

            {/* TAB 2 - DIRECCIONES */}
            <TabsContent value="direcciones" className="mt-4 space-y-4">
              {cliente.direccionList?.length ? (
                <ul className="space-y-3">
                  {cliente.direccionList.map((d) => (
                    <li key={d.idt} className="border rounded-lg p-3">
                      <p className="font-medium">{d.direccion}</p>
                      <p className="text-sm text-gray-500">
                        {d.municipio || "—"}, {d.departamento || "—"}
                      </p>
                      {d.codigoPostal && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          Principal
                        </span>
                      )}
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
                  {cliente.documentoList.map((doc) => (
                    <li
                      key={doc.idt}
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
