/**
 * POST /api/memberships/billing-portal
 * Body: { membershipId: string }
 * Auth: dueño de la membresía. Devuelve { url } del portal de Stripe para cambiar la tarjeta.
 * Requiere guardar una vez la configuración en Stripe → Configuración → Billing → Customer portal.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getRequestUser } from "@/lib/auth-request";
import { createCardUpdateLink, MEMBERSHIPS } from "@/lib/payments/memberships";

export async function POST(req: NextRequest) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "Inicia sesión de nuevo." }, { status: 401 });
  let body: { membershipId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  if (!body.membershipId) return NextResponse.json({ error: "Falta membershipId" }, { status: 400 });

  const snap = await getAdminDb().collection(MEMBERSHIPS).doc(body.membershipId).get();
  const m = snap.data();
  if (!m || m.uid !== user.uid || !m.stripeCustomerId) {
    return NextResponse.json({ error: "Membresía sin pago con tarjeta." }, { status: 404 });
  }
  try {
    return NextResponse.json({ url: await createCardUpdateLink(m.stripeCustomerId) });
  } catch (err) {
    console.error("[Membership billing portal]", err);
    return NextResponse.json({ error: "No se pudo abrir el portal de tarjeta. Escríbenos por WhatsApp." }, { status: 500 });
  }
}
