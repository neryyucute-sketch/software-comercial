// Tipos principales del sistema de preventa


export type DeviceCache = {
  id: string; // "device"
  deviceId: string;
};

export type VendedorRestriccion = {
  idt: number;
  codigoEmpresa: string;
  codigoVendedor: string;
  codigoSublinea: string;
};

export type Vendedor = {
  idt: number;
  codigoEmpresa: string;
  codigoVendedor: string;
  nombreVendedor: string;
};

export interface ClienteDocumento {
  idt: string;
  tipo: string;      // ej. NIT, DPI
  numero: string;    // valor del documento
  fecha: string;
}

export interface ClienteDireccion {
  idt: string;
  tipo: string;      // fiscal, entrega, cobro
  direccion: string; // dirección completa
  municipio?: string;
  departamento?: string;
  codigoPostal?: string;
}

export interface Cliente {
  idt: string;                // id interno (primary key)
  codigoCliente: string;      // código asignado
  nombreCliente: string;             // nombre o razón social
  nit?: string;               // NIT
  telefono?: string;
  correo?: string;
  documentoList?: ClienteDocumento[];
  direccionList ?: ClienteDireccion[];
  rutaVenta?: string;
  canalVenta?:string;
  subCanalVenta?:string;
  updatedAt: string;          // fecha de última sync
}

export interface Product {
  idt: string;
  codigoProducto: string;
  descripcion: string;
  descripcionCorta?: string;

  codigoProveedor?: string;
  proveedor?: string;

  codigoLinea?: string;
  linea?: string;

  codigoFamilia?: string | null;
  familia?: string;

  codigoSubfamilia?: string | null;
  subfamilia?: string;

  codigoFiltroVenta?: string | null;
  filtroVenta?: string;

  urlImg?: string;

  codigoCategoria?: string | null;
  categoria?: string;

  presentacion?: string;
  codigo_upc?: string;

  precio?: number | 0;
  inventario?: number;

  isActive?: boolean;
}


export function mapCodimisaToProduct(src: Product): Product {
  const id =
    (typeof globalThis !== "undefined" &&
      (globalThis as any).crypto &&
      (globalThis as any).crypto.randomUUID
      ? (globalThis as any).crypto.randomUUID()
      : Math.random().toString(36).slice(2));

  return {
    idt: src.idt,
    codigoProducto: src.codigoProducto ?? src.codigoProducto,
    descripcion: src.descripcion ?? src.descripcion,
    precio: src.precio ?? 0,
    subfamilia: src.subfamilia ?? src.familia ?? "Varios",
    inventario: src.inventario ?? 0,
    codigoFiltroVenta: src.codigoFiltroVenta ?? "",
    filtroVenta: src.filtroVenta ?? "",
    familia: src.familia ?? "Varios",
    urlImg: src.urlImg ?? "",
    isActive: src.isActive ?? true,
  };
}


export interface ComboProduct {
  productId: string
  isFixed: boolean
  quantity: number
}

export interface ComboRestrictions {
  regions?: string[]
  vendorIds?: string[]
  customerCriteria?: {
    channels?: string[]
    codes?: string[]
  }
}

export interface Combo {
  id: string
  name: string
  description: string
  price: number

  // Modelo 1 (tu data original)
  totalProducts: number
  fixedProducts: ComboProduct[]
  optionalProductLines: string[]
  optionalProductIds?: string[]

  // Modelo 2 (lo que la UI también usa)
  optionalProducts?: Array<{ productId: string; quantity: number }>
  minOptionalProducts?: number
  maxOptionalProducts?: number

  restrictions: ComboRestrictions
  isActive: boolean
  validFrom: Date
  validTo: Date
  createdAt: Date
}

export interface Kit {
  id: string
  name: string
  description: string
  price: number
  products: Array<{ productId: string; quantity: number }>
  restrictions: ComboRestrictions
  isActive: boolean
  validFrom: Date
  validTo: Date
  createdAt: Date
}

export interface Offer {
  id: string
  name: string
  type: "combo" | "kit" | "bonus" | "discount"
  description: string
  products?: string[]
  combo?: Combo
  kit?: Kit
  discountPercent?: number
  discountAmount?: number
  isActive: boolean
  validFrom: Date
  validTo: Date
}

export interface ComboOrderItem {
  comboId: string
  selectedProducts: Array<{ productId: string; quantity: number }>
  unitPrice: number
  total: number
}

export interface KitOrderItem {
  kitId: string
  unitPrice: number
  total: number
  // productos ya vienen definidos por el Kit
}

export type OrderItem = {
  id: string; // uuid local del item
  productoId: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  subtotalSinDescuento?: number;
  descuentoLinea?: number;
  total?: number;
  // metadata opcional
  priceSource?: "lista" | "oferta" | "base" | "default" | "negotiated";
  priceListName?: string;
  priceListId?: string;
  priceListCode?: string;
  codigoProveedor?: string | null;
  nombreProveedor?: string | null;
  codigoLinea?: string | null;
  nombreLinea?: string | null;
  comboId?: string | null;
  kitId?: string | null;
  comboGroupId?: string | null;
  comboCode?: string | null;
  comboName?: string | null;
  comboPackPrice?: number;
  comboPacksQty?: number;
  comboType?: "combo" | "kit";
  esBonificacion?: boolean;
  promoBonificacionId?: string;
  ofertaIdAplicada?: string;
  ofertaNombre?: string;
  ofertaCodigo?: string | null;
  codigoOferta?: string | null;
  tipoOferta?: "discount" | "bonus" | "combo" | "kit" | "pricelist" | "lista";
  parentItemId?: string | null;
  relatedItemIds?: string[];
  lineNumber?: number;
};

export type OrderStatus =
  | "ingresado"
  | "programado"
  | "autorizado_creditos"
  | "en_bodega"
  | "preparado"
  | "cargado"
  | "en_ruta"
  | "en_sitio"
  | "entregando"
  | "entregado"
  | "rechazado"
  | "con_devolucion"
  | "reenviar"
  | "anulado"

export interface OrderTracking {
  id: string
  orderId: string
  status: OrderStatus
  timestamp: Date
  userId: string
  userName: string
  notes?: string
}

export interface Order {
  id: string;
  // Identificadores locales/servidor y estado de sincronización (opcional)
  localId?: string;
  serverId?: string | null;
  codigoEmpresa: string;
  codigoCliente: string;
  nombreCliente?: string;
  codigoVendedor: string;
  fecha: string;
  estado: string;
  items: OrderItem[];
  subtotal: number;
  impuestos?: number;
  total: number;
  observaciones?: string;
  // Metadata de sincronización
  createdAt?: number;
  attempts?: number;
  synced?: boolean;
  
  // 🆕 Campos para ofertas
  ofertaAplicada?: {
    uuidOferta: string;
    nombreOferta: string;
    tipoOferta: string;
    descuentoPorcentaje?: number;
    descuentoMonto?: number;
  };
  descuentoTotal?: number;
  subtotalSinDescuento?: number;
  // Campos usados al crear/editar pedidos desde la UI
  discount?: number; // porcentaje aplicado manualmente
  notes?: string; // notas temporales (mapear a observaciones si se desea)
  photos?: { id: string; dataUrl: string; timestamp: number }[];
  location?: { lat: number; lng: number } | null;
  ordenCompra?: string;
  formaPago?: string;
  bodega?: string;
  direccionEntrega?: string;
  departamento?: string;
  municipio?: string;
  nombreClienteEnvio?: string;
  nombreVendedor?: string;
  seriePedido?: string;
  numeroPedido?: string;
  numeroPedidoTemporal?: string;
  telefonoEntrega?: string;
  contactoEntrega?: string;
}

export interface PriceList {
  id: string
  name: string
  companyId?: string
  tier?: number
  products: Record<string, number>
  isActive: boolean
  createdAt: Date
  serverId?: string
  code?: string
}

// Permisos / Auth
export interface UsuarioConfiguracion {
  idt: string
  configuracion: string
  valor: string
  codigoEmpresa: string
}

export interface Role {
  id: string
  name: string
  description: string
  permissions: string[]
  isActive: boolean
  createdAt: Date
}

export interface User {
  id: string
  username: string
  name?: string
  email: string
  phone?: string
  avatar?: string
  password: string
  roleId: string
  role?: string            // algunos componentes leen user.role
  vendorId?: string
  isActive: boolean
  createdAt: Date
  lastLogin?: Date
}

export type Tokens = {
  id: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // timestamp en ms
  usuarioConfiguracion: UsuarioConfiguracion[];
};

export interface AuthUser {
  id: string
  usuario: string
  clave?: string
  nombre: string
  apellido?: string
  rol?: string
  puesto?: string
  estado: string
  usuarioConfiguracion: UsuarioConfiguracion[]
  token: string
}

export type PermissionAction = "create" | "read" | "update" | "delete" | "cancel"
export type PermissionModule =
  | "products" | "orders" | "customers" | "offers" | "prices"
  | "stats" | "users" | "vendors" | "vendor_classifications"

export interface VendorClassification {
  idt: string
  idt_empresa: string
  codigo: string
  descripcion: string
}

export interface Vendor {
  idt: string
  idt_empresa: string
  codigo: string
  idt_clasificacion: string
  primer_nombre: string
  segundo_nombre?: string
  primer_apellido: string
  segundo_apellido?: string
  direccion: string
  correo: string
  telefono: string
  activo: boolean
  codigo_empresa: string
  tiene_supervisor: boolean
  id_supervisor?: string
  limite_comision: number
  maneja_cobro: boolean
  total_comision: number
  cobro: number
  venta: number
  es_supervisor: boolean
  numero_ruta: string
  createdAt?: Date
}

export interface PriceListRow {
  id: string;
  name: string;
  isActive: boolean;
  companyId?: string;
  tier?: number;
  scope?: any;
  version?: number;
  serverId?: string
  deleted?: boolean;
  dirty?: boolean;
  serverId?: string;
}

export interface PriceListItemRow {
  id?: number;
  priceListId: string;
  productId: string;
  price: number;
}

export interface CatalogoGeneral {
  id: number;
  codigo: string;
  tipo: string;
  descripcion: string;
  tipoPadre: string | null;   // 👈 antes solo string
  codigoPadre: string | null; // 👈 antes solo string
  codigoEmpresa: string;
}

export interface Visita {
  id: string
  clienteId?: string
  clienteCodigo?: string
  motivo: string
  notas?: string
  fecha?: string
  createdAt?: string
  synced?: boolean
  serverId?: string
}



export type ComboItem = ComboOrderItem
