import { test, expect } from '@playwright/test';

test('menu previews rotate, survive category changes and reuse cached mobile models', async ({ page }) => {
  const models: string[] = [];
  page.on('request', request => { if (/\.glb(?:\?|$)/.test(request.url())) models.push(request.url()); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?table=A01');
  const burgerCard = page.locator('.ordering-food-card').filter({ hasText: '经典汉堡' }).first();
  await expect(burgerCard.getByRole('button', { name: '查看经典汉堡' })).toBeVisible();
  const preview = page.locator('.ordering-food-card').filter({ hasText: '经典汉堡' }).first().getByTestId('menu-model-preview');
  await expect(preview).toBeVisible();
  await expect(preview.locator('canvas')).toBeVisible();
  await expect(preview).toHaveAttribute('data-ready', 'true');
  expect(models.filter(url => url.includes('/burger-'))).toHaveLength(1);
  const drinkCard = page.locator('.ordering-food-card').filter({ hasText: '鲜柠气泡饮' });
  await expect(drinkCard.getByTestId('menu-model-preview')).toHaveCount(0);
  await expect(drinkCard.locator('.ordering-cover img')).toBeVisible();
  await expect(page.getByTestId('menu-model-preview')).toHaveCount(5);
  expect(models[0]).toContain('/models-mobile/');
  await expect(preview.locator('canvas')).toHaveCount(1);
  const box = (await preview.boundingBox())!;
  const before = await preview.getAttribute('data-rotation');
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => preview.getAttribute('data-rotation')).not.toBe(before);
  await page.getByRole('button', { name: '饮品', exact: true }).click();
  await expect(page.locator('.ordering-food-card')).toHaveCount(1);
  await expect(page.getByTestId('menu-model-preview')).toHaveCount(0);
  await expect(page.locator('.ordering-food-card .ordering-cover img')).toHaveAttribute('src', '/foods/lemon-soda.svg');
  await page.getByRole('button', { name: '查看鲜柠气泡饮' }).click();
  await expect(page.getByRole('button', { name: '虚拟试吃', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /加入点单/ })).toBeEnabled();
  await page.getByRole('button', { name: /返回菜单/ }).click();
  expect(models.some(url => url.includes('lemon-soda'))).toBe(false);
  await page.getByRole('button', { name: '全部', exact: true }).click();
  await expect(page.locator('.ordering-food-card').filter({ hasText: '经典汉堡' }).first().getByTestId('menu-model-preview')).toHaveAttribute('data-ready', 'true');
  expect(models.filter(url => url.includes('/burger-'))).toHaveLength(1);
  await page.getByRole('button', { name: '查看经典汉堡' }).click();
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '经典汉堡' })).toBeVisible();
  expect(models.filter(url => url.includes('/burger-'))).toHaveLength(1);
});

test('desktop catalog has one card per row and one media item per card', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?table=A01');
  const cards = page.locator('.ordering-food-card');
  await expect(cards).toHaveCount(7);
  await expect(cards.getByTestId('menu-model-preview')).toHaveCount(5);
  const soldOut = cards.filter({ hasText: '黑松露帕玛森薯条' });
  await expect(soldOut.getByTestId('menu-model-preview')).toHaveCount(0);
  await expect(soldOut.locator('.ordering-cover img')).toBeVisible();
  const first = await cards.nth(0).boundingBox();
  const second = await cards.nth(1).boundingBox();
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  expect(second!.y).toBeGreaterThan(first!.y + first!.height - 1);
  await expect(cards.nth(0).locator('.ordering-food-thumbnail')).toHaveCount(1);
  await expect(cards.nth(0).getByRole('button', { name: '查看经典汉堡' }).locator('.ordering-cover')).toHaveCount(0);
  await expect(cards.nth(1).getByTestId('menu-model-preview')).toHaveAttribute('data-ready', 'true');
  await expect(cards.nth(1).getByRole('button', { name: '查看迷迭香薯条' }).locator('.ordering-cover')).toHaveCount(0);
});

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

test('failed default burger model remains recoverable without blocking menu', async ({ page }) => {
  await page.route('**/*.glb', route => route.abort());
  await page.goto('/?table=A01');
  await expect(page.locator('.ordering-food-card').filter({ hasText: '经典汉堡' }).first().getByTestId('menu-model-preview')).toContainText('加载失败');
  await page.getByRole('button', { name: '查看经典汉堡' }).click();
  await expect(page.getByRole('button', { name: /加入点单/ })).toBeEnabled();
});
