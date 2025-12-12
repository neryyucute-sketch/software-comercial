export type OfferType = "discount" | "bonus" | "combo" | "kit" | "pricelist";
export type OfferDateRange = { validFrom: string; validTo: string; };

export type DiscountConfig = { percent?: number; amount?: number; minQty?: number; minAmount?: number;type?:string; value?:number| undefined; };
export type BonusConfig = { buyQty: number; bonusQty: number; productId?: string; sameAsQualifier?: boolean; };
export type PackItem = { productId: string; qty: number; description?: string; };

export type OfferScope = {
  canales?: string[];
  subCanales?: string[];
  codigosCliente?: string[];
  codigosProducto?: string[];
  codigosProveedor?: string[];  
  departamentos?: string[];
  vendedores?: string[];
  regiones?: string[];
  codigosLinea?: string[];
  codigosFamilia?: string[];
  codigosSubfamilia?: string[];
};
export type OfferDef = {
  id: string;
  codigoEmpresa: string;
  type: OfferType;
  name: string;
  description?: string;
  status: "draft"|"active"|"inactive";
  dates: {
    validFrom: string;
    validTo: string;
  };
  scope?: OfferScope;
  products?: string[];
  familias?: string[];
  subfamilias?: string[];
  proveedores?: string[];
  // Permite combinar con otras ofertas que impactan el mismo producto
  stackableWithSameProduct?: boolean;
  discount?: DiscountConfig;
  bonus?: BonusConfig;
  pack?: { price: number; items: PackItem[] }; // precio general (no se distribuye)
  version?: number;
  updatedAt: string;
  deleted?: boolean;
  dirty?: boolean;
  serverId?: string;
};
