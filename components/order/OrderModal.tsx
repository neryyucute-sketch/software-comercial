// components/order/OrderModal.tsx
"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import OrderFormFull from "./OrderFormFull";

export default function OrderModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          max-w-5xl w-[96vw]
          p-0 overflow-hidden
          max-h-[90dvh] md:max-h-[85vh] lg:max-h-[80vh]
        "
      >
        {/* Contenedor para que el contenido interno ocupe toda la altura disponible */}
        <div className="flex h-full max-h-[inherit] flex-col">
          <OrderFormFull onClose={() => onOpenChange(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
