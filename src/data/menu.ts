export interface MenuChoice { readonly id: string; readonly label: string; readonly priceDelta: number }
export interface MenuOption { readonly id: string; readonly name: string; readonly choices: readonly MenuChoice[] }
export interface MenuItem {
  readonly id: string;
  readonly name: string;
  readonly category: '推荐' | '主食' | '小食' | '饮品';
  readonly description: string;
  readonly price: number;
  readonly cover: string;
  readonly foodId?: string;
  readonly options?: readonly MenuOption[];
  readonly available: boolean;
}
export const menuCategories = ['推荐', '主食', '小食', '饮品'] as const;
export const menuItems: readonly MenuItem[] = [
  {
    id: 'classic-burger', name: '经典汉堡', category: '主食',
    description: '炙烤牛肉饼、切达芝士与脆生菜，夹进松软芝麻面包。',
    price: 3200, cover: '/foods/classic-burger.svg', foodId: 'classic-burger', available: true,
    options: [
      { id: 'spice', name: '辣度', choices: [{ id: 'mild', label: '不辣', priceDelta: 0 }, { id: 'hot', label: '微辣', priceDelta: 0 }] },
      { id: 'cheese', name: '芝士', choices: [{ id: 'regular', label: '标准芝士', priceDelta: 0 }, { id: 'extra', label: '双份芝士', priceDelta: 300 }] },
    ],
  },
  {
    id: 'rosemary-fries', name: '迷迭香薯条', category: '小食',
    description: '带皮粗薯现炸至金黄，撒上海盐与迷迭香，配番茄蘸酱。',
    price: 1800, cover: '/foods/rosemary-fries.svg', available: true,
    options: [{ id: 'portion', name: '份量', choices: [{ id: 'regular', label: '标准份', priceDelta: 0 }, { id: 'large', label: '分享大份', priceDelta: 800 }] }],
  },
  {
    id: 'lemon-soda', name: '鲜柠气泡饮', category: '饮品',
    description: '鲜切柠檬与清爽气泡水，薄荷提香，搭配汉堡刚刚好。',
    price: 1600, cover: '/foods/lemon-soda.svg', available: true,
    options: [{ id: 'ice', name: '冰量', choices: [{ id: 'regular', label: '正常冰', priceDelta: 0 }, { id: 'less', label: '少冰', priceDelta: 0 }, { id: 'none', label: '去冰', priceDelta: 0 }] }],
  },
  {
    id: 'truffle-fries', name: '黑松露帕玛森薯条', category: '小食',
    description: '金黄薯条佐黑松露风味酱与帕玛森芝士，今日份已售罄。',
    price: 2600, cover: '/foods/rosemary-fries.svg', available: false,
  },
];
export function menuItemById(id: string): MenuItem | undefined { return menuItems.find(item => item.id === id); }
