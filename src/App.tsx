import { useCallback, useEffect, useReducer, useRef, useState, useSyncExternalStore } from 'react';
import { foodById, type FoodDefinition } from './data/foods';
import { menuItems, type MenuItem } from './data/menu';
import { addLine, cartTotal, readCart, saveCart, setLineQuantity } from './core/cart';
import { createDemoOrder, readOrder, saveOrder } from './core/orders';
import { parseTable } from './core/table';
import { MenuHome } from './ui/MenuHome';
import { MenuItemDetail, type MenuItemDraft } from './ui/MenuItemDetail';
import { CartSheet } from './ui/CartSheet';
import { OrderReview } from './ui/OrderReview';
import { OrderResult } from './ui/OrderResult';
import './ui/ordering.css';
import './ui/checkout.css';
import { createSequenceState, sequenceReducer, type SequenceEvent } from './core/sequence';
import { readSettings, saveSettings, type Settings } from './core/settings';
import { biteFeedback, cancelBiteAudio, primeBiteAudio, primeMilestoneAudio, milestoneFeedback } from './core/feedback';
import { createModelStore } from './scene/assets';
import { createMotion, impulse } from './scene/motion';
import { CHEW_SECONDS } from './scene/bite-effects';
import { Scene, type HitTest } from './scene/Scene';
import { useFoodInput } from './ui/useFoodInput';
import { SceneBoundary } from './ui/SceneBoundary';
import { HelpSheet } from './ui/HelpSheet';
import { SettingsSheet } from './ui/SettingsSheet';

import { Progress } from './ui/Progress';
import { FoodMark } from './ui/FoodMark';
import { ArrowLeft } from 'lucide-react';

function useSystemReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  return reduced;
}

function Brand() {
  return <div className="brand"><FoodMark className="brand-mark" /><h1>食刻</h1></div>;
}

function AppHeader({ settings, onSettingsChange, onBack }: { settings: Settings; onSettingsChange: (settings: Settings) => void; onBack?: () => void }) {
  return <header className="masthead">
    {onBack ? <button className="back-button" type="button" onClick={onBack}><ArrowLeft size={20} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 7 }} aria-hidden="true" /> 返回菜品</button> : <Brand />}
    {onBack && <Brand />}
    <nav className="header-tools" aria-label="工具"><HelpSheet /><SettingsSheet settings={settings} onChange={onSettingsChange} /></nav>
  </header>;
}

function PlayScreen({ food, settings, onSettingsChange, onBack }: { food: FoodDefinition; settings: Settings; onSettingsChange: (settings: Settings) => void; onBack: () => void }) {
  const [store] = useState(() => createModelStore(food.stages));
  const entries = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const reducer = useCallback((state: ReturnType<typeof createSequenceState>, event: SequenceEvent) => sequenceReducer(food.stages, state, event), [food.stages]);
  const [state, dispatch] = useReducer(reducer, undefined, () => createSequenceState(food.stages));
  const [motion] = useState(createMotion);
  const [chewing, setChewing] = useState(false);
  const chewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (chewTimer.current) clearTimeout(chewTimer.current); }, []);
  const hit = useRef<HitTest | null>(null);
  const [hitReady, setHitReady] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const setHit = useCallback((next: HitTest | null, owner?: HitTest) => {
    if (owner && hit.current !== owner) return;
    hit.current = next;
    setHitReady(Boolean(next));
  }, []);
  const systemReduced = useSystemReducedMotion();
  const reduced = settings.motion === 'reduced' || (settings.motion === 'system' && systemReduced);
  const handleContextLost = useCallback(() => { setContextLost(true); setHit(null); }, [setHit]);

  useEffect(() => { void store.load(0); }, [store]);
  useEffect(() => {
    if (settings.sound) { primeBiteAudio(food.sound); primeMilestoneAudio(); }
    else cancelBiteAudio();
    return cancelBiteAudio;
  }, [food.sound, settings.sound]);
  useEffect(() => {
    entries.forEach((entry, stage) => { if (entry.status === 'ready') dispatch({ type: 'READY', stage, run: state.run }); });
  }, [entries, state.run]);

  const lastMilestone = useRef({ run: state.run, stage: 0, finished: false });
  useEffect(() => {
    const previous = lastMilestone.current;
    if (previous.run !== state.run) {
      cancelBiteAudio();
    } else if (state.phase === 'finished' && !previous.finished) {
      milestoneFeedback(settings, 'complete', state.stage);
    } else if (state.stage > previous.stage) {
      milestoneFeedback(settings, 'transition', state.stage);
    }
    lastMilestone.current = { run: state.run, stage: state.stage, finished: state.phase === 'finished' };
  }, [state.run, state.stage, state.phase, settings]);

  const bite = useCallback(() => {
    if (chewTimer.current || state.phase !== 'idle' || contextLost || !hitReady || !hit.current) return;
    const finishing = state.bites === food.stages[state.stage]!.bites - 1;
    const role = finishing ? 'finish' : state.bites === 0 ? 'bite' : 'chew';
    impulse(motion, finishing ? 1 : 0.65);
    biteFeedback(settings, food.sound, role);
    setChewing(true);
    if (!finishing) dispatch({ type: 'BITE' });
    chewTimer.current = setTimeout(() => {
      chewTimer.current = null;
      setChewing(false);
      if (finishing) dispatch({ type: 'BITE' });
    }, CHEW_SECONDS * 1000);
  }, [contextLost, food.stages, food.sound, hitReady, motion, settings, state.bites, state.phase, state.stage]);
  const playable = state.phase === 'idle' && !chewing && !contextLost && hitReady;
  const input = useFoodInput(motion, hit, playable, bite, settings.sensitivity);
  const current = entries[state.stage];
  const base = entries[0];
  const needed = state.phase === 'loading' ? 0 : state.phase === 'waiting' ? state.stage + 1 : -1;
  const error = needed >= 0 && entries[needed]?.status === 'error';
  const status = contextLost ? '三维画面已中断，请重新加载画面。' : error ? `${food.name}加载失败，重试后继续。` : state.phase === 'loading' ? `${food.name}正在上桌…` : state.phase === 'waiting' ? '下一阶段正在准备…' : state.phase === 'finished' ? '吃光了。刚刚好。' : state.phase === 'final' ? '这一口，刚刚好。' : '点击食物吃一口，拖动转一转';

  return <main className="experience" data-testid="experience" data-food={food.id} data-stage={state.stage} data-bites={state.bites} data-phase={state.phase} data-hit-ready={hitReady}>
    <AppHeader settings={settings} onSettingsChange={onSettingsChange} onBack={onBack} />
    <div className="play-meta"><Progress stage={state.stage} bites={state.bites} stages={food.stages} /></div>
    <section className={`stage${state.phase === 'finished' ? ' empty' : ''}`} aria-label="食物空间">
      {state.phase === 'finished' && <div className="finished-state"><div className="finished-stamp">吃光了</div><h2>刚刚好</h2><p>这一刻，值得再来一次。</p></div>}
      {state.phase !== 'finished' && <SceneBoundary><div className="food-input" role="button" tabIndex={0} aria-label={food.name} aria-describedby="food-hint" aria-disabled={!playable} data-hit-ready={hitReady} {...input} onContextMenu={event => event.preventDefault()}>
        {!contextLost && current?.status === 'ready' && base?.status === 'ready' && <Scene asset={current.asset} base={base.asset} state={state} motion={motion} stage={food.stages[state.stage]!} reduced={reduced} dispatch={event => dispatch(event)} setHit={setHit} onContextLost={handleContextLost} />}
      </div></SceneBoundary>}
    </section>
    <footer className="action-dock">
      <div className="food-detail"><div><p className="food-caption">{state.phase === 'finished' ? '片刻满足' : `阶段 ${state.stage + 1} / ${food.stages.length}`}</p><h2>{state.phase === 'finished' ? '刚刚好' : food.name}</h2></div>{state.phase !== 'finished' && <p className="interaction-hint" id="food-hint"><span>{chewing ? '慢慢嚼，享受这一口' : '轻点品尝'}</span><span>拖动，换个角度</span></p>}</div>
      {(error || contextLost) && <p className="error-message" role="status" aria-live="polite">{status}</p>}
      {error ? <button className="primary-button" type="button" onClick={() => { void store.retry(needed); }}>重试加载</button>
        : contextLost ? <button className="primary-button" type="button" onClick={() => setContextLost(false)}>重试画面</button>
        : state.phase === 'finished' ? <div className="tasting-finished-actions"><button className="primary-button" type="button" onClick={onBack}>选规格，加入点单</button><button className="back-button" type="button" onClick={() => { Object.assign(motion, createMotion()); dispatch({ type: 'RESTART' }); }}>再吃一次</button></div>
        : (state.phase === 'loading' || state.phase === 'waiting') && <p className="loading-status" role="status">{status}</p>}
    </footer>
  </main>;
}

function browserStorage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

type OrderScreen = 'menu' | 'detail' | 'tasting' | 'cart' | 'review' | 'result';
const emptyDraft = (): MenuItemDraft => ({ choices: {}, quantity: 1, note: '' });

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => readSettings());
  const [table, setTable] = useState(() => parseTable(window.location.search));
  const [cart, setCart] = useState(() => readCart(browserStorage()));
  const [order, setOrder] = useState(() => readOrder(browserStorage()));
  const [screen, setScreen] = useState<OrderScreen>(() => {
    const restored = readOrder(browserStorage());
    return restored && restored.table === parseTable(window.location.search) && readCart(browserStorage()).length === 0 ? 'result' : 'menu';
  });
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [draft, setDraft] = useState<MenuItemDraft>(emptyDraft);
  const [category, setCategory] = useState('全部');
  const menuScroll = useRef(0);
  const leaveMenu = (next: OrderScreen) => { menuScroll.current = window.scrollY; setScreen(next); };
  const [error, setError] = useState('');
  const updateSettings = useCallback((next: Settings) => { setSettings(next); saveSettings(next); }, []);
  useEffect(() => {
    if (!saveCart(browserStorage(), cart)) setError('无法保存点单，请检查浏览器存储权限。当前选择仍保留在此页面。');
  }, [cart]);
  useEffect(() => {
    window.scrollTo(0, screen === 'menu' ? menuScroll.current : 0);
    const heading = document.querySelector<HTMLElement>('.ordering-app h1, .ordering-app h2');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  }, [screen]);
  const demoTable = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('table', 'A01');
    window.history.replaceState(null, '', url);
    setTable('A01');
  };
  const openItem = (item: MenuItem) => { setSelected(item); setDraft(emptyDraft()); leaveMenu('detail'); };
  const submit = () => {
    if (!table || !cart.length) return;
    const next = createDemoOrder(table, cart);
    if (!saveOrder(browserStorage(), next)) {
      setError('订单未保存，请允许浏览器存储后重试。你的购物车已保留。');
      return;
    }
    setOrder(next); setCart([]); setError(''); setScreen('result');
  };
  if (screen === 'tasting' && selected?.foodId) return <PlayScreen key={selected.foodId} food={foodById(selected.foodId)} settings={settings} onSettingsChange={updateSettings} onBack={() => setScreen('detail')} />;
  return <main className="ordering-app">
    {screen === 'menu' && <>
      <div className="ordering-tools"><HelpSheet /><SettingsSheet settings={settings} onChange={updateSettings} /></div>
      <MenuHome table={table} items={menuItems} onOpen={openItem} onCart={() => leaveMenu('cart')} category={category} onCategoryChange={setCategory} cartCount={cart.reduce((count, line) => count + line.quantity, 0)} total={cartTotal(cart)} onDemoTable={demoTable} />
    </>}
    {screen === 'detail' && selected && <MenuItemDetail item={selected} draft={draft} onDraftChange={setDraft} onClose={() => setScreen('menu')} onTaste={() => setScreen('tasting')} onAdd={(choices, quantity, note) => {
      setCart(current => addLine(current, selected, Object.entries(choices).map(([groupId, choiceId]) => ({ groupId, choiceId })), quantity, note));
      setScreen('menu');
    }} />}
    {screen === 'cart' && <CartSheet lines={cart} onClose={() => setScreen('menu')} onQuantity={(id, quantity) => setCart(current => setLineQuantity(current, id, quantity))} onReview={() => { setError(''); setScreen('review'); }} />}
    {screen === 'review' && <OrderReview table={table} lines={cart} onBack={() => setScreen('cart')} onSubmit={submit} onDemoTable={demoTable} error={error} />}
    {screen === 'result' && order && <OrderResult order={order} onMenu={() => setScreen('menu')} />}
    {error && screen !== 'review' && <p className="order-storage-error" role="alert">{error}</p>}
  </main>;
}
