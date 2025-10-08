// components/order/modals/KitConfirmModal.tsx
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function KitConfirmModal({
  open,
  onOpenChange,
  onAccept,
  description,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAccept: () => void;
  description: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar Kit</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm">{description}</div>
          <div className="text-right">
            <Button onClick={() => { onAccept(); onOpenChange(false); }}>Aceptar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
