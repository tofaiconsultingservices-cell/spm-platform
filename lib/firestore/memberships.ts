import {
  collection, addDoc, onSnapshot, query, where, serverTimestamp, type Unsubscribe, type Timestamp,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { BuilderState, MembershipQuote } from "@/lib/memberships/config";

const COL = "memberships";

export type MembershipStatus = "pendiente" | "activa" | "cancelada";

export interface Membership {
  id: string;
  uid: string;
  motorcycleId: string;
  clientEmail: string;
  clientName: string;
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
}

export async function createMembership(
  data: Omit<Membership, "id" | "createdAt" | "status">
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
