import { CART_STORAGE_KEY, cartTotal, restoreCartLines, type CartLine, type ReadStorage, type WriteStorage } from './cart';
import { type DiningChoice, validGuests } from './dining';
import { parseTable } from './table';

export interface DemoOrder {
  id: string;
  table: string | null;
  dining?: DiningChoice;
  lines: CartLine[];
  total: number;
  createdAt: string;
  status: 'received';
}
export const ORDER_STORAGE_KEY = CART_STORAGE_KEY;
let sequence = 0;

/** A local receipt only: callers must persist successfully before clearing their cart. */
export function createDemoOrder(table: string | null, lines: readonly CartLine[], now = new Date(), dining?: DiningChoice): DemoOrder {
  const takeaway = dining?.mode === 'takeaway';
  const normalizedTable = takeaway || !table ? null : parseTable(`?table=${encodeURIComponent(table)}`);
  const snapshot = restoreCartLines(lines);
  if ((!takeaway && !normalizedTable) || (dining?.mode === 'dine-in' && !validGuests(dining.guests)) || !snapshot.length || !Number.isFinite(now.getTime())) throw new Error('Invalid demo order');
  const createdAt = now.toISOString();
  const suffix = `${now.getTime().toString(36)}${(++sequence).toString(36)}${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
  return {
    id: `DEMO-${createdAt.slice(0, 10).replaceAll('-', '')}-${suffix}`,
    table: normalizedTable, ...(dining ? { dining: { ...dining } } : {}), lines: snapshot, total: cartTotal(snapshot), createdAt, status: 'received',
  };
}

function nonemptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Receipts are historical snapshots; validate shape and arithmetic without today's menu. */
function snapshotLines(value: unknown): CartLine[] {
  if (!Array.isArray(value) || !value.length || value.length > 200) throw new Error('Invalid receipt lines');
  const ids = new Set<string>();
  return value.map((raw: unknown) => {
    if (!raw || typeof raw !== 'object') throw new Error('Invalid receipt line');
    const line = raw as Record<string, unknown>;
    if (!nonemptyString(line.lineId) || ids.has(line.lineId) || !nonemptyString(line.itemId) || !nonemptyString(line.name)
      || typeof line.unitPrice !== 'number' || !Number.isSafeInteger(line.unitPrice) || line.unitPrice < 0
      || typeof line.quantity !== 'number' || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 99
      || !Number.isSafeInteger(line.unitPrice * line.quantity)
      || typeof line.note !== 'string' || line.note.length > 200 || !Array.isArray(line.options) || line.options.length > 50) throw new Error('Invalid receipt line');
    ids.add(line.lineId);
    const groups = new Set<string>();
    const options = line.options.map((rawOption: unknown) => {
      if (!rawOption || typeof rawOption !== 'object') throw new Error('Invalid receipt option');
      const option = rawOption as Record<string, unknown>;
      if (!nonemptyString(option.groupId) || groups.has(option.groupId) || !nonemptyString(option.choiceId) || !nonemptyString(option.label)
        || typeof option.priceDelta !== 'number' || !Number.isSafeInteger(option.priceDelta)) throw new Error('Invalid receipt option');
      groups.add(option.groupId);
      return { groupId: option.groupId, choiceId: option.choiceId, label: option.label, priceDelta: option.priceDelta };
    });
    return { lineId: line.lineId, itemId: line.itemId, name: line.name, unitPrice: line.unitPrice, quantity: line.quantity, note: line.note, options };
  });
}

function validatedOrder(value: unknown): DemoOrder {
  if (!value || typeof value !== 'object') throw new Error('Invalid order');
  const order = value as Record<string, unknown>;
  let dining: DiningChoice | undefined;
  if (order.dining !== undefined) {
    const choice = order.dining as Partial<DiningChoice> | null;
    if (choice?.mode === 'takeaway') dining = { mode: 'takeaway' };
    else if (choice?.mode === 'dine-in' && validGuests(choice.guests)) dining = { mode: 'dine-in', guests: choice.guests };
    else throw new Error('Invalid dining choice');
  }
  const table = order.table;
  if (dining?.mode === 'takeaway' ? table !== null
    : typeof table !== 'string' || parseTable(`?table=${encodeURIComponent(table)}`) !== table) throw new Error('Invalid order table');
  if (typeof order.id !== 'string' || !/^DEMO-\d{8}-[A-Z0-9]+$/.test(order.id)
    || order.status !== 'received' || typeof order.createdAt !== 'string'
    || !Number.isFinite(Date.parse(order.createdAt)) || new Date(order.createdAt).toISOString() !== order.createdAt) throw new Error('Invalid order metadata');
  const lines = snapshotLines(order.lines);
  if (!Number.isSafeInteger(order.total) || order.total !== cartTotal(lines)) throw new Error('Invalid order total');
  return { id: order.id, table: typeof table === 'string' ? table : null, ...(dining ? { dining } : {}), lines, total: cartTotal(lines), createdAt: order.createdAt, status: 'received' };
}
export function readOrder(storage: ReadStorage): DemoOrder | null {
  try {
    const raw = storage?.getItem(ORDER_STORAGE_KEY);
    if (!raw) return null;
    const payload: unknown = JSON.parse(raw);
    if (!payload || typeof payload !== 'object' || !('version' in payload) || payload.version !== 1 || !('order' in payload)) return null;
    return validatedOrder(payload.order);
  } catch { return null; }
}
export function saveOrder(storage: WriteStorage, order: DemoOrder): boolean {
  try {
    if (!storage) return false;
    const validated = validatedOrder(order);
    // One setItem commits the receipt and clears the submitted cart together.
    storage.setItem(ORDER_STORAGE_KEY, JSON.stringify({ version: 1, lines: [], order: validated }));
    return true;
  } catch { return false; }
}
