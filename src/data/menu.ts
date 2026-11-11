export interface MenuChoice { readonly id: string; readonly label: string; readonly priceDelta: number }
export interface MenuOption { readonly id: string; readonly name: string; readonly choices: readonly MenuChoice[] }
export interface MenuItem {
  readonly id: string;
  readonly name: string;
  readonly category: '推荐' | '主食' | '小食' | '饮品' | '甜点';
  readonly description: string;
  readonly price: number;
  readonly cover: string;
  readonly unit?: '罐';
  readonly foodId?: string;
  /** Display model, independent of whether virtual tasting is offered. */
  readonly modelFoodId?: string;
  /** Standalone display asset with no associated tasting sequence. */
  readonly previewModelUrl?: string;
  readonly options?: readonly MenuOption[];
  readonly available: boolean;
}
export const menuCategories = ['推荐', '主食', '小食', '饮品', '甜点'] as const;
function cannedDrink(id: string, name: string, flavour: string): MenuItem {
  return {
    id, name, category: '饮品', description: `330 mL 罐装 · ${flavour}`,
    price: 500, unit: '罐', available: true,
    cover: `/foods/${id}.png`, previewModelUrl: `/models-mobile/${id}-0.glb`,
  };
}

export const menuItems: readonly MenuItem[] = [
  {
    id: 'classic-burger', name: '经典汉堡', category: '主食',
    description: '炙烤牛肉饼、切达芝士与脆生菜，夹进松软芝麻面包',
    price: 3200, cover: '/foods/burger-double-cutout.png', foodId: 'classic-burger', available: true,
    options: [
      { id: 'spice', name: '辣度', choices: [{ id: 'mild', label: '不辣', priceDelta: 0 }, { id: 'hot', label: '微辣', priceDelta: 0 }] },
      { id: 'cheese', name: '芝士', choices: [{ id: 'regular', label: '标准芝士', priceDelta: 0 }, { id: 'extra', label: '双份芝士', priceDelta: 300 }] },
    ],
  },
  {
    id: 'rosemary-fries', name: '迷迭香薯条', category: '小食',
    description: '带皮粗薯现炸至金黄，撒上海盐与迷迭香',
    price: 1800, cover: '/foods/rosemary-fries-cutout.png', foodId: 'rosemary-fries', available: true,
    options: [{ id: 'portion', name: '份量', choices: [{ id: 'regular', label: '标准份', priceDelta: 0 }, { id: 'large', label: '分享大份', priceDelta: 800 }] }],
  },
  {
    id: 'pepperoni-pizza', name: '意式双重芝士披萨', category: '主食',
    description: '金黄饼边、融化双重芝士与意式香肠，点缀新鲜罗勒',
    price: 4800, cover: '/foods/pizza-six-0-cutout.png', foodId: 'pepperoni-pizza', available: true,
    options: [{ id: 'cheese', name: '芝士', choices: [{ id: 'regular', label: '标准芝士', priceDelta: 0 }, { id: 'extra', label: '加量芝士', priceDelta: 600 }] }],
  },
  {
    id: 'crispy-chicken', name: '黄金炸鸡腿', category: '小食',
    description: '带骨鸡腿现炸至金黄，酥脆外壳与鲜嫩鸡肉逐口呈现',
    price: 2800, cover: '/foods/crispy-chicken-cutout.png', foodId: 'crispy-chicken', available: true,
    options: [{ id: 'sauce', name: '蘸酱', choices: [{ id: 'none', label: '原味', priceDelta: 0 }, { id: 'honey-mustard', label: '蜂蜜芥末', priceDelta: 300 }] }],
  },
  {
    id: 'mango-cheesecake', name: '芒果芝士蛋糕', category: '甜点',
    description: '金黄芒果层与细腻芝士，配上酥香饼底',
    price: 2200, cover: '/foods/mango-cheesecake-cutout.png', foodId: 'mango-cheesecake', available: true,
    options: [{ id: 'temperature', name: '温度', choices: [{ id: 'chilled', label: '冷藏', priceDelta: 0 }, { id: 'room', label: '常温', priceDelta: 0 }] }],
  },
  {
    id: 'truffle-fries', name: '黑松露帕玛森薯条', category: '小食',
    description: '金黄薯条佐黑松露风味酱与帕玛森芝士，今日份已售罄',
    price: 2600, cover: '/foods/rosemary-fries-cutout.png', modelFoodId: 'rosemary-fries', available: false,
  },
  {
    id: 'lemon-soda', name: '鲜柠气泡饮', category: '饮品',
    description: '鲜切柠檬与清爽气泡水，沁凉爽口',
    price: 1600, cover: '/foods/lemon-soda.svg', modelFoodId: 'lemon-soda', available: true,
    options: [{ id: 'ice', name: '冰量', choices: [{ id: 'regular', label: '正常冰', priceDelta: 0 }, { id: 'less', label: '少冰', priceDelta: 0 }, { id: 'none', label: '去冰', priceDelta: 0 }] }],
  },
  cannedDrink('coca-cola', '可口可乐', '经典原味可乐'),
  cannedDrink('sprite', '雪碧', '柠檬青柠味汽水'),
  cannedDrink('fanta-orange', '橙味芬达', '橙味汽水'),
  cannedDrink('coca-cola-no-sugar', '无糖可口可乐', '零糖可乐'),
];
export function menuItemById(id: string): MenuItem | undefined { return menuItems.find(item => item.id === id); }
