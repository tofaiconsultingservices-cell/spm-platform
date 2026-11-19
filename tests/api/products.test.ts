import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAdminDb } from "@/lib/firebase-admin";
import { makeFakeDb, fakeReq } from "../helpers/fake-admin";

const auth = vi.hoisted(() => ({ user: null as null | { uid: string; role: string } }));
const rl = vi.hoisted(() => ({ allow: true }));

vi.mock("@/lib/auth-server", async (orig) => {
  const real = await orig<typeof import("@/lib/auth-server")>();
  return { ...real, getSessionUser: vi.fn(async () => auth.user) };
});
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => () => ({ success: rl.allow, remaining: 1, retryAfter: 30 }),
  getClientIp: () => "1.2.3.4",
}));

import { GET, POST } from "@/app/api/products/route";
import * as ById from "@/app/api/products/[id]/route";

const product = {
  id: "p1", sku: "PRD-00001", name: "Bobina", category: "electrico", unit: "PZA",
  costPrice: 100, salePrice: 180, stock: 5, minStock: 2, isActive: true,
};
const outOfStock = { ...product, id: "p2", sku: "PRD-00002", stock: 0 };
const params = (id: string) => ({ params: Promise.resolve({ id }) });

let fake: ReturnType<typeof makeFakeDb>;

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = null;
  rl.allow = true;
  fake = makeFakeDb({ products: [product, outOfStock] });
  (getAdminDb as ReturnType<typeof vi.fn>).mockReturnValue(fake.db);
});

describe("GET /api/products", () => {
  it("returns active products without costPrice for the public", async () => {
    const res = await GET(fakeReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.total).toBe(2);
    expect(json.products[0].costPrice).toBeUndefined();
    expect(json.products[0].compatibleModels).toEqual([]);
    expect(fake.calls.where).toContainEqual(["isActive", "==", true]);
    expect(fake.calls.limit).toEqual([50]);
  });

  it("includes costPrice for managers", async () => {
    auth.user = { uid: "m", role: "manager" };
    const json = await (await GET(fakeReq())).json();
    expect(json.products[0].costPrice).toBe(100);
  });

  it("applies category, vendor, featured, inStock and limit filters", async () => {
    const res = await GET(fakeReq({
      url: "http://localhost/api/products?category=electrico&vendorId=v1&featured=true&inStock=true&limit=500",
    }));
    const json = await res.json();
    expect(json.products.map((p: { id: string }) => p.id)).toEqual(["p1"]);
    expect(fake.calls.where).toContainEqual(["category", "==", "electrico"]);
    expect(fake.calls.where).toContainEqual(["vendorId", "==", "v1"]);
    expect(fake.calls.where).toContainEqual(["isFeatured", "==", true]);
    expect(fake.calls.limit).toEqual([100]);
  });

  it("ignores an invalid category", async () => {
    await GET(fakeReq({ url: "http://localhost/api/products?category=hack" }));
    expect(fake.calls.where).not.toContainEqual(["category", "==", "hack"]);
  });

  it("returns 429 when rate limited", async () => {
    rl.allow = false;
    expect((await GET(fakeReq())).status).toBe(429);
  });

  it("returns 500 on Firestore error", async () => {
    fake.fail();
    expect((await GET(fakeReq())).status).toBe(500);
  });
});

describe("POST /api/products", () => {
  const valid = { name: "Balata", category: "frenos", costPrice: 50, salePrice: 90, stock: 3 };

  it("requires manager role", async () => {
    expect((await POST(fakeReq({ body: valid }))).status).toBe(401);
    auth.user = { uid: "o", role: "operador" };
    expect((await POST(fakeReq({ body: valid }))).status).toBe(401);
  });

  it("creates a product with a sequential SKU", async () => {
    auth.user = { uid: "m", role: "manager" };
    fake.counters.products = 41;
    const res = await POST(fakeReq({ body: { ...valid, compatibleModels: ["FT150", 125], tags: ["x"], vendorId: "v1", shortName: "Bal", vendorSku: "MC-1", isFeatured: true } }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.sku).toBe("PRD-00042");
    const saved = fake.calls.add[0];
    expect(saved.col).toBe("products");
    expect(saved.doc).toMatchObject({
      sku: "PRD-00042", name: "Balata", unit: "PZA", minStock: 2, isActive: true,
      compatibleModels: ["FT150", "125"], tags: ["x"], vendorId: "v1", isFeatured: true,
    });
  });

  it.each([
    [{ ...valid, name: "  " }, "name is required"],
    [{ ...valid, category: "nope" }, "Invalid category"],
    [{ ...valid, unit: "BOX" }, "Invalid unit"],
    [{ ...valid, costPrice: -1 }, "Invalid costPrice"],
    [{ ...valid, salePrice: "abc" }, "Invalid salePrice"],
    [{ ...valid, stock: -2 }, "Invalid stock"],
  ])("rejects invalid input %#", async (body, error) => {
    auth.user = { uid: "a", role: "admin" };
    const res = await POST(fakeReq({ body }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(error);
  });

  it("rejects invalid JSON", async () => {
    auth.user = { uid: "a", role: "admin" };
    expect((await POST(fakeReq({ badJson: true }))).status).toBe(400);
  });

  it("returns 429 when rate limited", async () => {
    rl.allow = false;
    expect((await POST(fakeReq({ body: valid }))).status).toBe(429);
  });

  it("returns 500 on Firestore error", async () => {
    auth.user = { uid: "a", role: "admin" };
    fake.fail();
    expect((await POST(fakeReq({ body: valid }))).status).toBe(500);
  });
});

describe("/api/products/[id]", () => {
  it("GET returns the product, hiding costPrice from the public", async () => {
    const json = await (await ById.GET(fakeReq(), params("p1"))).json();
    expect(json.product.sku).toBe("PRD-00001");
    expect(json.product.costPrice).toBeUndefined();
  });

  it("GET shows costPrice to managers", async () => {
    auth.user = { uid: "m", role: "manager" };
    const json = await (await ById.GET(fakeReq(), params("p1"))).json();
    expect(json.product.costPrice).toBe(100);
  });

  it("GET returns 404 for a missing product", async () => {
    expect((await ById.GET(fakeReq(), params("nope"))).status).toBe(404);
  });

  it("PUT only updates whitelisted fields", async () => {
    auth.user = { uid: "m", role: "manager" };
    const res = await ById.PUT(fakeReq({ body: { salePrice: 200, sku: "HACK", createdAt: 1 } }), params("p1"));
    expect(res.status).toBe(200);
    const upd = fake.calls.update[0];
    expect(upd.id).toBe("p1");
    expect(upd.doc.salePrice).toBe(200);
    expect(upd.doc.sku).toBeUndefined();
    expect(upd.doc.createdAt).toBeUndefined();
  });

  it("PUT rejects an empty update, bad JSON and non-managers", async () => {
    expect((await ById.PUT(fakeReq({ body: { salePrice: 1 } }), params("p1"))).status).toBe(401);
    auth.user = { uid: "m", role: "manager" };
    expect((await ById.PUT(fakeReq({ body: { sku: "X" } }), params("p1"))).status).toBe(400);
    expect((await ById.PUT(fakeReq({ badJson: true }), params("p1"))).status).toBe(400);
  });

  it("DELETE soft-deletes and requires admin", async () => {
    auth.user = { uid: "m", role: "manager" };
    expect((await ById.DELETE(fakeReq(), params("p1"))).status).toBe(401);
    auth.user = { uid: "a", role: "admin" };
    expect((await ById.DELETE(fakeReq(), params("p1"))).status).toBe(200);
    expect(fake.calls.update[0].doc.isActive).toBe(false);
  });

  it("all methods return 429 when rate limited", async () => {
    rl.allow = false;
    expect((await ById.GET(fakeReq(), params("p1"))).status).toBe(429);
    expect((await ById.PUT(fakeReq(), params("p1"))).status).toBe(429);
    expect((await ById.DELETE(fakeReq(), params("p1"))).status).toBe(429);
  });

  it("all methods return 500 on Firestore error", async () => {
    auth.user = { uid: "a", role: "admin" };
    fake.fail();
    expect((await ById.GET(fakeReq(), params("p1"))).status).toBe(500);
    expect((await ById.PUT(fakeReq({ body: { stock: 1 } }), params("p1"))).status).toBe(500);
    expect((await ById.DELETE(fakeReq(), params("p1"))).status).toBe(500);
  });
});
