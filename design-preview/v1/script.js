const screens = [...document.querySelectorAll('.screen')];
const show = (id) => {
  screens.forEach(screen => screen.classList.toggle('active', screen.id === id));
  window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
};
document.querySelectorAll('[data-screen]').forEach(button => button.addEventListener('click', () => show(button.dataset.screen)));
const sound = document.querySelector('.sound');
sound.addEventListener('click', () => {
  const active = sound.getAttribute('aria-pressed') !== 'true';
  sound.setAttribute('aria-pressed', String(active));
  sound.firstChild.textContent = active ? '♫ ' : '♪ ';
});
const burger = document.querySelector('.stage-burger');
const status = document.querySelector('#bite-status');
let bites = 0;
let chewing = false;
burger.addEventListener('click', () => {
  if (chewing) return;
  chewing = true;
  bites = Math.min(bites + 1, 16);
  burger.classList.remove('biting');
  void burger.offsetWidth;
  burger.classList.add('biting');
  status.textContent = bites === 16 ? '十六口满足，刚刚好。' : '慢慢嚼，享受这一口。';
  document.querySelectorAll('.journey-step').forEach((step, index) => {
    const eaten = Math.max(0, Math.min(4, bites - index * 4));
    step.querySelector('small').textContent = `${eaten} / 4 口`;
    step.querySelector('i').textContent = '● '.repeat(eaten) + '○ '.repeat(4 - eaten);
    step.classList.toggle('complete', eaten === 4);
    step.classList.toggle('current', Math.floor(Math.min(bites, 15) / 4) === index);
  });
  document.querySelector('.stage-tag b').textContent = `STAGE 0${Math.floor(Math.min(bites, 15) / 4) + 1} / 04`;
  setTimeout(() => { chewing = false; if (bites < 16) status.textContent = '好吃就再来一口，不着急。'; }, 550);
});
let drag = null;
burger.addEventListener('pointerdown', event => { drag = { x: event.clientX, rotation: 0 }; burger.setPointerCapture(event.pointerId); });
burger.addEventListener('pointermove', event => { if (!drag) return; drag.rotation = Math.max(-18, Math.min(18, (event.clientX - drag.x) / 8)); burger.style.transform = `rotate(${drag.rotation}deg)`; });
burger.addEventListener('pointerup', () => { drag = null; burger.style.transform = ''; });
document.querySelectorAll('[data-stage]').forEach(button => button.addEventListener('click', () => { status.textContent = `第 ${Number(button.dataset.stage) + 1} 阶段 · 品尝进度将在实际版本中与 3D 模型同步。`; }));
