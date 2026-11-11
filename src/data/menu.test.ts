/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
const covers = import.meta.glob('../../public/foods/*.{svg,png}', { eager: true, query: '?url', import: 'default' });
const previewModels = import.meta.glob('../../public/models-mobile/*.glb', { query: '?url', import: 'default' });
import { menuItems, menuCategories, menuItemById } from './menu';
import { foods } from './foods';

describe('restaurant menu', () => {
  it('offers categorized dishes with valid models and local covers', () => {
    for (const id of ['crispy-chicken', 'mango-cheesecake']) {
      expect(menuItemById(id)).toMatchObject({ available: true, foodId: id });
    }
    expect(menuItemById('lemon-soda')).toMatchObject({ available: true, modelFoodId: 'lemon-soda' });
    expect(menuItemById('lemon-soda')?.foodId).toBeUndefined();
    expect(menuItemById('lemon-soda')?.cover).toBe('/foods/lemon-soda.svg');
    expect(menuItems.some(item => !item.foodId)).toBe(true);
    expect(menuItems.some(item => !item.available)).toBe(true);
    expect(new Set(menuItems.map(item => item.id)).size).toBe(menuItems.length);
    for (const item of menuItems) {
      expect(menuCategories).toContain(item.category);
      expect(Number.isInteger(item.price) && item.price > 0).toBe(true);
      if (item.previewModelUrl) {
        expect(previewModels[`../../public${item.previewModelUrl}`]).toBeDefined();
      } else {
        expect(covers[`../../public${item.cover}`]).toBeDefined();
        expect(foods.some(food => food.id === (item.modelFoodId ?? item.foodId))).toBe(true);
      }
      if (item.foodId) expect(foods.some(food => food.id === item.foodId)).toBe(true);
    }
    expect(menuItemById('classic-burger')?.foodId).toBe('classic-burger');
    expect(menuItemById('crispy-chicken')?.category).toBe('小食');
    expect(menuItemById('mango-cheesecake')?.category).toBe('甜点');
    expect(menuItemById('chocolate-brownie')).toBeUndefined();
    expect(menuItemById('mango-cheesecake')?.cover).toBe('/foods/mango-cheesecake-cutout.png');
    expect(menuItemById('missing')).toBeUndefined();
  });
  it('keeps display-only drinks and shared fries geometry separate from tasting and availability', () => {
    for (const id of ['coca-cola', 'sprite', 'fanta-orange', 'coca-cola-no-sugar']) {
      const item = menuItemById(id);
      expect(item).toMatchObject({ available: true, category: '饮品', previewModelUrl: `/models-mobile/${id}-0.glb` });
      expect(item?.foodId).toBeUndefined();
      expect(item?.modelFoodId).toBeUndefined();
    }
    expect(menuItemById('truffle-fries')).toMatchObject({ available: false, foodId: 'rosemary-fries' });
    for (const item of menuItems) expect(Boolean(item.foodId)).toBe(item.category !== '饮品');
    expect(menuItemById('lemon-soda')?.foodId).toBeUndefined();
  });
});
