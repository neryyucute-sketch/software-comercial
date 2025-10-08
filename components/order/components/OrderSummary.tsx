// components/order/components/OrderSummary.tsx
"use client";

import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function OrderSummary({
  discount,
  onDiscountChange,
  itemsTotal,
}: {
  discount: number;
  onDiscountChange: (v: number) => void;
  itemsTotal: number;
}) {
  const total = useMemo(() => {
    const d = Math.max(0, Math.min(100, discount || 0));
    return Math.round(itemsTotal * (1 - d / 100) * 100) / 100;
  }, [discount, itemsTotal]);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 items-center">
        <Label>Descuento (%)</Label>
        <Input
          type="number"
          min={0}
          max={100}
          value={discount}
          onChange={(e) => onDiscountChange(Math.max(0, Math.min(100, Number(e.target.value || 0))))}
        />
      </div>
      <div className="text-right font-semibold">Total: Q{total.toFixed(2)}</div>
    </div>
  );
}
