// components/order/OrderPhotos.tsx
"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";

export default function OrderPhotos({
  photos,
  onChange,
}: {
  photos: { id: string; dataUrl: string; timestamp: number }[];
  onChange: (p: { id: string; dataUrl: string; timestamp: number }[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);

  const addPhoto = (dataUrl: string) => {
    const id = Math.random().toString(36).slice(2);
    onChange([...(photos || []), { id, dataUrl, timestamp: Date.now() }]);
  };

  const onPick = async (file: File) => {
    const reader = new FileReader();
    reader.onload = () => addPhoto(String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.currentTarget.value = "";
        }}
      />
      <Button variant="secondary" onClick={() => fileRef.current?.click()}>
        Tomar/Seleccionar foto
      </Button>

      {(!photos || photos.length === 0) && (
        <div className="text-sm text-muted-foreground">Sin fotos.</div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {photos?.map((p) => (
          <div key={p.id} className="relative">
            <img src={p.dataUrl} alt="foto" className="w-full h-24 object-cover rounded-lg" />
            <button
              className="absolute top-1 right-1 text-xs bg-black/60 text-white rounded px-1"
              onClick={() => onChange(photos.filter((x) => x.id !== p.id))}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
