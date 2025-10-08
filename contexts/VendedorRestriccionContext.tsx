"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { getCachedVendedorRestriccion, syncVendedorRestriccion } from "@/services/vendedorRestriccion";
import { VendedorRestriccion } from "@/types/types";

// 👇 1. Crear contexto con el tipo de datos
type VendedorRestriccionContextType = {
  vendedorRestriccion: VendedorRestriccion[];
  syncRestriccionVendedor : () => Promise<void>;
};

const VendedorRestriccionContext = createContext<VendedorRestriccionContextType | undefined>(undefined);


// 👇 2. Provider
export function VendedorRestriccionProvider({ children }: { children: React.ReactNode }) {
  const [vendedorRestriccion, setVendedorRestriccion] = useState<VendedorRestriccion[]>([]);

  // cargar cache al iniciar
  useEffect(() => {
    getCachedVendedorRestriccion().then(setVendedorRestriccion);
  }, []);

  const handleSyncRestriccionVendedor = async () => {
    await syncVendedorRestriccion();
    const updated = await getCachedVendedorRestriccion();
    setVendedorRestriccion(updated);
  };

  return (
    <VendedorRestriccionContext.Provider value={{ vendedorRestriccion, syncRestriccionVendedor: handleSyncRestriccionVendedor }}>
      {children}
    </VendedorRestriccionContext.Provider>
  );
}

// 👇 3. Hook para usar el contexto
export function useVendedorRestriccion() {
  const ctx = useContext(VendedorRestriccionContext);
  if (!ctx) {
    throw new Error("useRestriccionVendedor debe usarse dentro de RestriccionVendedorProvider");
  }
  return ctx;
}
