import { describe, expect, it } from 'vitest';
import { menuItemById } from '../data/menu';
import { addLine, readCart, saveCart } from './cart';
import { createDemoOrder, readOrder, saveOrder, ORDER_STORAGE_KEY } from './orders';

const lines = () => addLine([], menuItemById('classic-burger')!, [], 2, '少盐');
const now = new Date('2026-11-03T02:00:00.000Z');
function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}

describe('local demo orders', () => {
  it('creates independent snapshots with normalized table, integer total and demo ID', () => {
    const cart = lines();
    const order = createDemoOrder('a01', cart, now);
    expect(order).toMatchObject({ table: 'A01', total: 6400, createdAt: '2026-11-03T02:00:00.000Z', status: 'received' });
    expect(order.id).toMatch(/^DEMO-20261103-[A-Z0-9]+$/);
    expect(createDemoOrder('a01', cart, now).id).not.toBe(order.id);
    cart[0]!.quantity = 9;
    cart[0]!.options[0]!.label = '改动';
    expect(order.lines[0]!.quantity).toBe(2);
    expect(order.lines[0]!.options[0]!.label).not.toBe('改动');
  });
  it('requires a valid table and nonempty validated cart', () => {
    expect(() => createDemoOrder('', lines(), now)).toThrow();
    expect(() => createDemoOrder('A01', [], now)).toThrow();
    expect(() => createDemoOrder('A01', [{ ...lines()[0]!, quantity: -1 }], now)).toThrow();
  });
  it('persists and restores only valid local demo orders', () => {
    const storage = memoryStorage();
    const order = createDemoOrder('A01', lines(), now);
    expect(saveOrder(storage, order)).toBe(true);
    expect(readOrder(storage)).toEqual(order);
    for (const patch of [{ status: 'paid' }, { table: '<bad>' }, { total: 1 }, { createdAt: 'not a date' }, { id: 'REAL-123' }]) {
      saveOrder(storage, order);
      const payload = JSON.parse(storage.getItem(ORDER_STORAGE_KEY)!);
      Object.assign(payload.order, patch);
      storage.setItem(ORDER_STORAGE_KEY, JSON.stringify(payload));
      expect(readOrder(storage)).toBeNull();
    }
    for (const raw of ['{bad', 'null', JSON.stringify({ version: 999, order })]) {
      storage.setItem(ORDER_STORAGE_KEY, raw);
      expect(readOrder(storage)).toBeNull();
    }
  });
  it('preserves historical names, prices and retired items without consulting the current menu', () => {
    const storage = memoryStorage();
    const historical = {
      id: 'DEMO-20261001-HISTORY', table: 'A01', status: 'received' as const,
      createdAt: '2026-10-01T02:00:00.000Z', total: 5100,
      lines: [{ lineId: 'historical-line', itemId: 'retired-autumn-burger', name: '秋日限定汉堡',
        unitPrice: 2550, quantity: 2, note: '少盐',
        options: [{ groupId: 'topping', choiceId: 'mushroom', label: '时令菌菇', priceDelta: 150 }] }],
    };
    storage.setItem(ORDER_STORAGE_KEY, JSON.stringify({ version: 1, order: historical }));
    expect(readOrder(storage)).toEqual(historical);
    expect(saveOrder(storage, historical)).toBe(true);
    expect(readOrder(storage)).toEqual(historical);
  });
  it('rejects malformed historical receipt lines and unsafe monetary totals', () => {
    const storage = memoryStorage();
    const order = createDemoOrder('A01', lines(), now);
    for (const patch of [
      { name: null }, { itemId: '' }, { lineId: '' }, { note: 10 },
      { unitPrice: -1 }, { unitPrice: 12.5 }, { unitPrice: Number.MAX_SAFE_INTEGER },
      { quantity: 0 }, { quantity: 100 }, { quantity: 1.5 },
      { options: [{ groupId: 'cheese', choiceId: 'regular', label: '芝士', priceDelta: 0.5 }] },
      { options: [{ groupId: '', choiceId: 'regular', label: '芝士', priceDelta: 0 }] },
    ]) {
      storage.setItem(ORDER_STORAGE_KEY, JSON.stringify({ version: 1, order: { ...order, lines: [{ ...order.lines[0], ...patch }] } }));
      expect(readOrder(storage)).toBeNull();
    }
  });
  it('atomically replaces the persisted cart with a receipt and preserves it on later cart edits', () => {
    const storage = memoryStorage();
    const cart = lines();
    saveCart(storage, cart);
    const order = createDemoOrder('A01', cart, now);
    expect(saveOrder(storage, order)).toBe(true);
    expect(readCart(storage)).toEqual([]);
    expect(readOrder(storage)).toEqual(order);
    expect(saveCart(storage, cart)).toBe(true);
    expect(readCart(storage)).toEqual(cart);
    expect(readOrder(storage)).toEqual(order);
  });
  it('leaves the previously persisted cart and receipt intact if checkout storage fails', () => {
    const storage = memoryStorage();
    const previous = createDemoOrder('A01', lines(), now);
    saveOrder(storage, previous);
    saveCart(storage, lines());
    const blocked = { getItem: storage.getItem, setItem() { throw new Error('quota'); } };
    expect(saveOrder(blocked, createDemoOrder('A01', lines(), now))).toBe(false);
    expect(readCart(storage)).toEqual(lines());
    expect(readOrder(storage)).toEqual(previous);
  });
  it('reports failed persistence without changing the order or active cart', () => {
    const cart = lines();
    const order = createDemoOrder('A01', cart, now);
    const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); } };
    expect(saveOrder(broken, order)).toBe(false);
    expect(saveOrder(null, order)).toBe(false);
    expect(readOrder(broken)).toBeNull();
    expect(cart).toHaveLength(1);
    expect(order.total).toBe(6400);
  });
});
