import { describe, expect, it } from 'vitest';
import { foods, type FoodDefinition } from './foods';

describe('foods', () => {
  it('defines a selectable classic burger with four uniquely addressed stages', () => {
    const burger = foods.find(food => food.id === 'classic-burger');
    expect(burger).toBeDefined();
    expect(burger).toMatchObject({ name: '经典汉堡', description: '四层香气，慢慢吃完。' });
    expect(burger!.stages).toHaveLength(4);
    expect(new Set(burger!.stages.map(stage => stage.url)).size).toBe(4);
    expect(burger!.stages.map(stage => stage.bites)).toEqual([5, 6, 5, 6]);
    expect(burger!.cover).toBe('/foods/classic-burger.svg');
  });

  it('resolves foods by stable ID and never joins food stages', async () => {
    const { foodById } = await import('./foods');
    const burger: FoodDefinition = foodById('classic-burger');
    expect(burger.stages.map(stage => stage.url)).toEqual([
      '/models-mobile/burger-0.glb', '/models-mobile/burger-1.glb',
      '/models-mobile/burger-2.glb', '/models-mobile/burger-3.glb',
    ]);
    expect(() => foodById('missing')).toThrow('Unknown food');
  });
});
