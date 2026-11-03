import { Check, ReceiptText } from 'lucide-react';
import { formatPrice } from '../core/cart';
import type { DemoOrder } from '../core/orders';
import { OrderLines } from './CartSheet';

export function OrderResult({ order, onMenu }: { order: DemoOrder; onMenu: () => void }) {
  return <section className="order-page order-receipt" aria-labelledby="result-title">
    <div className="order-success"><Check size={34} strokeWidth={3} /></div>
    <h1 id="result-title">演示订单已生成</h1>
    <p className="order-footnote">已保存在此设备，餐厅尚未接收此订单。</p>
    <div className="order-ticket"><ReceiptText size={24} /><strong>{order.id}</strong><span>桌号 {order.table}</span><time dateTime={order.createdAt}>{new Date(order.createdAt).toLocaleString('zh-CN')}</time></div>
    <OrderLines lines={order.lines} />
    <div className="order-total"><span>合计</span><strong>{formatPrice(order.total)}</strong></div>
    <button className="order-primary order-wide" onClick={onMenu}>返回菜单</button>
  </section>;
}
