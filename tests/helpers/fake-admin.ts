import { vi } from "vitest";

/**
 * In-memory stand-in for the Firebase Admin Firestore API used by API routes.
 * Seed collections with `data`; queries (where/orderBy/limit) are chainable and
 * return every doc in the collection — tests assert on the calls, not on filtering.
 */
type Row = Record<string, unknown> & { id: string };

export function makeFakeDb(data: Record<string, Row[]> = {}) {
  const calls = {
    where: [] as unknown[][],
    orderBy: [] as unknown[][],
    limit: [] as number[],
    add: [] as { col: string; doc: Record<string, unknown> }[],
    update: [] as { col: string; id: string; doc: Record<string, unknown> }[],
    txSet: [] as unknown[][],
  };
  const counters: Record<string, number> = {};
  let failGet = false;

  const snapOf = (rows: Row[]) => ({
    empty: rows.length === 0,
    docs: rows.map(({ id, ...rest }) => ({ id, data: () => rest })),
  });

  type Snap = ReturnType<typeof snapOf>;
  interface Q {
    where: (...a: unknown[]) => Q;
    orderBy: (...a: unknown[]) => Q;
    limit: (n: number) => Q;
    get: () => Promise<Snap>;
  }

  function query(col: string): Q {
    const q: Q = {
      where: (...a: unknown[]) => { calls.where.push(a); return q; },
      orderBy: (...a: unknown[]) => { calls.orderBy.push(a); return q; },
      limit: (n: number) => { calls.limit.push(n); return q; },
      get: async () => {
        if (failGet) throw new Error("Firestore down");
        return snapOf(data[col] ?? []);
      },
    };
    return q;
  }

  const db = {
    collection: vi.fn((col: string) => ({
      ...query(col),
      doc: (id: string) => ({
        id,
        get: async () => {
          if (failGet) throw new Error("Firestore down");
          const row = (data[col] ?? []).find((r) => r.id === id);
          const rest = row ? Object.fromEntries(Object.entries(row).filter(([k]) => k !== "id")) : undefined;
          return { id, exists: !!row, data: () => rest };
        },
        update: vi.fn(async (doc: Record<string, unknown>) => {
          if (failGet) throw new Error("Firestore down");
          calls.update.push({ col, id, doc });
        }),
        _counter: col === "_counters" ? id : undefined,
      }),
      add: vi.fn(async (doc: Record<string, unknown>) => {
        if (failGet) throw new Error("Firestore down");
        calls.add.push({ col, doc });
        return { id: `new-${col}-${calls.add.length}` };
      }),
    })),
    runTransaction: vi.fn(async (fn: (tx: unknown) => Promise<void>) => {
      if (failGet) throw new Error("Firestore down");
      const tx = {
        get: async (ref: { _counter?: string }) => {
          const n = counters[ref._counter ?? ""];
          return { data: () => (n == null ? undefined : { count: n }) };
        },
        set: (ref: { _counter?: string }, val: { count: number }) => {
          calls.txSet.push([ref._counter, val]);
          if (ref._counter) counters[ref._counter] = val.count;
        },
      };
      await fn(tx);
    }),
  };

  return {
    db,
    calls,
    counters,
    fail: () => { failGet = true; },
  };
}

/** Minimal NextRequest-shaped object (avoids NextRequest/happy-dom cookie issues). */
export function fakeReq(opts: {
  url?: string;
  body?: unknown;
  badJson?: boolean;
  session?: string;
  ip?: string;
} = {}) {
  return {
    headers: new Headers({ "x-forwarded-for": opts.ip ?? "1.2.3.4" }),
    nextUrl: new URL(opts.url ?? "http://localhost/api/test"),
    cookies: {
      get: (name: string) =>
        name === "__session" && opts.session ? { value: opts.session } : undefined,
    },
    json: async () => {
      if (opts.badJson) throw new SyntaxError("Unexpected token");
      return opts.body;
    },
  } as never;
}
