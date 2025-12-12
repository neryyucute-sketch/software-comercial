"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { OfferEditorApi } from "../useOfferEditor";

type Props = {
  editor: OfferEditorApi;
};

export function OfferTabBasic({ editor }: Props) {
  const { draft, setDraft } = editor;
  if (!draft) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Nombre</Label>
            <Input
              className="mt-1"
              value={draft.name}
              onChange={(e) =>
                setDraft((d) => ({ ...d, name: e.target.value }))
              }
            />
          </div>

          <div>
            <Label>Estado</Label>
            <select
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/70"
              value={draft.status}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  status: e.target.value as typeof d.status,
                }))
              }
            >
              <option value="draft">Borrador</option>
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </div>
        </div>

        <div>
          <Label>Descripción</Label>
          <textarea
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/70"
            rows={3}
            value={draft.description || ""}
            onChange={(e) =>
              setDraft((d) => ({ ...d, description: e.target.value }))
            }
          />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label>Tipo</Label>
            <select
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/70"
              value={draft.type}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  type: e.target.value as typeof d.type,
                }))
              }
            >
              <option value="discount">Descuento</option>
              <option value="bonus">Bonificación</option>
              <option value="combo">Combo</option>
              <option value="kit">Kit</option>
              <option value="pricelist">Lista de precios</option>
            </select>
          </div>

          <div>
            <Label>Válido desde</Label>
            <Input
              type="date"
              className="mt-1"
              value={draft.dates.validFrom}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  dates: { ...d.dates, validFrom: e.target.value },
                }))
              }
            />
          </div>
          <div>
            <Label>Válido hasta</Label>
            <Input
              type="date"
              className="mt-1"
              value={draft.dates.validTo}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  dates: { ...d.dates, validTo: e.target.value },
                }))
              }
            />
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3">
          <input
            id="stackableWithSameProduct"
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            checked={!!draft.stackableWithSameProduct}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                stackableWithSameProduct: e.target.checked,
              }))
            }
          />
          <div className="space-y-1">
            <Label htmlFor="stackableWithSameProduct">Permitir combinar con otras ofertas del mismo producto</Label>
            <p className="text-xs text-slate-600">
              Si está activo, esta oferta puede coexistir con otras que afecten los mismos productos. De lo contrario, se considerará exclusiva por producto.
            </p>
          </div>
        </div>
      </div>

      {/* Descuento */}
      {draft.type === "discount" && (
        <div className="grid gap-4 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
          <div>
            <div className="text-sm font-semibold text-emerald-900">
              Configuración del descuento
            </div>
            <p className="text-xs text-emerald-800/80">
              Usa un % o un monto fijo. Puedes condicionar por cantidad o monto
              alcanzado.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>% descuento</Label>
              <Input
                type="number"
                className="mt-1"
                value={draft.discount?.percent ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    discount: {
                      ...(d.discount ?? {}),
                      percent: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    },
                  }))
                }
              />
            </div>
            <div>
              <Label>Monto fijo (Q)</Label>
              <Input
                type="number"
                className="mt-1"
                value={draft.discount?.amount ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    discount: {
                      ...(d.discount ?? {}),
                      amount: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    },
                  }))
                }
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Cantidad mínima (unidades)</Label>
              <Input
                type="number"
                className="mt-1"
                value={draft.discount?.minQty ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    discount: {
                      ...(d.discount ?? {}),
                      minQty: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    },
                  }))
                }
              />
            </div>
            <div>
              <Label>Monto mínimo (Q)</Label>
              <Input
                type="number"
                className="mt-1"
                value={draft.discount?.minAmount ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    discount: {
                      ...(d.discount ?? {}),
                      minAmount: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    },
                  }))
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
