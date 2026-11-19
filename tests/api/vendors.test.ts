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

import { GET, POST } from "@/app/api/vendors/route";

let fake: ReturnType<typeof makeFakeDb>;

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = null;
  rl.allow = true;
  fake = makeFakeDb({ vendors: [{ id: "v1", vendorId: "PROV-0001", name: "MotoCruz" }] });
  (getAdminDb as ReturnType<typeof vi.fn>).mockReturnValue(fake.db);
});

describe("GET /api/vendors", () => {
  it("requires operador or higher", async () => {
    expect((await GET(fakeReq())).status).toBe(401);
    auth.user = { uid: "x", role: "mecanico" };
    expect((await GET(fakeReq())).status).toBe(401);
  });

  it("lists vendors ordered by name", async () => {
    auth.user = { uid: "x", role: "operador" };
    const json = await (await GET(fakeReq())).json();
    expect(json.vendors).toEqual([{ id: "v1", vendorId: "PROV-0001", name: "MotoCruz" }]);
    expect(fake.calls.orderBy).toContainEqual(["name", "asc"]);
  });

  it("returns 429 when rate limited and 500 on error", async () => {
    rl.allow = false;
    expect((await GET(fakeReq())).status).toBe(429);
    rl.allow = true;
    auth.user = { uid: "x", role: "admin" };
    fake.fail();
    expect((await GET(fakeReq())).status).toBe(500);
  });
});

describe("POST /api/vendors", () => {
  it("requires manager or higher", async () => {
    auth.user = { uid: "x", role: "operador" };
    expect((await POST(fakeReq({ body: { name: "A" } }))).status).toBe(401);
  });

  it("creates a vendor with a sequential PROV id and trimmed fields", async () => {
    auth.user = { uid: "m", role: "manager" };
    fake.counters.vendors = 4;
    const res = await POST(fakeReq({
      body: { name: "  Refaccionaria Norte ", rfc: "ABC123456XYZ", phone: "8133880010", email: "a@b.mx", notes: "n", contactName: "Luis", address: { city: "MTY" } },
    }));
    expect(res.status).toBe(201);
    expect((await res.json()).vendorId).toBe("PROV-0005");
    expect(fake.calls.add[0].doc).toMatchObject({
      vendorId: "PROV-0005", name: "Refaccionaria Norte", rfc: "ABC123456XYZ",
      contactName: "Luis", address: { city: "MTY" }, isActive: true,
    });
  });

  it("nulls optional fields when absent", async () => {
    auth.user = { uid: "m", role: "admin" };
    await POST(fakeReq({ body: { name: "Solo" } }));
    expect(fake.calls.add[0].doc).toMatchObject({ rfc: null, phone: null, email: null, address: null, notes: null });
  });

  it("validates name and JSON", async () => {
    auth.user = { uid: "m", role: "manager" };
    expect((await POST(fakeReq({ body: { name: " " } }))).status).toBe(400);
    expect((await POST(fakeReq({ badJson: true }))).status).toBe(400);
  });

  it("returns 429 when rate limited and 500 on error", async () => {
    rl.allow = false;
    expect((await POST(fakeReq({ body: { name: "A" } }))).status).toBe(429);
    rl.allow = true;
    auth.user = { uid: "m", role: "manager" };
    fake.fail();
    expect((await POST(fakeReq({ body: { name: "A" } }))).status).toBe(500);
  });
});
