import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/auth-server";

vi.mock("@/lib/auth-server", () => ({
  getSessionUser: vi.fn(),
  hasMinimumRole: (role: string, minimum: string) => {
    const weights: Record<string, number> = {
      viewer: 1, mecanico: 2, operador: 3, manager: 4, admin: 5,
    };
    return weights[role] >= weights[minimum];
  },
}));

function chain(get: ReturnType<typeof vi.fn>) {
  const query: {
    where: ReturnType<typeof vi.fn>;
    orderBy: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
  } = {
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    get,
  };
  query.where.mockReturnValue(query);
  query.orderBy.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  return query;
}

describe("API /api/products", () => {
  const listGet = vi.fn();
  const listQuery = chain(listGet);
  const mockAdd = vi.fn();
  const mockUpdate = vi.fn();
  const mockDelete = vi.fn();
  const docGet = vi.fn();
  const mockSet = vi.fn();
  const mockRunTransaction = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    listQuery.where.mockReturnValue(listQuery);
    listQuery.orderBy.mockReturnValue(listQuery);
    listQuery.limit.mockReturnValue(listQuery);
    mockAdd.mockResolvedValue({ id: "prod-new" });
    mockUpdate.mockResolvedValue(undefined);
    mockDelete.mockResolvedValue(undefined);
    mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      await fn({
        get: async () => ({ data: () => ({ count: 2 }) }),
        set: mockSet,
      });
    });
    (getSessionUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (getAdminDb as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: (name: string) => {
        if (name === "_counters") return { doc: () => ({ path: "counters/products" }) };
        return {
          where: listQuery.where,
          add: mockAdd,
          doc: () => ({ get: docGet, update: mockUpdate, delete: mockDelete, id: "prod-1" }),
        };
      },
      runTransaction: mockRunTransaction,
    });
  });

  function req(url: string, init?: { method?: string; body?: unknown; ip?: string }) {
    const headers = new Headers();
    if (init?.ip) headers.set("x-forwarded-for", init.ip);
    if (init?.body !== undefined) headers.set("content-type", "application/json");
    return new NextRequest(url, {
      method: init?.method ?? "GET",
      headers,
      body: init?.body === undefined ? undefined : typeof init.body === "string" ? init.body : JSON.stringify(init.body),
    });
  }

  it("GET lista precios de venta calculados y oculta el costo al público", async () => {
    listGet.mockResolvedValue({
      docs: [
        {
          id: "a",
          data: () => ({
            sku: "PRD-00001", name: "Balero", costPrice: 100, salePrice: 180,
            stock: 3, category: "transmision", unit: "PZA", isActive: true,
          }),
        },
        {
          id: "b",
          data: () => ({
            sku: "PRD-00002", name: "Sin costo", salePrice: 80, stock: 0, isActive: true,
          }),
        },
      ],
    });

    const { GET } = await import("@/app/api/products/route");
    const res = await GET(req("http://localhost/api/products?category=transmision&vendorId=v1&featured=true&inStock=true&limit=500", { ip: "10.1.0.1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.products[0].salePrice).toBe(120);
    expect(body.products[0].costPrice).toBeUndefined();
    expect(listQuery.where).toHaveBeenCalledWith("category", "==", "transmision");
    expect(listQuery.where).toHaveBeenCalledWith("vendorId", "==", "v1");
    expect(listQuery.where).toHaveBeenCalledWith("isFeatured", "==", true);
    expect(listQuery.limit).toHaveBeenCalledWith(100);
  });

  it("GET muestra el costo a un manager y usa el precio guardado si no hay costo válido", async () => {
    (getSessionUser as ReturnType<typeof vi.fn>).mockResolvedValue({ uid: "u1", role: "manager" });
    listGet.mockResolvedValue({
      docs: [
        { id: "a", data: () => ({ sku: "PRD-1", name: "A", costPrice: 10, salePrice: 99, stock: 1, isActive: true }) },
        { id: "b", data: () => ({ sku: "PRD-2", name: "B", costPrice: -1, salePrice: 40, stock: 1, isActive: true }) },
        { id: "c", data: () => ({ sku: "PRD-3", name: "C", costPrice: "x", salePrice: -5, stock: 1, isActive: true }) },
      ],
    });

    const { GET } = await import("@/app/api/products/route");
    const res = await GET(req("http://localhost/api/products?category=no-existe", { ip: "10.1.0.2" }));
    const body = await res.json();
    expect(body.products.map((p: { salePrice: number; costPrice?: number }) => [p.salePrice, p.costPrice])).toEqual([
      [12, 10],
      [40, -1],
      [0, "x"],
    ]);
  });

  it("GET responde 429 y 500", async () => {
    const { GET } = await import("@/app/api/products/route");
    listGet.mockResolvedValue({ docs: [] });
    for (let i = 0; i < 60; i++) {
      const ok = await GET(req("http://localhost/api/products", { ip: "10.9.9.1" }));
      expect(ok.status).toBe(200);
    }
    const limited = await GET(req("http://localhost/api/products", { ip: "10.9.9.1" }));
    expect(limited.status).toBe(429);

    listGet.mockRejectedValue(new Error("boom"));
    const failed = await GET(req("http://localhost/api/products", { ip: "10.9.9.2" }));
    expect(failed.status).toBe(500);
  });

  it("POST rechaza anónimos, JSON inválido y campos malos", async () => {
    const { POST } = await import("@/app/api/products/route");
    expect((await POST(req("http://localhost/api/products", { method: "POST", body: {}, ip: "10.2.0.1" }))).status).toBe(401);

    (getSessionUser as ReturnType<typeof vi.fn>).mockResolvedValue({ uid: "m1", role: "manager" });
    expect((await POST(req("http://localhost/api/products", { method: "POST", body: "{", ip: "10.2.0.2" }))).status).toBe(400);

    const cases: Array<[Record<string, unknown>, string]> = [
      [{ category: "motor" }, "name is required"],
      [{ name: "X", category: "nope" }, "Invalid category"],
      [{ name: "X", category: "motor", unit: "KG" }, "Invalid unit"],
      [{ name: "X", category: "motor", costPrice: -1 }, "Invalid costPrice"],
      [{ name: "X", category: "motor", costPrice: 10, stock: -1 }, "Invalid stock"],
    ];
    for (let i = 0; i < cases.length; i++) {
      const [body, message] = cases[i];
      const res = await POST(req("http://localhost/api/products", { method: "POST", body, ip: `10.2.1.${i}` }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe(message);
    }
  });

  it("POST calcula la venta aunque el cliente mande otro precio", async () => {
    (getSessionUser as ReturnType<typeof vi.fn>).mockResolvedValue({ uid: "m1", role: "admin" });
    const { POST } = await import("@/app/api/products/route");
    const res = await POST(req("http://localhost/api/products", {
      method: "POST",
      ip: "10.2.2.1",
      body: {
        name: "  Balero  ",
        category: "transmision",
        costPrice: 100,
        salePrice: 500,
        stock: 2,
        shortName: "Balero",
        vendorId: "vendor-1",
        vendorSku: "MC-1",
        supplierName: " MotoCruz ",
        compatibleModels: ["FT150", 125],
        tags: ["balero"],
        isFeatured: true,
      },
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.sku).toBe("PRD-00003");
    expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({
      name: "Balero",
      costPrice: 100,
      salePrice: 120,
      supplierName: "MotoCruz",
      compatibleModels: ["FT150", "125"],
    }));
  });

  it("POST usa el SKU escrito y no toca el contador", async () => {
    (getSessionUser as ReturnType<typeof vi.fn>).mockResolvedValue({ uid: "m1", role: "manager" });
    const { POST } = await import("@/app/api/products/route");
    const res = await POST(req("http://localhost/api/products", {
      method: "POST",
      ip: "10.2.2.2",
      body: { name: "Aceite", category: "lubricantes", unit: "LT", costPrice: 80, sku: " ACE-1 " },
    }));
    expect(res.status).toBe(201);
    expect((await res.json()).sku).toBe("ACE-1");
    expect(mockRunTransaction).not.toHaveBeenCalled();
    expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({ salePrice: 96, stock: 0, minStock: 2 }));
  });

  it("POST responde 429 y 500", async () => {
    (getSessionUser as ReturnType<typeof vi.fn>).mockResolvedValue({ uid: "m1", role: "manager" });
    const { POST } = await import("@/app/api/products/route");
    const payload = { name: "X", category: "otro", costPrice: 1 };
    for (let i = 0; i < 20; i++) {
      const ok = await POST(req("http://localhost/api/products", { method: "POST", body: payload, ip: "10.8.8.1" }));
      expect(ok.status).toBe(201);
    }
    expect((await POST(req("http://localhost/api/products", { method: "POST", body: payload, ip: "10.8.8.1" }))).status).toBe(429);

    mockAdd.mockRejectedValueOnce(new Error("boom"));
    expect((await POST(req("http://localhost/api/products", { method: "POST", body: payload, ip: "10.8.8.2" }))).status).toBe(500);
  });
});

describe("API /api/products/[id]", () => {
  const docGet = vi.fn();
  const mockUpdate = vi.fn();
  const mockDelete = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue(undefined);
    mockDelete.mockResolvedValue(undefined);
    (getSessionUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (getAdminDb as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: () => ({
        doc: () => ({ id: "prod-1", get: docGet, update: mockUpdate, delete: mockDelete }),
      }),
    });
  });

  function call(method: string, body?: unknown, ip = "10.3.0.1") {
    return new NextRequest("http://localhost/api/products/prod-1", {
      method,
      headers: {
        "x-forwarded-for": ip,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });
  }

  const params = { params: Promise.resolve({ id: "prod-1" }) };

  it("GET oculta el costo, lo muestra al manager y cubre precios inválidos", async () => {
    docGet.mockResolvedValue({
      exists: true,
      id: "prod-1",
      data: () => ({ sku: "PRD-1", name: "Balero", costPrice: 100, salePrice: 400, stock: 2, isActive: true }),
    });
    const { GET } = await import("@/app/api/products/[id]/route");
    const pub = await GET(call("GET", undefined, "10.3.1.1"), params);
    const pubBody = await pub.json();
    expect(pubBody.product.salePrice).toBe(120);
    expect(pubBody.product.costPrice).toBeUndefined();

    (getSessionUser as ReturnType<typeof vi.fn>).mockResolvedValue({ uid: "m", role: "manager" });
    const mgr = await GET(call("GET", undefined, "10.3.1.2"), params);
    expect((await mgr.json()).product.costPrice).toBe(100);

    docGet.mockResolvedValue({
      exists: true,
      id: "prod-1",
      data: () => ({ sku: "PRD-2", name: "Viejo", costPrice: -3, salePrice: 15, stock: 1, isActive: true }),
    });
    const legacy = await GET(call("GET", undefined, "10.3.1.3"), params);
    expect((await legacy.json()).product.salePrice).toBe(15);

    docGet.mockResolvedValue({
      exists: true,
      id: "prod-1",
      data: () => ({ sku: "PRD-3", name: "Roto", salePrice: Number.NaN, stock: 1, isActive: true }),
    });
    const broken = await GET(call("GET", undefined, "10.3.1.4"), params);
    expect((await broken.json()).product.salePrice).toBe(0);
  });

  it("GET responde 404, 429 y 500", async () => {
    const { GET } = await import("@/app/api/products/[id]/route");
    docGet.mockResolvedValue({ exists: false });
    expect((await GET(call("GET", undefined, "10.3.2.1"), params)).status).toBe(404);

    docGet.mockResolvedValue({ exists: true, id: "prod-1", data: () => ({ sku: "A", name: "A", costPrice: 1, stock: 1, isActive: true }) });
    for (let i = 0; i < 30; i++) {
      expect((await GET(call("GET", undefined, "10.3.2.9"), params)).status).toBe(200);
    }
    expect((await GET(call("GET", undefined, "10.3.2.9"), params)).status).toBe(429);

    docGet.mockRejectedValue(new Error("boom"));
    expect((await GET(call("GET", undefined, "10.3.2.2"), params)).status).toBe(500);
  });

  it("PUT recalcula la venta, ignora el precio suelto y valida", async () => {
    const { PUT } = await import("@/app/api/products/[id]/route");
    expect((await PUT(call("PUT", { name: "X" }, "10.4.0.1"), params)).status).toBe(401);

    (getSessionUser as ReturnType<typeof vi.fn>).mockResolvedValue({ uid: "m", role: "operador" });
    expect((await PUT(call("PUT", { name: "X" }, "10.4.0.2"), params)).status).toBe(401);

    (getSessionUser as ReturnType<typeof vi.fn>).mockResolvedValue({ uid: "m", role: "manager" });
    expect((await PUT(call("PUT", "{", "10.4.0.3"), params)).status).toBe(400);
    expect((await PUT(call("PUT", { salePrice: 999, sku: "HACK" }, "10.4.0.4"), params)).status).toBe(400);
    expect((await PUT(call("PUT", { costPrice: -2 }, "10.4.0.5"), params)).status).toBe(400);

    const res = await PUT(call("PUT", { name: "Balero", costPrice: 50, salePrice: 1, supplierName: "MotoCruz" }, "10.4.0.6"), params);
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      name: "Balero",
      costPrice: 50,
      salePrice: 60,
      supplierName: "MotoCruz",
    }));
    const written = mockUpdate.mock.calls[0][0];
    expect(written.sku).toBeUndefined();
  });

  it("PUT y DELETE responden 429 y 500", async () => {
    (getSessionUser as ReturnType<typeof vi.fn>).mockResolvedValue({ uid: "a", role: "admin" });
    const { PUT, DELETE } = await import("@/app/api/products/[id]/route");
    for (let i = 0; i < 30; i++) {
      expect((await PUT(call("PUT", { isActive: true }, "10.4.9.1"), params)).status).toBe(200);
    }
    expect((await PUT(call("PUT", { isActive: false }, "10.4.9.1"), params)).status).toBe(429);

    mockUpdate.mockRejectedValueOnce(new Error("boom"));
    expect((await PUT(call("PUT", { stock: 3 }, "10.4.9.2"), params)).status).toBe(500);

    expect((await DELETE(call("DELETE", undefined, "10.5.0.1"), params)).status).toBe(200);
    expect(mockDelete).toHaveBeenCalled();

    (getSessionUser as ReturnType<typeof vi.fn>).mockResolvedValue({ uid: "m", role: "manager" });
    expect((await DELETE(call("DELETE", undefined, "10.5.0.2"), params)).status).toBe(401);

    (getSessionUser as ReturnType<typeof vi.fn>).mockResolvedValue({ uid: "a", role: "admin" });
    mockDelete.mockRejectedValueOnce(new Error("boom"));
    expect((await DELETE(call("DELETE", undefined, "10.5.0.3"), params)).status).toBe(500);
  });

  it("DELETE responde 429", async () => {
    (getSessionUser as ReturnType<typeof vi.fn>).mockResolvedValue({ uid: "a", role: "admin" });
    const { DELETE } = await import("@/app/api/products/[id]/route");
    for (let i = 0; i < 30; i++) {
      expect((await DELETE(call("DELETE", undefined, "10.5.9.9"), params)).status).toBe(200);
    }
    expect((await DELETE(call("DELETE", undefined, "10.5.9.9"), params)).status).toBe(429);
  });
});
