import {
  collection, doc, onSnapshot, updateDoc, addDoc, getDoc,
  serverTimestamp, query, orderBy, Timestamp, increment,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type {
  ServiceTicket, ServiceTicketStatus, TicketEvent,
  TicketPayment, PaymentMethod, PaymentType,
} from "@/types";

const COL = "service_tickets";

/** Subscribe to all tickets ordered by creation date (newest first). */
export function subscribeTickets(
  cb: (tickets: ServiceTicket[]) => void
): Unsubscribe {
  const db = getDb();
  const q = query(collection(db, COL), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ServiceTicket));
  });
}

/** Advance a ticket to the next status and append to statusHistory. */
export async function advanceTicketStatus(
  ticketId: string,
  newStatus: ServiceTicketStatus,
  note: string,
  userId: string
): Promise<void> {
  console.log("[tickets] advanceTicketStatus called:", { ticketId, newStatus, userId });
  const db = getDb();
  const ref = doc(db, COL, ticketId);

  const snap = await getDoc(ref);
  if (!snap.exists()) {
    console.error("[tickets] Document not found:", ticketId);
    throw new Error(`Ticket document ${ticketId} not found`);
  }

  const existing: TicketEvent[] = snap.data()?.statusHistory ?? [];
  const event: Record<string, unknown> = {
    status: newStatus,
    timestamp: Timestamp.now(),
    userId,
  };
  if (note) event.note = note;

  await updateDoc(ref, {
    status: newStatus,
    updatedAt: serverTimestamp(),
    ...(newStatus === "completado" ? { completedAt: serverTimestamp() } : {}),
    statusHistory: [...existing, event],
  });
  console.log("[tickets] Status updated successfully to:", newStatus);
}

/** Assign a mechanic to a ticket. */
export async function assignMechanic(
  ticketId: string,
  mechanicId: string,
  mechanicName: string
): Promise<void> {
  const db = getDb();
  await updateDoc(doc(db, COL, ticketId), {
    mechanicId: mechanicId || null,
    mechanicName: mechanicName || null,
    updatedAt: serverTimestamp(),
  });
}

/** Update editable fields on a ticket. */
export async function updateTicketFields(
  ticketId: string,
  fields: Partial<Pick<ServiceTicket, "estimatedCost" | "finalCost" | "diagnosis" | "workDone" | "mechanicId" | "mechanicName" | "anticipo" | "parts" | "serviceCharges">>
): Promise<void> {
  const db = getDb();
  await updateDoc(doc(db, COL, ticketId), {
    ...fields,
    updatedAt: serverTimestamp(),
  });
}

/** Create a new ticket directly (CRM-initiated, not via quote form). Requires a linked clientId. */
export async function createTicketDirect(data: {
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  serviceType: string;
  serviceDescription: string;
  serviceAddress: string;
  source?: string;
  motoBrand?: string;
  motoModel?: string;
  motoYear?: number;
  motoPlaca?: string;
}): Promise<string> {
  const db = getDb();

  const { doc: fsDoc, runTransaction } = await import("firebase/firestore");
  const counterRef = fsDoc(db, "_counters", "service_tickets");

  let ticketId = "";
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const count = (snap.data()?.count ?? 0) + 1;
    ticketId = `SPM-${String(count).padStart(4, "0")}`;
    tx.set(counterRef, { count }, { merge: true });
  });

  await addDoc(collection(db, COL), {
    ticketId,
    status: "lead-recibido",
    clientId: data.clientId,
    clientName: data.clientName,
    clientPhone: data.clientPhone,
    ...(data.clientEmail ? { clientEmail: data.clientEmail } : {}),
    serviceType: data.serviceType,
    serviceDescription: data.serviceDescription,
    serviceAddress: { street: data.serviceAddress },
    source: data.source ?? "crm-directo",
    ...(data.motoBrand ? { motoBrand: data.motoBrand } : {}),
    ...(data.motoModel ? { motoModel: data.motoModel } : {}),
    ...(data.motoYear ? { motoYear: data.motoYear } : {}),
    ...(data.motoPlaca ? { motoPlaca: data.motoPlaca } : {}),
    statusHistory: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, "clients", data.clientId), {
    totalTickets: increment(1),
    updatedAt: serverTimestamp(),
  });

  return ticketId;
}

/** Mark a ticket as paid in cash (no Stripe). Also updates client totalPaid. */
export async function markAsPaidCash(
  ticketId: string,
  userId: string,
  options?: { clientId?: string; finalCost?: number }
): Promise<void> {
  const db = getDb();
  const ref = doc(db, COL, ticketId);

  const snap = await getDoc(ref);
  const existing: TicketEvent[] = snap.data()?.statusHistory ?? [];
  const event: TicketEvent = {
    status: "pagado",
    timestamp: Timestamp.now(),
    note: "Pago en efectivo registrado",
    userId,
  };

  await updateDoc(ref, {
    status: "pagado",
    paymentMethod: "efectivo",
    paidAt: serverTimestamp(),
    statusHistory: [...existing, event],
    updatedAt: serverTimestamp(),
  });

  if (options?.clientId && options?.finalCost) {
    await updateDoc(doc(db, "clients", options.clientId), {
      totalPaid: increment(options.finalCost),
      updatedAt: serverTimestamp(),
    });
  }
}

/** Record a payment (partial, anticipo, or final) on a ticket. */
export async function recordPayment(
  ticketId: string,
  payment: {
    type: PaymentType;
    method: PaymentMethod;
    amount: number;
    note?: string;
    stripeSessionId?: string;
    stripeUrl?: string;
    registeredBy: string;
    registeredByName?: string;
  }
): Promise<void> {
  const db = getDb();
  const ref = doc(db, COL, ticketId);
  const snap = await getDoc(ref);
  const data = snap.data();
  const existingPayments: TicketPayment[] = data?.payments ?? [];
  const existingHistory: TicketEvent[] = data?.statusHistory ?? [];
  const previousTotal = data?.totalPaid ?? 0;

  const newPayment: Record<string, unknown> = {
    id: `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: payment.type,
    method: payment.method,
    amount: payment.amount,
    registeredBy: payment.registeredBy,
    createdAt: Timestamp.now(),
  };
  if (payment.note) newPayment.note = payment.note;
  if (payment.stripeSessionId) newPayment.stripeSessionId = payment.stripeSessionId;
  if (payment.stripeUrl) newPayment.stripeUrl = payment.stripeUrl;
  if (payment.registeredByName) newPayment.registeredByName = payment.registeredByName;

  const newTotalPaid = previousTotal + payment.amount;
  const finalCost = data?.finalCost ?? 0;
  const isFullyPaid = finalCost > 0 && newTotalPaid >= finalCost;

  const updates: Record<string, unknown> = {
    payments: [...existingPayments, newPayment],
    totalPaid: newTotalPaid,
    updatedAt: serverTimestamp(),
  };

  if (payment.type === "anticipo") {
    updates.anticipoPagado = true;
    updates.anticipo = (data?.anticipo ?? 0) + payment.amount;
  }

  if (isFullyPaid && payment.type === "final") {
    updates.status = "pagado";
    updates.paymentMethod = payment.method;
    updates.paidAt = serverTimestamp();
    const event: TicketEvent = {
      status: "pagado",
      timestamp: Timestamp.now(),
      note: `Pago final de $${payment.amount} (${payment.method})`,
      userId: payment.registeredBy,
    };
    updates.statusHistory = [...existingHistory, event];
  }

  await updateDoc(ref, updates);

  if (data?.clientId && payment.amount > 0) {
    await updateDoc(doc(db, "clients", data.clientId), {
      totalPaid: increment(payment.amount),
      updatedAt: serverTimestamp(),
    });
  }
}
