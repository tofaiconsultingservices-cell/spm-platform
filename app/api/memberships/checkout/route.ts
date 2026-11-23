/**
 * POST /api/memberships/checkout
 * Body: { membershipId: string, method: "card" | "oxxo" }
 * Auth: Authorization: Bearer <Firebase ID token> (dueño de la membresía)
 * Respuesta: { url } — página de pago de Stripe
 */
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getRequestUser } from "@/lib/auth-request";
import { createMembershipCheckout, totalPayments, MEMBERSHIPS, type MembershipBilling } from "@/lib/payments/memberships";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

export async function POST(req: NextRequest) {
  if (!limiter(getClientIp(req)).success) {
    return NextResponse.json({ error: "Demasiadas solicitudes, intenta en un minuto." }, { status: 429 });
  }
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "Inicia sesión de nuevo." }, { status: 401 });

  let body: { membershipId?: string; method?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  const { membershipId, method } = body;
  if (!membershipId || (method !== "card" && method !== "oxxo")) {
    return NextResponse.json({ error: "Faltan membershipId o method (card | oxxo)." }, { status: 400 });
  }

  const snap = await getAdminDb().collection(MEMBERSHIPS).doc(membershipId).get();
  const m = snap.data();
  if (!snap.exists || !m || m.uid !== user.uid) {
    return NextResponse.json({ error: "Membresía no encontrada." }, { status: 404 });
  }

  const billing = (m.billing ?? "monthly") as MembershipBilling;
  if ((m.paymentsMade ?? 0) >= totalPayments(billing)) {
    return NextResponse.json({ error: "Esta membresía ya está pagada por completo." }, { status: 409 });
  }
  const canCard = m.status === "por_pagar" || (m.status === "atrasada" && m.paymentMethod !== "card");
  // Si paga con tarjeta y un cobro falló, Stripe reintenta ese mismo cobro: no ofrecer OXXO para no cobrar doble.
  if (billing === "annual" && m.status !== "por_pagar") {
    return NextResponse.json({ error: "Esta membresía anual ya está pagada." }, { status: 409 });
  }
  const canOxxo = m.status === "por_pagar"
    || (m.status === "atrasada" && m.paymentMethod !== "card")
    || (m.status === "activa" && m.paymentMethod === "oxxo");
  if ((method === "card" && !canCard) || (method === "oxxo" && !canOxxo)) {
    return NextResponse.json({ error: "Esta membresía no tiene pagos pendientes con ese método." }, { status: 409 });
  }

  try {
    const { url } = await createMembershipCheckout({
      membershipId,
      membership: { ...m, billing } as Parameters<typeof createMembershipCheckout>[0]["membership"],
      method,
      customerEmail: user.email ?? m.clientEmail,
    });
    return NextResponse.json({ url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No se pudo crear el pago.";
    console.error("[Membership checkout]", membershipId, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
