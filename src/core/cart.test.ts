import { describe, expect, it } from 'vitest';
import { menuItemById } from '../data/menu';
import { addLine, cartTotal, formatPrice, readCart, saveCart, setLineQuantity, CART_STORAGE_KEY } from './cart';

const burger = () => menuItemById('classic-burger')!;
function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}

describe('catalog-backed cart', () => {
  it('merges normalized options and notes without mutating previous lines', () => {
    const first = addLine([], burger(), [{ groupId: 'cheese', choiceId: 'extra' }, { groupId: 'spice', choiceId: 'mild' }], 2, '  少盐  谢谢  ');
    const merged = addLine(first, burger(), [{ groupId: 'spice', choiceId: 'mild' }, { groupId: 'cheese', choiceId: 'extra' }], 1, '少盐 谢谢');
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ quantity: 3, unitPrice: 3500, note: '少盐 谢谢' });
    expect(first[0]!.quantity).toBe(2);
    expect(cartTotal(merged)).toBe(10500);
  });
  it('keeps different options and notes separate and supplies option defaults', () => {
    let lines = addLine([], burger(), [], 1);
    lines = addLine(lines, burger(), [{ groupId: 'cheese', choiceId: 'extra' }], 1);
    lines = addLine(lines, burger(), [], 1, '不要洋葱');
    expect(lines).toHaveLength(3);
    expect(lines.map(line => line.unitPrice)).toEqual([3200, 3500, 3200]);
  });
  it('caps quantities, removes at zero, and computes integer cents', () => {
    const lines = addLine([], burger(), [], 120);
    expect(lines[0]!.quantity).toBe(99);
    expect(addLine(lines, burger(), [], 2)[0]!.quantity).toBe(99);
    expect(setLineQuantity(lines, lines[0]!.lineId, 2.8)[0]!.quantity).toBe(2);
    expect(setLineQuantity(lines, lines[0]!.lineId, 0)).toEqual([]);
    expect(formatPrice(10550)).toBe('¥105.50');
    expect(formatPrice(0)).toBe('¥0.00');
  });
  it('rejects unavailable items, invalid options and nonfinite quantities', () => {
    const soldOut = menuItemById('truffle-fries')!;
    expect(() => addLine([], soldOut, [], 1)).toThrow();
    expect(() => addLine([], burger(), [{ groupId: 'cheese', choiceId: 'fake' }], 1)).toThrow();
    expect(() => addLine([], burger(), [{ groupId: 'fake', choiceId: 'mild' }], 1)).toThrow();
    expect(() => addLine([], burger(), [], NaN)).toThrow();
  });
  it('round trips while replacing stored names, prices and option labels from catalog', () => {
    const storage = memoryStorage();
    const lines = addLine([], burger(), [{ groupId: 'cheese', choiceId: 'extra' }], 2);
    expect(saveCart(storage, lines)).toBe(true);
    const payload = JSON.parse(storage.getItem(CART_STORAGE_KEY)!);
    payload.lines[0].name = '伪造';
    payload.lines[0].unitPrice = 1;
    payload.lines[0].options[0].priceDelta = -99999;
    payload.lines[0].options[0].label = '伪造';
    storage.setItem(CART_STORAGE_KEY, JSON.stringify(payload));
    expect(readCart(storage)).toEqual(lines);
    expect(cartTotal(readCart(storage))).toBe(7000);
  });
  it('rejects malformed, stale and invalid persisted carts', () => {
    const storage = memoryStorage();
    for (const raw of ['{bad', 'null', '[]', JSON.stringify({ version: 9, lines: [] })]) {
      storage.setItem(CART_STORAGE_KEY, raw);
      expect(readCart(storage)).toEqual([]);
    }
    const lines = addLine([], burger(), [], 1);
    for (const patch of [{ itemId: 'missing' }, { itemId: 'truffle-fries' }, { quantity: -1 }, { quantity: 100 }, { quantity: 1.5 }, { options: [{ groupId: 'cheese', choiceId: 'fake' }] }]) {
      saveCart(storage, lines);
      const payload = JSON.parse(storage.getItem(CART_STORAGE_KEY)!);
      Object.assign(payload.lines[0], patch);
      storage.setItem(CART_STORAGE_KEY, JSON.stringify(payload));
      expect(readCart(storage)).toEqual([]);
    }
  });
  it('keeps the active cart intact when storage fails', () => {
    const lines = addLine([], burger(), [], 1);
    const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); } };
    expect(readCart(broken)).toEqual([]);
    expect(saveCart(broken, lines)).toBe(false);
    expect(saveCart(null, lines)).toBe(false);
    expect(lines[0]!.quantity).toBe(1);
  });
});
