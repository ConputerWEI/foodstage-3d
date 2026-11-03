import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MenuHome } from './MenuHome';
import { MenuItemDetail } from './MenuItemDetail';
import type { MenuItem } from '../data/menu';

const burger: MenuItem = { id: 'burger', name: '经典汉堡', category: '主食', description: '现煎牛肉配鲜蔬', price: 2890, cover: '/foods/burger.webp', available: true, foodId: 'classic-burger', options: [{ id: 'size', name: '份量', choices: [{ id: 'regular', label: '标准', priceDelta: 0 }, { id: 'double', label: '双层', priceDelta: 800 }] }] };
const soldOut: MenuItem = { id: 'tea', name: '柠檬茶', category: '饮品', description: '清爽解腻', price: 1200, cover: '/foods/tea.svg', available: false };
const noop = () => {};

describe('ordering menu UI', () => {
  it('presents table, menu categories, cent prices and a browsable sold-out item', () => {
    const html = renderToStaticMarkup(createElement(MenuHome, { table: 'A01', items: [burger, soldOut], onOpen: noop, onCart: noop, cartCount: 2, total: 5780, onDemoTable: noop }));
    for (const text of ['A01', '主食', '饮品', '28.90', '57.80', '暂时售罄', '柠檬茶']) expect(html).toContain(text);
    expect(html).toContain('aria-label="菜品分类"');
    expect(html).toContain('aria-label="查看购物车，2 件菜品"');
  });
  it('offers a demo table without blocking menu browsing', () => {
    const html = renderToStaticMarkup(createElement(MenuHome, { table: null, items: [burger], onOpen: noop, onCart: noop, cartCount: 0, total: 0, onDemoTable: noop }));
    expect(html).toContain('扫描桌码');
    expect(html).toContain('使用演示桌号');
    expect(html).toContain('经典汉堡');
  });
  it('renders controlled selections, quantity and note with option-adjusted cent totals', () => {
    const html = renderToStaticMarkup(createElement(MenuItemDetail, { item: burger, onClose: noop, onTaste: noop, onAdd: noop, draft: { choices: { size: 'double' }, quantity: 2, note: '不要洋葱' }, onDraftChange: noop }));
    expect(html).toContain('虚拟试吃');
    expect(html).toContain('73.80');
    expect(html).toContain('不要洋葱');
    expect(html).toContain('aria-label="数量"');
    expect(html).toContain('checked=""');
    expect(html).toContain('加入点单');
  });
  it('keeps sold-out detail accessible but disables ordering and omits unavailable tasting', () => {
    const html = renderToStaticMarkup(createElement(MenuItemDetail, { item: soldOut, onClose: noop, onTaste: noop, onAdd: noop, draft: { choices: {}, quantity: 1, note: '' }, onDraftChange: noop }));
    expect(html).toContain('暂时售罄');
    expect(html).toContain('disabled=""');
    expect(html).not.toContain('虚拟试吃');
    expect(html).toContain('返回菜单');
  });
});
