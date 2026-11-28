import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  addDoc, updateDoc, getDoc, getDocs, onSnapshot, orderBy, where, runTransaction,
} from "firebase/firestore";

type Fn = ReturnType<typeof vi.fn>;

/** Make onSnapshot immediately emit the given docs to the subscriber. */
function emit(rows: Record<string, unknown>[]) {
  (onSnapshot as Fn).mockImplementation((_q: unknown, cb: (s: unknown) => void) => {
    cb({ docs: rows.map(({ id, ...rest }) => ({ id, data: () => rest })) });
    return () => {};
  });
}

/** Make runTransaction run the callback with a fake tx whose get() returns `snapData`. */
function tx(snapData: Record<string, unknown> | undefined, exists = true) {
  const calls = { set: [] as unknown[][], update: [] as unknown[][] };
  (runTransaction as Fn).mockImplementation(async (_db: unknown, fn: (t: unknown) => Promise<void>) => {
    await fn({
      get: async () => ({ exists: () => exists, data: () => snapData }),
      set: (...a: unknown[]) => calls.set.push(a),
      update: (...a: unknown[]) => calls.update.push(a),
    });
  });
  return calls;
}

beforeEach(() => {
  vi.clearAllMocks();
  (addDoc as Fn).mockResolvedValue({ id: "new-id" });
});

describe("firestore/products", () => {
  it("subscriptions map docs and use the right filters", async () => {
    const m = await import("@/lib/firestore/products");
    emit([{ id: "p1", name: "Bobina" }]);
    const cb = vi.fn();

    m.subscribeProducts(cb);
    expect(cb).toHaveBeenLastCalledWith([{ id: "p1", name: "Bobina" }]);

    m.subscribeActiveProducts(cb);
    m.subscribeActiveProducts(cb, "frenos");
    expect(where).toHaveBeenCalledWith("category", "==", "frenos");

    m.subscribeProductMovements("p1", cb);
    expect(where).toHaveBeenCalledWith("productId", "==", "p1");
    expect(orderBy).toHaveBeenCalledWith("createdAt", "desc");
  });

  it("getProduct returns the product or null", async () => {
    const { getProduct } = await import("@/lib/firestore/products");
    (getDoc as Fn).mockResolvedValueOnce({ exists: () => true, id: "p1", data: () => ({ name: "Bobina" }) });
    expect(await getProduct("p1")).toEqual({ id: "p1", name: "Bobina" });
    (getDoc as Fn).mockResolvedValueOnce({ exists: () => false });
    expect(await getProduct("x")).toBeNull();
  });

  it("getLowStockProducts keeps only stock <= minStock", async () => {
    const { getLowStockProducts } = await import("@/lib/firestore/products");
    (getDocs as Fn).mockResolvedValueOnce({
      docs: [
        { id: "a", data: () => ({ stock: 1, minStock: 2 }) },
        { id: "b", data: () => ({ stock: 2, minStock: 2 }) },
        { id: "c", data: () => ({ stock: 9, minStock: 2 }) },
      ],
    });
    expect((await getLowStockProducts()).map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("createProduct assigns the next PRD sku", async () => {
    const { createProduct } = await import("@/lib/firestore/products");
    const calls = tx({ count: 7 });
    const id = await createProduct({ name: "Balata" } as never);
    expect(id).toBe("new-id");
    expect(calls.set[0][1]).toEqual({ count: 8 });
    expect((addDoc as Fn).mock.calls[0][1]).toMatchObject({ name: "Balata", sku: "PRD-00008" });
  });

  it("createProduct starts at PRD-00001 with no counter", async () => {
    const { createProduct } = await import("@/lib/firestore/products");
    tx(undefined);
    await createProduct({ name: "X" } as never);
    expect((addDoc as Fn).mock.calls[0][1].sku).toBe("PRD-00001");
  });

  it("updateProduct stamps updatedAt", async () => {
    const { updateProduct } = await import("@/lib/firestore/products");
    await updateProduct("p1", { salePrice: 99 });
    expect((updateDoc as Fn).mock.calls[0][1]).toMatchObject({ salePrice: 99, updatedAt: expect.anything() });
  });

  describe("adjustStock", () => {
    it("updates stock and logs a movement with optional fields", async () => {
      const { adjustStock } = await import("@/lib/firestore/products");
      const calls = tx({ name: "Bobina", stock: 5 });
      await adjustStock("p1", -2, { type: "venta-tienda", createdBy: "u1", reference: "SPM-0001", note: "n", unitCost: 10 });
      expect(calls.update[0][1]).toMatchObject({ stock: 3 });
      expect(calls.set[0][1]).toMatchObject({
        productId: "p1", productName: "Bobina", type: "venta-tienda", qty: -2,
        stockBefore: 5, stockAfter: 3, reference: "SPM-0001", note: "n", unitCost: 10,
      });
    });

    it("omits empty optional fields", async () => {
      const { adjustStock } = await import("@/lib/firestore/products");
      const calls = tx({ name: "B", stock: 1 });
      await adjustStock("p1", 4, { type: "compra", createdBy: "u1" });
      const mv = calls.set[0][1] as Record<string, unknown>;
      expect(mv.stockAfter).toBe(5);
      expect("reference" in mv || "note" in mv || "unitCost" in mv).toBe(false);
    });

    it("rejects going below zero", async () => {
      const { adjustStock } = await import("@/lib/firestore/products");
      tx({ name: "B", stock: 1 });
      await expect(adjustStock("p1", -3, { type: "venta-tienda", createdBy: "u" })).rejects.toThrow("Stock insuficiente");
    });

    it("rejects a missing product", async () => {
      const { adjustStock } = await import("@/lib/firestore/products");
      tx(undefined, false);
      await expect(adjustStock("nope", 1, { type: "compra", createdBy: "u" })).rejects.toThrow("not found");
    });
  });
});

describe("firestore/vendors", () => {
  it("subscriptions order by name and filter active", async () => {
    const m = await import("@/lib/firestore/vendors");
    emit([{ id: "v1", name: "MotoCruz" }]);
    const cb = vi.fn();
    m.subscribeVendors(cb);
    m.subscribeActiveVendors(cb);
    expect(cb).toHaveBeenLastCalledWith([{ id: "v1", name: "MotoCruz" }]);
    expect(orderBy).toHaveBeenCalledWith("name", "asc");
    expect(where).toHaveBeenCalledWith("isActive", "==", true);
  });

  it("createVendor assigns the next PROV id; updateVendor stamps updatedAt", async () => {
    const { createVendor, updateVendor } = await import("@/lib/firestore/vendors");
    tx({ count: 2 });
    expect(await createVendor({ name: "N" } as never)).toBe("new-id");
    expect((addDoc as Fn).mock.calls[0][1].vendorId).toBe("PROV-0003");
    tx(undefined);
    await createVendor({ name: "M" } as never);
    expect((addDoc as Fn).mock.calls[1][1].vendorId).toBe("PROV-0001");

    await updateVendor("v1", { phone: "81" } as never);
    expect((updateDoc as Fn).mock.calls[0][1]).toMatchObject({ phone: "81" });
  });
});

describe("firestore/store-orders", () => {
  it("subscriptions, get and status updates", async () => {
    const m = await import("@/lib/firestore/store-orders");
    emit([{ id: "o1", status: "pagado" }]);
    const cb = vi.fn();
    m.subscribeStoreOrders(cb);
    m.subscribeStoreOrdersByStatus("pagado" as never, cb);
    expect(cb).toHaveBeenLastCalledWith([{ id: "o1", status: "pagado" }]);
    expect(where).toHaveBeenCalledWith("status", "==", "pagado");

    (getDoc as Fn).mockResolvedValueOnce({ exists: () => true, id: "o1", data: () => ({ total: 10 }) });
    expect(await m.getStoreOrder("o1")).toEqual({ id: "o1", total: 10 });
    (getDoc as Fn).mockResolvedValueOnce({ exists: () => false });
    expect(await m.getStoreOrder("x")).toBeNull();

    await m.updateStoreOrderStatus("o1", "enviado" as never, { shippedAt: "t" } as never);
    expect((updateDoc as Fn).mock.calls[0][1]).toMatchObject({ status: "enviado", shippedAt: "t" });
  });
});

describe("firestore/purchase-orders", () => {
  it("subscriptions filter by vendor", async () => {
    const m = await import("@/lib/firestore/purchase-orders");
    emit([{ id: "po1" }]);
    const cb = vi.fn();
    m.subscribePurchaseOrders(cb);
    m.subscribePurchaseOrdersByVendor("v1", cb);
    expect(cb).toHaveBeenLastCalledWith([{ id: "po1" }]);
    expect(where).toHaveBeenCalledWith("vendorId", "==", "v1");
  });

  it("createPurchaseOrder assigns OC-<year>-NNNN", async () => {
    const { createPurchaseOrder } = await import("@/lib/firestore/purchase-orders");
    tx({ count: 9 });
    await createPurchaseOrder({ vendorId: "v1" } as never);
    expect((addDoc as Fn).mock.calls[0][1].orderId).toBe(`OC-${new Date().getFullYear()}-0010`);
    tx(undefined);
    await createPurchaseOrder({ vendorId: "v1" } as never);
    expect((addDoc as Fn).mock.calls[1][1].orderId).toBe(`OC-${new Date().getFullYear()}-0001`);
  });

  it("receivePurchaseOrder adds stock for linked items and marks it received", async () => {
    const { receivePurchaseOrder } = await import("@/lib/firestore/purchase-orders");
    (getDoc as Fn).mockResolvedValueOnce({
      exists: () => true, id: "po1",
      data: () => ({
        orderId: "OC-2026-0001",
        items: [
          { productId: "p1", productName: "Bobina", qty: 3, unitCost: 50 },
          { productId: "p2", productName: "Balata", qty: 4, receivedQty: 2, unitCost: 20 },
          { productName: "Sin catálogo", qty: 1 },
          { productId: "p3", productName: "Cero", qty: 0 },
        ],
      }),
    });
    const calls = tx({ name: "X", stock: 0 });

    await receivePurchaseOrder("po1", "u1");

    // one stock update per linked, positive-qty item
    expect(calls.update.map((u) => (u[1] as { stock: number }).stock)).toEqual([3, 2]);
    expect(calls.set[0][1]).toMatchObject({ type: "compra", reference: "OC-2026-0001", unitCost: 50, createdBy: "u1" });
    expect((updateDoc as Fn).mock.calls.at(-1)![1]).toMatchObject({ status: "recibida-completa" });
  });

  it("receivePurchaseOrder can process an explicit item list", async () => {
    const { receivePurchaseOrder } = await import("@/lib/firestore/purchase-orders");
    (getDoc as Fn).mockResolvedValueOnce({ exists: () => true, id: "po1", data: () => ({ orderId: "OC-1", items: [] }) });
    const calls = tx({ name: "X", stock: 1 });
    await receivePurchaseOrder("po1", "u1", [{ productId: "p9", productName: "Y", qty: 5 } as never]);
    expect(calls.update).toHaveLength(1);
  });

  it("receivePurchaseOrder throws for a missing order", async () => {
    const { receivePurchaseOrder } = await import("@/lib/firestore/purchase-orders");
    (getDoc as Fn).mockResolvedValueOnce({ exists: () => false });
    await expect(receivePurchaseOrder("nope", "u")).rejects.toThrow("not found");
  });
});
