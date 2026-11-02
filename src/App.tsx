import { useCallback, useEffect, useReducer, useRef, useState, useSyncExternalStore } from 'react';
import { foods, type FoodDefinition } from './data/foods';
import { createSequenceState, sequenceReducer, type SequenceEvent } from './core/sequence';
import { readSettings, saveSettings, type Settings } from './core/settings';
import { biteFeedback, primeBiteAudio } from './core/feedback';
import { createModelStore } from './scene/assets';
import { createMotion, impulse } from './scene/motion';
import { CHEW_SECONDS } from './scene/bite-effects';
import { Scene, type HitTest } from './scene/Scene';
import { useFoodInput } from './ui/useFoodInput';
import { SceneBoundary } from './ui/SceneBoundary';
import { HelpSheet } from './ui/HelpSheet';
import { SettingsSheet } from './ui/SettingsSheet';
import { FoodPicker } from './ui/FoodPicker';
import { Progress } from './ui/Progress';

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
  return <div className="brand"><svg className="brand-mark" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M6 14c0-6 4.5-10 10-10s10 4 10 10H6ZM6 23h20c0 3-4 5-10 5S6 26 6 23Z" fill="currentColor"/><path d="m6 18 5 2 5-2 5 2 5-2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg><h1>食刻</h1></div>;
}

function AppHeader({ settings, onSettingsChange, onBack }: { settings: Settings; onSettingsChange: (settings: Settings) => void; onBack?: () => void }) {
  return <header className="masthead">
    {onBack ? <button className="back-button" type="button" onClick={onBack}><span aria-hidden="true">←</span> 食物柜</button> : <Brand />}
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
  useEffect(() => { primeBiteAudio(food.sound); }, [food.sound]);
  useEffect(() => {
    entries.forEach((entry, stage) => { if (entry.status === 'ready') dispatch({ type: 'READY', stage, run: state.run }); });
  }, [entries, state.run]);

  const bite = useCallback(() => {
    if (chewTimer.current || state.phase !== 'idle' || contextLost || !hitReady || !hit.current) return;
    const total = food.stages[state.stage]!.bites;
    const finishing = state.bites === total - 1;
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
  }, [contextLost, food.stages, hitReady, motion, settings, state.bites, state.phase, state.stage]);
  const playable = state.phase === 'idle' && !chewing && !contextLost && hitReady;
  const input = useFoodInput(motion, hit, playable, bite, settings.sensitivity);
  const current = entries[state.stage];
  const base = entries[0];
  const needed = state.phase === 'loading' ? 0 : state.phase === 'waiting' ? state.stage + 1 : -1;
  const error = needed >= 0 && entries[needed]?.status === 'error';
  const status = contextLost ? '三维画面已中断，请重新加载画面。' : error ? `${food.name}加载失败，重试后继续。` : state.phase === 'loading' ? `${food.name}正在上桌…` : state.phase === 'waiting' ? '下一阶段正在准备…' : state.phase === 'finished' ? '吃光了。刚刚好。' : state.phase === 'final' ? '这一口，刚刚好。' : '点击食物吃一口，拖动转一转';

  return <main className="experience" data-testid="experience" data-food={food.id} data-stage={state.stage} data-bites={state.bites} data-phase={state.phase} data-hit-ready={hitReady}>
    <AppHeader settings={settings} onSettingsChange={onSettingsChange} onBack={onBack} />
    <div className="play-meta"><div><span className="play-kicker">正在品尝</span><h2>{food.name}</h2></div><Progress stage={state.stage} bites={state.bites} stages={food.stages} /></div>
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
        : state.phase === 'finished' ? <button className="primary-button" type="button" onClick={() => { Object.assign(motion, createMotion()); dispatch({ type: 'RESTART' }); }}>再吃一次</button>
        : (state.phase === 'loading' || state.phase === 'waiting') && <p className="loading-status" role="status">{status}</p>}
    </footer>
  </main>;
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => readSettings());
  const [selected, setSelected] = useState<FoodDefinition | null>(null);
  const updateSettings = useCallback((next: Settings) => { setSettings(next); saveSettings(next); }, []);
  return selected
    ? <PlayScreen key={selected.id} food={selected} settings={settings} onSettingsChange={updateSettings} onBack={() => setSelected(null)} />
    : <main className="shell"><AppHeader settings={settings} onSettingsChange={updateSettings} /><FoodPicker foods={foods} onStart={setSelected} /></main>;
}
