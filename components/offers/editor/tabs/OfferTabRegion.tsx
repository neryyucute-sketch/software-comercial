"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { OfferEditorApi } from "../useOfferEditor";

type Props = {
  editor: OfferEditorApi;
};

export function OfferTabRegion({ editor }: Props) {
  const { draft, updateScope } = editor;
  if (!draft) return null;

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div>
        <div className="text-sm font-semibold text-slate-900">
          Restricciones por región
        </div>
        <p className="text-xs text-slate-500">
          Si lo dejas vacío, la oferta aplica para todas las regiones y
          departamentos.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label>Regiones</Label>
          <Input
            className="mt-1"
            placeholder="Ej: Centro,Occidente,Oriente"
            value={(draft.scope?.regiones ?? []).join(",")}
            onChange={(e) =>
              updateScope({
                regiones: e.target.value
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>

        <div>
          <Label>Departamentos</Label>
          <Input
            className="mt-1"
            placeholder="Ej: GUATEMALA,QUETZALTENANGO"
            value={(draft.scope?.departamentos ?? []).join(",")}
            onChange={(e) =>
              updateScope({
                departamentos: e.target.value
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
