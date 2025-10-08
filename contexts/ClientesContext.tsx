"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { Cliente } from "@/lib/types";
import { db, getData } from "@/lib/db";
import { getCachedClientes, syncClientes } from "@/services/clientes";
import { useAuth } from "./AuthContext";

type ClientesContextType = {
  clientes: Cliente[];
  syncing: boolean;
  error: string | null;
  loadClientesFromDB: () => Promise<void>;
  syncClientes: () => Promise<void>;
};

const ClientesContext = createContext<ClientesContextType | undefined>(undefined);

export function ClientesProvider({ children }: { children: React.ReactNode }) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // 🔹 cargar desde IndexedDB
  const loadClientesFromDB = async () => {
    try {
      const local = await getCachedClientes();
      setClientes(local || []);
    } catch (err) {
      console.error("❌ Error cargando clientes locales:", err);
      setClientes([]);
    }
  };

  useEffect(() => {
    async function load() {
      try {
        const cached = await getData<Cliente>("clientes");
        setClientes(cached);
      } catch (e) {
        console.error("❌ Error cargando clientes desde DB:", e);
        setError("No se pudo cargar clientes desde la BD");
      }
    }
    load();
  }, []);

  const handleSyncClientes = async () => {
    try {
      setSyncing(true);
      setError(null);
      await syncClientes(user); // WS → guarda en Dexie
      const updated = await db.clientes.toArray();
      setClientes(updated);
    } catch (e: any) {
      console.error("❌ Error al sincronizar clientes:", e);
      setError(e?.message ?? "Error al sincronizar clientes");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <ClientesContext.Provider
      value={{
        clientes,
        syncing,
        error,
        loadClientesFromDB,
        syncClientes: handleSyncClientes,
      }}
    >
      {children}
    </ClientesContext.Provider>
  );
}

export function useClientes() {
  const ctx = useContext(ClientesContext);
  if (!ctx) throw new Error("useClientes debe usarse dentro de <ClientesProvider>");
  return ctx;
}
