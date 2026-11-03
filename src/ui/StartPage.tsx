import { ArrowRight, Utensils, Bike } from 'lucide-react';
import { MenuCover } from './MenuCover';
export function StartPage({ table, onChoose }: { table: string | null; onChoose: (mode: 'dine-in' | 'delivery') => void }) {
  return <main className="start-page">
    <header className="start-header"><span className="start-brand">食刻<span>®</span></span><span>虚拟试吃 · 在线点餐</span></header>
    <section className="start-content">
      <div className="start-art"><MenuCover src="/foods/burger-illustration.svg" name="经典汉堡" /></div>
      <div className="start-welcome"><h1>好吃的，<br />现在开始。</h1><p>先虚拟试吃，再选今天想吃的。</p>
        <div className="start-choices">
          <button onClick={() => onChoose('dine-in')}><Utensils size={26} strokeWidth={1.6} /><span><strong>堂食点餐</strong><small>{table ? `${table} 桌 · 入座开吃` : '入座后，扫码或选择演示桌号'}</small></span><ArrowRight size={22} /></button>
          <button onClick={() => onChoose('delivery')}><Bike size={27} strokeWidth={1.6} /><span><strong>外卖点餐</strong><small>浏览菜单，体验外卖点单</small></span><ArrowRight size={22} /></button>
        </div>
        <p className="start-disclaimer">当前为演示版本，不扣款、不向餐厅下单，也不安排配送。</p>
      </div>
    </section>
    <footer className="start-footer">食刻，让点餐多一点体验。</footer>
  </main>;
}
