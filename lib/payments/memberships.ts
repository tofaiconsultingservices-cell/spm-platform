/**
 * Cobro de membresías de mantenimiento (servidor).
 *
 * - Tarjeta: Stripe Checkout en modo "subscription". Stripe cobra solo cada
 *   semana o mes y la suscripción se cancela sola al cumplir el plazo de 12 meses.
 * - OXXO: Stripe no permite OXXO en suscripciones, así que cada periodo el cliente
 *   genera una ficha (Checkout en modo "payment") desde su portal.
 *
 * Todos los pagos llegan por /api/payments/webhook → handleMembershipEvent().
 * Eventos que hay que activar en el webhook de Stripe:
 *   checkout.session.completed, checkout.session.async_payment_succeeded,
 *   checkout.session.async_payment_failed, invoice.paid, invoice.payment_failed,
 *   customer.subscription.deleted
 */

import type Stripe from "stripe";
import { getStripe } from "@/lib/payments/stripe-client";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { sendWhatsApp } from "@/lib/notifications/whatsapp";

export const MEMBERSHIPS = "memberships";
export type MembershipBilling = "weekly" | "monthly";
export type MembershipPayMethod = "card" | "oxxo";

/** OXXO acepta como máximo $10,000 MXN por ficha. */
export const OXXO_MAX_MXN = 10_000;

export const totalPayments = (billing: MembershipBilling) => (billing === "weekly" ? 52 : 12);

export function addPeriod(date: Date, billing: MembershipBilling): Date {
  const d = new Date(date);
  if (billing === "weekly") d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

/** Fin del plazo de 12 meses a partir de la fecha de inicio. */
export function termEnd(start: Date, billing: MembershipBilling): Date {
  const d = new Date(start);
  if (billing === "weekly") d.setDate(d.getDate() + 52 * 7);
  else d.setMonth(d.getMonth() + 12);
  return d;
}

const idOf = (x: string | { id: string } | null | undefined) => (typeof x === "string" ? x : x?.id);

interface MembershipData {
  uid: string;
  status: string;
  billing: MembershipBilling;
  confirmedAmount?: number;
  paymentsMade?: number;
  payments?: { id: string }[];
  paymentMethod?: MembershipPayMethod;
  nextPaymentAt?: { toDate(): Date };
  stripeCustomerId?: string;
  clientName?: string;
  clientPhone?: string;
  vehicle?: { typeName?: string; range?: string; model?: string };
}

/* ─────────────────────────── Checkout ─────────────────────────── */

export async function createMembershipCheckout(opts: {
  membershipId: string;
  membership: MembershipData;
  method: MembershipPayMethod;
  customerEmail?: string;
}): Promise<{ url: string }> {
  const { membershipId, membership: m, method } = opts;
  const amount = m.confirmedAmount;
  if (!amount || amount < 10) throw new Error("La membresía no tiene un precio confirmado.");
  if (method === "oxxo" && amount > OXXO_MAX_MXN) {
    throw new Error("El pago por periodo excede el máximo de OXXO ($10,000). Usa tarjeta.");
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://sanpedromotocare.com";
  const period = m.billing === "weekly" ? "semanal" : "mensual";
  const name = `Membresía ${period} SPM — ${m.vehicle?.typeName ?? "Vehículo"} ${m.vehicle?.range ?? ""}`.trim();
  const description = m.vehicle?.model || undefined;
  const folio = membershipId.slice(0, 6).toUpperCase();
  const metadata = { type: "membership", membershipId, method, platform: "spm-platform" };
  const stripe = getStripe();
  const customer = m.stripeCustomerId
    ? { customer: m.stripeCustomerId }
    : opts.customerEmail ? { customer_email: opts.customerEmail } : {};

  let session: Stripe.Checkout.Session;
  if (method === "card") {
    session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "mxn",
          product_data: { name, ...(description ? { description } : {}) },
          unit_amount: Math.round(amount * 100),
          recurring: { interval: m.billing === "weekly" ? "week" : "month" },
        },
        quantity: 1,
      }],
      ...customer,
      metadata,
      subscription_data: {
        description: `SPM membresía ${folio}`,
        metadata: { type: "membership", membershipId },
      },
      success_url: `${appUrl}/portal/membresias?pago=ok`,
      cancel_url: `${appUrl}/portal/membresias?pago=cancelado`,
    }, { idempotencyKey: `membership_card_${membershipId}_${Math.floor(Date.now() / 600_000)}` });
  } else {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["oxxo"],
      payment_method_options: { oxxo: { expires_after_days: 3 } },
      line_items: [{
        price_data: {
          currency: "mxn",
          product_data: { name, ...(description ? { description } : {}) },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      }],
      ...(opts.customerEmail ? { customer_email: opts.customerEmail } : {}),
      metadata,
      payment_intent_data: {
        description: `SPM membresía ${folio} — pago ${period}`,
        statement_descriptor_suffix: "SPMOTOCARE",
        metadata,
      },
      success_url: `${appUrl}/portal/membresias?pago=oxxo`,
      cancel_url: `${appUrl}/portal/membresias?pago=cancelado`,
    }, { idempotencyKey: `membership_oxxo_${membershipId}_${Math.floor(Date.now() / 600_000)}` });
  }

  if (!session.url) throw new Error("Stripe no devolvió la página de pago.");
  return { url: session.url };
}

/** Portal de Stripe para que el cliente actualice su tarjeta. */
export async function createCardUpdateLink(customerId: string): Promise<string> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://sanpedromotocare.com";
  const s = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/portal/membresias`,
  });
  return s.url;
}

/** El staff cancela una membresía; si tiene suscripción con tarjeta, se cancela en Stripe. */
export async function cancelMembership(membershipId: string, byUid: string): Promise<void> {
  const ref = getAdminDb().collection(MEMBERSHIPS).doc(membershipId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Membresía no encontrada");
  const subId = snap.data()?.stripeSubscriptionId as string | undefined;
  if (subId) {
    try { await getStripe().subscriptions.cancel(subId); }
    catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== "resource_missing") throw err; // ya cancelada en Stripe
    }
  }
  await ref.update({
    status: "cancelada",
    cancelledAt: FieldValue.serverTimestamp(),
    cancelledBy: byUid,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/* ─────────────────────────── Pagos ─────────────────────────── */

/** Registra un pago una sola vez (idempotente por id de factura/sesión). */
export async function recordMembershipPayment(
  membershipId: string,
  p: { id: string; amount: number; method: MembershipPayMethod },
): Promise<boolean> {
  const db = getAdminDb();
  const ref = db.collection(MEMBERSHIPS).doc(membershipId);
  let notify: { phone?: string; name?: string; made: number; total: number } | null = null;

  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const m = snap.data() as MembershipData;
    if ((m.payments ?? []).some(x => x.id === p.id)) return; // ya registrado

    const now = new Date();
    const total = totalPayments(m.billing);
    const made = (m.paymentsMade ?? 0) + 1;
    // OXXO puede pagarse por adelantado: el siguiente vencimiento se recorre desde el último
    const prevDue = m.nextPaymentAt?.toDate();
    const base = p.method === "oxxo" && prevDue && prevDue > now ? prevDue : now;
    const finished = made >= total;

    tx.update(ref, {
      status: finished ? "finalizada" : "activa",
      paymentMethod: p.method,
      paymentsMade: made,
      lastPaymentAt: FieldValue.serverTimestamp(),
      nextPaymentAt: finished ? null : addPeriod(base, m.billing),
      payments: FieldValue.arrayUnion({ id: p.id, amount: p.amount, method: p.method, paidAt: now }),
      ...(m.paymentsMade ? {} : { activatedAt: FieldValue.serverTimestamp() }),
      ...(p.method === "oxxo" ? { oxxoVoucherUrl: FieldValue.delete(), oxxoPendingUntil: FieldValue.delete() } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });
    notify = { phone: m.clientPhone, name: m.clientName, made, total };
  });

  const n = notify as { phone?: string; name?: string; made: number; total: number } | null;
  if (n?.phone) {
    try {
      await sendWhatsApp({
        to: n.phone,
        body: [
          `✅ *Pago de membresía recibido*`,
          ``,
          `Hola ${(n.name ?? "").split(" ")[0] || "rider"}, recibimos tu pago de *$${p.amount.toLocaleString("es-MX")} MXN* (${n.made} de ${n.total}).`,
          `Revisa tu plan en sanpedromotocare.com/portal/membresias`,
          `— San Pedro Moto Care`,
        ].join("\n"),
      });
    } catch (err) {
      console.warn("[Membership] WhatsApp notify failed:", err);
    }
  }
  return n !== null;
}

/* ─────────────────────────── Webhook ─────────────────────────── */

/**
 * Procesa eventos de Stripe de membresías.
 * Devuelve true si el evento era de una membresía (y ya se atendió).
 */
export async function handleMembershipEvent(event: Stripe.Event): Promise<boolean> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed": {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.metadata?.type !== "membership" || !s.metadata.membershipId) return false;
      const membershipId = s.metadata.membershipId;
      const ref = getAdminDb().collection(MEMBERSHIPS).doc(membershipId);
      const amount = (s.amount_total ?? 0) / 100;

      if (event.type === "checkout.session.completed" && s.mode === "subscription") {
        const subId = idOf(s.subscription);
        const snap = await ref.get();
        const billing = (snap.data()?.billing ?? "monthly") as MembershipBilling;
        if (subId) {
          // Que la suscripción termine sola al cumplir 12 meses (1 h antes para no generar un cobro extra)
          const endsAt = termEnd(new Date(), billing);
          await getStripe().subscriptions.update(subId, {
            cancel_at: Math.floor(endsAt.getTime() / 1000) - 3600,
            proration_behavior: "none",
            metadata: { type: "membership", membershipId },
          });
          await ref.update({
            status: "activa",
            paymentMethod: "card",
            stripeSubscriptionId: subId,
            stripeCustomerId: idOf(s.customer) ?? null,
            termEndsAt: endsAt,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
        return true;
      }

      if (event.type === "checkout.session.completed" && s.mode === "payment") {
        if (s.payment_status === "paid") {
          await recordMembershipPayment(membershipId, { id: s.id, amount, method: "oxxo" });
          return true;
        }
        // Ficha OXXO generada: guardar el link para que el cliente la vuelva a ver
        let voucherUrl: string | null = null;
        const piId = idOf(s.payment_intent);
        if (piId) {
          try {
            const pi = await getStripe().paymentIntents.retrieve(piId);
            voucherUrl = pi.next_action?.oxxo_display_details?.hosted_voucher_url ?? null;
          } catch (err) {
            console.warn("[Membership] could not read OXXO voucher:", err);
          }
        }
        await ref.update({
          oxxoVoucherUrl: voucherUrl,
          oxxoPendingUntil: new Date(Date.now() + 3 * 24 * 3600 * 1000),
          updatedAt: FieldValue.serverTimestamp(),
        });
        return true;
      }

      if (event.type === "checkout.session.async_payment_succeeded") {
        await recordMembershipPayment(membershipId, { id: s.id, amount, method: "oxxo" });
        return true;
      }

      // async_payment_failed: la ficha venció sin pago
      await ref.update({
        oxxoVoucherUrl: FieldValue.delete(),
        oxxoPendingUntil: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return true;
    }

    case "invoice.paid":
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      const membershipId = inv.parent?.subscription_details?.metadata?.membershipId;
      if (!membershipId) return false;
      if (event.type === "invoice.paid") {
        if ((inv.amount_paid ?? 0) > 0) {
          await recordMembershipPayment(membershipId, { id: inv.id ?? `inv_${event.id}`, amount: inv.amount_paid / 100, method: "card" });
        }
      } else {
        await getAdminDb().collection(MEMBERSHIPS).doc(membershipId).update({
          status: "atrasada",
          lastPaymentFailedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      return true;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const membershipId = sub.metadata?.membershipId;
      if (sub.metadata?.type !== "membership" || !membershipId) return false;
      const ref = getAdminDb().collection(MEMBERSHIPS).doc(membershipId);
      const snap = await ref.get();
      const m = snap.data() as MembershipData | undefined;
      if (!m || m.status === "cancelada" || m.status === "finalizada") return true;
      const done = (m.paymentsMade ?? 0) >= totalPayments(m.billing);
      await ref.update({
        status: done ? "finalizada" : "cancelada",
        nextPaymentAt: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return true;
    }

    default:
      return false;
  }
}
