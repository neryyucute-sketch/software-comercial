"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { OfferEditorApi } from "../useOfferEditor";

type Props = {
  editor: OfferEditorApi;
};

export function OfferTabVendor({ editor }: Props) {
  const { draft, updateScope } = editor;
  if (!draft) return null;

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div>
        <div className="text-sm font-semibold text-slate-900">
          Restricciones por vendedor
        </div>
        <p className="text-xs text-slate-500">
          Si lo dejas vacío, la oferta aplica para todos los tipos de vendedor y
          vendedores.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label>Tipo de vendedor</Label>
          <Input
            className="mt-1"
            placeholder="Ej: Ruteo,Mayoreo,Supervisor"
            value={(draft.scope?.vendedores ?? []).join(",")}
            onChange={(e) =>
              updateScope({
                tiposVendedor: e.target.value
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>

        <div>
          <Label>Vendedores</Label>
          <Input
            className="mt-1"
            placeholder="Ej: V001,V002,V003"
            value={(draft.scope?.vendedores ?? []).join(",")}
            onChange={(e) =>
              updateScope({
                vendedores: e.target.value
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
