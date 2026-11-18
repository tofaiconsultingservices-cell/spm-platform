import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();
const mockConstructEvent = vi.fn();

vi.mock("stripe", () => {
  class StripeError extends Error {}
  function MockStripe() {
    return {
      checkout: { sessions: { create: mockCreate } },
      webhooks: { constructEvent: mockConstructEvent },
    };
  }
  MockStripe.errors = {
    StripeCardError: StripeError,
    StripeInvalidRequestError: StripeError,
    StripeAPIError: StripeError,
    StripeConnectionError: StripeError,
    StripeRateLimitError: StripeError,
  };
  MockStripe.default = MockStripe;
  return { default: MockStripe };
});

describe("stripe-client", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockCreate.mockReset();
    mockConstructEvent.mockReset();
    process.env = { ...originalEnv };
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_fake";
    process.env.NEXT_PUBLIC_APP_URL = "https://spm-test.vercel.app";
  });

  describe("getStripe", () => {
    it("throws without STRIPE_SECRET_KEY", async () => {
      delete process.env.STRIPE_SECRET_KEY;
      const { getStripe } = await import("@/lib/payments/stripe-client");
      expect(() => getStripe()).toThrow("STRIPE_SECRET_KEY is not configured");
    });

    it("returns stripe instance with key", async () => {
      const { getStripe } = await import("@/lib/payments/stripe-client");
      const stripe = getStripe();
      expect(stripe).toBeDefined();
      expect(stripe.checkout).toBeDefined();
    });
  });

  describe("createCheckoutSession", () => {
    it("creates session with correct params", async () => {
      mockCreate.mockResolvedValueOnce({
        id: "cs_test_123",
        url: "https://checkout.stripe.com/pay/cs_test_123",
      });

      const { createCheckoutSession } = await import("@/lib/payments/stripe-client");
      const result = await createCheckoutSession({
        ticketId: "SPM-0001",
        clientName: "Juan",
        clientPhone: "+5281234567",
        serviceDescription: "Cambio de aceite",
        serviceType: "afinacion-menor",
        amountMXN: 500,
      });

      expect(result.success).toBe(true);
      expect(result.url).toContain("checkout.stripe.com");
      expect(result.sessionId).toBe("cs_test_123");

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.currency).toBe("mxn");
      expect(callArgs.line_items[0].price_data.unit_amount).toBe(50000);
      expect(callArgs.metadata.ticketId).toBe("SPM-0001");
      expect(callArgs.metadata.type).toBe("servicio");
      expect(callArgs.success_url).toContain("spm-test.vercel.app");
      expect(callArgs.success_url).toContain("SPM-0001");
    });

    it("sets type to anticipo when specified", async () => {
      mockCreate.mockResolvedValueOnce({ id: "cs_test_456", url: "https://checkout.stripe.com/pay/cs_test_456" });

      const { createCheckoutSession } = await import("@/lib/payments/stripe-client");
      await createCheckoutSession({
        ticketId: "SPM-0002",
        clientName: "Ana",
        clientPhone: "+5281000000",
        serviceDescription: "Diagnóstico",
        serviceType: "diagnostico",
        amountMXN: 200,
        type: "anticipo",
      });

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.metadata.type).toBe("anticipo");
    });

    it("converts MXN to centavos correctly", async () => {
      mockCreate.mockResolvedValueOnce({ id: "cs_test_789", url: null });

      const { createCheckoutSession } = await import("@/lib/payments/stripe-client");
      await createCheckoutSession({
        ticketId: "SPM-0003",
        clientName: "Test",
        clientPhone: "+521",
        serviceDescription: "Test",
        serviceType: "otro",
        amountMXN: 1250.50,
      });

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.line_items[0].price_data.unit_amount).toBe(125050);
    });

    it("returns error on Stripe failure", async () => {
      mockCreate.mockRejectedValueOnce(new Error("Card declined"));

      const { createCheckoutSession } = await import("@/lib/payments/stripe-client");
      const result = await createCheckoutSession({
        ticketId: "SPM-0004",
        clientName: "Test",
        clientPhone: "+521",
        serviceDescription: "Test",
        serviceType: "otro",
        amountMXN: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Card declined");
    });

    it("handles null url from Stripe", async () => {
      mockCreate.mockResolvedValueOnce({ id: "cs_null_url", url: null });

      const { createCheckoutSession } = await import("@/lib/payments/stripe-client");
      const result = await createCheckoutSession({
        ticketId: "SPM-0005",
        clientName: "Test",
        clientPhone: "+521",
        serviceDescription: "Test",
        serviceType: "otro",
        amountMXN: 100,
      });

      expect(result.success).toBe(true);
      expect(result.url).toBeUndefined();
    });
  });

  describe("verifyWebhookSignature", () => {
    it("throws without STRIPE_WEBHOOK_SECRET", async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;
      const { verifyWebhookSignature } = await import("@/lib/payments/stripe-client");
      expect(() => verifyWebhookSignature("body", "sig")).toThrow("STRIPE_WEBHOOK_SECRET is not configured");
    });

    it("calls constructEvent with correct params", async () => {
      mockConstructEvent.mockReturnValueOnce({ type: "checkout.session.completed" });

      const { verifyWebhookSignature } = await import("@/lib/payments/stripe-client");
      const event = verifyWebhookSignature("raw-body", "sig_header");
      expect(event.type).toBe("checkout.session.completed");
      expect(mockConstructEvent).toHaveBeenCalledWith("raw-body", "sig_header", "whsec_test_fake");
    });
  });
});
