import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAdminDb } from "@/lib/firebase-admin";

vi.mock("@/lib/payments/stripe-client", () => ({
  verifyWebhookSignature: vi.fn(),
  getStripe: vi.fn(),
}));

vi.mock("@/lib/notifications/whatsapp", () => ({
  sendWhatsApp: vi.fn().mockResolvedValue({ sid: "SM123" }),
  sendSMS: vi.fn(),
}));

describe("POST /api/payments/webhook", () => {
  const mockUpdate = vi.fn().mockResolvedValue(undefined);
  const mockGet = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    (getAdminDb as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => ({
            get: mockGet,
          })),
        })),
      })),
    });
  });

  async function callWebhook(body: string, signature = "sig_valid") {
    const { POST } = await import("@/app/api/payments/webhook/route");
    const req = new Request("http://localhost/api/payments/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": signature,
      },
      body,
    });
    return POST(req as never);
  }

  it("returns 400 without stripe-signature header", async () => {
    const { POST } = await import("@/app/api/payments/webhook/route");
    const req = new Request("http://localhost/api/payments/webhook", {
      method: "POST",
      body: "{}",
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Missing stripe-signature");
  });

  it("returns 400 on invalid signature", async () => {
    const { verifyWebhookSignature } = await import("@/lib/payments/stripe-client");
    (verifyWebhookSignature as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const res = await callWebhook("bad-body", "invalid_sig");
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid signature");
  });

  it("marks ticket as pagado on checkout.session.completed (servicio)", async () => {
    const { verifyWebhookSignature } = await import("@/lib/payments/stripe-client");
    (verifyWebhookSignature as ReturnType<typeof vi.fn>).mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_123",
          metadata: {
            ticketId: "SPM-0010",
            clientName: "Juan",
            clientPhone: "+528100000000",
            type: "servicio",
          },
          amount_total: 85000,
          payment_status: "paid",
        },
      },
    });

    mockGet.mockResolvedValue({
      empty: false,
      docs: [{ ref: { update: mockUpdate }, data: () => ({}) }],
    });

    const res = await callWebhook(JSON.stringify({}));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "pagado",
      })
    );
  });

  it("handles anticipo payment type without marking as pagado", async () => {
    const { verifyWebhookSignature } = await import("@/lib/payments/stripe-client");
    (verifyWebhookSignature as ReturnType<typeof vi.fn>).mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_456",
          metadata: {
            ticketId: "SPM-0020",
            clientName: "Ana",
            clientPhone: "+528100000001",
            type: "anticipo",
          },
          amount_total: 20000,
        },
      },
    });

    mockGet.mockResolvedValue({
      empty: false,
      docs: [{ ref: { update: mockUpdate }, data: () => ({}) }],
    });

    const res = await callWebhook(JSON.stringify({}));
    expect(res.status).toBe(200);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        anticipoPagado: true,
      })
    );
    const updateArg = mockUpdate.mock.calls[0][0];
    expect(updateArg.status).toBeUndefined();
  });

  it("handles missing ticketId in metadata gracefully", async () => {
    const { verifyWebhookSignature } = await import("@/lib/payments/stripe-client");
    (verifyWebhookSignature as ReturnType<typeof vi.fn>).mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: { id: "cs_no_meta", metadata: {} },
      },
    });

    const res = await callWebhook(JSON.stringify({}));
    expect(res.status).toBe(200);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("handles ticket not found in Firestore", async () => {
    const { verifyWebhookSignature } = await import("@/lib/payments/stripe-client");
    (verifyWebhookSignature as ReturnType<typeof vi.fn>).mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_missing",
          metadata: { ticketId: "SPM-9999", type: "servicio" },
        },
      },
    });

    mockGet.mockResolvedValue({ empty: true, docs: [] });

    const res = await callWebhook(JSON.stringify({}));
    expect(res.status).toBe(200);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("handles payment_intent.payment_failed event", async () => {
    const { verifyWebhookSignature } = await import("@/lib/payments/stripe-client");
    (verifyWebhookSignature as ReturnType<typeof vi.fn>).mockReturnValue({
      type: "payment_intent.payment_failed",
      data: {
        object: {
          metadata: {
            ticketId: "SPM-0030",
            clientPhone: "+528100000002",
            clientName: "Carlos",
          },
          last_payment_error: { message: "Card declined" },
        },
      },
    });

    const res = await callWebhook(JSON.stringify({}));
    expect(res.status).toBe(200);

    const { sendWhatsApp } = await import("@/lib/notifications/whatsapp");
    expect(sendWhatsApp).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "+528100000002",
      })
    );
  });
});
