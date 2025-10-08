// ProductsContext.tsx
"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { getCachedProducts, syncProducts } from "@/services/products";
import type { Product } from "../lib/types";
import { getData, db } from "@/lib/db";
import { useAuth } from "../contexts/AuthContext"  // 👈 importa el context


type ProductsContextType = {
  products: Product[];
  syncing: boolean;
  error: string | null;
  loadProductsFromDB: () => Promise<void>
  syncProducts: () => Promise<void>;
};

const ProductsContext = createContext<ProductsContextType | undefined>(undefined);

export function ProductsProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();


    // 🔹 método para leer únicamente desde IndexedDB
  const loadProductsFromDB = async () => {
    try{
      const localProducts = await getCachedProducts(); // 👈 aquí va el await
      setProducts(localProducts || []) // 👈 ya es Product[], no la promesa
    }catch(err){
      console.error("❌ Error cargando productos locales:", err)
      setProducts([]) // fallback
    }
  }
  
// ProductsContext.tsx
useEffect(() => {
  async function load() {
    try {
      const cached = await getData<Product>("products")
      setProducts(cached);
    } catch (e) {
      console.error("Error cargando productos de la BD:", e);
      setError("No se pudo cargar productos desde la BD");
    }
  }
  load();
}, []);

  // 🔹 sincronizar solo cuando se mande llamar explícitamente
const handleSyncProducts = async () => {
  try {
    setSyncing(true);
    setError(null);    
    await syncProducts(user); // esto guarda en la BD
    const updated = await db.products.toArray(); // 👈 refrescar desde BD
    setProducts(updated);
  } catch (e: any) {
    console.error("Error al sincronizar productos:", e);
    setError(e?.message ?? "Error al sincronizar productos");
  } finally {
    setSyncing(false);
  }
};

  return (
    <ProductsContext.Provider
      value={{ products, syncing, error, loadProductsFromDB, syncProducts: handleSyncProducts }}
    >
      {children}
    </ProductsContext.Provider>
  );
}

export function useProducts() {
  const ctx = useContext(ProductsContext);
  if (!ctx) throw new Error("useProducts debe usarse dentro de <ProductsProvider>");
  return ctx;
}
