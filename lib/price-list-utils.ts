import type { PriceList } from "./types";

export type PriceListSelection = {
  requestedCode?: string | null;
  matchedList?: PriceList;
  baseList?: PriceList;
  effectiveList?: PriceList;
};

const NUMERIC_PATTERN = /^-?\d+(?:\.\d+)?$/;

const normalizeCompany = (companyId?: string) => (companyId || "general").trim().toLowerCase();

const isNumeric = (value: string) => NUMERIC_PATTERN.test(value);

const normalizeCode = (value?: string | number | null) => {
  if (value === undefined || value === null) return null;
  const txt = String(value).trim();
  return txt.length ? txt : null;
};

const matchesPriceList = (list: PriceList, target: string, targetNumber: number | null) => {
  const listCodeRaw = normalizeCode(list.code);
  if (listCodeRaw) {
    const listCode = listCodeRaw.toLowerCase();
    const targetCode = target.toLowerCase();
    if (listCode === targetCode) return true;
    if (isNumeric(listCodeRaw) && isNumeric(target)) {
      if (Number(listCodeRaw) === Number(target)) return true;
    }
  }

  if (targetNumber !== null && typeof list.tier === "number") {
    return Number(list.tier) === targetNumber;
  }

  return false;
};

const isBaseList = (list: PriceList) => {
  const code = normalizeCode(list.code)?.toLowerCase();
  if (code === "default" || code === "base") return true;
  return (list.tier ?? 0) === 0;
};

export const extractCustomerPriceCode = (customer: any): string | null => {
  if (!customer) return null;
  const candidates = [
    customer.clasificacionPrecios,
    customer.clasificacion_precios,
    customer.listaPrecio,
    customer.lista_precio,
    customer.listaPrecioCodigo,
    customer.listaPrecioCod,
    customer.priceList,
    customer.priceListCode,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeCode(candidate);
    if (normalized) return normalized;
  }

  return null;
};

export function selectCustomerPriceList(
  customer: any,
  priceLists: PriceList[] = [],
  companyId?: string,
): PriceListSelection {
  if (!priceLists.length) {
    return { requestedCode: extractCustomerPriceCode(customer) };
  }

  const scopedCompany = normalizeCompany(companyId);
  const activeLists = priceLists.filter((pl) => pl && (pl.isActive ?? true));
  const scoped = activeLists.filter((pl) => normalizeCompany(pl.companyId) === scopedCompany);
  const relevant = scoped.length ? scoped : activeLists;

  const requestedCode = extractCustomerPriceCode(customer);
  const targetNumber = requestedCode && isNumeric(requestedCode) ? Number(requestedCode) : null;

  const matchedList = requestedCode
    ? relevant.find((pl) => matchesPriceList(pl, requestedCode, targetNumber))
    : undefined;

  const baseList = relevant.find((pl) => isBaseList(pl)) ?? relevant[0];
  const effectiveList = matchedList ?? baseList ?? relevant[0];

  return {
    requestedCode,
    matchedList,
    baseList,
    effectiveList,
  };
}
