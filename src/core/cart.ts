import { menuItemById, type MenuItem } from '../data/menu';

export interface CartChoice { groupId: string; choiceId: string }
export interface CartLine {
  lineId: string;
  itemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  options: (CartChoice & { label: string; priceDelta: number })[];
  note: string;
}
export type ReadStorage = { getItem(key: string): string | null } | null | undefined;
export type WriteStorage = { getItem(key: string): string | null; setItem(key: string, value: string): void } | null | undefined;
/** Cart and receipt share one atomic storage record so checkout cannot restore old lines. */
export const CART_STORAGE_KEY = 'foodstage-ordering-session';

function cappedQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) throw new Error('Invalid quantity');
  return Math.max(1, Math.min(99, Math.floor(quantity)));
}

/** Prices and display labels always come from the catalog, including during restore. */
export function addLine(lines: readonly CartLine[], item: MenuItem, choices: readonly CartChoice[] = [], quantity = 1, note = ''): CartLine[] {
  const catalogItem = menuItemById(item.id);
  if (!catalogItem?.available) throw new Error('Item unavailable');
  const groups = catalogItem.options ?? [];
  const selected = new Map<string, string>();
  for (const choice of choices) {
    const group = groups.find(group => group.id === choice.groupId);
    if (!group?.choices.some(option => option.id === choice.choiceId) || selected.has(choice.groupId)) {
      throw new Error('Invalid option');
    }
    selected.set(choice.groupId, choice.choiceId);
  }
  const options = groups.map(group => {
    const choice = group.choices.find(choice => choice.id === selected.get(group.id)) ?? group.choices[0];
    if (!choice) throw new Error('Missing catalog option');
    return { groupId: group.id, choiceId: choice.id, label: choice.label, priceDelta: choice.priceDelta };
  }).sort((a, b) => a.groupId.localeCompare(b.groupId));
  const normalizedNote = note.trim().replace(/\s+/g, ' ').slice(0, 200);
  const lineId = JSON.stringify([catalogItem.id, options.map(option => [option.groupId, option.choiceId]), normalizedNote]);
  const unitPrice = catalogItem.price + options.reduce((sum, option) => sum + option.priceDelta, 0);
  const existing = lines.find(line => line.lineId === lineId);
  const next: CartLine = {
    lineId, itemId: catalogItem.id, name: catalogItem.name, unitPrice,
    quantity: cappedQuantity((existing?.quantity ?? 0) + cappedQuantity(quantity)), options, note: normalizedNote,
  };
  return existing ? lines.map(line => line.lineId === lineId ? next : line) : [...lines, next];
}

export function setLineQuantity(lines: readonly CartLine[], id: string, quantity: number): CartLine[] {
  if (!Number.isFinite(quantity)) throw new Error('Invalid quantity');
  if (quantity <= 0) return lines.filter(line => line.lineId !== id);
  return lines.map(line => line.lineId === id ? { ...line, quantity: cappedQuantity(quantity) } : line);
}
export function cartTotal(lines: readonly CartLine[]): number {
  return lines.reduce((total, line) => total + line.unitPrice * line.quantity, 0);
}
export function formatPrice(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new Error('Price must be integer cents');
  return `¥${(cents / 100).toFixed(2)}`;
}

/** Strict structural validation; rejects the whole payload on any invalid/stale line. */
export function restoreCartLines(value: unknown): CartLine[] {
  if (!Array.isArray(value) || value.length > 200) throw new Error('Invalid cart');
  let restored: CartLine[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || typeof raw.itemId !== 'string'
      || !Number.isInteger(raw.quantity) || raw.quantity < 1 || raw.quantity > 99
      || typeof raw.note !== 'string' || raw.note.length > 200 || !Array.isArray(raw.options)) throw new Error('Invalid cart line');
    const item = menuItemById(raw.itemId);
    if (!item?.available || raw.options.length !== (item.options?.length ?? 0)) throw new Error('Stale cart item');
    const choices: CartChoice[] = raw.options.map((option: unknown) => {
      if (!option || typeof option !== 'object' || !('groupId' in option) || !('choiceId' in option)
        || typeof option.groupId !== 'string' || typeof option.choiceId !== 'string') throw new Error('Invalid cart option');
      return { groupId: option.groupId, choiceId: option.choiceId };
    });
    restored = addLine(restored, item, choices, raw.quantity, raw.note);
  }
  return restored;
}
export function readCart(storage: ReadStorage): CartLine[] {
  try {
    const raw = storage?.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const payload: unknown = JSON.parse(raw);
    if (!payload || typeof payload !== 'object' || !('version' in payload) || payload.version !== 1 || !('lines' in payload)) return [];
    return restoreCartLines(payload.lines);
  } catch { return []; }
}
export function saveCart(storage: WriteStorage, lines: readonly CartLine[]): boolean {
  try {
    if (!storage) return false;
    const validated = restoreCartLines(lines);
    let order: unknown = null;
    const raw = storage.getItem(CART_STORAGE_KEY);
    if (raw) {
      // Recover from corrupt JSON, while still surfacing storage access failures.
      try {
        const payload: unknown = JSON.parse(raw);
        if (payload && typeof payload === 'object' && 'version' in payload && payload.version === 1 && 'order' in payload) order = payload.order;
      } catch { /* A fresh valid cart replaces a malformed session record. */ }
    }
    storage.setItem(CART_STORAGE_KEY, JSON.stringify({ version: 1, lines: validated, order }));
    return true;
  } catch { return false; }
}
