"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import type { OfferDef } from "@/lib/types.offers";
import { useOfferEditor } from "./useOfferEditor";
import { OfferTabBasic } from "./tabs/OfferTabBasic";
import { OfferTabProducts } from "./tabs/OfferTabProducts";
import { OfferTabClients } from "./tabs/OfferTabClients";
import { OfferTabRegion } from "./tabs/OfferTabRegion";
import { OfferTabVendor } from "./tabs/OfferTabVendor";
import type { CatalogoGeneral } from "@/lib/types";
import { toast } from "@/hooks/use-toast";


type Props = {
  open: boolean;
  draft: OfferDef | null;
  onClose: () => void;
  onSave: (offer: OfferDef) => Promise<void> | void;
};

interface OfferEditorDialogProps {
  open: boolean;
  draft: OfferDef | null;
  onClose: () => void;
  onSave: (off: OfferDef) => Promise<void>;

  catalogs: {
    proveedores: CatalogoGeneral[];
    familias: CatalogoGeneral[];
    lineas: CatalogoGeneral[];
    canalesVenta : CatalogoGeneral[];
    subCanalesVenta : CatalogoGeneral[];
  };

  catalogsLoading: boolean;
  catalogsError: string | null;
}



export function OfferEditorDialog({
  open,
  draft: propDraft,      // 👈 renombramos el prop
  onClose,
  onSave,
  catalogs,
  catalogsLoading,
  catalogsError,
}: OfferEditorDialogProps) {
  const editor = useOfferEditor(propDraft); // 👈 usamos el prop renombrado
  const { draft } = editor;                 // 👈 aquí ya no hay conflicto

  const handleSave = async () => {
    if (!draft) return;

    if (draft.type === "discount") {
      const tiers = draft.discount?.tiers ?? [];
      const hasValidTier = tiers.some((t) => {
        const pct = Number(t.percent ?? 0);
        const amt = Number(t.amount ?? 0);
        return pct > 0 || amt > 0;
      });

      if (!tiers.length || !hasValidTier) {
        toast({
          title: "Agrega al menos una escala",
          description: "Las ofertas de descuento necesitan escalas con % o monto para guardarse.",
          variant: "default",
        });
        return;
      }
    }

    if (draft.type === "bonus") {
      const cfg: any = draft.bonus || {};
      const everyN = Number(cfg.everyN ?? cfg.buyQty ?? 0);
      const givesM = Number(cfg.givesM ?? cfg.bonusQty ?? 0);
      if (!everyN || everyN <= 0 || !givesM || givesM <= 0) {
        toast({
          title: "Completa la bonificación",
          description: "Ingresa 'cada N' y 'bonifica M' para guardar la oferta.",
          variant: "default",
        });
        return;
      }
      // Normaliza campos legacy
      draft.bonus = {
        ...cfg,
        everyN,
        givesM,
      } as any;
    }

    await onSave(draft);
  };

  if (!draft) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
                <DialogContent>
          <DialogTitle>Editor de Oferta</DialogTitle>
          <DialogDescription>
            Configura los detalles de la oferta, productos aplicables y restricciones.
          </DialogDescription>
          {/* ...resto del contenido... */}
        </DialogContent>
            
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      {/* max-h para el modal y el contenido interno se encarga del scroll */}
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-slate-900">
            {draft.id ? "Editar oferta de descuento" : "Nueva oferta"}
          </DialogTitle>
        </DialogHeader>

        {/* Tabs en columna con área central de altura fija */}
        <Tabs defaultValue="basico" className="mt-1 flex h-full flex-col overflow-hidden">
          <TabsList className="mb-4 flex items-center justify-between gap-1 overflow-x-auto rounded-xl border bg-slate-50 p-1">
            <TabsTrigger className="flex-1" value="basico">
              Básico
            </TabsTrigger>
            <TabsTrigger className="flex-1" value="productos">
              Productos
            </TabsTrigger>
            <TabsTrigger className="flex-1" value="clientes">
              Clientes
            </TabsTrigger>
            <TabsTrigger className="flex-1" value="region">
              Región
            </TabsTrigger>
            <TabsTrigger className="flex-1" value="vendedor">
              Vendedor
            </TabsTrigger>
          </TabsList>

          {/* Área de contenido con altura fija/minima y scroll */}
          <div className="flex-1 min-h-[460px] overflow-y-auto pr-1">
            <TabsContent value="basico" className="h-full">
              <OfferTabBasic
                editor={editor}
                proveedores={catalogs.proveedores}
                lineas={catalogs.lineas}
              />
            </TabsContent>
            <TabsContent value="productos" className="h-full">
              <OfferTabProducts 
                draft={draft}
                update={editor.setDraft}  // 👈 Cambia esto
                proveedores={catalogs.proveedores}
                familias={catalogs.familias}
                lineas={catalogs.lineas}
              />
            </TabsContent>
            <TabsContent value="clientes" className="h-full">
              <OfferTabClients 
                draft={draft}
                update={editor.setDraft}
                canalesVenta={catalogs.canalesVenta}
                subCanalesVenta={catalogs.subCanalesVenta}
              />
            </TabsContent>
            <TabsContent value="region" className="h-full">
              <OfferTabRegion editor={editor} />
            </TabsContent>
            <TabsContent value="vendedor" className="h-full">
              <OfferTabVendor editor={editor} />
            </TabsContent>
          </div>

          {/* Footer fijo abajo */}
          <div className="sticky bottom-0 mt-4 flex justify-end gap-2 border-t border-slate-200 bg-white/90 pb-1 pt-3 backdrop-blur">
            <Button
              variant="outline"
              className="border-slate-300 text-slate-700 hover:bg-slate-100"
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button
              className="bg-black hover:bg-slate-900 text-white"
              onClick={handleSave}
            >
              Guardar oferta
            </Button>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
