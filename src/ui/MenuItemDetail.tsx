import { ArrowLeft, Minus, Plus, ShoppingBag } from 'lucide-react';
import type { MenuItem } from '../data/menu';
import { MenuCover } from './MenuCover';

export interface MenuItemDraft { choices: Record<string, string>; quantity: number; note: string }
export interface MenuItemDetailProps {
  item: MenuItem;
  onClose: () => void;
  onTaste: () => void;
  onAdd: (choices: Record<string, string>, quantity: number, note: string) => void;
  draft: MenuItemDraft;
  onDraftChange: (draft: MenuItemDraft) => void;
}
const price = (cents: number) => `¥${(cents / 100).toFixed(2)}`;

export function MenuItemDetail({ item, onClose, onTaste, onAdd, draft, onDraftChange }: MenuItemDetailProps) {
  const choices: Record<string, string> = {};
  let unitPrice = item.price;
  for (const group of item.options ?? []) {
    const choice = group.choices.find(value => value.id === draft.choices[group.id]) ?? group.choices[0];
    if (choice) { choices[group.id] = choice.id; unitPrice += choice.priceDelta; }
  }
  const quantity = Math.max(1, Math.min(99, Math.trunc(draft.quantity) || 1));
  const update = (patch: Partial<MenuItemDraft>) => onDraftChange({ ...draft, choices, quantity, ...patch });
  return <main className="ordering-detail">
    <header className="ordering-detail-top"><button onClick={onClose}><ArrowLeft size={20} aria-hidden="true" />返回菜单</button><span>食刻</span></header>
    <div className="ordering-detail-layout">
      <section className="ordering-detail-art" aria-label={`${item.name}封面`}><MenuCover src={item.cover} name={item.name} /></section>
      <section className="ordering-detail-content" aria-labelledby="ordering-detail-title">
        <div className="ordering-detail-heading"><span className="ordering-detail-category">{item.category}</span><h1 id="ordering-detail-title">{item.name}</h1><p>{item.description}</p><strong className="ordering-price">{price(item.price)}<small> / 份</small></strong>{!item.available && <p className="ordering-unavailable" role="status">暂时售罄，看看其他好吃的吧</p>}</div>
        {item.foodId && <button className="ordering-taste-button" onClick={onTaste}><strong>虚拟试吃</strong></button>}
        <form className="ordering-detail-form" onSubmit={event => { event.preventDefault(); if (item.available) onAdd(choices, quantity, draft.note); }}>
          {(item.options ?? []).map(group => <fieldset className="ordering-option-group" key={group.id}><legend>{group.name}</legend><div className="ordering-option-choices">{group.choices.map(choice => <label key={choice.id} className="ordering-option"><input type="radio" name={`option-${group.id}`} value={choice.id} checked={choices[group.id] === choice.id} onChange={() => update({ choices: { ...choices, [group.id]: choice.id } })} /><span>{choice.label}{choice.priceDelta !== 0 && <small>{choice.priceDelta > 0 ? '+' : '−'}{price(Math.abs(choice.priceDelta))}</small>}</span></label>)}</div></fieldset>)}
          <div className="ordering-quantity-row"><span>数量</span><div className="ordering-stepper"><button type="button" aria-label="减少数量" disabled={quantity <= 1} onClick={() => update({ quantity: quantity - 1 })}><Minus size={18} aria-hidden="true" /></button><output aria-label="数量" aria-live="polite">{quantity}</output><button type="button" aria-label="增加数量" disabled={quantity >= 99} onClick={() => update({ quantity: quantity + 1 })}><Plus size={18} aria-hidden="true" /></button></div></div>
          <label className="ordering-note"><span>备注</span><textarea aria-label="备注" value={draft.note} maxLength={200} rows={3} placeholder="例如：不要洋葱" onChange={event => update({ note: event.target.value })} /></label>
          <div className="ordering-detail-dock"><div><small>合计</small><strong className="ordering-price">{price(unitPrice * quantity)}</strong></div><button className="ordering-add-button" type="submit" disabled={!item.available}><ShoppingBag size={19} aria-hidden="true" />{item.available ? '加入点单' : '暂时售罄'}</button></div>
        </form>
      </section>
    </div>
  </main>;
}
