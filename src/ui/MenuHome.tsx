import { useState, type ReactNode } from 'react';
import { ArrowUpRight, ShoppingBag } from 'lucide-react';
import { menuCategories, type MenuItem } from '../data/menu';
import { MenuCover } from './MenuCover';


export interface MenuHomeProps {
  mode?: 'dine-in' | 'delivery';
  onStart?: () => void;
  tools?: ReactNode;
  table: string | null;
  items: readonly MenuItem[];
  onOpen: (item: MenuItem) => void;
  onCart: () => void;
  onTaste?: (item: MenuItem) => void;
  cartCount: number;
  total: number;
  onDemoTable: () => void;
  category?: string;
  onCategoryChange?: (category: string) => void;
}
const price = (cents: number) => `¥${(cents / 100).toFixed(2)}`;

export function MenuHome({ mode = 'dine-in', onStart, table, items, onOpen, onCart, cartCount, total, onDemoTable, tools, onTaste, category: selectedCategory, onCategoryChange }: MenuHomeProps) {
  const [localCategory, setLocalCategory] = useState('全部');
  const category = selectedCategory ?? localCategory;
  const setCategory = onCategoryChange ?? setLocalCategory;
  const categories = ['全部', ...menuCategories];
  const shown = category === '全部' ? items : items.filter(item => item.category === category || (category === '推荐' && Boolean(item.foodId)));
  return <main className="ordering-menu">
    <header className="ordering-topbar">
      <a className="ordering-wordmark" href="#restaurant-menu" aria-label="食刻菜单">食刻<span>®</span></a>
      <span className="ordering-brand-caption">好好吃饭，快乐加倍</span>
      <div className="ordering-header-actions">{onStart && <button className="menu-mode-switch" onClick={onStart}>切换用餐方式</button>}<span className="ordering-table">{mode === 'delivery' ? '外卖 · 演示' : table ? `${table} 桌 · 堂食` : '未选桌号'}</span><button className="ordering-bag-top" onClick={onCart} aria-label={`查看购物车，${cartCount} 件菜品`}><ShoppingBag size={20} /><b>{cartCount}</b></button><div className="ordering-tools">{tools}</div></div>
    </header>
    <div className="ordering-menu-inner">
      <section className="ordering-hero" aria-label="食刻餐厅"><div><span className="menu-tasting-kicker">虚拟试吃 · 先体验，再点单</span><h1 className="menu-brand-headline">臻虚拟——但真好吃</h1></div></section>
      {mode === 'dine-in' && !table && <div className="ordering-table-hint"><span>扫描桌码，即可为本桌点单</span><button onClick={onDemoTable}>使用演示桌号 A01</button></div>}
      <section className="ordering-catalog" id="restaurant-menu" aria-labelledby="ordering-menu-heading">
        <h2 id="ordering-menu-heading" className="sr-only">菜单</h2>
        <nav className="ordering-categories" aria-label="菜品分类">{categories.map(value => <button key={value} aria-pressed={category === value} onClick={() => setCategory(value)}>{value}</button>)}</nav>
        <div className="ordering-food-grid">{shown.map((item) => <article className={`ordering-food-card${item.foodId ? ' is-featured' : ''}${item.available ? '' : ' is-sold-out'}`} key={item.id}>
          <div className={`ordering-food-art${item.category === '小食' ? ' is-fries' : item.category === '饮品' ? ' is-soda' : ''}`}>
            <div className="ordering-food-halo" />
            <MenuCover src={item.cover} name={item.name} />
          </div>
          {item.foodId && onTaste ? <div className="ordering-food-copy menu-tasting-copy"><span className="menu-tasting-badge">支持虚拟试吃</span><h3>{item.name}</h3><p>{item.description}</p><strong className="ordering-price">{price(item.price)}</strong><div className="menu-tasting-actions"><button className="menu-taste-primary" disabled={!item.available} onClick={() => onTaste(item)}>虚拟试吃 ↗</button><button className="menu-spec-secondary" onClick={() => onOpen(item)}>选规格</button></div></div> : <button className="ordering-food-open" onClick={() => onOpen(item)} aria-label={`查看${item.name}`}>
            <div className="ordering-food-copy"><span className="ordering-food-category">{item.category}</span><h3>{item.name}</h3><p>{item.description}</p>{!item.available && <span className="ordering-sold-out">暂时售罄</span>}<div className="ordering-food-bottom"><strong className="ordering-price">{price(item.price)}</strong><span className="ordering-card-action" aria-hidden="true"><ArrowUpRight size={18} /></span></div></div>
          </button>}
        </article>)}</div>
        {shown.length === 0 && <p className="ordering-local-note">这个分类还在备菜中，先看看其他好滋味。</p>}
      </section>
      <footer className="ordering-menu-note">好好吃饭，是今天最重要的小事。</footer>
    </div>
    {cartCount > 0 && <footer className="ordering-cart-dock"><button onClick={onCart} aria-label={`查看购物车，${cartCount} 件菜品`}><span>已选 {cartCount} 件</span><strong>{price(total)}</strong><b>查看点单 <ArrowUpRight size={18} /></b></button></footer>}
  </main>;
}
