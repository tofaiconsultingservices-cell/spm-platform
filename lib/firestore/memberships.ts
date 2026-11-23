import {
  collection, addDoc, onSnapshot, query, where, serverTimestamp, updateDoc, doc, type Unsubscribe, type Timestamp,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { BuilderState, MembershipQuote } from "@/lib/memberships/config";

const COL = "memberships";

/**
 * pendiente  → solicitada por el cliente, en revisión
 * por_pagar  → el staff confirmó el precio; el cliente ya puede pagar
 * activa     → al corriente
 * atrasada   → falló un cobro con tarjeta o venció un pago OXXO
 * finalizada → completó sus 12 meses
 * cancelada  → cancelada por el staff
 */
export type MembershipStatus = "pendiente" | "por_pagar" | "activa" | "atrasada" | "finalizada" | "cancelada";
export type MembershipPayMethod = "card" | "oxxo";

export interface Membership {
  id: string;
  uid: string;
  motorcycleId: string;
  clientEmail: string;
  clientName: string;
  clientPhone?: string;
  status: MembershipStatus;
  termMonths: 12;
  vehicle: { type: string; typeName: string; range: string; model: string; usage: string };
  selection: BuilderState;
  services: { id: string; name: string; timesPerYear: number }[];
  perks: { id: string; name: string; monthly: number }[];
  billing: BuilderState["billing"];
  paymentAmount: number;   // por semana o por mes, según billing
  totalYear: number;
  createdAt?: Timestamp;
  // Lo llena el staff al revisar
  confirmedAmount?: number;
  confirmedAt?: Timestamp;
  // Lo llena el webhook de Stripe
  paymentMethod?: MembershipPayMethod;
  paymentsMade?: number;
  nextPaymentAt?: Timestamp | null;
  lastPaymentAt?: Timestamp;
  payments?: { id: string; amount: number; method: MembershipPayMethod; paidAt: Timestamp }[];
  stripeSubscriptionId?: string;
  oxxoVoucherUrl?: string | null;
  oxxoPendingUntil?: Timestamp;
  termEndsAt?: Timestamp;
}

export const totalPaymentsFor = (billing: BuilderState["billing"]) => (billing === "weekly" ? 52 : billing === "annual" ? 1 : 12);

/** Membresías de todos los clientes (CRM, operador o superior). */
export function subscribeAllMemberships(cb: (m: Membership[]) => void): Unsubscribe {
  return onSnapshot(collection(getDb(), COL), snap => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Membership);
    list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    cb(list);
  });
}

/** El staff confirma el precio por periodo y habilita el pago. */
export async function confirmMembership(id: string, amount: number, billing: BuilderState["billing"], byUid: string) {
  await updateDoc(doc(getDb(), COL, id), {
    status: "por_pagar",
    confirmedAmount: amount,
    paymentAmount: amount,
    totalYear: amount * totalPaymentsFor(billing),
    confirmedAt: serverTimestamp(),
    confirmedBy: byUid,
    updatedAt: serverTimestamp(),
  });
}

export async function createMembership(
  data: Pick<Membership, "uid" | "motorcycleId" | "clientEmail" | "clientName" | "clientPhone" | "termMonths" | "vehicle" | "selection" | "services" | "perks" | "billing" | "paymentAmount" | "totalYear">
): Promise<string> {
  const ref = await addDoc(collection(getDb(), COL), {
    ...data,
    status: "pendiente",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Membresías del cliente actual (sin orderBy para no requerir índice compuesto). */
export function subscribeMyMemberships(uid: string, cb: (m: Membership[]) => void): Unsubscribe {
  const q = query(collection(getDb(), COL), where("uid", "==", uid));
  return onSnapshot(q, snap => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Membership);
    list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    cb(list);
  });
}

export type { MembershipQuote };
