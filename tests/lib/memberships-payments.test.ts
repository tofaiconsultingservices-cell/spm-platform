import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";
import { getAdminDb } from "@/lib/firebase-admin";

vi.mock("@/lib/payments/stripe-client", () => ({ getStripe: vi.fn() }));
vi.mock("@/lib/notifications/whatsapp", () => ({ sendWhatsApp: vi.fn().mockResolvedValue({}) }));

import {
  totalPayments, addPeriod, termEnd, handleMembershipEvent, recordMembershipPayment,
} from "@/lib/payments/memberships";

const ev = (type: string, object: unknown) => ({ id: "evt_1", type, data: { object } }) as unknown as Stripe.Event;

describe("membership payment periods", () => {
  it("counts 52 weekly or 12 monthly payments", () => {
    expect(totalPayments("weekly")).toBe(52);
    expect(totalPayments("monthly")).toBe(12);
  });

  it("adds one week or one month", () => {
    const d = new Date(2026, 0, 31);
    expect(addPeriod(d, "weekly").getDate()).toBe(7);
    expect(addPeriod(new Date(2026, 4, 10), "monthly").getMonth()).toBe(5);
  });

  it("ends the term after 12 months", () => {
    const start = new Date(2026, 10, 23);
    expect(termEnd(start, "monthly").getFullYear()).toBe(2027);
    expect(termEnd(start, "monthly").getMonth()).toBe(10);
    const days = (termEnd(start, "weekly").getTime() - start.getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(364);
  });
});

describe("handleMembershipEvent", () => {
  const txUpdate = vi.fn();
  let docData: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    docData = { uid: "u1", status: "por_pagar", billing: "weekly", paymentsMade: 0, payments: [], clientPhone: "8112345678", clientName: "Ana" };
    (getAdminDb as ReturnType<typeof vi.fn>).mockReturnValue({
      collection: vi.fn(() => ({ doc: vi.fn(() => ({ id: "m1" })) })),
      runTransaction: vi.fn(async (fn: (tx: unknown) => Promise<void>) =>
        fn({ get: vi.fn(async () => ({ exists: true, data: () => docData })), update: txUpdate })),
    });
  });

  it("ignores checkout sessions that are not memberships", async () => {
    const handled = await handleMembershipEvent(ev("checkout.session.completed", { metadata: { ticketId: "SPM-1", type: "servicio" } }));
    expect(handled).toBe(false);
    expect(getAdminDb).not.toHaveBeenCalled();
  });

  it("ignores unrelated event types", async () => {
    expect(await handleMembershipEvent(ev("payment_intent.payment_failed", {}))).toBe(false);
  });

  it("ignores invoices without membership metadata", async () => {
    expect(await handleMembershipEvent(ev("invoice.paid", { id: "in_1", amount_paid: 10000, parent: null }))).toBe(false);
  });

  it("records a paid card invoice and activates the membership", async () => {
    const handled = await handleMembershipEvent(ev("invoice.paid", {
      id: "in_1", amount_paid: 19900,
      parent: { type: "subscription_details", subscription_details: { metadata: { type: "membership", membershipId: "m1" } } },
    }));
    expect(handled).toBe(true);
    expect(txUpdate).toHaveBeenCalledTimes(1);
    const update = txUpdate.mock.calls[0][1];
    expect(update.status).toBe("activa");
    expect(update.paymentsMade).toBe(1);
    expect(update.paymentMethod).toBe("card");
  });

  it("does not record the same payment twice", async () => {
    docData.payments = [{ id: "in_1" }];
    const recorded = await recordMembershipPayment("m1", { id: "in_1", amount: 199, method: "card" });
    expect(recorded).toBe(false);
    expect(txUpdate).not.toHaveBeenCalled();
  });

  it("marks the membership finished on the last payment", async () => {
    docData.billing = "monthly";
    docData.paymentsMade = 11;
    await recordMembershipPayment("m1", { id: "in_12", amount: 900, method: "card" });
    expect(txUpdate.mock.calls[0][1].status).toBe("finalizada");
    expect(txUpdate.mock.calls[0][1].nextPaymentAt).toBeNull();
  });
});
