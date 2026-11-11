import { useCallback, useEffect, useReducer, useRef, useState, useSyncExternalStore } from 'react';
import { foodById, type FoodDefinition } from './data/foods';
import { menuItemById, menuItems, type MenuItem } from './data/menu';
import { addLine, cartTotal, readCart, saveCart, setLineQuantity } from './core/cart';
import { createDemoOrder, readOrder, saveOrder } from './core/orders';
import { parseTable } from './core/table';
import { OrderWelcome } from './ui/OrderWelcome';
import { parseDining, validGuests, type DiningChoice } from './core/dining';
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
import { ArrowLeft, Minus, Pause, Play, Plus, RotateCcw } from 'lucide-react';

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

function PlayScreen({ item, food, settings, reduced, onSettingsChange, onBack }: { item: MenuItem; food: FoodDefinition; settings: Settings; reduced: boolean; onSettingsChange: (settings: Settings) => void; onBack: () => void }) {
  const [store] = useState(() => createModelStore(food.stages));
  const entries = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const reducer = useCallback((state: ReturnType<typeof createSequenceState>, event: SequenceEvent) => sequenceReducer(food.stages, state, event), [food.stages]);
  const [state, dispatch] = useReducer(reducer, undefined, () => createSequenceState(food.stages));
  const [motion] = useState(createMotion);
  const [zoom, setZoom] = useState(1);
  const [spinning, setSpinning] = useState(true);
  const zoomBy = useCallback((factor: number) => {
    motion.idle = 0;
    setZoom(current => Math.max(0.7, Math.min(2, current * factor)));
  }, [motion]);
  const resetView = () => {
    Object.assign(motion, { x: 0, y: 0, vx: 0, vy: 0, hoverPitch: 0, hoverYaw: 0, idle: 0 });
    setZoom(1);
  };
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
    biteFeedback(settings, food.sound, role, food.interaction);
    setChewing(true);
    if (!finishing) dispatch({ type: 'BITE' });
    chewTimer.current = setTimeout(() => {
      chewTimer.current = null;
      setChewing(false);
      if (finishing) dispatch({ type: 'BITE' });
    }, CHEW_SECONDS * 1000);
  }, [contextLost, food.stages, food.sound, food.interaction, hitReady, motion, settings, state.bites, state.phase, state.stage]);
  const playable = state.phase === 'idle' && !chewing && !contextLost && hitReady;
  const input = useFoodInput(motion, hit, playable, bite, settings.sensitivity, zoomBy);
  const current = entries[state.stage];
  const base = entries[0];
  const needed = state.phase === 'loading' ? 0 : state.phase === 'waiting' ? state.stage + 1 : -1;
  const error = needed >= 0 && entries[needed]?.status === 'error';
  const status = contextLost ? '三维画面已中断，请重新加载画面。' : error ? `${item.name}加载失败，重试后继续。` : state.phase === 'loading' ? `${item.name}正在上桌…` : state.phase === 'waiting' ? '下一阶段正在准备…' : state.phase === 'finished' ? '吃光了。刚刚好。' : state.phase === 'final' ? '这一口，刚刚好。' : '点击食物吃一口，拖动转一转';

  return <main className="experience" data-testid="experience" data-food={item.id} data-stage={state.stage} data-bites={state.bites} data-phase={state.phase} data-hit-ready={hitReady}>
    <AppHeader settings={settings} onSettingsChange={onSettingsChange} onBack={onBack} />
    <div className="play-meta"><Progress stage={state.stage} bites={state.bites} stages={food.stages} /></div>
    <section className={`stage${state.phase === 'finished' ? ' empty' : ''}`} aria-label="食物空间">
      {state.phase === 'finished' && <div className="finished-state"><div className="finished-stamp">吃光了</div><h2>刚刚好</h2><p>这一刻，值得再来一次。</p></div>}
      {state.phase !== 'finished' && <SceneBoundary><div className="food-input" role="button" tabIndex={0} aria-label={item.name} aria-describedby="food-hint" aria-disabled={!playable} data-hit-ready={hitReady} {...input} onContextMenu={event => event.preventDefault()}>
        {!contextLost && current?.status === 'ready' && base?.status === 'ready' && <Scene zoom={zoom} spinning={spinning} interaction={food.interaction} asset={current.asset} base={base.asset} state={state} motion={motion} stage={food.stages[state.stage]!} reduced={reduced} dispatch={event => dispatch(event)} setHit={setHit} onContextLost={handleContextLost} />}
      </div></SceneBoundary>}
      {hitReady && !contextLost && state.phase !== 'finished' && <div className="viewer-controls" role="group" aria-label="模型视角">
        {!reduced && <button type="button" aria-label={spinning ? '暂停自动旋转' : '开始自动旋转'} title={spinning ? '暂停自动旋转' : '开始自动旋转'} onClick={() => setSpinning(value => !value)}>{spinning ? <Pause /> : <Play />}</button>}
        <button type="button" aria-label="缩小模型" title="缩小模型" disabled={zoom <= 0.7} onClick={() => zoomBy(1 / 1.2)}><Minus /></button>
        <output aria-label="模型缩放比例">{Math.round(zoom * 100)}%</output>
        <button type="button" aria-label="放大模型" title="放大模型" disabled={zoom >= 2} onClick={() => zoomBy(1.2)}><Plus /></button>
        <button type="button" aria-label="重置视角" title="重置视角" onClick={resetView}><RotateCcw /></button>
      </div>}
    </section>
    <footer className="action-dock">
      <div className="food-detail"><div><p className="food-caption">{state.phase === 'finished' ? '片刻满足' : `阶段 ${state.stage + 1} / ${food.stages.length}`}</p><h2>{state.phase === 'finished' ? '刚刚好' : item.name}</h2></div>{state.phase !== 'finished' && <p className="interaction-hint" id="food-hint"><span>{chewing ? '慢慢嚼，享受这一口' : '轻点品尝'}</span><span>拖动，换个角度</span></p>}</div>
      {(error || contextLost) && <p className="error-message" role="status" aria-live="polite">{status}</p>}
      {error ? <button className="primary-button" type="button" onClick={() => { void store.retry(needed); }}>重试加载</button>
        : contextLost ? <button className="primary-button" type="button" onClick={() => setContextLost(false)}>重试画面</button>
        : state.phase === 'finished' ? <div className="tasting-finished-actions"><button className="primary-button" type="button" onClick={onBack}>{item.available ? '选规格，加入点单' : '返回菜品'}</button><button className="back-button" type="button" onClick={() => { Object.assign(motion, createMotion()); setZoom(1); dispatch({ type: 'RESTART' }); }}>再吃一次</button></div>
        : (state.phase === 'loading' || state.phase === 'waiting') && <p className="loading-status" role="status">{status}</p>}
    </footer>
  </main>;
}

function browserStorage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

type OrderScreen = 'welcome' | 'menu' | 'detail' | 'tasting' | 'cart' | 'review' | 'result';
const emptyDraft = (): MenuItemDraft => ({ choices: {}, quantity: 1, note: '' });

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => readSettings());
  const systemReduced = useSystemReducedMotion();
  const reducedMotion = settings.motion === 'reduced' || (settings.motion === 'system' && systemReduced);
  const [table, setTable] = useState(() => parseTable(window.location.search));
  const [dining, setDining] = useState(() => parseDining(window.location.search));
  const [cart, setCart] = useState(() => readCart(browserStorage()));
  const [order, setOrder] = useState(() => readOrder(browserStorage()));
  const [selected, setSelected] = useState<MenuItem | null>(() => {
    const id = new URLSearchParams(window.location.search).get('item');
    return id ? menuItemById(id) ?? null : null;
  });
  const [screen, setScreen] = useState<OrderScreen>(() => {
    if (selected?.foodId && new URLSearchParams(window.location.search).get('view') === 'tasting') return 'tasting';
    if (selected) return 'detail';
    if (order && order.id === window.history.state?.receipt && !cart.length) return 'result';
    return dining ? 'menu' : 'welcome';
  });
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
    const url = new URL(window.location.href);
    if (screen !== 'tasting') url.searchParams.delete('view');
    if (screen !== 'detail' && screen !== 'tasting') url.searchParams.delete('item');
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url);
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
  const chooseDining = (mode: DiningChoice['mode'], guests?: number) => {
    const url = new URL(window.location.href);
    url.searchParams.set('mode', mode);
    if (mode === 'dine-in') {
      if (!validGuests(guests)) return;
      setDining({ mode, guests });
      url.searchParams.set('guests', String(guests));
    } else {
      setDining({ mode });
      url.searchParams.delete('guests');
    }
    window.history.replaceState({ ...window.history.state, receipt: null }, '', url);
    setScreen('menu');
  };
  const returnToMenu = () => setScreen(dining ? 'menu' : 'welcome');
  const openItem = (item: MenuItem) => { setSelected(item); setDraft(emptyDraft()); leaveMenu('detail'); };
  const submit = () => {
    if (!dining || (dining.mode === 'dine-in' && !table) || !cart.length) return;
    const next = createDemoOrder(table, cart, new Date(), dining);
    if (!saveOrder(browserStorage(), next)) {
      setError('订单未保存，请允许浏览器存储后重试。你的购物车已保留。');
      return;
    }
    window.history.replaceState({ ...window.history.state, receipt: next.id }, '');
    setOrder(next); setCart([]); setError(''); setScreen('result');
  };
  if (screen === 'tasting' && selected?.foodId) return <PlayScreen key={selected.id} item={selected} food={foodById(selected.foodId)} settings={settings} reduced={reducedMotion} onSettingsChange={updateSettings} onBack={() => setScreen('detail')} />;
  return <main className="ordering-app">
    {screen === 'welcome' && <OrderWelcome reducedMotion={reducedMotion} onChoose={chooseDining} />}
    {screen === 'menu' && <>
      <MenuHome reducedMotion={reducedMotion} tools={<><HelpSheet /><SettingsSheet settings={settings} onChange={updateSettings} /></>} table={table} dining={dining} onChooseDining={() => setScreen('welcome')} items={menuItems} onOpen={openItem} onCart={() => leaveMenu('cart')} category={category} onCategoryChange={setCategory} cartCount={cart.reduce((count, line) => count + line.quantity, 0)} total={cartTotal(cart)} onDemoTable={demoTable} />
    </>}
    {screen === 'detail' && selected && <MenuItemDetail item={selected} reducedMotion={reducedMotion} draft={draft} onDraftChange={setDraft} onClose={returnToMenu} onTaste={() => setScreen('tasting')} onAdd={(choices, quantity, note) => {
      setCart(current => addLine(current, selected, Object.entries(choices).map(([groupId, choiceId]) => ({ groupId, choiceId })), quantity, note));
      returnToMenu();
    }} />}
    {screen === 'cart' && <CartSheet lines={cart} onClose={() => setScreen('menu')} onQuantity={(id, quantity) => setCart(current => setLineQuantity(current, id, quantity))} onReview={() => { setError(''); setScreen('review'); }} />}
    {screen === 'review' && <OrderReview table={table} dining={dining} lines={cart} onBack={() => setScreen('cart')} onSubmit={submit} onDemoTable={demoTable} error={error} />}
    {screen === 'result' && order && <OrderResult order={order} onMenu={() => { window.history.replaceState({ ...window.history.state, receipt: null }, ''); returnToMenu(); }} />}
    {error && screen !== 'review' && <p className="order-storage-error" role="alert">{error}</p>}
  </main>;
}
