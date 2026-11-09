import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, getDoc, getDocs,
  serverTimestamp, query, orderBy, where, runTransaction,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { salePriceFromCost } from "@/lib/pricing";
import type {
  Product, ProductCategory, InventoryMovement, InventoryMovementType,
} from "@/types";

const COL = "products";
const MOVEMENTS_COL = "inventory_movements";

// ── Subscriptions ────────────────────────────────────────────────────────────

export function subscribeProducts(cb: (p: Product[]) => void): Unsubscribe {
  const db = getDb();
  const q = query(collection(db, COL), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product));
  });
}

export function subscribeActiveProducts(
  cb: (p: Product[]) => void,
  category?: ProductCategory
): Unsubscribe {
  const db = getDb();
  const constraints = category
    ? [where("isActive", "==", true), where("category", "==", category), orderBy("createdAt", "desc")]
    : [where("isActive", "==", true), orderBy("createdAt", "desc")];
  const q = query(collection(db, COL), ...constraints);
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product));
  });
}

export function subscribeProductMovements(
  productId: string,
  cb: (m: InventoryMovement[]) => void
): Unsubscribe {
  const db = getDb();
  const q = query(
    collection(db, MOVEMENTS_COL),
    where("productId", "==", productId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as InventoryMovement));
  });
}

// ── Reads ────────────────────────────────────────────────────────────────────

export async function getProduct(id: string): Promise<Product | null> {
  const snap = await getDoc(doc(getDb(), COL, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Product;
}

export async function getLowStockProducts(): Promise<Product[]> {
  const db = getDb();
  const snap = await getDocs(
    query(collection(db, COL), where("isActive", "==", true))
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Product)
    .filter((p) => p.stock <= p.minStock);
}

// ── Writes ───────────────────────────────────────────────────────────────────

export async function createProduct(
  data: Omit<Product, "id" | "sku" | "salePrice" | "createdAt" | "updatedAt"> & { sku?: string }
): Promise<string> {
  const db = getDb();
  const { sku: requestedRaw, ...rest } = data;
  const requestedSku = requestedRaw?.trim().slice(0, 40) ?? "";

  let sku = requestedSku;
  if (!sku) {
    const { runTransaction: fsTx, doc: fsDoc } = await import("firebase/firestore");
    const counterRef = fsDoc(db, "_counters", "products");
    await fsTx(db, async (tx) => {
      const snap = await tx.get(counterRef);
      const count = (snap.data()?.count ?? 0) + 1;
      sku = `PRD-${String(count).padStart(5, "0")}`;
      tx.set(counterRef, { count }, { merge: true });
    });
  }

  const costPrice = Number(rest.costPrice);
  const clean = Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== undefined)
  );
  const ref = await addDoc(collection(db, COL), {
    ...clean,
    sku,
    costPrice,
    salePrice: salePriceFromCost(costPrice),
    supplierName: rest.supplierName?.trim() || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateProduct(
  id: string,
  fields: Partial<Omit<Product, "id" | "createdAt">>
): Promise<void> {
  const next: Record<string, unknown> = { ...fields };
  if (fields.costPrice != null) {
    const costPrice = Number(fields.costPrice);
    next.costPrice = costPrice;
    next.salePrice = salePriceFromCost(costPrice);
  } else {
    delete next.salePrice;
  }
  if (typeof next.supplierName === "string") {
    next.supplierName = next.supplierName.trim();
  }
  for (const key of Object.keys(next)) {
    if (next[key] === undefined) delete next[key];
  }
  await updateDoc(doc(getDb(), COL, id), {
    ...next,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteProduct(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), COL, id));
}

// ── Stock Management ─────────────────────────────────────────────────────────

/** Atomically adjust stock and write a movement log entry. */
export async function adjustStock(
  productId: string,
  delta: number,  // positive = in, negative = out
  movement: {
    type: InventoryMovementType;
    reference?: string;
    note?: string;
    unitCost?: number;
    createdBy: string;
  }
): Promise<void> {
  const db = getDb();
  const productRef = doc(db, COL, productId);
  const movementRef = doc(collection(db, MOVEMENTS_COL));

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(productRef);
    if (!snap.exists()) throw new Error(`Product ${productId} not found`);

    const current = snap.data() as Product;
    const stockBefore = current.stock;
    const stockAfter = stockBefore + delta;

    if (stockAfter < 0) {
      throw new Error(
        `Stock insuficiente: ${stockBefore} disponibles, se requieren ${Math.abs(delta)}`
      );
    }

    tx.update(productRef, {
      stock: stockAfter,
      updatedAt: serverTimestamp(),
    });

    const movementData: Omit<InventoryMovement, "id"> = {
      productId,
      productName: current.name,
      type: movement.type,
      qty: delta,
      stockBefore,
      stockAfter,
      createdBy: movement.createdBy,
      ...(movement.reference ? { reference: movement.reference } : {}),
      ...(movement.note ? { note: movement.note } : {}),
      ...(movement.unitCost != null ? { unitCost: movement.unitCost } : {}),
    };

    tx.set(movementRef, {
      ...movementData,
      createdAt: serverTimestamp(),
    });
  });
}
