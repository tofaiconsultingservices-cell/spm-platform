import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot,
  orderBy, query, runTransaction, updateDoc, where,
} from "firebase/firestore";

const baseProduct = {
  name: "Balero 6203",
  category: "transmision" as const,
  unit: "PZA" as const,
  compatibleModels: ["FT150"],
  costPrice: 100,
  stock: 4,
  minStock: 2,
  isActive: true,
};

describe("firestore/products", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("subscribeProducts entrega los documentos ordenados por fecha", async () => {
    const cb = vi.fn();
    const unsub = vi.fn();
    (onSnapshot as ReturnType<typeof vi.fn>).mockImplementation((_q, next) => {
      next({
        docs: [{ id: "p1", data: () => ({ ...baseProduct, name: "Balero" }) }],
      });
      return unsub;
    });

    const { subscribeProducts } = await import("@/lib/firestore/products");
    const stop = subscribeProducts(cb);

    expect(collection).toHaveBeenCalledWith(expect.anything(), "products");
    expect(orderBy).toHaveBeenCalledWith("createdAt", "desc");
    expect(query).toHaveBeenCalled();
    expect(cb).toHaveBeenCalledWith([expect.objectContaining({ id: "p1", name: "Balero" })]);
    expect(stop).toBe(unsub);
  });

  it("subscribeActiveProducts filtra por categoría cuando se pide", async () => {
    (onSnapshot as ReturnType<typeof vi.fn>).mockImplementation((_q, next) => {
      next({ docs: [] });
      return vi.fn();
    });

    const { subscribeActiveProducts } = await import("@/lib/firestore/products");
    subscribeActiveProducts(vi.fn(), "frenos");
    subscribeActiveProducts(vi.fn());

    expect(where).toHaveBeenCalledWith("isActive", "==", true);
    expect(where).toHaveBeenCalledWith("category", "==", "frenos");
  });

  it("subscribeProductMovements escucha la bitácora del producto", async () => {
    const cb = vi.fn();
    (onSnapshot as ReturnType<typeof vi.fn>).mockImplementation((_q, next) => {
      next({
        docs: [{ id: "m1", data: () => ({ productId: "p1", type: "compra", qty: 2 }) }],
      });
      return vi.fn();
    });

    const { subscribeProductMovements } = await import("@/lib/firestore/products");
    subscribeProductMovements("p1", cb);

    expect(where).toHaveBeenCalledWith("productId", "==", "p1");
    expect(cb).toHaveBeenCalledWith([expect.objectContaining({ id: "m1", qty: 2 })]);
  });

  it("getProduct devuelve null si no existe y el documento si existe", async () => {
    const ref = { id: "p1" };
    (doc as ReturnType<typeof vi.fn>).mockReturnValue(ref);
    (getDoc as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ exists: () => false })
      .mockResolvedValueOnce({
        exists: () => true,
        id: "p1",
        data: () => baseProduct,
      });

    const { getProduct } = await import("@/lib/firestore/products");
    await expect(getProduct("missing")).resolves.toBeNull();
    await expect(getProduct("p1")).resolves.toEqual({ id: "p1", ...baseProduct });
  });

  it("getLowStockProducts se queda solo con activos en o bajo el mínimo", async () => {
    (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({
      docs: [
        { id: "low", data: () => ({ ...baseProduct, stock: 1, minStock: 3 }) },
        { id: "ok", data: () => ({ ...baseProduct, stock: 8, minStock: 2 }) },
        { id: "zero", data: () => ({ ...baseProduct, stock: 0, minStock: 1 }) },
      ],
    });

    const { getLowStockProducts } = await import("@/lib/firestore/products");
    const rows = await getLowStockProducts();
    expect(rows.map((p) => p.id)).toEqual(["low", "zero"]);
  });

  it("createProduct genera SKU y fuerza venta = costo × 1.20", async () => {
    (runTransaction as ReturnType<typeof vi.fn>).mockImplementation(async (_db, fn) => {
      await fn({
        get: async () => ({ data: () => ({ count: 6 }) }),
        set: vi.fn(),
      });
    });
    (addDoc as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "new-1" });

    const { createProduct } = await import("@/lib/firestore/products");
    const id = await createProduct({
      ...baseProduct,
      shortName: undefined,
      supplierName: "  MotoCruz  ",
      salePrice: 999,
    } as never);

    expect(id).toBe("new-1");
    const written = (addDoc as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(written).toEqual(expect.objectContaining({
      sku: "PRD-00007",
      costPrice: 100,
      salePrice: 120,
      supplierName: "MotoCruz",
    }));
    expect(written).not.toHaveProperty("shortName");
  });

  it("createProduct respeta un SKU propio y recorta espacios", async () => {
    (addDoc as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "new-2" });

    const { createProduct } = await import("@/lib/firestore/products");
    await createProduct({
      ...baseProduct,
      sku: `  ${"X".repeat(50)}  `,
      supplierName: "",
    });

    expect(runTransaction).not.toHaveBeenCalled();
    const written = (addDoc as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(written.sku).toHaveLength(40);
    expect(written.supplierName).toBeNull();
    expect(written.salePrice).toBe(120);
  });

  it("updateProduct recalcula la venta al cambiar el costo e ignora un precio escrito", async () => {
    const ref = { id: "p1" };
    (doc as ReturnType<typeof vi.fn>).mockReturnValue(ref);
    (updateDoc as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const { updateProduct } = await import("@/lib/firestore/products");
    await updateProduct("p1", {
      name: "Balero nuevo",
      costPrice: 50,
      salePrice: 10,
      supplierName: "  RefaMoto  ",
      shortName: undefined,
    });

    const payload = (updateDoc as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(payload.costPrice).toBe(50);
    expect(payload.salePrice).toBe(60);
    expect(payload.supplierName).toBe("RefaMoto");
    expect(payload).not.toHaveProperty("shortName");
    expect(updateDoc).toHaveBeenCalledWith(ref, expect.objectContaining({ name: "Balero nuevo" }));
  });

  it("updateProduct no deja cambiar solo el precio de venta", async () => {
    (doc as ReturnType<typeof vi.fn>).mockReturnValue({ id: "p1" });
    (updateDoc as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const { updateProduct } = await import("@/lib/firestore/products");
    await updateProduct("p1", { salePrice: 500, isActive: false });

    const payload = (updateDoc as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(payload.isActive).toBe(false);
    expect(payload).not.toHaveProperty("salePrice");
  });

  it("deleteProduct borra el documento", async () => {
    const ref = { id: "p1" };
    (doc as ReturnType<typeof vi.fn>).mockReturnValue(ref);
    const { deleteProduct } = await import("@/lib/firestore/products");
    await deleteProduct("p1");
    expect(deleteDoc).toHaveBeenCalledWith(ref);
  });

  it("adjustStock mueve existencias y registra la bitácora", async () => {
    const productRef = { id: "p1" };
    const movementRef = { id: "mov" };
    (doc as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(productRef)
      .mockReturnValueOnce(movementRef);
    (collection as ReturnType<typeof vi.fn>).mockReturnValue("movements");
    const tx = {
      get: vi.fn().mockResolvedValue({
        exists: () => true,
        data: () => ({ ...baseProduct, stock: 4, name: "Balero 6203" }),
      }),
      update: vi.fn(),
      set: vi.fn(),
    };
    (runTransaction as ReturnType<typeof vi.fn>).mockImplementation(async (_db, fn) => fn(tx));

    const { adjustStock } = await import("@/lib/firestore/products");
    await adjustStock("p1", -1, {
      type: "uso-servicio",
      createdBy: "user-1",
      reference: "SPM-0001",
      note: "Ticket",
      unitCost: 120,
    });

    expect(tx.update).toHaveBeenCalledWith(productRef, expect.objectContaining({ stock: 3 }));
    expect(tx.set).toHaveBeenCalledWith(
      movementRef,
      expect.objectContaining({
        qty: -1,
        stockBefore: 4,
        stockAfter: 3,
        reference: "SPM-0001",
        note: "Ticket",
        unitCost: 120,
      })
    );
  });

  it("adjustStock omite campos opcionales de la bitácora", async () => {
    (doc as ReturnType<typeof vi.fn>).mockReturnValue({ id: "ref" });
    const tx = {
      get: vi.fn().mockResolvedValue({
        exists: () => true,
        data: () => ({ ...baseProduct, stock: 2, name: "X" }),
      }),
      update: vi.fn(),
      set: vi.fn(),
    };
    (runTransaction as ReturnType<typeof vi.fn>).mockImplementation(async (_db, fn) => fn(tx));

    const { adjustStock } = await import("@/lib/firestore/products");
    await adjustStock("p1", 1, { type: "ajuste-entrada", createdBy: "user-1" });

    const written = tx.set.mock.calls[0][1];
    expect(written.stockAfter).toBe(3);
    expect(written).not.toHaveProperty("reference");
    expect(written).not.toHaveProperty("note");
    expect(written).not.toHaveProperty("unitCost");
  });

  it("adjustStock rechaza producto inexistente o stock insuficiente", async () => {
    (doc as ReturnType<typeof vi.fn>).mockReturnValue({ id: "ref" });
    const missing = {
      get: vi.fn().mockResolvedValue({ exists: () => false }),
      update: vi.fn(),
      set: vi.fn(),
    };
    const short = {
      get: vi.fn().mockResolvedValue({
        exists: () => true,
        data: () => ({ ...baseProduct, stock: 1, name: "X" }),
      }),
      update: vi.fn(),
      set: vi.fn(),
    };
    (runTransaction as ReturnType<typeof vi.fn>)
      .mockImplementationOnce(async (_db, fn) => fn(missing))
      .mockImplementationOnce(async (_db, fn) => fn(short));

    const { adjustStock } = await import("@/lib/firestore/products");
    await expect(
      adjustStock("nope", 1, { type: "ajuste-entrada", createdBy: "u" })
    ).rejects.toThrow(/not found/);
    await expect(
      adjustStock("p1", -5, { type: "ajuste-salida", createdBy: "u" })
    ).rejects.toThrow(/Stock insuficiente/);
  });
});
