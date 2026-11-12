import type { Timestamp } from "firebase/firestore";

// ============================================================
// SPM — Core Type Definitions
// ============================================================

export type UserRole = "admin" | "manager" | "operador" | "mecanico" | "viewer";

export type ServiceTicketStatus =
  | "lead-recibido"
  | "diagnostico-pendiente"
  | "en-camino"
  | "en-servicio"
  | "completado"
  | "pagado"
  | "cancelado";

export type ServiceType =
  | "afinacion-menor"
  | "afinacion-mayor"
  | "frenos"
  | "sistema-electrico"
  | "suspension"
  | "cadena-y-sprockets"
  | "neumaticos"
  | "bateria"
  | "carburador-inyeccion"
  | "motor"
  | "transmision"
  | "refaccion"
  | "diagnostico"
  | "lavado"
  | "otro";

export type LeadSource =
  | "google-ads"
  | "meta-ads"
  | "llamada-directa"
  | "whatsapp"
  | "landing-page"
  | "referido"
  | "organico"
  | "otro";

export type MotoType =
  | "naked"
  | "deportiva"
  | "touring"
  | "enduro"
  | "scooter"
  | "custom"
  | "otra";

// ============================================================
// User
// ============================================================

export interface SPMUser {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  phone?: string;
  photoURL?: string;
  mechanicId?: string;
  isActive: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  lastLogin?: Timestamp;
}

// ============================================================
// Address
// ============================================================

export interface Address {
  street?: string;
  colonia?: string;
  city?: string;
  state?: string;
  zip?: string;
  lat?: number;
  lng?: number;
  reference?: string;
}

// ============================================================
// Client / Customer
// ============================================================

export interface Client {
  id: string;
  clientId: string; // CLT-XXXXXX
  name: string;
  lastName: string;
  email?: string;
  phone: string;
  whatsapp?: string;
  type: "individual" | "empresa";
  address?: Address;
  totalTickets: number;
  totalPaid: number;
  source?: LeadSource;
  leadScore?: number;
  isActive: boolean;
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ============================================================
// Motorcycle
// ============================================================

export interface Motorcycle {
  id: string;
  clientId: string;
  brand: string;
  model: string;
  year: number;
  color?: string;
  placa?: string;
  vin?: string;
  tipoMoto?: MotoType;
  cilindrada?: number;
  ticketIds?: string[];
  photoUrl?: string;
  createdAt?: Timestamp;
}

// ============================================================
// Mechanic
// ============================================================

export interface Mechanic {
  id: string;
  mechanicId: string; // MEC-XXXX
  name: string;
  phone?: string;
  email?: string;
  status: "disponible" | "en-servicio" | "descanso" | "inactivo";
  zona: string[];
  skills: ServiceType[];
  vehicleType?: "moto" | "auto" | "bicicleta";
  totalServicesCompleted: number;
  averageRating?: number;
  photoUrl?: string;
  location?: { lat: number; lng: number; updatedAt: Timestamp };
  createdAt?: Timestamp;
}

// ============================================================
// Service Ticket
// ============================================================

export interface PartItem {
  productId?: string; // Optional link to Product in catalog
  name: string;
  qty: number;
  unitCost: number;
  total: number;
}

/** Servicio cobrado en un ticket. unitPrice siempre es costPrice × 1.20. */
export interface ServiceCharge {
  serviceId?: string;
  code?: string;
  name: string;
  qty: number;
  costPrice: number;
  unitPrice: number;
  total: number;
}

export interface TicketEvent {
  status: ServiceTicketStatus;
  timestamp: Timestamp;
  note?: string;
  userId?: string;
}

export interface ServiceTicket {
  id: string;
  ticketId: string; // SPM-XXXX
  status: ServiceTicketStatus;
  clientId?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  motorcycleId?: string;
  serviceType: ServiceType;
  serviceDescription: string;
  diagnosis?: string;
  workDone?: string;
  mechanicId?: string;
  mechanicName?: string;
  mechanicPhone?: string;
  serviceAddress: Address;
  estimatedCost?: number;
  anticipo?: number;
  finalCost?: number;
  parts?: PartItem[];
  /** Mano de obra / servicios del taller. El precio al cliente es costo × 1.20. */
  serviceCharges?: ServiceCharge[];
  source: LeadSource;
  statusHistory?: TicketEvent[];
  rating?: number;
  photosBefore?: string[];
  photosAfter?: string[];
  // Payments — anticipo (guarantee deposit before field visit)
  anticipoLinkUrl?: string;     // Stripe URL for the diagnostic-visit charge
  anticipoPagado?: boolean;     // true once Stripe webhook confirms anticipo payment
  // Payments — final service
  paymentLinkUrl?: string;      // Stripe Checkout Session URL
  stripeSessionId?: string;     // Stripe session ID for webhook matching
  paymentMethod?: "stripe" | "efectivo";
  paidAt?: Timestamp;
  // Partial payments
  payments?: TicketPayment[];
  totalPaid?: number;
  // Notifications
  lastWhatsAppSent?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  completedAt?: Timestamp;
}

// ============================================================
// Payment (per-ticket, supports partial payments)
// ============================================================

export type PaymentMethod = "stripe" | "efectivo" | "transferencia";
export type PaymentType = "anticipo" | "parcial" | "final";

export interface TicketPayment {
  id: string;
  type: PaymentType;
  method: PaymentMethod;
  amount: number;
  note?: string;
  stripeSessionId?: string;
  stripeUrl?: string;
  registeredBy: string;
  registeredByName?: string;
  createdAt?: Timestamp;
}

// ============================================================
// Invoice
// ============================================================

export interface InvoiceItem {
  description: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceId: string; // INV-YYYY-XXXXX
  clientId: string;
  clientName?: string;
  ticketId?: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: "pendiente" | "pagada" | "vencida" | "cancelada";
  paymentMethod?: string;
  pdfUrl?: string;
  cfdiUrl?: string;
  dueDate?: Timestamp;
  paidAt?: Timestamp;
  createdAt?: Timestamp;
}

// ============================================================
// Dashboard Stats
// ============================================================

export interface DashboardStats {
  totalTickets: number;
  activeTickets: number;
  completedToday: number;
  revenueToday: number;
  revenueMonth: number;
  avgRating: number;
  activeMechanics: number;
  totalClients: number;
  pendingPayments: number;
  conversionRate: number;
}

// ============================================================
// Chat / Chatbot
// ============================================================

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

// ============================================================
// Quote Request (landing form)
// ============================================================

export interface QuoteRequest {
  name: string;
  phone: string;
  email?: string;
  address: string;
  motoType?: MotoType;
  motoBrand?: string;
  motoYear?: string;
  serviceType: ServiceType;
  description: string;
  preferredTime?: string;
  source?: LeadSource;
}

// ============================================================
// Helpers
// ============================================================

export const STATUS_LABELS: Record<ServiceTicketStatus, string> = {
  "lead-recibido": "Lead Recibido",
  "diagnostico-pendiente": "Diagnóstico Pendiente",
  "en-camino": "En Camino",
  "en-servicio": "En Servicio",
  completado: "Completado",
  pagado: "Pagado",
  cancelado: "Cancelado",
};

export const STATUS_COLORS: Record<ServiceTicketStatus, string> = {
  "lead-recibido": "bg-slate-500/20 text-slate-300",
  "diagnostico-pendiente": "bg-yellow-500/20 text-yellow-300",
  "en-camino": "bg-blue-500/20 text-blue-300",
  "en-servicio": "bg-orange-500/20 text-orange-300",
  completado: "bg-green-500/20 text-green-300",
  pagado: "bg-emerald-500/20 text-emerald-300",
  cancelado: "bg-red-500/20 text-red-300",
};

export const SERVICE_LABELS: Record<ServiceType, string> = {
  "afinacion-menor": "Afinación Menor",
  "afinacion-mayor": "Afinación Mayor",
  frenos: "Sistema de Frenos",
  "sistema-electrico": "Sistema Eléctrico",
  suspension: "Suspensión",
  "cadena-y-sprockets": "Cadena y Sprockets",
  neumaticos: "Neumáticos",
  bateria: "Batería",
  "carburador-inyeccion": "Carburador / Inyección",
  motor: "Motor",
  transmision: "Transmisión",
  refaccion: "Refacción",
  diagnostico: "Diagnóstico",
  lavado: "Lavado de Motocicleta",
  otro: "Otro",
};

export const NEXT_STATUS: Partial<Record<ServiceTicketStatus, ServiceTicketStatus>> = {
  "lead-recibido": "diagnostico-pendiente",
  "diagnostico-pendiente": "en-camino",
  "en-camino": "en-servicio",
  "en-servicio": "completado",
  completado: "pagado",
};

export const STATUS_PIPELINE: ServiceTicketStatus[] = [
  "lead-recibido",
  "diagnostico-pendiente",
  "en-camino",
  "en-servicio",
  "completado",
  "pagado",
];

export const STATUS_ICONS: Record<ServiceTicketStatus, string> = {
  "lead-recibido": "inbox",
  "diagnostico-pendiente": "stethoscope",
  "en-camino": "truck",
  "en-servicio": "wrench",
  completado: "check",
  pagado: "banknotes",
  cancelado: "x-circle",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  stripe: "Stripe (tarjeta)",
  efectivo: "Efectivo",
  transferencia: "Transferencia",
};

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  anticipo: "Anticipo",
  parcial: "Pago parcial",
  final: "Pago final",
};

// ============================================================
// Inventory — Product Catalog
// ============================================================

export type ProductCategory =
  | "motor"
  | "transmision"
  | "suspension"
  | "frenos"
  | "electrico"
  | "neumaticos"
  | "lubricantes"
  | "carroceria"
  | "encendido"
  | "herramientas"
  | "accesorios"
  | "otro";

export type ProductUnit = "PZA" | "LT" | "KIT" | "PAR" | "JGO" | "MT";

export interface Product {
  id: string;
  sku: string;              // PRD-XXXXX
  name: string;             // Full description (from supplier invoice)
  shortName?: string;       // Short display name for UI
  category: ProductCategory;
  unit: ProductUnit;
  compatibleModels: string[]; // e.g. ["FT150", "DM200", "125Z"]
  vendorId?: string;
  vendorSku?: string;
  /** Nombre del proveedor, aunque no esté ligado a /vendors. */
  supplierName?: string;
  costPrice: number;        // Precio de compra al proveedor
  salePrice: number;        // Precio de venta al cliente = costPrice × 1.20 (fijo)
  stock: number;            // Current units in stock
  minStock: number;         // Reorder threshold
  imageUrls?: string[];
  isActive: boolean;
  isFeatured?: boolean;
  tags?: string[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ============================================================
// Workshop services — mano de obra del taller
// Precio de venta fijo: costPrice × 1.20
// ============================================================

export interface WorkshopService {
  id: string;
  code: string;             // SRV-XXXXX o código propio
  name: string;
  serviceType: ServiceType;
  description?: string;
  costPrice: number;        // Lo que le cuesta al taller
  salePrice: number;        // Precio al cliente = costPrice × 1.20
  isActive: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ============================================================
// Inventory — Vendor (Proveedor)
// ============================================================

export interface Vendor {
  id: string;
  vendorId: string;  // PROV-XXXX
  name: string;
  rfc?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: Address;
  isActive: boolean;
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ============================================================
// Inventory — Purchase Order (Orden de Compra)
// ============================================================

export type PurchaseOrderStatus =
  | "borrador"
  | "enviada"
  | "recibida-parcial"
  | "recibida-completa"
  | "cancelada";

export interface PurchaseOrderItem {
  productId?: string;   // Optional: links to catalog product
  productName: string;  // Snapshot
  sku?: string;
  unit: ProductUnit;
  qty: number;
  unitCost: number;
  total: number;
  receivedQty?: number; // For partial receipts
}

export interface PurchaseOrder {
  id: string;
  orderId: string;       // OC-YYYY-XXXXX
  vendorId: string;
  vendorName: string;
  items: PurchaseOrderItem[];
  subtotal: number;
  total: number;
  status: PurchaseOrderStatus;
  notes?: string;
  invoiceRef?: string;   // External nota de venta / invoice number
  receivedAt?: Timestamp;
  createdBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ============================================================
// Inventory — Movement Log (Bitácora)
// ============================================================

export type InventoryMovementType =
  | "compra"          // Received from supplier
  | "venta-tienda"    // Sold via marketplace
  | "uso-servicio"    // Used in a service ticket
  | "ajuste-entrada"  // Manual positive adjustment
  | "ajuste-salida"   // Manual negative adjustment
  | "devolucion";     // Customer return

export interface InventoryMovement {
  id: string;
  productId: string;
  productName: string;    // Snapshot at time of movement
  type: InventoryMovementType;
  qty: number;            // Positive = in, Negative = out
  stockBefore: number;
  stockAfter: number;
  unitCost?: number;
  reference?: string;     // ticketId, orderId, orderId, etc.
  note?: string;
  createdBy: string;
  createdAt?: Timestamp;
}

// ============================================================
// Inventory — Helpers / Labels
// ============================================================

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  motor: "Motor",
  transmision: "Transmisión",
  suspension: "Suspensión",
  frenos: "Frenos",
  electrico: "Sistema Eléctrico",
  neumaticos: "Neumáticos",
  lubricantes: "Lubricantes",
  carroceria: "Carrocería",
  encendido: "Encendido",
  herramientas: "Herramientas",
  accesorios: "Accesorios",
  otro: "Otro",
};

export const PRODUCT_UNIT_LABELS: Record<ProductUnit, string> = {
  PZA: "Pieza",
  LT: "Litro",
  KIT: "Kit",
  PAR: "Par",
  JGO: "Juego",
  MT: "Metro",
};

export const PURCHASE_ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  borrador: "Borrador",
  enviada: "Enviada",
  "recibida-parcial": "Recibida Parcial",
  "recibida-completa": "Recibida Completa",
  cancelada: "Cancelada",
};

export const INVENTORY_MOVEMENT_LABELS: Record<InventoryMovementType, string> = {
  compra: "Compra a proveedor",
  "venta-tienda": "Venta en tienda",
  "uso-servicio": "Uso en servicio",
  "ajuste-entrada": "Ajuste (entrada)",
  "ajuste-salida": "Ajuste (salida)",
  devolucion: "Devolución",
};

// ============================================================
// Store Orders — Tienda en línea
// ============================================================

export type StoreOrderStatus =
  | "pendiente-pago"      // Stripe session created, awaiting payment
  | "pendiente-efectivo"  // Cash on delivery/pickup, not yet paid
  | "pagada"              // Payment confirmed (Stripe webhook or manual)
  | "preparando"          // Admin is preparing the shipment
  | "enviada"             // Shipped
  | "entregada"           // Delivered / picked up
  | "cancelada";          // Cancelled (stock restored)

export type DeliveryMethod = "envio" | "taller";
export type StorePaymentMethod = "stripe" | "efectivo";

export interface StoreOrderItem {
  productId: string;
  sku: string;
  name: string;
  unit: ProductUnit;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface StoreOrder {
  id: string;
  orderId: string;             // ORD-YYYY-XXXXX
  status: StoreOrderStatus;
  items: StoreOrderItem[];
  customer: {
    name: string;
    phone: string;
    email?: string;
  };
  delivery: {
    method: DeliveryMethod;
    address?: ShippingAddress;
    shippingCost: number;
  };
  paymentMethod: StorePaymentMethod;
  stripeSessionId?: string;
  subtotal: number;
  total: number;
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  paidAt?: Timestamp;
  shippedAt?: Timestamp;
  deliveredAt?: Timestamp;
}

export const STORE_ORDER_STATUS_LABELS: Record<StoreOrderStatus, string> = {
  "pendiente-pago":     "Pendiente de pago",
  "pendiente-efectivo": "Pago en entrega",
  pagada:               "Pagada",
  preparando:           "Preparando",
  enviada:              "Enviada",
  entregada:            "Entregada",
  cancelada:            "Cancelada",
};

export const STORE_ORDER_STATUS_COLORS: Record<StoreOrderStatus, string> = {
  "pendiente-pago":     "bg-amber-500/20 text-amber-400",
  "pendiente-efectivo": "bg-blue-500/20 text-blue-400",
  pagada:               "bg-emerald-500/20 text-emerald-400",
  preparando:           "bg-purple-500/20 text-purple-400",
  enviada:              "bg-indigo-500/20 text-indigo-400",
  entregada:            "bg-green-500/20 text-green-400",
  cancelada:            "bg-red-500/20 text-red-400",
};
