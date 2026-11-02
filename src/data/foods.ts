export interface ModelCalibration {
  readonly scale: number;
  readonly position: readonly [number, number, number];
  readonly yaw: number;
}
export interface FoodStage {
  readonly url: string;
  readonly bites: number;
  readonly calibration: ModelCalibration;
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
export interface FoodDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly cover: string;
  readonly stages: readonly FoodStage[];
  readonly sound: FoodSound;
}

export const foods: readonly FoodDefinition[] = [
  {
    id: 'classic-burger',
    name: '经典汉堡',
    description: '四层香气，慢慢吃完。',
    cover: '/foods/classic-burger.svg',
    stages: [0, 1, 2, 3].map(index => ({
      url: `/models-mobile/burger-${index}.glb`,
      bites: 4,
      calibration: { scale: 1, position: [0, 0, 0], yaw: 0 },
    })),
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
