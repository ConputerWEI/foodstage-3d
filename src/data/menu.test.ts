/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
const covers = import.meta.glob('../../public/foods/*.svg', { eager: true, query: '?raw', import: 'default' });
import { menuItems, menuCategories, menuItemById } from './menu';
import { foods } from './foods';

describe('restaurant menu', () => {
  it('offers categorized, orderable non-3D dishes with real local covers', () => {
    expect(menuItems.filter(item => item.available && !item.foodId).length).toBeGreaterThanOrEqual(2);
    expect(menuItems.some(item => !item.available)).toBe(true);
    expect(new Set(menuItems.map(item => item.id)).size).toBe(menuItems.length);
    for (const item of menuItems) {
      expect(menuCategories).toContain(item.category);
      expect(Number.isInteger(item.price) && item.price > 0).toBe(true);
      expect(covers[`../../public${item.cover}`]).toContain('<svg');
      if (item.foodId) expect(foods.some(food => food.id === item.foodId)).toBe(true);
    }
    expect(menuItemById('classic-burger')?.foodId).toBe('classic-burger');
    expect(menuItemById('missing')).toBeUndefined();
  });
});
