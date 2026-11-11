import { useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Rotate3D, ShoppingBag, Utensils, UtensilsCrossed, X } from 'lucide-react';
import { menuItemById } from '../data/menu';
import { MenuFoodVisual } from './MenuFoodVisual';
import './order-welcome.css';

type OrderMode = 'dine-in' | 'takeaway';
const quickCounts = [1, 2, 3, 4, 5];
const featured = menuItemById('classic-burger');

export function OrderWelcome({ onChoose }: { onChoose: (mode: OrderMode, guests?: number) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [guests, setGuests] = useState<number | 'custom'>(2);
  const [customCount, setCustomCount] = useState('');
  const customInput = useRef<HTMLInputElement>(null);
  const selectedCount = guests === 'custom' ? Number(customCount) : guests;
  const validCount = Number.isSafeInteger(selectedCount) && selectedCount > 0;

  function openGuests() {
    dialog.current?.showModal();
    dialog.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
  }

  function startDineIn(event: FormEvent) {
    event.preventDefault();
    if (!validCount) return;
    dialog.current?.close();
    onChoose('dine-in', selectedCount);
  }

  return <section className="order-welcome" aria-labelledby="welcome-heading">
    <div className="welcome-inner">
      <header className="welcome-header">
        <div className="welcome-brand"><UtensilsCrossed size={28} strokeWidth={2.2} aria-hidden="true" />食刻</div>
        <span className="welcome-service">自助点单<span className="welcome-checker" aria-hidden="true" /></span>
      </header>

      <div className="welcome-poster">
        <div className="welcome-poster-copy">
          <h1 id="welcome-heading">今天，<br /><strong>怎么吃？</strong></h1>
          <p>请选择用餐方式。</p>
        </div>
        <figure className="welcome-hero-art">
          <div className="welcome-hero-food">
            <img className="welcome-hero-poster" src="/foods/burger-double-cutout.png" alt="" fetchPriority="high" />
            {featured && <MenuFoodVisual item={featured} variant="hero" />}
          </div>
          <figcaption><Rotate3D size={16} aria-hidden="true" />经典汉堡</figcaption>
        </figure>
      </div>

      <div className="welcome-choices" aria-label="用餐方式">
        <button className="welcome-choice welcome-choice-dine" type="button" aria-haspopup="dialog" onClick={openGuests}>
          <Utensils className="welcome-choice-icon" aria-hidden="true" />
          <span className="welcome-choice-copy"><strong>堂食</strong><small>选择就餐人数</small></span>
          <ArrowRight className="welcome-choice-arrow" size={25} aria-hidden="true" />
        </button>
        <button className="welcome-choice welcome-choice-away" type="button" onClick={() => onChoose('takeaway')}>
          <ShoppingBag className="welcome-choice-icon" aria-hidden="true" />
          <span className="welcome-choice-copy"><strong>打包</strong><small>直接进入菜单</small></span>
          <ArrowRight className="welcome-choice-arrow" size={25} aria-hidden="true" />
        </button>
      </div>
    </div>

    <dialog ref={dialog} className="welcome-dialog" aria-labelledby="guest-heading" onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.current?.close();
    }}>
      <form onSubmit={startDineIn}>
        <div className="welcome-dialog-header"><span><Utensils size={17} aria-hidden="true" />堂食</span>
          <button type="button" onClick={() => dialog.current?.close()} aria-label="关闭人数选择"><X size={21} /></button>
        </div>
        <div className="welcome-dialog-body">
          <h2 id="guest-heading">几位用餐？</h2>
          <div className="welcome-counts" role="group" aria-label="就餐人数">
            {quickCounts.map(n => <button type="button" key={n} aria-pressed={guests === n} onClick={() => setGuests(n)}>{n}<span> 人</span></button>)}
            <button type="button" aria-pressed={guests === 'custom'} onClick={() => {
              setGuests('custom');
              requestAnimationFrame(() => customInput.current?.focus());
            }}>更多</button>
          </div>
          {guests === 'custom' && <label className="welcome-custom-count">就餐人数
            <input ref={customInput} type="number" inputMode="numeric" min={1} max={Number.MAX_SAFE_INTEGER} step={1}
              placeholder="输入人数" required value={customCount} onChange={event => setCustomCount(event.currentTarget.value)} />
          </label>}
          <button className="welcome-confirm" type="submit" disabled={!validCount}>进入菜单<ArrowRight size={20} aria-hidden="true" /></button>
        </div>
      </form>
    </dialog>
  </section>;
}
