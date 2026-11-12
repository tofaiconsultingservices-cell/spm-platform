import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  addDoc, deleteDoc, doc, onSnapshot, orderBy, runTransaction, updateDoc,
} from "firebase/firestore";

const baseService = {
  name: "Lavado de moto",
  serviceType: "lavado" as const,
  costPrice: 200,
  isActive: true,
};

describe("firestore/services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("subscribeWorkshopServices entrega el catálogo", async () => {
    const cb = vi.fn();
    (onSnapshot as ReturnType<typeof vi.fn>).mockImplementation((_q, next) => {
      next({
        docs: [{ id: "s1", data: () => ({ ...baseService, salePrice: 240, code: "SRV-00001" }) }],
      });
      return vi.fn();
    });

    const { subscribeWorkshopServices } = await import("@/lib/firestore/services");
    subscribeWorkshopServices(cb);

    expect(orderBy).toHaveBeenCalledWith("createdAt", "desc");
    expect(cb).toHaveBeenCalledWith([
      expect.objectContaining({ id: "s1", name: "Lavado de moto", code: "SRV-00001" }),
    ]);
  });

  it("subscribeWorkshopServices avisa lista vacía si la lectura falla", async () => {
    const cb = vi.fn();
    (onSnapshot as ReturnType<typeof vi.fn>).mockImplementation((_q, _next, onError) => {
      onError(new Error("permission"));
      return vi.fn();
    });

    const { subscribeWorkshopServices } = await import("@/lib/firestore/services");
    subscribeWorkshopServices(cb);
    expect(cb).toHaveBeenCalledWith([]);
  });

  it("createWorkshopService genera código y precio de venta fijo", async () => {
    (runTransaction as ReturnType<typeof vi.fn>).mockImplementation(async (_db, fn) => {
      await fn({
        get: async () => ({ data: () => ({}) }),
        set: vi.fn(),
      });
    });
    (addDoc as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "srv-new" });

    const { createWorkshopService } = await import("@/lib/firestore/services");
    const id = await createWorkshopService({
      ...baseService,
      description: undefined,
      salePrice: 1,
    } as never);

    expect(id).toBe("srv-new");
    const written = (addDoc as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(written.code).toBe("SRV-00001");
    expect(written.costPrice).toBe(200);
    expect(written.salePrice).toBe(240);
    expect(written).not.toHaveProperty("description");
  });

  it("createWorkshopService usa un código propio recortado", async () => {
    (addDoc as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "srv-2" });
    const { createWorkshopService } = await import("@/lib/firestore/services");
    await createWorkshopService({
      ...baseService,
      code: `  ${"LAVADO-ESPECIAL".padEnd(50, "X")}  `,
    });

    expect(runTransaction).not.toHaveBeenCalled();
    const written = (addDoc as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(written.code).toHaveLength(40);
    expect(written.salePrice).toBe(240);
  });

  it("updateWorkshopService recalcula la venta y no acepta solo el precio", async () => {
    const ref = { id: "s1" };
    (doc as ReturnType<typeof vi.fn>).mockReturnValue(ref);
    (updateDoc as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const { updateWorkshopService } = await import("@/lib/firestore/services");
    await updateWorkshopService("s1", { costPrice: 80, salePrice: 1, description: undefined });
    let payload = (updateDoc as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(payload.costPrice).toBe(80);
    expect(payload.salePrice).toBe(96);
    expect(payload).not.toHaveProperty("description");

    await updateWorkshopService("s1", { isActive: false, salePrice: 500 });
    payload = (updateDoc as ReturnType<typeof vi.fn>).mock.calls[1][1];
    expect(payload.isActive).toBe(false);
    expect(payload).not.toHaveProperty("salePrice");
  });

  it("deleteWorkshopService borra el documento", async () => {
    const ref = { id: "s1" };
    (doc as ReturnType<typeof vi.fn>).mockReturnValue(ref);
    const { deleteWorkshopService } = await import("@/lib/firestore/services");
    await deleteWorkshopService("s1");
    expect(deleteDoc).toHaveBeenCalledWith(ref);
  });
});
