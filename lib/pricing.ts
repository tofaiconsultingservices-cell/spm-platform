import type { ServiceCharge } from "@/types";

/**
 * Margen fijo del taller para productos y servicios.
 * El precio de venta SIEMPRE es costo × (1 + SALE_MARKUP_RATE).
 * No hay override por producto ni por servicio.
 * Es el único lugar para cambiar el margen más adelante.
 */
export const SALE_MARKUP_RATE = 0.2;
export const SALE_MARKUP_PERCENT = 20;

export function roundMoney(amount: number): number {
  if (!Number.isFinite(amount)) {
    throw new Error("El monto debe ser un número finito");
  }
  return Math.round(amount * 100) / 100;
}

/** Precio de venta al cliente. No acepta otro margen: el 20% es fijo. */
export function salePriceFromCost(costPrice: number): number {
  if (!Number.isFinite(costPrice) || costPrice < 0) {
    throw new Error("El precio de costo debe ser un número mayor o igual a cero");
  }
  return Math.round(costPrice * (1 + SALE_MARKUP_RATE) * 100) / 100;
}

export function profitPerUnit(costPrice: number, salePrice = salePriceFromCost(costPrice)): number {
  if (!Number.isFinite(costPrice) || !Number.isFinite(salePrice)) {
    throw new Error("Los precios deben ser números");
  }
  return roundMoney(salePrice - costPrice);
}

export interface FixedPrice {
  costPrice: number;
  salePrice: number;
  profit: number;
}

/** Costo, precio de venta y utilidad de una pieza o de un servicio. */
export function priceFromCost(costPrice: number): FixedPrice {
  const salePrice = salePriceFromCost(costPrice);
  return {
    costPrice,
    salePrice,
    profit: profitPerUnit(costPrice, salePrice),
  };
}

/**
 * Precio que ve el cliente. Si hay costo, manda el 20% fijo
 * (aunque el documento guardado tenga otro precio de venta).
 */
export function customerUnitPrice(item: {
  costPrice?: number | null;
  salePrice?: number | null;
}): number {
  if (typeof item.costPrice === "number" && Number.isFinite(item.costPrice) && item.costPrice >= 0) {
    return salePriceFromCost(item.costPrice);
  }
  if (typeof item.salePrice === "number" && Number.isFinite(item.salePrice) && item.salePrice >= 0) {
    return roundMoney(item.salePrice);
  }
  return 0;
}

/** Línea de servicio para un ticket. El precio al cliente no se puede pasar a mano. */
export function buildServiceCharge(input: {
  name: string;
  costPrice: number;
  qty?: number;
  serviceId?: string;
  code?: string;
}): ServiceCharge {
  const name = input.name.trim();
  if (!name) throw new Error("El servicio necesita un nombre");
  const qty = input.qty ?? 1;
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error("La cantidad debe ser mayor a cero");
  }
  const { salePrice } = priceFromCost(input.costPrice);
  return {
    ...(input.serviceId ? { serviceId: input.serviceId } : {}),
    ...(input.code ? { code: input.code } : {}),
    name,
    qty,
    costPrice: input.costPrice,
    unitPrice: salePrice,
    total: roundMoney(qty * salePrice),
  };
}
