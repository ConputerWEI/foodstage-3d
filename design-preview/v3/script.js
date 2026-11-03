import * as THREE from '../../node_modules/three/build/three.module.js';
import { OrbitControls } from '../../node_modules/three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from '../../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from '../../node_modules/three/examples/jsm/environments/RoomEnvironment.js';

const dishes = {
  burger: { name: '经典汉堡', category: 'THE SIGNATURE / 主厨推荐', description: '炙烤牛肉饼、切达芝士与脆生菜，夹进松软芝麻面包。', price: 32, image: '../../public/foods/classic-burger.svg', options: [{ name: '辣度', choices: [{ label: '不辣', delta: 0 }, { label: '微辣', delta: 0 }] }, { name: '芝士', choices: [{ label: '标准芝士', delta: 0 }, { label: '双份芝士', delta: 3 }] }] },
  fries: { name: '迷迭香薯条', category: 'SIDES / 现炸小食', description: '带皮粗薯现炸至金黄，撒上海盐与迷迭香，配番茄蘸酱。', price: 18, image: '../../public/foods/rosemary-fries.svg', options: [{ name: '份量', choices: [{ label: '标准份', delta: 0 }, { label: '分享大份', delta: 8 }] }] },
  soda: { name: '鲜柠气泡饮', category: 'DRINKS / 清爽特调', description: '鲜切柠檬与清爽气泡水，薄荷提香，搭配汉堡刚刚好。', price: 16, image: '../../public/foods/lemon-soda.svg', options: [{ name: '冰量', choices: [{ label: '正常冰', delta: 0 }, { label: '少冰', delta: 0 }, { label: '去冰', delta: 0 }] }] },
};
const pages = [...document.querySelectorAll('.page')];
const dock = document.querySelector('#cart-dock');
let selected = 'burger';
let quantity = 1;
let choices = Object.fromEntries(dishes.burger.options.map(group => [group.name, 0]));
let cart = [];
let currentPage = 'menu';
const money = value => `¥${value.toFixed(2)}`;
function go(id) {
  currentPage = id;
  pages.forEach(page => page.classList.toggle('active', page.id === id));
  dock.classList.toggle('visible', id === 'menu' && cart.length > 0);
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (id === 'cart') renderCart();
}
document.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => go(button.dataset.page)));
document.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.categories button').forEach(category => category.classList.toggle('selected', category === button));
  document.querySelectorAll('.dish').forEach(dish => dish.classList.toggle('hidden', button.dataset.category !== 'all' && dish.dataset.category !== button.dataset.category));
}));
function openDish(id) {
  selected = id;
  quantity = 1;
  choices = Object.fromEntries(dishes[id].options.map(group => [group.name, 0]));
  document.querySelector('#order-note').value = '';
  renderDish();
  go('detail');
}
document.querySelectorAll('[data-dish]').forEach(button => button.addEventListener('click', event => { if (!event.target.closest('canvas')) openDish(button.dataset.dish); }));
function unitPrice() { return dishes[selected].price + dishes[selected].options.reduce((total, group) => total + group.choices[choices[group.name]].delta, 0); }
function renderDish() {
  const dish = dishes[selected];
  document.querySelector('#detail-name').textContent = dish.name;
  document.querySelector('#detail-category').textContent = dish.category;
  document.querySelector('#detail-description').textContent = dish.description;
  document.querySelector('#detail-price').textContent = money(dish.price);
  document.querySelector('#detail-image').src = dish.image;
  document.querySelector('#detail-image').alt = dish.name;
  document.querySelector('#detail-image').classList.toggle('hidden', selected === 'burger' && modelReady);
  document.querySelector('#detail-model').classList.toggle('hidden', selected !== 'burger');
  document.querySelector('#detail-3d-note').classList.toggle('hidden', selected !== 'burger');
  document.querySelector('#detail-object').textContent = `OBJECT 0${Object.keys(dishes).indexOf(selected) + 1} / 03`;
  document.querySelector('#taste').classList.toggle('hidden', selected !== 'burger');
  document.querySelector('#detail-options').innerHTML = dish.options.map(group => `<fieldset class="option-group"><legend>${group.name}</legend><div class="option-choices">${group.choices.map((choice, index) => `<button class="${choices[group.name] === index ? 'selected' : ''}" data-option="${group.name}" data-choice="${index}">${choice.label}${choice.delta ? `<small>+¥${choice.delta}.00</small>` : ''}</button>`).join('')}</div></fieldset>`).join('');
  document.querySelectorAll('[data-option]').forEach(button => button.addEventListener('click', () => { choices[button.dataset.option] = Number(button.dataset.choice); renderDish(); }));
  updateQuantity();
}
function updateQuantity() {
  document.querySelector('#quantity').textContent = quantity;
  document.querySelector('#minus').disabled = quantity <= 1;
  document.querySelector('#add-total').textContent = money(unitPrice() * quantity);
}
document.querySelector('#minus').addEventListener('click', () => { quantity = Math.max(1, quantity - 1); updateQuantity(); });
document.querySelector('#plus').addEventListener('click', () => { quantity = Math.min(99, quantity + 1); updateQuantity(); });
function cartTotal() { return cart.reduce((total, line) => total + line.price * line.quantity, 0); }
function updateCart() {
  const count = cart.reduce((total, line) => total + line.quantity, 0);
  document.querySelector('#bag-count').textContent = count;
  document.querySelector('#dock-count').textContent = count;
  document.querySelector('#dock-total').textContent = money(cartTotal());
  dock.classList.toggle('visible', currentPage === 'menu' && count > 0);
}
let toastTimer;
document.querySelector('#add-order').addEventListener('click', () => {
  const dish = dishes[selected];
  const labels = dish.options.map(group => group.choices[choices[group.name]].label);
  const note = document.querySelector('#order-note').value.trim();
  const existing = cart.find(line => line.id === selected && line.options.join() === labels.join() && line.note === note);
  if (existing) existing.quantity += quantity;
  else cart.push({ id: selected, name: dish.name, image: dish.image, price: unitPrice(), quantity, options: labels, note });
  updateCart();
  go('menu');
  const toast = document.querySelector('#toast');
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
});
function renderCart() {
  const container = document.querySelector('#cart-content');
  if (!cart.length) {
    container.innerHTML = '<div class="cart-empty"><p>还没有选好这一餐。<br />去菜单里，看看今天的好味道。</p><button class="add-order" data-empty-menu>去点菜 <span>→</span></button></div>';
    container.querySelector('[data-empty-menu]').addEventListener('click', () => go('menu'));
    return;
  }
  container.innerHTML = cart.map((line, index) => `<div class="cart-line"><img src="${line.image}" alt="${line.name}" /><div><h3>${line.name}</h3><p>${line.options.join(' · ')}</p>${line.note ? `<p>备注：${line.note.replace(/[<>&"]/g, '')}</p>` : ''}</div><div class="cart-line-price"><strong>${money(line.price * line.quantity)}</strong><div><button data-quantity="${index}" data-change="-1" aria-label="减少${line.name}">−</button><span>${line.quantity}</span><button data-quantity="${index}" data-change="1" aria-label="增加${line.name}">+</button></div></div></div>`).join('') + `<div class="cart-summary"><div><span>共 ${cart.reduce((total, line) => total + line.quantity, 0)} 件 · A01 桌</span><strong>${money(cartTotal())}</strong></div><button class="add-order" id="submit-order">确认点单 <span>→</span></button><small>这是设计预览，提交后不会扣款，也不会发送到后厨。</small></div>`;
  container.querySelectorAll('[data-quantity]').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.quantity);
    cart[index].quantity += Number(button.dataset.change);
    if (cart[index].quantity <= 0) cart.splice(index, 1);
    updateCart(); renderCart();
  }));
  container.querySelector('#submit-order').addEventListener('click', () => {
    document.querySelector('#result-number').textContent = `FS ${String(Math.floor(Math.random() * 9000) + 1000)}`;
    cart = []; updateCart(); go('result');
  });
}
let bites = 0;
let chewing = false;
let tastingClick = false;
document.querySelector('#taste-model').addEventListener('click', () => {
  if (!tastingClick || chewing || bites >= 16) return;
  chewing = true; bites += 1;
  document.querySelector('#taste-count').textContent = bites;
  document.querySelector('#taste-stage').textContent = `阶段 0${Math.floor((bites - 1) / 4) + 1} / 04`;
  document.querySelector('#taste-status').textContent = bites === 16 ? '吃光了，刚刚好。' : '慢慢嚼，享受这一口。';
  document.querySelectorAll('.taste-bars i').forEach((bar, index) => bar.classList.toggle('eaten', index < ((bites - 1) % 4 + 1)));
  setTimeout(() => { chewing = false; }, 550);
});

let modelReady = false;
const loader = new GLTFLoader();
const viewers = [];
function mountModel(id, isTasting = false) {
  const mount = document.querySelector(`#${id}`);
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  mount.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', '可拖动旋转的经典汉堡3D模型');
  const camera = new THREE.PerspectiveCamera(34, 1, .001, 100);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, .04).texture;
  scene.environmentIntensity = .35;
  room.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight('#fff6e8', '#665344', 1.2));
  const key = new THREE.DirectionalLight('#fff0da', 3.5); key.position.set(-2.5, 3, 2); scene.add(key);
  const fill = new THREE.DirectionalLight('#edf4ff', 1.2); fill.position.set(2, 1, 1); scene.add(fill);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.enablePan = false; controls.enableZoom = false;
  controls.minPolarAngle = Math.PI * .18; controls.maxPolarAngle = Math.PI * .72;
  controls.rotateSpeed = .65;
  loader.load('../../public/models-desktop/burger-0.glb', gltf => {
    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);
    scene.add(model);
    const radius = size.length() / 2;
    const distance = radius * 1.1 / Math.sin(camera.fov * Math.PI / 360);
    camera.position.set(0, distance * .2, distance);
    camera.lookAt(0, 0, 0);
    controls.update();
    modelReady = true;
    if (id === 'menu-model') document.querySelector('.model-fallback').classList.add('hidden');
    if (id === 'detail-model' && selected === 'burger') document.querySelector('#detail-image').classList.add('hidden');
    if (isTasting) tastingClick = true;
  }, undefined, () => { mount.classList.add('hidden'); });
  const resize = () => {
    const width = mount.clientWidth, height = mount.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(mount); resize();
  viewers.push({ scene, camera, renderer, controls, mount });
}
mountModel('menu-model'); mountModel('detail-model'); mountModel('taste-model', true);
function animate() { requestAnimationFrame(animate); viewers.forEach(viewer => { if (viewer.mount.clientWidth && viewer.mount.clientHeight) { viewer.controls.update(); viewer.renderer.render(viewer.scene, viewer.camera); } }); }
animate();
renderDish(); updateCart();
