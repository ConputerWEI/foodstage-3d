import { useRef } from 'react';
import { CircleHelp, X } from 'lucide-react';

export function HelpSheet() {
  const dialog = useRef<HTMLDialogElement>(null);
  return <>
    <button className="icon-button help-trigger" aria-label="使用说明" onClick={() => dialog.current?.showModal()}>
      <CircleHelp size={22} strokeWidth={1.8} aria-hidden="true" />
    </button>
    <dialog ref={dialog} className="help-sheet" aria-labelledby="help-title" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="sheet-content">
        <div className="sheet-heading"><h2 id="help-title">怎么吃</h2><button className="icon-button" aria-label="关闭说明" onClick={() => dialog.current?.close()}><X size={22} strokeWidth={1.8} aria-hidden="true" /></button></div>
        <p>直接轻点汉堡，就能品尝一口。</p>
        <p>拖动可以转着看，吃完可以再来一个。</p>
        <button className="primary-button" onClick={() => dialog.current?.close()}>知道了</button>
      </div>
    </dialog>
  </>;
}
