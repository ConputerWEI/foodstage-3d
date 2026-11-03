import { ArrowLeft, MapPin } from 'lucide-react';
import { cartTotal, formatPrice, type CartLine } from '../core/cart';
import { OrderLines } from './CartSheet';

export function OrderReview({ mode = 'dine-in', table, lines, onBack, onSubmit, onDemoTable, error }: {
  mode?: 'dine-in' | 'delivery'; table: string | null; lines: readonly CartLine[]; onBack: () => void; onSubmit: () => void; onDemoTable: () => void; error: string;
}) {
  return <section className="order-page" aria-labelledby="review-title">
    <button className="order-back" onClick={onBack}><ArrowLeft size={20} /> 返回购物车</button>
    <header className="order-page-heading"><h1 id="review-title">确认订单</h1></header>
    <div className="order-table"><MapPin size={24} /><div><span>{mode === 'delivery' ? '用餐方式' : '用餐桌号'}</span><strong>{mode === 'delivery' ? '外卖演示' : table || '尚未选择桌号'}</strong></div></div>
    {mode === 'dine-in' && !table && <div className="order-notice"><p>请扫描桌码，或使用演示桌号体验点单。</p><button onClick={onDemoTable}>使用演示桌号 A01</button></div>}
    {mode === 'delivery' && <p className="order-footnote">当前仅体验外卖点单，不收集地址，不提供真实配送。</p>}
    <OrderLines lines={lines} />
    {error && <p className="order-error" role="alert">{error}</p>}
    <div className="order-checkout-dock"><div className="order-total"><span>合计</span><strong>{formatPrice(cartTotal(lines))}</strong></div>
    <button className="order-primary order-wide" disabled={(mode === 'dine-in' && !table) || !lines.length} onClick={onSubmit}>提交演示订单</button>
    <p className="order-footnote">仅保存在本机，不发送后厨、不扣款。</p></div>
  </section>;
}
