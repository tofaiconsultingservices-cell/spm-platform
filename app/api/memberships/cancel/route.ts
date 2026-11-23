/**
 * POST /api/memberships/cancel
 * Body: { membershipId: string }
 * Auth: staff (operador o superior). Cancela también la suscripción de Stripe si existe.
 */
import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth-request";
import { hasMinimumRole } from "@/lib/auth-server";
import { cancelMembership } from "@/lib/payments/memberships";

export async function POST(req: NextRequest) {
  const user = await getRequestUser(req);
  if (!user || !hasMinimumRole(user.role, "operador")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  let body: { membershipId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  if (!body.membershipId) return NextResponse.json({ error: "Falta membershipId" }, { status: 400 });

  try {
    await cancelMembership(body.membershipId, user.uid);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No se pudo cancelar.";
    console.error("[Membership cancel]", body.membershipId, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
