const pages = [...document.querySelectorAll('.page')];
const about = document.querySelector('.about-panel');
const toggle = document.querySelector('.menu-toggle');
function go(id) {
  pages.forEach(page => page.classList.toggle('active', page.id === id));
  about.classList.remove('open');
  about.setAttribute('aria-hidden', 'true');
  toggle.setAttribute('aria-expanded', 'false');
  window.scrollTo({ top: 0, behavior: 'instant' });
}
document.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => go(button.dataset.go)));
toggle.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(open));
  about.setAttribute('aria-hidden', String(!open));
  about.classList.toggle('open', open);
});
document.addEventListener('keydown', event => { if (event.key === 'Escape') go('home'); });
const sound = document.querySelector('.sound-button');
sound.addEventListener('click', () => {
  const active = sound.getAttribute('aria-pressed') !== 'true';
  sound.setAttribute('aria-pressed', String(active));
  sound.querySelector('span').textContent = active ? 'ON' : 'OFF';
});
const burger = document.querySelector('#burger');
const status = document.querySelector('#play-status');
const bars = [...document.querySelectorAll('.bite-track i')];
let bites = 0;
let chewing = false;
function reset() {
  bites = 0;
  bars.forEach(bar => bar.classList.remove('eaten'));
  document.querySelector('#bite-number').textContent = '0';
  document.querySelector('#stage-number').textContent = '01';
  status.innerHTML = '轻点食物，品尝第一口。<br />或者拖动它，换个角度看看。';
}
document.querySelector('.light-button').addEventListener('click', reset);
burger.addEventListener('click', () => {
  if (chewing || bites >= 16) return;
  chewing = true;
  bites += 1;
  burger.classList.remove('bite');
  void burger.offsetWidth;
  burger.classList.add('bite');
  bars.forEach((bar, index) => bar.classList.toggle('eaten', index < ((bites - 1) % 4 + 1)));
  document.querySelector('#bite-number').textContent = bites;
  document.querySelector('#stage-number').textContent = String(Math.floor((bites - 1) / 4) + 1).padStart(2, '0');
  status.textContent = bites === 16 ? '十六口，刚刚好。谢谢你的品尝。' : '慢慢嚼，这一口值得认真享受。';
  setTimeout(() => { chewing = false; if (bites < 16) status.textContent = '准备好了，就再来一口。'; }, 550);
});
let drag = null;
burger.addEventListener('pointerdown', event => { drag = event.clientX; burger.setPointerCapture(event.pointerId); });
burger.addEventListener('pointermove', event => { if (drag === null) return; burger.style.transform = `rotate(${Math.max(-15, Math.min(15, (event.clientX - drag) / 9))}deg)`; });
burger.addEventListener('pointerup', () => { drag = null; burger.style.transform = ''; });
