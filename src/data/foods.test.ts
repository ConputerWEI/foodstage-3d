import { describe, expect, it } from 'vitest';
import { foodById, foods } from './foods';

describe('food definitions', () => {
  it('has four stage definitions for crispy chicken', () => {
    const food = foodById('crispy-chicken');
    expect(food.stages).toHaveLength(4);
    expect(food.stages.map(stage => stage.bites)).toEqual([3, 3, 3, 3]);
    expect(food.stages.map(stage => stage.url)).toEqual([
      '/models-mobile/crispy-chicken-0.glb', '/models-mobile/crispy-chicken-1.glb',
      '/models-mobile/crispy-chicken-2.glb', '/models-mobile/crispy-chicken-3.glb',
    ]);
  });
  it('registers the drink and dessert as independent four-stage foods', () => {
    for (const id of ['lemon-soda', 'mango-cheesecake']) {
      const food = foodById(id);
      expect(food.stages).toHaveLength(4);
      expect(food.stages.every(stage => stage.url.startsWith(`/models-mobile/${id}-`))).toBe(true);
      expect(food.sound.chews).toEqual([]);
    }
    expect(foods).toHaveLength(6);
    expect(foods.some(food => food.id === 'chocolate-brownie')).toBe(false);
    expect(foodById('mango-cheesecake').name).toBe('芒果芝士蛋糕');
  });
});
