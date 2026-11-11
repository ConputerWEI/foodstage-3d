import { test, expect, type Locator, type Page } from '@playwright/test';
import { menuItemById, menuItems } from '../src/data/menu';

async function rotatePreview(page: Page, preview: Locator) {
  await preview.scrollIntoViewIfNeeded();
  await expect(preview).toHaveAttribute('data-ready', 'true');
  const bounds = (await preview.boundingBox())!;
  const before = await preview.getAttribute('data-rotation');
  await page.mouse.move(bounds.x + bounds.width * 0.25, bounds.y + bounds.height * 0.45);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.75, bounds.y + bounds.height * 0.45, { steps: 8 });
  await page.mouse.up();
  await expect(preview).not.toHaveAttribute('data-rotation', before!);
}

test('menu, hero and detail share cached mobile models across category changes', async ({ page }) => {
  const models: string[] = [];
  page.on('request', request => { if (/\.glb(?:\?|$)/.test(request.url())) models.push(request.url()); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?table=A01');
  const burgerCard = page.locator('.ordering-food-card').filter({ hasText: '经典汉堡' }).first();
  const preview = burgerCard.getByTestId('menu-model-preview');
  await expect(page.getByTestId('menu-model-preview')).toHaveCount(menuItems.length + 1);
  await expect(page.locator('.ordering-menu img')).toHaveCount(0);
  await rotatePreview(page, preview);
  expect(models.filter(url => url.includes('/burger-'))).toHaveLength(1);
  expect(models.map(url => new URL(url).pathname)).toContain('/models-mobile/burger-0.glb');
  await expect(page.locator('.ordering-menu')).toBeVisible();

  await page.getByRole('button', { name: '饮品', exact: true }).click();
  const drinks = page.locator('.ordering-food-card');
  const drinkCount = menuItems.filter(item => item.category === '饮品').length;
  await expect(drinks).toHaveCount(drinkCount);
  await expect(drinks.getByTestId('menu-model-preview')).toHaveCount(drinkCount);
  const drinkPreview = drinks.filter({ hasText: '鲜柠气泡饮' }).getByTestId('menu-model-preview');
  await drinkPreview.scrollIntoViewIfNeeded();
  await expect(drinkPreview).toHaveAttribute('data-ready', 'true');
  expect(models.filter(url => url.includes('/lemon-soda-'))).toHaveLength(1);
  await page.getByRole('button', { name: '查看鲜柠气泡饮' }).click();
  const detailPreview = page.locator('.ordering-detail-art').getByTestId('menu-model-preview');
  await expect(detailPreview).toHaveAttribute('data-ready', 'true');
  await rotatePreview(page, detailPreview);
  await expect(page.locator('.ordering-detail img')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '虚拟试吃', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /加入点单/ })).toBeEnabled();
  expect(models.filter(url => url.includes('/lemon-soda-'))).toHaveLength(1);

  await page.getByRole('button', { name: /返回菜单/ }).click();
  await page.getByRole('button', { name: '全部', exact: true }).click();
  await preview.scrollIntoViewIfNeeded();
  await expect(preview).toHaveAttribute('data-ready', 'true');
  expect(models.filter(url => url.includes('/burger-'))).toHaveLength(1);
  await page.getByRole('button', { name: '查看经典汉堡' }).click();
  await expect(detailPreview).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: '经典汉堡' })).toBeVisible();
  expect(models.filter(url => url.includes('/burger-'))).toHaveLength(1);
});

test('all four canned drinks have 3D previews and can be ordered without virtual tasting', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?table=A01');
  await page.getByRole('button', { name: '饮品', exact: true }).click();
  const cans = ['coca-cola', 'sprite', 'fanta-orange', 'coca-cola-no-sugar'].map(id => menuItemById(id)!);
  for (const can of cans) {
    const card = page.locator('.ordering-food-card').filter({ has: page.getByRole('heading', { name: can.name, exact: true }) });
    const thumbnail = card.getByTestId('menu-model-preview');
    await thumbnail.scrollIntoViewIfNeeded();
    await expect(thumbnail).toHaveAttribute('data-ready', 'true');
    await card.getByRole('button', { name: `查看${can.name}`, exact: true }).click();
    const detail = page.locator('.ordering-detail');
    await expect(detail.getByRole('heading', { level: 1 })).toHaveText(can.name);
    await expect(detail.getByTestId('menu-model-preview')).toHaveAttribute('data-ready', 'true');
    await expect(detail.getByRole('button', { name: '虚拟试吃', exact: true })).toHaveCount(0);
    await detail.getByRole('button', { name: '加入点单', exact: true }).click();
  }
  await page.getByRole('button', { name: /查看购物车/ }).click();
  const lines = page.locator('.cart-lines li');
  await expect(lines).toHaveCount(cans.length);
  for (const can of cans) await expect(lines.getByRole('heading', { name: can.name, exact: true })).toBeVisible();
  const total = cans.reduce((sum, item) => sum + item.price, 0);
  await expect(page.locator('.order-total')).toContainText(`¥${(total / 100).toFixed(2)}`);
});

test('desktop catalog gives every card one model and keeps sold-out ordering disabled', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?table=A01');
  const cards = page.locator('.ordering-food-card');
  await expect(cards).toHaveCount(menuItems.length);
  await expect(cards.getByTestId('menu-model-preview')).toHaveCount(menuItems.length);
  await expect(page.getByTestId('menu-model-preview')).toHaveCount(menuItems.length + 1);
  await expect(page.locator('.ordering-menu img')).toHaveCount(0);
  const first = await cards.nth(0).boundingBox();
  const second = await cards.nth(1).boundingBox();
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  expect(second!.y).toBeGreaterThan(first!.y + first!.height - 1);
  for (const card of await cards.all()) {
    await expect(card.locator('.ordering-food-thumbnail')).toHaveCount(1);
    await expect(card.getByTestId('menu-model-preview')).toHaveCount(1);
  }
  const soldOut = cards.filter({ hasText: '黑松露帕玛森薯条' });
  await soldOut.scrollIntoViewIfNeeded();
  await expect(soldOut.getByTestId('menu-model-preview')).toHaveAttribute('data-ready', 'true');
  await soldOut.getByRole('button', { name: '查看黑松露帕玛森薯条' }).click();
  const detailPreview = page.locator('.ordering-detail-art').getByTestId('menu-model-preview');
  await expect(detailPreview).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('button', { name: '暂时售罄', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '虚拟试吃', exact: true })).toHaveCount(0);
});

for (const width of [390, 1440]) {
  test(`hero rotates without navigation, opens on tap and supports keyboard activation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/?table=A01');
    const hero = page.getByRole('button', { name: '招牌推荐：经典汉堡', exact: true });
    const heroPreview = hero.getByTestId('menu-model-preview');
    await rotatePreview(page, heroPreview);
    await expect(page.locator('.ordering-menu')).toBeVisible();
    await expect(page.locator('.ordering-detail')).toHaveCount(0);
    const bounds = (await heroPreview.boundingBox())!;
    await heroPreview.click({ position: { x: bounds.width * 0.5, y: bounds.height * 0.45 } });
    const detailPreview = page.locator('.ordering-detail-art').getByTestId('menu-model-preview');
    await expect(detailPreview).toHaveAttribute('data-ready', 'true');
    await rotatePreview(page, detailPreview);
    await expect(page.getByRole('heading', { name: '经典汉堡', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /返回菜单/ }).click();
    await hero.focus();
    await page.keyboard.press('Enter');
    await expect(detailPreview).toHaveAttribute('data-ready', 'true');
    await expect(page.getByRole('button', { name: /加入点单/ })).toBeEnabled();
  });
}

test('burger preview resumes after scrolling out of view', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 480 });
  await page.goto('/?table=A01');
  const preview = page.locator('.ordering-food-card').filter({ hasText: '经典汉堡' }).first().getByTestId('menu-model-preview');
  await preview.scrollIntoViewIfNeeded();
  await expect(preview).toHaveAttribute('data-ready', 'true');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(preview.locator('canvas')).toHaveCount(0);
  // R3F releases its WebGL context asynchronously after unmount.
  await page.waitForTimeout(1000);
  await preview.scrollIntoViewIfNeeded();
  await expect(preview).toHaveAttribute('data-ready', 'true', { timeout: 10000 });
});

test('failed model leaves ordering usable and retries when returning to the menu', async ({ page }) => {
  let fail = true;
  await page.route('**/models-mobile/burger-0.glb', route => fail ? route.abort() : route.continue());
  await page.goto('/?table=A01');
  const preview = page.locator('.ordering-food-card').filter({ hasText: '经典汉堡' }).first().getByTestId('menu-model-preview');
  await expect(preview).toContainText('加载失败');
  await page.getByRole('button', { name: '查看经典汉堡' }).click();
  await expect(page.locator('.ordering-detail-art').getByTestId('menu-model-preview')).toContainText('加载失败');
  await expect(page.getByRole('button', { name: /加入点单/ })).toBeEnabled();
  fail = false;
  await page.getByRole('button', { name: /返回菜单/ }).click();
  await preview.scrollIntoViewIfNeeded();
  await expect(preview).toHaveAttribute('data-ready', 'true');
});
