import { ArrowLeft, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { cartTotal, formatPrice, type CartLine } from '../core/cart';

export function OrderLines({ lines }: { lines: readonly CartLine[] }) {
  return <ul className="order-lines">{lines.map(line => <li key={line.lineId}>
    <div><strong>{line.name}</strong><p>{line.options.map(option => option.label).join(' / ') || '标准份'}</p>{line.note && <p>{line.note}</p>}</div>
    <span>× {line.quantity}</span><b>{formatPrice(line.unitPrice * line.quantity)}</b>
  </li>)}</ul>;
}

export function CartSheet({ lines, onClose, onQuantity, onReview }: {
  lines: readonly CartLine[]; onClose: () => void; onQuantity: (id: string, quantity: number) => void; onReview: () => void;
}) {
  return <section className="order-page" aria-labelledby="cart-title">
    <button className="order-back" onClick={onClose}><ArrowLeft size={20} /> 继续选菜</button>
    <header className="order-page-heading"><ShoppingBag size={30} /><h1 id="cart-title">我的点单</h1></header>
    {!lines.length ? <div className="order-empty"><ShoppingBag size={56} strokeWidth={1.2} /><h2>还没有选菜</h2><p>先翻翻菜单，找一道想吃的。</p><button className="order-primary" onClick={onClose}>去看菜单</button></div> : <>
      <ul className="cart-lines">{lines.map(line => <li key={line.lineId}>
        <div className="cart-line-info"><h2>{line.name}</h2><p>{line.options.map(option => option.label).join(' / ') || '标准份'}</p>{line.note && <p>{line.note}</p>}<b>{formatPrice(line.unitPrice)}</b></div>
        <div className="cart-line-actions"><button aria-label={`删除${line.name}`} onClick={() => onQuantity(line.lineId, 0)}><Trash2 size={18} /></button><div className="order-stepper"><button aria-label={`减少${line.name}数量`} onClick={() => onQuantity(line.lineId, line.quantity - 1)}><Minus size={18} /></button><output>{line.quantity}</output><button aria-label={`增加${line.name}数量`} disabled={line.quantity >= 99} onClick={() => onQuantity(line.lineId, line.quantity + 1)}><Plus size={18} /></button></div><strong>{formatPrice(line.unitPrice * line.quantity)}</strong></div>
      </li>)}</ul>
      <div className="order-total"><span>菜品合计</span><strong>{formatPrice(cartTotal(lines))}</strong></div>
      <button className="order-primary order-wide" onClick={onReview}>确认点单</button>
    </>}
  </section>;
}
