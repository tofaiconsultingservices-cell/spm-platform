import {
  collection, doc, onSnapshot, addDoc, updateDoc, getDoc,
  serverTimestamp, query, orderBy, where, type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { StoreOrder, StoreOrderStatus } from "@/types";

const COL = "store_orders";

export function subscribeStoreOrders(
  cb: (orders: StoreOrder[]) => void
): Unsubscribe {
  const db = getDb();
  const q = query(collection(db, COL), orderBy("createdAt", "desc"));
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() }) as StoreOrder));
  });
}

export function subscribeStoreOrdersByStatus(
  status: StoreOrderStatus,
  cb: (orders: StoreOrder[]) => void
): Unsubscribe {
  const db = getDb();
  const q = query(
    collection(db, COL),
    where("status", "==", status),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() }) as StoreOrder));
  });
}

export async function getStoreOrder(id: string): Promise<StoreOrder | null> {
  const snap = await getDoc(doc(getDb(), COL, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as StoreOrder;
}

export async function updateStoreOrderStatus(
  id: string,
  status: StoreOrderStatus,
  extra?: Partial<Pick<StoreOrder, "paidAt" | "shippedAt" | "deliveredAt">>
): Promise<void> {
  await updateDoc(doc(getDb(), COL, id), {
    status,
    ...extra,
    updatedAt: serverTimestamp(),
  });
}
