"use client";

import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

export type ProductSearchMode = "producto" | "proveedor" | "familia" | "subfamilia";

type ProductLike = {
  codigoProducto?: string;
  descripcion?: string;
};

type Props = {
  mode: ProductSearchMode;
  onModeChange: (mode: ProductSearchMode) => void;
  onSelectCode: (code: string) => void;
  selectedSkus: string[];
  onRemoveSku: (sku: string) => void;
  localProducts?: ProductLike[];
};

export function ProductCriteriaSelector({
  mode,
  onModeChange,
  onSelectCode,
  selectedSkus,
  onRemoveSku,
  localProducts = [],
}: Props) {
  const [search, setSearch] = useState("");
  const [remote, setRemote] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setRemote([]);
  }, [mode]);

  useEffect(() => {
    if (!search) {
      setRemote([]);
      return;
    }
    let ignore = false;
    const controller = new AbortController();

    async function run() {
      try {
        setLoading(true);
        const base = API.replace(/\/$/, "");
        const path =
          mode === "producto"
            ? "/productos/buscar"
            : mode === "proveedor"
            ? "/catalogos/proveedores"
            : mode === "familia"
            ? "/catalogos/familias"
            : "/catalogos/subfamilias";
        const url = `${base}${path}?q=${encodeURIComponent(search)}`;
        
        // 👇 Agrega autenticación
        const token = localStorage.getItem('token');
        const headers: HeadersInit = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        
        const res = await fetch(url, { 
          signal: controller.signal,
          headers  // 👈 Envía el token
        });
        
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        if (!ignore)
          setRemote(Array.isArray(data) ? data : data.items ?? []);
      } catch {
        if (!ignore) setRemote([]);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    run();
    return () => {
      ignore = true;
      controller.abort();
    };
  }, [search, mode]);

  const fallbackLocal = useMemo(() => {
    if (!search || mode !== "producto") return [];
    const q = search.toLowerCase();
    return localProducts
      .filter(
        (p) =>
          (p.codigoProducto ?? "").toLowerCase().includes(q) ||
          (p.descripcion ?? "").toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [search, mode, localProducts]);

  const list = remote.length ? remote : fallbackLocal;

  return (
    <div className="space-y-3">
      <div className="mb-1 text-xs font-semibold text-slate-700">
        Tipo de criterio
      </div>
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        {(
          [
            ["producto", "Producto"],
            ["proveedor", "Proveedor"],
            ["familia", "Línea"],
            ["subfamilia", "Sublínea"],
          ] as [ProductSearchMode, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => onModeChange(value)}
            className={
              "rounded-full border px-3 py-1.5 " +
              (mode === value
                ? "border-sky-600 bg-sky-50 text-sky-700"
                : "border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100")
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div>
        <Label>
          Buscar{" "}
          {mode === "producto"
            ? "productos"
            : mode === "proveedor"
            ? "proveedores"
            : mode === "familia"
            ? "líneas"
            : "sublíneas"}
        </Label>
        <Input
          className="mt-1"
          placeholder="Escribe para buscar…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 text-xs">
          {loading && (
            <div className="px-2 py-1.5 text-slate-400">Buscando…</div>
          )}
          {!loading &&
            list.map((p: any) => {
              const code =
                p.codigoProducto ?? p.codigo ?? p.id ?? "";
              const desc = p.descripcion ?? p.nombre ?? "";
              if (!code) return null;
              return (
                <button
                  key={code}
                  type="button"
                  className="flex w-full items-center justify-between px-2 py-1.5 text-left hover:bg-emerald-50"
                  onClick={() => onSelectCode(code)}
                >
                  <span className="font-medium text-slate-800">
                    {code}
                  </span>
                  <span className="ml-2 flex-1 truncate text-slate-500">
                    {desc}
                  </span>
                  <span className="ml-2 text-[11px] text-emerald-700">
                    Agregar
                  </span>
                </button>
              );
            })}
          {!loading && list.length === 0 && (
            <div className="px-2 py-1.5 text-slate-400">
              Sin resultados.
            </div>
          )}
        </div>
      </div>

      <div>
        <Label>Productos incluidos</Label>
        <div className="mt-1 flex min-h-[40px] flex-wrap gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
          {selectedSkus.length === 0 && (
            <span className="text-xs text-slate-400">
              Aún no has agregado productos.
            </span>
          )}
          {selectedSkus.map((sku) => (
            <span
              key={sku}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800"
            >
              {sku}
              <button
                type="button"
                className="ml-0.5 text-emerald-700/70 hover:text-emerald-900"
                onClick={() => onRemoveSku(sku)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
