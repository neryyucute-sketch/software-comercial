"use client";

import { useEffect, useState } from "react";
import type { OfferDef } from "@/lib/types.offers";

export type OfferEditorApi = {
  draft: OfferDef | null;
  setDraft: (updater: (draft: OfferDef) => OfferDef) => void;
  updateScope: (partial: any) => void;
};

function normalizeOffer(offer: OfferDef | null): OfferDef | null {
  if (!offer) return null;
  return {
    ...offer,
    stackableWithSameProduct: offer.stackableWithSameProduct ?? false,
  };
}

export function useOfferEditor(initial: OfferDef | null): OfferEditorApi {
  const [draft, setDraftState] = useState<OfferDef | null>(normalizeOffer(initial));

  useEffect(() => {
    setDraftState(normalizeOffer(initial));
  }, [initial]);

  const setDraft = (updater: (draft: OfferDef) => OfferDef) => {
    setDraftState((prev) => (prev ? updater(prev) : prev));
  };

  const updateScope = (partial: any) => {
    setDraft((d) => ({
      ...d,
      scope: { ...(d.scope ?? {}), ...partial },
    }));
  };

  return { draft, setDraft, updateScope };
}
