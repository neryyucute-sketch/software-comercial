// components/order/OrderModal.tsx
"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import OrderFormFull from "./OrderFormFull";

export default function OrderModal({
  open,
  onOpenChange,
  draft,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  draft: any;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onInteractOutside={(e: any) => e.preventDefault()}
        className="
          max-w-5xl w-[96vw]
          p-0
          max-h-[90dvh] md:max-h-[85vh] lg:max-h-[80vh]
        "
      >
        
         <DialogTitle>
           <span className="block text-2xl font-bold text-blue-700 text-center w-full">Nuevo Pedido</span>
         </DialogTitle>

        {/* Contenedor para que el contenido interno ocupe toda la altura disponible */}
        <div className="flex h-full max-h-[inherit] flex-col">
          <OrderFormFull onClose={() => onOpenChange(false)} draft={draft} open={open} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
