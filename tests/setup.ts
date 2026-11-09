import { vi } from "vitest";

vi.mock("@/lib/firebase", () => ({
  getDb: vi.fn(() => ({})),
  getFirebaseAuth: vi.fn(() => ({})),
  getRtdb: vi.fn(() => ({})),
  getFirebaseMessaging: vi.fn(() => ({})),
}));

vi.mock("@/lib/firebase-admin", () => ({
  getAdminDb: vi.fn(),
  getAdminAuth: vi.fn(),
  getAdminMessaging: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  onSnapshot: vi.fn(),
  updateDoc: vi.fn(),
  addDoc: vi.fn(),
  getDoc: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _type: "serverTimestamp" })),
  query: vi.fn(),
  orderBy: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  deleteDoc: vi.fn(),
  Timestamp: {
    now: vi.fn(() => ({ seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 })),
  },
  increment: vi.fn((n: number) => ({ _type: "increment", value: n })),
  runTransaction: vi.fn(),
}));

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: vi.fn(() => ({ _type: "serverTimestamp" })),
    increment: vi.fn((n: number) => ({ _type: "increment", value: n })),
    arrayUnion: vi.fn((...args: unknown[]) => ({ _type: "arrayUnion", values: args })),
  },
}));
