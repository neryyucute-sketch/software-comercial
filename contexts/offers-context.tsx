"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { OfferDef } from "../lib/types.offers";
import {
  getOfferDefs,
  saveOfferDef,
  deleteOfferDef,
} from "@/services/offers.repo";

type OffersContextType = {
  offers: OfferDef[];
  loading: boolean;
  reload: () => Promise<void>;
  addOrUpdate: (offer: OfferDef) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

const OffersContext = createContext<OffersContextType | null>(null);

export function OffersProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [offers, setOffers] = useState<OfferDef[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    const rows = await getOfferDefs();
    setOffers(rows);
  };

  const addOrUpdate = async (offer: OfferDef) => {
    await saveOfferDef(offer);
    await reload();
  };

  const remove = async (id: string) => {
    await deleteOfferDef(id);
    await reload();
  };

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  return (
    <OffersContext.Provider
      value={{ offers, loading, reload, addOrUpdate, remove }}
    >
      {children}
    </OffersContext.Provider>
  );
}

export function useOffers() {
  const ctx = useContext(OffersContext);
  if (!ctx) {
    throw new Error("useOffers must be used within OffersProvider");
  }
  return ctx;
}
