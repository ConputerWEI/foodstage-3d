import assetCatalog from '../../assets/catalog.json';

function assetStages(id: string): FoodStage[] {
  const food = assetCatalog.foods.find(item => item.id === id);
  if (!food) throw new Error(`Missing asset catalog entry: ${id}`);
  return food.stages.map((stage, index) => ({
    url: `/models-mobile/${food.runtimePrefix}-${index}.glb`,
    bites: stage.bites,
    calibration: {
      scale: stage.calibration.scale,
      position: [...stage.calibration.position] as [number, number, number],
      yaw: stage.calibration.yaw,
    },
    presentation: 'presentation' in stage ? stage.presentation as FoodStage['presentation'] : undefined,
  }));
}

export interface ModelCalibration {
  readonly scale: number;
  readonly position: readonly [number, number, number];
  readonly yaw: number;
}
export interface FoodStage {
  readonly url: string;
  readonly bites: number;
  readonly calibration: ModelCalibration;
  /** Stable mode retains stage-zero source coordinates and pivot as components disappear. */
  readonly presentation?: 'fixed-width' | 'physical-size' | 'physical-size-stable';
}
/**
 * Recorded mouth sounds for one food. Every food ships its own set, because a crispy
 * taco and a soft burger must not sound alike. Files live in `public/audio/<food-id>/`.
 */
export interface FoodSound {
  /** Opening bite of a stage: crisp first contact. Falls back to `chews`. */
  readonly bite?: string;
  /** Regular mouthfuls; one is picked at random for each middle bite. */
  readonly chews: readonly string[];
  /** Closing mouthful of a stage: heavier and longer. Falls back to `chews`. */
  readonly finish?: string;
  /** Absolute playback gain (default 0.42), for louder or quieter foods. */
  readonly level?: number;
}
export type FoodInteraction = 'solid' | 'drink';

export interface FoodDefinition {
  /** Defaults to solid for existing foods. */
  readonly interaction?: FoodInteraction;
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly cover: string;
  readonly stages: readonly FoodStage[];
  readonly sound: FoodSound;
}

export const foods: readonly FoodDefinition[] = [
  {
    id: 'crispy-chicken',
    name: '黄金炸鸡腿',
    description: '带骨鸡腿现炸至金黄，酥脆外壳与鲜嫩鸡肉逐口呈现',
    cover: '/foods/crispy-chicken-cutout.png',
    stages: assetStages('crispy-chicken'),
    sound: { chews: [] },
  },
  {
    id: 'lemon-soda',
    interaction: 'drink',
    name: '鲜柠气泡饮',
    description: '透明杯中的柠檬气泡饮、冰块与柠檬片，液位逐阶段下降',
    cover: '/foods/lemon-soda.svg',
    stages: assetStages('lemon-soda'),
    sound: { chews: [] },
  },
  {
    id: 'mango-cheesecake',
    name: '芒果芝士蛋糕',
    description: '金黄芒果层、细腻芝士与酥香饼底，逐口呈现自然咬痕',
    cover: '/foods/mango-cheesecake-cutout.png',
    stages: assetStages('mango-cheesecake'),
    sound: { chews: [] },
  },
  {
    id: 'pepperoni-pizza',
    name: '意式双重芝士披萨',
    description: '金黄饼边、融化双重芝士与意式香肠，点缀新鲜罗勒',
    cover: '/foods/pizza-six-0-cutout.png',
    stages: assetStages('pepperoni-pizza'),
    sound: { chews: ['/audio/classic-burger/chew-1.mp3', '/audio/classic-burger/chew-2.mp3'] },
  },
  {
    id: 'rosemary-fries',
    name: '迷迭香薯条',
    description: '带皮粗薯现炸至金黄，撒上海盐与迷迭香',
    cover: '/foods/rosemary-fries-cutout.png',
    stages: assetStages('rosemary-fries'),
    sound: {
      chews: ['/audio/classic-burger/chew-1.mp3', '/audio/classic-burger/chew-2.mp3'],
    },
  },
  {
    id: 'classic-burger',
    name: '经典汉堡',
    description: '四层香气，慢慢吃完。',
    cover: '/foods/burger-double-cutout.png',
    stages: assetStages('classic-burger'),
    sound: {
      bite: '/audio/classic-burger/bite-1.mp3',
      chews: ['/audio/classic-burger/chew-1.mp3', '/audio/classic-burger/chew-2.mp3'],
      finish: '/audio/classic-burger/finish-1.mp3',
    },
  },
];

export function foodById(id: string): FoodDefinition {
  const food = foods.find(item => item.id === id);
  if (!food) throw new Error(`Unknown food: ${id}`);
  return food;
}
