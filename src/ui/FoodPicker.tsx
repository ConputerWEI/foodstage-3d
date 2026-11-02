import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen } from 'lucide-react';
import type { FoodDefinition } from '../data/foods';
import { FoodMark } from './FoodMark';

interface FoodPickerProps {
  foods: readonly FoodDefinition[];
  onStart: (food: FoodDefinition) => void;
}

function FoodCover({ food }: { food: FoodDefinition }) {
  const [failed, setFailed] = useState(false);
  return food.cover && !failed
    ? <img className="menu-food-cover" src={food.cover} alt="" onError={() => setFailed(true)} />
    : <span className="menu-cover-fallback" aria-hidden="true">食</span>;
}

export function FoodPicker({ foods, onStart }: FoodPickerProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTitle = useRef<HTMLHeadingElement>(null);
  const enterButton = useRef<HTMLButtonElement>(null);
  const navigated = useRef(false);
  useEffect(() => {
    if (menuOpen) {
      navigated.current = true;
      menuTitle.current?.focus();
    } else if (navigated.current) enterButton.current?.focus();
  }, [menuOpen]);
  return <section className={`picker-screen${menuOpen ? ' menu-open' : ''}`} data-testid="food-picker">
    {!menuOpen ? <div className="shop-landing">
      <div className="shop-sign"><FoodMark className="shop-emblem" /><h2>食刻</h2></div>
      <div className="food-spread">
        <span className="comic-spark spark-left" aria-hidden="true" />
        <img src="/foods/fast-food-spread.svg" alt="汉堡、薯条、披萨和饮品组成的西式快餐插画" fetchPriority="high" />
        <span className="comic-spark spark-right" aria-hidden="true" />
      </div>
      <button className="enter-menu" ref={enterButton} type="button" onClick={() => setMenuOpen(true)}>翻开菜单 <BookOpen size={24} strokeWidth={1.8} aria-hidden="true" /></button>
    </div> : <div className="shop-menu">
      <div className="menu-toolbar"><button className="menu-return" type="button" onClick={() => setMenuOpen(false)}><ArrowLeft size={20} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 7 }} aria-hidden="true" /> 返回店面</button></div>
      <div className="menu-heading"><h2 ref={menuTitle} tabIndex={-1}>菜单</h2></div>
      <div className="menu-list">
        {foods.map(food => <article className="menu-item" key={food.id} data-food-id={food.id}>
          <div className="menu-item-image"><FoodCover food={food} /></div>
          <div className="menu-item-body">
            <h3>{food.name}</h3>
            <button className="menu-order" type="button" onClick={() => onStart(food)}>开始品尝</button>
          </div>
        </article>)}
      </div>
    </div>}
  </section>;
}
