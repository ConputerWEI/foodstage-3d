import { useState } from 'react';
import { ArrowUpRight, MapPin, ShoppingBag, UtensilsCrossed } from 'lucide-react';
import { menuCategories, type MenuItem } from '../data/menu';
import { MenuCover } from './MenuCover';

export interface MenuHomeProps {
  table: string | null;
  items: readonly MenuItem[];
  onOpen: (item: MenuItem) => void;
  onCart: () => void;
  cartCount: number;
  total: number;
  onDemoTable: () => void;
  category?: string;
  onCategoryChange?: (category: string) => void;
}
const price = (cents: number) => `¥${(cents / 100).toFixed(2)}`;

export function MenuHome({ table, items, onOpen, onCart, cartCount, total, onDemoTable, category: selectedCategory, onCategoryChange }: MenuHomeProps) {
  const [localCategory, setLocalCategory] = useState('全部');
  const category = selectedCategory ?? localCategory;
  const setCategory = onCategoryChange ?? setLocalCategory;
  const categories = ['全部', ...menuCategories];
  const shown = category === '全部' ? items : items.filter(item => item.category === category || (category === '推荐' && Boolean(item.foodId)));
  const featured = items.find(item => item.foodId && item.available) ?? items.find(item => item.available);
  return <main className="ordering-menu">
    <header className="ordering-topbar">
      <a className="ordering-wordmark" href="#restaurant-menu" aria-label="食刻菜单"><UtensilsCrossed aria-hidden="true" size={24} /><span>食刻</span></a>
      <span className="ordering-table"><MapPin size={16} aria-hidden="true" />{table ? <><strong>{table}</strong> 桌</> : '欢迎入座'}</span>
    </header>
    <div className="ordering-menu-inner">
      <section className="ordering-hero" aria-label="食刻餐厅">
        <div className="ordering-hero-copy"><span className="ordering-sign-caption">好好吃饭 · 快乐加倍</span><h1>食刻开饭！</h1><p>现做的好滋味，<br />从这一口开始。</p><span className="ordering-sign-note">汉堡 / 小食 / 清爽饮品</span></div>
        {featured && <button className="ordering-hero-food" onClick={() => onOpen(featured)} aria-label={`招牌推荐：${featured.name}`}><MenuCover src={featured.cover} name={featured.name} /><span>招牌推荐 <ArrowUpRight size={16} aria-hidden="true" /></span></button>}
      </section>
      {!table && <div className="ordering-table-hint"><span>扫描桌码，即可为本桌点单</span><button onClick={onDemoTable}>使用演示桌号 A01</button></div>}
      <section className="ordering-catalog" id="restaurant-menu" aria-labelledby="ordering-menu-heading">
        <div className="ordering-section-title"><h2 id="ordering-menu-heading">今天吃点什么</h2><span>{items.length} 款好滋味</span></div>
        <nav className="ordering-categories" aria-label="菜品分类">{categories.map(value => <button key={value} aria-pressed={category === value} onClick={() => setCategory(value)}>{value}</button>)}</nav>
        <div className="ordering-food-grid">{shown.map(item => <article className={`ordering-food-card${item.available ? '' : ' is-sold-out'}`} key={item.id}>
          <button className="ordering-food-open" onClick={() => onOpen(item)} aria-label={`查看${item.name}`}>
            <MenuCover src={item.cover} name={item.name} />
            <div className="ordering-food-copy"><div className="ordering-food-heading"><h3>{item.name}</h3>{!item.available && <span className="ordering-sold-out">暂时售罄</span>}</div><p>{item.description}</p><div className="ordering-food-bottom"><strong className="ordering-price">{price(item.price)}</strong>{item.foodId && <span className="ordering-taste-tag">可虚拟试吃</span>}<span className="ordering-card-action" aria-hidden="true">{item.available ? '+' : '看详情'}</span></div></div>
          </button>
        </article>)}</div>
        {shown.length === 0 && <p className="ordering-local-note">这个分类还在备菜中，先看看其他好滋味。</p>}
      </section>
      <p className="ordering-local-note">本地演示菜单 · 提交后不会发送至餐厅</p>
    </div>
    <footer className="ordering-cart-dock"><div className="ordering-cart-inner"><div className="ordering-cart-amount"><span className="ordering-bag"><ShoppingBag size={24} aria-hidden="true" />{cartCount > 0 && <b>{cartCount}</b>}</span><div><strong>{price(total)}</strong><span>{cartCount ? `已选 ${cartCount} 件菜品` : '挑点喜欢的，好好吃一餐'}</span></div></div><button onClick={onCart} aria-label={`查看购物车，${cartCount} 件菜品`}>查看购物车<ArrowUpRight size={18} aria-hidden="true" /></button></div></footer>
  </main>;
}
