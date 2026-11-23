import type { NextRequest } from "next/server";
import { getAdminAuth, getAdminDb } from "./firebase-admin";
import type { UserRole } from "@/types";

/**
 * Usuario de la petición: primero `Authorization: Bearer <Firebase ID token>`,
 * y si no viene, la cookie de sesión `__session`.
 */
export async function getRequestUser(
  req: NextRequest,
): Promise<{ uid: string; email?: string; role: UserRole } | null> {
  try {
    const authz = req.headers.get("authorization");
    let uid: string, email: string | undefined;
    if (authz?.startsWith("Bearer ")) {
      const d = await getAdminAuth().verifyIdToken(authz.slice(7));
      uid = d.uid; email = d.email;
    } else {
      const cookie = req.cookies.get("__session")?.value;
      if (!cookie) return null;
      const d = await getAdminAuth().verifySessionCookie(cookie, true);
      uid = d.uid; email = d.email;
    }
    const snap = await getAdminDb().collection("users").doc(uid).get();
    return { uid, email, role: (snap.data()?.role ?? "viewer") as UserRole };
  } catch {
    return null;
  }
}
