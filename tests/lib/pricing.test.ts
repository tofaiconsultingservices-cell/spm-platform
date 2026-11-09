import { describe, it, expect } from "vitest";
import {
  SALE_MARKUP_PERCENT,
  SALE_MARKUP_RATE,
  buildServiceCharge,
  customerUnitPrice,
  priceFromCost,
  profitPerUnit,
  roundMoney,
  salePriceFromCost,
} from "@/lib/pricing";

describe("margen fijo del taller (productos y servicios)", () => {
  it("el margen es 20% y no es configurable por pieza", () => {
    expect(SALE_MARKUP_RATE).toBe(0.2);
    expect(SALE_MARKUP_PERCENT).toBe(20);
    expect(salePriceFromCost.length).toBe(1);
  });

  it("precio de venta = costo × 1.20", () => {
    expect(salePriceFromCost(0)).toBe(0);
    expect(salePriceFromCost(100)).toBe(120);
    expect(salePriceFromCost(153.75)).toBe(184.5);
    expect(salePriceFromCost(10.01)).toBe(12.01);
    expect(salePriceFromCost(19.99)).toBe(23.99);
    expect(salePriceFromCost(50.5)).toBe(60.6);
  });

  it("la utilidad por unidad es el 20% del costo", () => {
    expect(profitPerUnit(100)).toBe(20);
    expect(profitPerUnit(100, salePriceFromCost(100))).toBe(20);
    expect(profitPerUnit(19.99, salePriceFromCost(19.99))).toBe(4);
    expect(profitPerUnit(0, 0)).toBe(0);
  });

  it("redondea a centavos", () => {
    expect(roundMoney(12.015)).toBe(12.02);
    expect(roundMoney(184.5)).toBe(184.5);
  });

  it("rechaza costos inválidos", () => {
    expect(() => salePriceFromCost(-1)).toThrow(/costo/i);
    expect(() => salePriceFromCost(Number.NaN)).toThrow(/costo/i);
    expect(() => profitPerUnit(Number.POSITIVE_INFINITY, 1)).toThrow(/precios/i);
    expect(() => roundMoney(Number.NaN)).toThrow(/monto/i);
  });

  it("un producto y un servicio con el mismo costo cobran lo mismo", () => {
    const product = priceFromCost(250);
    const service = priceFromCost(250);
    expect(product).toEqual({ costPrice: 250, salePrice: 300, profit: 50 });
    expect(service).toEqual(product);
  });

  it("si hay costo, el precio al cliente ignora un precio de venta guardado distinto", () => {
    expect(customerUnitPrice({ costPrice: 100, salePrice: 180 })).toBe(120);
    expect(customerUnitPrice({ costPrice: 0, salePrice: 50 })).toBe(0);
  });

  it("sin costo válido usa el precio de venta guardado o cero", () => {
    expect(customerUnitPrice({ salePrice: 80 })).toBe(80);
    expect(customerUnitPrice({ costPrice: -5, salePrice: 80 })).toBe(80);
    expect(customerUnitPrice({})).toBe(0);
  });

  it("la línea de servicio guarda el precio de venta calculado y no uno escrito a mano", () => {
    const line = buildServiceCharge({
      name: "  Lavado de moto  ",
      costPrice: 200,
      qty: 2,
      serviceId: "srv1",
      code: "SRV-00001",
    });
    expect(line).toEqual({
      serviceId: "srv1",
      code: "SRV-00001",
      name: "Lavado de moto",
      qty: 2,
      costPrice: 200,
      unitPrice: 240,
      total: 480,
    });
    expect(line.unitPrice).toBe(salePriceFromCost(line.costPrice));
  });

  it("rechaza un servicio sin nombre o con cantidad inválida", () => {
    expect(() => buildServiceCharge({ name: "   ", costPrice: 10 })).toThrow(/nombre/i);
    expect(() => buildServiceCharge({ name: "Frenos", costPrice: 10, qty: 0 })).toThrow(/cantidad/i);
  });
});
