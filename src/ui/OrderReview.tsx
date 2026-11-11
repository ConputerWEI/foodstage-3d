import { ArrowLeft, MapPin } from 'lucide-react';
import { cartTotal, formatPrice, type CartLine } from '../core/cart';
import { diningLabel, type DiningChoice } from '../core/dining';
import { OrderLines } from './CartSheet';

export function OrderReview({ table, dining, lines, onBack, onSubmit, onDemoTable, error }: {
  dining?: DiningChoice; table: string | null; lines: readonly CartLine[]; onBack: () => void; onSubmit: () => void; onDemoTable: () => void; error: string;
}) {
  const needsTable = dining?.mode !== 'takeaway' && !table;
  return <section className="order-page" aria-labelledby="review-title">
    <button className="order-back" onClick={onBack}><ArrowLeft size={20} /> 返回购物车</button>
    <header className="order-page-heading"><h1 id="review-title">确认订单</h1></header>
    <div className="order-table"><MapPin size={24} /><div><span>{dining ? '用餐方式' : '用餐桌号'}</span><strong>{dining ? diningLabel(dining) : table || '尚未选择桌号'}</strong>{dining?.mode === 'dine-in' && table && <span>{table} 桌</span>}</div></div>
    {needsTable && <div className="order-notice"><p>请扫描桌码，或使用演示桌号体验点单。</p><button onClick={onDemoTable}>使用演示桌号 A01</button></div>}
    <OrderLines lines={lines} />
    <div className="order-total"><span>合计</span><strong>{formatPrice(cartTotal(lines))}</strong></div>
    <p className="order-footnote">订单仅保存在当前浏览器，不会发送到后厨，也不会扣款。</p>
    {error && <p className="order-error" role="alert">{error}</p>}
    <button className="order-primary order-wide" disabled={needsTable || !lines.length} onClick={onSubmit}>提交演示订单</button>
  </section>;
}
