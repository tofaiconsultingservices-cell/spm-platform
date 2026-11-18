import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { salePriceFromCost } from "@/lib/pricing";
import type { WorkshopService } from "@/types";

const COL = "workshop_services";

export function subscribeWorkshopServices(cb: (services: WorkshopService[]) => void): Unsubscribe {
  const db = getDb();
  const q = query(collection(db, COL), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WorkshopService));
  }, () => cb([]));
}

export async function createWorkshopService(
  data: Omit<WorkshopService, "id" | "code" | "salePrice" | "createdAt" | "updatedAt"> & { code?: string }
): Promise<string> {
  const db = getDb();
  const { code: requestedRaw, ...rest } = data;
  const requested = requestedRaw?.trim().slice(0, 40) ?? "";

  let code = requested;
  if (!code) {
    const { runTransaction, doc: fsDoc } = await import("firebase/firestore");
    const counterRef = fsDoc(db, "_counters", "workshop_services");
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(counterRef);
      const count = (snap.data()?.count ?? 0) + 1;
      code = `SRV-${String(count).padStart(5, "0")}`;
      tx.set(counterRef, { count }, { merge: true });
    });
  }

  const clean = Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== undefined)
  );
  const ref = await addDoc(collection(db, COL), {
    ...clean,
    code,
    costPrice: Number(rest.costPrice),
    salePrice: salePriceFromCost(Number(rest.costPrice)),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateWorkshopService(
  id: string,
  fields: Partial<Omit<WorkshopService, "id" | "createdAt">>
): Promise<void> {
  const next: Record<string, unknown> = { ...fields };
  if (fields.costPrice != null) {
    const cost = Number(fields.costPrice);
    next.costPrice = cost;
    next.salePrice = salePriceFromCost(cost);
  } else {
    delete next.salePrice;
  }
  for (const key of Object.keys(next)) {
    if (next[key] === undefined) delete next[key];
  }
  await updateDoc(doc(getDb(), COL, id), {
    ...next,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteWorkshopService(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), COL, id));
}
