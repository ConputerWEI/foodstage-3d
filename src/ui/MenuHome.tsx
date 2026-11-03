import { useCallback, useState, type ReactNode } from 'react';
import { ArrowUpRight, MapPin, ShoppingBag } from 'lucide-react';
import { menuCategories, type MenuItem } from '../data/menu';
import { MenuCover } from './MenuCover';
import { FoodModelPreview } from './FoodModelPreview';

export interface MenuHomeProps {
  tools?: ReactNode;
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

export function MenuHome({ table, items, onOpen, onCart, cartCount, total, onDemoTable, tools, category: selectedCategory, onCategoryChange }: MenuHomeProps) {
  const [localCategory, setLocalCategory] = useState('全部');
  const [modelReady, setModelReady] = useState(false);
  const category = selectedCategory ?? localCategory;
  const setCategory = onCategoryChange ?? setLocalCategory;
  const categories = ['全部', ...menuCategories];
  const shown = category === '全部' ? items : items.filter(item => item.category === category || (category === '推荐' && Boolean(item.foodId)));
  const ready = useCallback(() => setModelReady(true), []);
  return <main className="ordering-menu">
    <header className="ordering-topbar">
      <a className="ordering-wordmark" href="#restaurant-menu" aria-label="食刻菜单">食刻<span>®</span></a>
      <span className="ordering-brand-caption">GOOD FOOD,<br />A LITTLE MORE PLAY.</span>
      <div className="ordering-header-actions"><span className="ordering-table"><i />{table ? `${table} 桌 · 堂食` : '未选桌号'}</span><button className="ordering-bag-top" onClick={onCart} aria-label={`查看购物车，${cartCount} 件菜品`}><ShoppingBag size={20} /><b>{cartCount}</b></button><div className="ordering-tools">{tools}</div></div>
    </header>
    <div className="ordering-menu-inner">
      <section className="ordering-hero" aria-label="食刻餐厅"><div><span className="ordering-overline">FOODSTAGE KITCHEN · NO. 001</span><h1>今天，吃点<br />好的<span>。</span></h1></div><p>熟悉的好味道，也值得多看一眼。<br />转一转，选一份，慢慢享用。</p></section>
      {!table && <div className="ordering-table-hint"><span>扫描桌码，即可为本桌点单</span><button onClick={onDemoTable}>使用演示桌号 A01</button></div>}
      <section className="ordering-catalog" id="restaurant-menu" aria-labelledby="ordering-menu-heading">
        <h2 id="ordering-menu-heading" className="sr-only">菜单</h2>
        <nav className="ordering-categories" aria-label="菜品分类">{categories.map(value => <button key={value} aria-pressed={category === value} onClick={() => setCategory(value)}>{value}</button>)}</nav>
        <div className="ordering-food-grid">{shown.map((item, index) => <article className={`ordering-food-card${item.foodId ? ' is-featured' : ''}${item.available ? '' : ' is-sold-out'}`} key={item.id}>
          <div className={`ordering-food-art${item.category === '小食' ? ' is-fries' : item.category === '饮品' ? ' is-soda' : ''}`}>
            <span className="ordering-food-index">0{index + 1} / {item.category.toUpperCase()}</span><div className="ordering-food-halo" />
            {item.foodId ? <><FoodModelPreview onReady={ready} />{!modelReady && <MenuCover src={item.cover} name={item.name} />}<span className="ordering-3d-label">3D ↻</span><span className="ordering-rotate-note">拖动，看看每一面</span></> : <MenuCover src={item.cover} name={item.name} />}
          </div>
          <button className="ordering-food-open" onClick={() => onOpen(item)} aria-label={`查看${item.name}`}>
            <div className="ordering-food-copy"><span className="ordering-food-category">{item.category}</span><h3>{item.name}</h3><p>{item.description}</p>{!item.available && <span className="ordering-sold-out">暂时售罄</span>}<div className="ordering-food-bottom"><strong className="ordering-price">{price(item.price)}</strong><span className="ordering-card-action" aria-hidden="true"><ArrowUpRight size={18} /></span></div></div>
          </button>
        </article>)}</div>
        {shown.length === 0 && <p className="ordering-local-note">这个分类还在备菜中，先看看其他好滋味。</p>}
      </section>
      <footer className="ordering-menu-note"><span>好好吃饭，是今天最重要的小事。</span><span>MADE FRESH · SERVED WITH JOY</span></footer>
    </div>
    {cartCount > 0 && <footer className="ordering-cart-dock"><button onClick={onCart} aria-label={`查看购物车，${cartCount} 件菜品`}><span>已选 {cartCount} 件</span><strong>{price(total)}</strong><b>查看点单 <ArrowUpRight size={18} /></b></button></footer>}
  </main>;
}
