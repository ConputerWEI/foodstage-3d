import { useId, useRef } from 'react';
import { Settings as SettingsIcon, X } from 'lucide-react';
import type { Settings } from '../core/settings';

export interface SettingsSheetProps {
  settings: Settings;
  onChange: (settings: Settings) => void;
}

export function SettingsSheet({ settings, onChange }: SettingsSheetProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  return <>
    <button className="icon-button settings-trigger" aria-label="设置" onClick={() => dialog.current?.showModal()}>
      <SettingsIcon size={22} strokeWidth={1.8} aria-hidden="true" />
    </button>
    <dialog ref={dialog} className="settings-sheet" aria-labelledby={titleId} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="sheet-content">
        <div className="sheet-heading">
          <h2 id={titleId}>玩得顺手</h2>
          <button className="icon-button" type="button" aria-label="关闭设置" onClick={() => dialog.current?.close()}>
            <X size={22} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
        <div className="settings-fields">
          <label className="setting-switch"><span>声音</span><input type="checkbox" checked={settings.sound} onChange={event => update('sound', event.currentTarget.checked)} /></label>
          <label className="setting-switch"><span>触感</span><input type="checkbox" checked={settings.haptics} onChange={event => update('haptics', event.currentTarget.checked)} /></label>
          <label className="setting-control"><span>动态效果</span><select value={settings.motion} onChange={event => update('motion', event.currentTarget.value as Settings['motion'])}><option value="system">跟随系统</option><option value="reduced">减少动态</option><option value="full">完整动态</option></select></label>
          <label className="setting-control"><span>灵敏度 <output>{settings.sensitivity.toFixed(2)}</output></span><input type="range" min="0.5" max="1.5" step="0.05" value={settings.sensitivity} onChange={event => update('sensitivity', Number(event.currentTarget.value))} /></label>
        </div>
        <button className="primary-button" type="button" onClick={() => dialog.current?.close()}>完成</button>
      </div>
    </dialog>
  </>;
}
