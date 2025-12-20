export type OfferType = "discount" | "bonus" | "combo" | "kit" | "pricelist";
export type OfferDateRange = { validFrom: string; validTo: string; };

export type DiscountTier = {
  from?: number; // cantidad mínima inclusive
  to?: number;   // cantidad máxima inclusive (vacío = en adelante)
  percent?: number;
  amount?: number;
};

export type DiscountConfig = {
  percent?: number;
  amount?: number;
  minQty?: number;
  minAmount?: number;
  type?: string;
  value?: number | undefined;
  tiers?: DiscountTier[];
  perLine?: boolean;
};

export type BonusTargetType = "same" | "sku" | "linea" | "familia" | "proveedor";

export type BonusTarget = {
  type: BonusTargetType;
  productId?: string;     // when type === "sku"
  lineaId?: string;       // when type === "linea"
  familiaId?: string;     // when type === "familia"
  proveedorId?: string;   // when type === "proveedor"
  productIds?: string[];
  lineaIds?: string[];
  proveedorIds?: string[];
  requiereSeleccionUsuario?: boolean;
};

export type BonusConfig = {
  mode?: "acumulado" | "por_linea"; // default acumulado
  buyQty?: number;        // legacy: cada N (sinónimo everyN)
  everyN?: number;        // preferido: cada N unidades califican
  bonusQty?: number;      // legacy: M unidades bonificadas (sinónimo givesM)
  givesM?: number;        // preferido: M a bonificar por aplicación
  maxApplications?: number; // límite opcional de aplicaciones
  target?: BonusTarget;   // qué se bonifica
  sameAsQualifier?: boolean; // legacy flag
};
export type ComboFixedItem = { productoId: string; unidades: number; descripcion?: string };
export type ComboVariableItem = { productoId: string; descripcion?: string };

export type ComboPackConfig = {
  precioFijo: number;
  cantidadTotalProductos: number;
  itemsFijos: ComboFixedItem[];
  itemsVariablesPermitidos: ComboVariableItem[];
};

export type PriceListProductOverride = {
  productId: string;
  price?: number | null;
  description?: string;
  basePrice?: number | null;
};

export type PriceListConfig = {
  products: PriceListProductOverride[];
};

export type OfferScope = {
  canales?: string[];
  subCanales?: string[];
  codigosCliente?: string[];
  codigosProducto?: string[];
  codigosProveedor?: string[];  
  departamentos?: string[];
  vendedores?: string[];
  tiposVendedor?: string[];
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
  referenceCode?: string;
  codigoOferta?: string;
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
  priority?: number | null;
  discount?: DiscountConfig;
  bonus?: BonusConfig;
  pack?: ComboPackConfig;
  priceList?: PriceListConfig;
  version?: number;
  createdAt?: string;
  createdBy?: string;
  updatedAt: string;
  updatedBy?: string;
  deleted?: boolean;
  dirty?: boolean;
  serverId?: string;
};
