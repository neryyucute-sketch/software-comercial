// components/order/modals/ProductQuantityModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ProductQuantityModal({
  open,
  onOpenChange,
  title,
  price,
  initialQty = 1,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  price: number;
  initialQty?: number;
  onConfirm: (qty: number) => void;
}) {
  const [qty, setQty] = useState(initialQty);

  useEffect(() => {
    if (open) setQty(initialQty || 1);
  }, [open, initialQty]);

  const subtotal = useMemo(() => Math.round((price * qty) * 100) / 100, [price, qty]);

  const inc = () => setQty((q) => Math.max(1, q + 1));
  const dec = () => setQty((q) => Math.max(1, q - 1));

  const confirm = () => {
    onConfirm(qty);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Precio unitario</div>
            <div className="font-semibold">Q{price.toFixed(2)}</div>
          </div>

          <div className="flex items-stretch gap-2">
            <Button type="button" variant="secondary" onClick={dec} className="px-3">−</Button>
            <Input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value || 1)))}
              onKeyDown={(e) => { if (e.key === "Enter") confirm(); }}
            />
            <Button type="button" variant="secondary" onClick={inc} className="px-3">+</Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Subtotal</div>
            <div className="text-lg font-semibold">Q{subtotal.toFixed(2)}</div>
          </div>

          <div className="text-right">
            <Button onClick={confirm}>Agregar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
