// components/order/components/OrderCustomer.tsx
"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import type { Cliente } from "@/lib/types";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function OrderCustomer({
  value,
  onChange,
}: {
  value?: string;
  onChange: (codigoCliente: string) => void;
}) {
  const [clientes, setClientes] = useState<Cliente[]>([]);

  useEffect(() => {
    db.clientes.toArray().then((rows) => {
      rows.sort((a, b) => a.nombreCliente.localeCompare(b.nombreCliente));
      setClientes(rows);
    });
  }, []);

  return (
    <div className="space-y-2">
      <Label>Cliente</Label>
      <Select value={value || ""} onValueChange={(v) => onChange(v)}>
        <SelectTrigger>
          <SelectValue placeholder="Selecciona un cliente" />
        </SelectTrigger>
        <SelectContent className="max-h-80">
          {clientes.map((c) => (
            <SelectItem key={c.codigoCliente} value={c.codigoCliente}>
              {c.nombreCliente} {c.nit ? `· NIT ${c.nit}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
