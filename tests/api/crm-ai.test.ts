import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { makeFakeDb, fakeReq } from "../helpers/fake-admin";

const mistral = vi.hoisted(() => ({ complete: vi.fn() }));
const rl = vi.hoisted(() => ({ allow: true }));

vi.mock("@mistralai/mistralai", () => ({
  Mistral: function Mistral() { return { chat: { complete: mistral.complete } }; },
}));
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => () => ({ success: rl.allow, remaining: 1, retryAfter: 12 }),
}));

import { POST } from "@/app/api/crm/ai/route";

const now = { toDate: () => new Date() };
const seed = () => ({
  users: [
    { id: "staff", role: "manager", displayName: "Saúl" },
    { id: "client", role: "cliente" },
  ],
  service_tickets: [
    { id: "t1", ticketId: "SPM-0007", status: "en-servicio", serviceType: "afinacion", clientName: "Juan", mechanicName: "Pepe", mechanicId: "m1", estimatedCost: 900, createdAt: now, updatedAt: now },
    { id: "t2", ticketId: "SPM-0008", status: "lead-recibido", serviceType: "frenos", estimatedCost: 500, createdAt: now, updatedAt: now },
    { id: "t3", ticketId: "SPM-0009", status: "pagado", serviceType: "lavado", finalCost: 300, paymentMethod: "stripe", paidAt: now, updatedAt: now },
    { id: "t4", ticketId: "SPM-0010", status: "pagado", finalCost: 200, paidAt: now, updatedAt: now },
  ],
  mechanics: [
    { id: "m1", name: "Pepe", status: "disponible", skills: ["motor", "frenos"], zona: ["San Pedro"], averageRating: 4.8, totalServicesCompleted: 12 },
    { id: "m2", name: "Toño", status: "ocupado", zona: "Apodaca" },
  ],
  clients: [{ id: "c1", name: "Juan", lastName: "Pérez", phone: "81", totalTickets: 2, totalPaid: 1200 }],
  products: [
    { id: "p1", sku: "PRD-00001", name: "Bobina", shortName: "Bob", category: "electrico", unit: "PZA", stock: 1, minStock: 2, costPrice: 100, salePrice: 180, isActive: true, compatibleModels: ["FT150"], updatedAt: now },
    { id: "p2", sku: "PRD-00002", name: "Balata", category: "frenos", unit: "PZA", stock: 0, minStock: 1, costPrice: 50, salePrice: 90, isActive: true },
    { id: "p3", sku: "PRD-00003", name: "Vieja", stock: 9, minStock: 1, costPrice: 1, salePrice: 2, isActive: false },
  ],
  vendors: [{ id: "v1", vendorId: "PROV-0001", name: "MotoCruz", rfc: "MCR", phone: "81" }],
  purchase_orders: [{ id: "po1", orderId: "OC-2026-0001", vendorName: "MotoCruz", status: "borrador", items: [{}, {}], total: 28101.88, createdAt: now }],
});

const verifySessionCookie = vi.fn();
let fake: ReturnType<typeof makeFakeDb>;

function ask(message: unknown, history?: unknown) {
  return POST(fakeReq({ session: "cookie", body: { message, history } }));
}
function systemPrompt(): string {
  return mistral.complete.mock.calls.at(-1)![0].messages[0].content;
}

beforeEach(() => {
  vi.clearAllMocks();
  rl.allow = true;
  process.env.MISTRAL_API_KEY = "test-key";
  fake = makeFakeDb(seed());
  (getAdminDb as ReturnType<typeof vi.fn>).mockReturnValue(fake.db);
  (getAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({ verifySessionCookie });
  verifySessionCookie.mockResolvedValue({ uid: "staff", email: "s@spm.mx" });
  mistral.complete.mockResolvedValue({ choices: [{ message: { content: "Hola" } }] });
});

describe("POST /api/crm/ai — auth", () => {
  it("401 without a session cookie", async () => {
    expect((await POST(fakeReq({ body: { message: "hola" } }))).status).toBe(401);
  });

  it("401 for an invalid cookie", async () => {
    verifySessionCookie.mockRejectedValue(new Error("bad"));
    expect((await ask("hola")).status).toBe(401);
  });

  it("401 when the user doc is missing or not staff", async () => {
    verifySessionCookie.mockResolvedValue({ uid: "ghost" });
    expect((await ask("hola")).status).toBe(401);
    verifySessionCookie.mockResolvedValue({ uid: "client" });
    expect((await ask("hola")).status).toBe(401);
  });

  it("429 with Retry-After when rate limited", async () => {
    rl.allow = false;
    const res = await ask("hola");
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("12");
  });
});

describe("POST /api/crm/ai — requests", () => {
  it("400 for a missing message", async () => {
    expect((await ask(undefined)).status).toBe(400);
    expect((await ask(42)).status).toBe(400);
  });

  it("500 when Mistral is not configured", async () => {
    delete process.env.MISTRAL_API_KEY;
    const res = await ask("hola");
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("IA no configurada");
  });

  it("always includes tickets and mechanics, and returns the reply", async () => {
    const res = await ask("¿qué hay pendiente?");
    expect(res.status).toBe(200);
    expect((await res.json()).reply).toBe("Hola");
    const p = systemPrompt();
    expect(p).toContain("Saúl (manager)");
    expect(p).toContain("SPM-0007");
    expect(p).toContain("Sin mecánico: 1");
    expect(p).toContain("MECÁNICOS (1/2 disponibles)");
    expect(p).toContain("⭐4.8");
    expect(p).not.toContain("INVENTARIO");
  });

  it("adds ticket detail when a ticket id is asked about", async () => {
    await ask("detalle del spm-7");
    expect(systemPrompt()).toContain("DETALLE SPM-0007");
  });

  it("adds clients for client questions", async () => {
    await ask("lista de clientes");
    expect(systemPrompt()).toContain("CLIENTES RECIENTES");
  });

  it("adds inventory with low-stock alerts and product detail", async () => {
    await ask("stock de PRD-00001");
    const p = systemPrompt();
    expect(p).toContain("INVENTARIO — 2 productos activos");
    expect(p).toContain("Con stock bajo: 2  |  Sin stock: 1");
    expect(p).toContain("ALERTAS STOCK BAJO");
    expect(p).toContain("DETALLE PRD-00001");
    expect(p).toContain("Modelos: FT150");
  });

  it("adds vendors and purchase orders for supplier questions", async () => {
    await ask("¿qué le debemos al proveedor?");
    const p = systemPrompt();
    expect(p).toContain("PROVEEDORES");
    expect(p).toContain("OC-2026-0001");
  });

  it("adds payments for revenue questions", async () => {
    await ask("¿cuánto se ha cobrado hoy?");
    const p = systemPrompt();
    expect(p).toContain("PAGOS Y FACTURACIÓN");
    expect(p).toContain("stripe");
    expect(p).toContain("desconocido");
  });

  it("includes every section for a summary", async () => {
    await ask("dame un resumen general");
    const p = systemPrompt();
    for (const s of ["INVENTARIO", "PAGOS", "CLIENTES", "PROVEEDORES", "ÓRDENES DE COMPRA"]) {
      expect(p).toContain(s);
    }
  });

  it("shows no low-stock alert when stock is fine and handles empty data", async () => {
    fake = makeFakeDb({ ...seed(), products: [], service_tickets: [], mechanics: [] });
    (getAdminDb as ReturnType<typeof vi.fn>).mockReturnValue(fake.db);
    await ask("inventario");
    const p = systemPrompt();
    expect(p).toContain("Sin alertas de stock bajo");
    expect(p).toContain("(sin mecánicos)");
  });

  it("sends only the last 8 history messages, mapping roles", async () => {
    const history = Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` }));
    await ask("hola", history);
    const msgs = mistral.complete.mock.calls[0][0].messages;
    expect(msgs).toHaveLength(1 + 8 + 1);
    expect(msgs[1]).toEqual({ role: "user", content: "m2" });
    expect(msgs[2]).toEqual({ role: "assistant", content: "m3" });
    expect(msgs.at(-1)).toEqual({ role: "user", content: "hola" });
  });

  it("returns an empty reply without failing", async () => {
    mistral.complete.mockResolvedValue({ choices: [] });
    expect((await (await ask("hola")).json()).reply).toBe("");
  });

  it("500 when Mistral or Firestore fails", async () => {
    mistral.complete.mockRejectedValue(new Error("boom"));
    expect((await ask("hola")).status).toBe(500);
  });
});
