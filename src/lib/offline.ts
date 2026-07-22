import type { Expense, ExpenseDraft } from "./types";
import { api } from "./api";

/*
 * Offline-first store (cache + queued writes).
 *
 * The database stays the source of truth, but the app keeps a per-space copy of
 * expenses in localStorage so it can:
 *   - open instantly with the last-known data (no waiting on the network), and
 *   - accept add/edit/delete while offline, queuing them and flushing to the DB
 *     automatically once a connection is available.
 *
 * Note: this stores ordinary expense data only — never session tokens or other
 * secrets (those stay in the HttpOnly cookie).
 */

type CreateOp = { kind: "create"; tempId: string; draft: ExpenseDraft; ts: number };
type UpdateOp = { kind: "update"; id: string; draft: ExpenseDraft; ts: number };
type DeleteOp = { kind: "delete"; id: string; ts: number };
export type QueueOp = CreateOp | UpdateOp | DeleteOp;

const cacheKey = (space: string) => `spendly.cache.${space}`;
const queueKey = (space: string) => `spendly.queue.${space}`;
const syncedKey = (space: string) => `spendly.lastSync.${space}`;
const lastSpaceKey = "spendly.lastSpace";

// Remember the last-opened space (its name is not a secret) so a cold OFFLINE
// open can still restore that space's cached data — the space name otherwise
// lives only in the HttpOnly cookie, which JS can't read.
export function rememberSpace(space: string): void {
  if (space) write(lastSpaceKey, space);
}

export function getLastSpace(): string {
  return read<string>(lastSpaceKey, "");
}

export function forgetSpace(): void {
  try {
    localStorage.removeItem(lastSpaceKey);
  } catch {
    /* ignore */
  }
}

export function isTempId(id: string): boolean {
  return id.startsWith("local-");
}

export function newTempId(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `local-${rand}`;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / unavailable — ignore */
  }
}

/* ---------- cache ---------- */

export function readCache(space: string): Expense[] {
  if (!space) return [];
  return read<Expense[]>(cacheKey(space), []);
}

export function writeCache(space: string, expenses: Expense[]): void {
  if (!space) return;
  write(cacheKey(space), expenses);
}

export function getLastSync(space: string): number {
  if (!space) return 0;
  return read<number>(syncedKey(space), 0);
}

function setLastSync(space: string, ts: number): void {
  write(syncedKey(space), ts);
}

/* ---------- queue ---------- */

export function readQueue(space: string): QueueOp[] {
  if (!space) return [];
  return read<QueueOp[]>(queueKey(space), []);
}

function writeQueue(space: string, ops: QueueOp[]): void {
  if (!space) return;
  write(queueKey(space), ops);
}

export function pendingCount(space: string): number {
  return readQueue(space).length;
}

/**
 * Build an optimistic Expense for immediate display from a draft.
 */
export function draftToExpense(draft: ExpenseDraft, base?: Expense): Expense {
  const now = new Date().toISOString();
  return {
    id: base?.id ?? newTempId(),
    title: draft.title,
    category: draft.category,
    amount: draft.amount,
    paidBy: draft.paidBy,
    date: new Date(draft.date).toISOString(),
    notes: draft.notes ? draft.notes : null,
    createdAt: base?.createdAt ?? now,
    updatedAt: now,
  };
}

export function enqueueCreate(space: string, tempId: string, draft: ExpenseDraft): void {
  const ops = readQueue(space);
  ops.push({ kind: "create", tempId, draft, ts: Date.now() });
  writeQueue(space, ops);
}

export function enqueueUpdate(space: string, id: string, draft: ExpenseDraft): void {
  let ops = readQueue(space);
  if (isTempId(id)) {
    // Not synced yet: fold the edit into the pending create so we only ever
    // send the latest version to the server.
    const create = ops.find((o) => o.kind === "create" && o.tempId === id) as
      | CreateOp
      | undefined;
    if (create) {
      create.draft = draft;
      writeQueue(space, ops);
      return;
    }
  }
  // Collapse consecutive updates for the same row (last write wins).
  ops = ops.filter((o) => !(o.kind === "update" && o.id === id));
  ops.push({ kind: "update", id, draft, ts: Date.now() });
  writeQueue(space, ops);
}

export function enqueueDelete(space: string, id: string): void {
  let ops = readQueue(space);
  if (isTempId(id)) {
    // Never reached the server — just drop any pending ops for it.
    ops = ops.filter(
      (o) =>
        !((o.kind === "create" && o.tempId === id) ||
          (o.kind === "update" && o.id === id))
    );
    writeQueue(space, ops);
    return;
  }
  // Drop pending updates for this row, then queue the delete.
  ops = ops.filter((o) => !(o.kind === "update" && o.id === id));
  ops.push({ kind: "delete", id, ts: Date.now() });
  writeQueue(space, ops);
}

function remap(op: QueueOp, from: string, to: string): QueueOp {
  if (op.kind === "update" && op.id === from) return { ...op, id: to };
  if (op.kind === "delete" && op.id === from) return { ...op, id: to };
  return op;
}

export type FlushResult = {
  /** tempId -> real server id, for optimistic rows that got created. */
  mapped: Record<string, string>;
  /** true if the whole queue drained without error. */
  ok: boolean;
};

/**
 * Push queued mutations to the server, in order. Stops (and keeps the rest
 * queued) on the first failure, e.g. when offline. Safe to call repeatedly.
 */
export async function flush(space: string): Promise<FlushResult> {
  const mapped: Record<string, string> = {};
  let ops = readQueue(space);

  while (ops.length > 0) {
    const op = ops[0];
    try {
      if (op.kind === "create") {
        const { expense } = await api.createExpense(op.draft);
        mapped[op.tempId] = expense.id;
        // Rewrite later ops that referenced the temp id, then drop this op.
        ops = ops.slice(1).map((o) => remap(o, op.tempId, expense.id));
      } else if (op.kind === "update") {
        if (isTempId(op.id)) break; // its create hasn't synced yet; try later
        await api.updateExpense(op.id, op.draft);
        ops = ops.slice(1);
      } else {
        // delete
        if (!isTempId(op.id)) await api.deleteExpense(op.id);
        ops = ops.slice(1);
      }
      writeQueue(space, ops); // persist progress after every op
    } catch {
      writeQueue(space, ops);
      return { mapped, ok: false };
    }
  }

  writeQueue(space, ops);
  return { mapped, ok: true };
}

/**
 * Full sync: flush pending writes, and (only when the queue is fully drained)
 * pull the canonical list from the server into the cache.
 */
export async function sync(
  space: string
): Promise<{ expenses: Expense[] | null; mapped: Record<string, string>; ok: boolean }> {
  const { mapped, ok } = await flush(space);
  if (ok && readQueue(space).length === 0) {
    const { expenses } = await api.listExpenses();
    writeCache(space, expenses);
    setLastSync(space, Date.now());
    return { expenses, mapped, ok: true };
  }
  return { expenses: null, mapped, ok };
}
