import { test, expect, type Page } from '@playwright/test';
import { menuItems } from '../src/data/menu';

async function idle(page: Page, stage: number) {
  await expect(page.getByTestId('experience')).toHaveAttribute('data-stage', String(stage));
  await expect(page.getByTestId('experience')).toHaveAttribute('data-phase', 'idle');
  await expect(page.getByRole('button', { name: '经典汉堡' })).toHaveAttribute('data-hit-ready', 'true');
  await expect(page.getByRole('button', { name: '经典汉堡' })).toHaveAttribute('aria-disabled', 'false');
  await expect(page.locator('canvas')).toHaveAttribute('data-stage-blend', '1');
  await expect(page.locator('canvas')).toHaveAttribute('data-crumbs', '0');
  await expect(page.locator('canvas')).toHaveAttribute('data-recoil', '0');
}
async function bites(page: Page, count: number, waitForIdleAfterLast = true) {
  const area = page.getByRole('button', { name: '经典汉堡' });
  await area.focus();
  for (let i = 0; i < count; i++) {
    await expect(area).toHaveAttribute('aria-disabled', 'false');
    await page.keyboard.press('Space');
    // Failed asset loads and the final bite do not return to enabled food input.
    if (i < count - 1 || waitForIdleAfterLast) await expect(area).toHaveAttribute('aria-disabled', 'false');
  }
}
test('real model, drag isolation, percentage transition and complete replay', async ({ page }) => {
  const failures: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('console', message => { if (message.type() === 'error') failures.push(message.text()); });
  const loaded = page.waitForResponse(response => response.url().includes('/models-desktop/burger-0.glb') && response.ok());
  await page.goto('/');
  await page.getByRole('button', { name: '查看经典汉堡' }).click();
  await page.getByRole('button', { name: '虚拟试吃' }).click();
  const desktopModel = await loaded; await idle(page, 0);
  expect(Number(desktopModel.headers()['content-length'])).toBeGreaterThan(3_000_000);
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('h1')).toHaveText('食刻');
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  await expect(page.locator('.progress')).not.toContainText('口');
  await expect(page.locator('.keyboard-hint')).toHaveCount(0);
  await expect(page.locator('.experience')).toHaveCSS('background-color', 'rgb(255, 243, 217)');
  await page.screenshot({ path: 'docs/screenshots/desktop-initial.png' });
  await page.screenshot({ path: 'test-results/stage-0.png' });
  await page.locator('canvas').screenshot({ path: 'docs/screenshots/stage-1.png', omitBackground: true });
  const area = page.getByRole('button', { name: '经典汉堡' });
  const box = (await area.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + 90, y + 40, { steps: 8 }); await page.mouse.move(x, y); await page.mouse.up();
  await expect(page.getByTestId('experience')).toHaveAttribute('data-bites', '0');
  // Actual scene raycast input, not just DOM keyboard handling.
  await page.mouse.click(x, y);
  await expect(page.getByTestId('experience')).toHaveAttribute('data-bites', '1');
  await expect(area).toHaveAttribute('aria-disabled', 'false');
  await page.screenshot({ path: 'docs/screenshots/desktop.png' });
  await bites(page, 4);
  await idle(page, 1);
  await expect.poll(() => page.locator('canvas').evaluate(canvas => Number(getComputedStyle(canvas).opacity))).toBe(1);
  await page.screenshot({ path: 'test-results/stage-1.png' });
  await page.locator('canvas').screenshot({ path: 'docs/screenshots/stage-2.png', omitBackground: true });
  await expect(page.getByTestId('experience')).toHaveAttribute('data-bites', '0');
  for (let stage = 1; stage < 4; stage++) {
    if (stage > 1) await page.locator('canvas').screenshot({ path: `docs/screenshots/stage-${stage + 1}.png`, omitBackground: true });
    await bites(page, stage % 2 === 0 ? 5 : 6, stage < 3);
    if (stage < 3) await idle(page, stage + 1);
  }
  await expect(page.getByRole('button', { name: '再吃一次' })).toBeVisible();
  await expect(page.getByRole('button', { name: '再吃一次' })).toBeEnabled();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  await expect(page.locator('.keyboard-hint')).toHaveCount(0);
  await page.screenshot({ path: 'docs/screenshots/finished.png' });
  await page.getByRole('button', { name: '再吃一次' }).click(); await idle(page, 0);
  await expect(page.getByTestId('experience')).toHaveAttribute('data-bites', '0');
  expect(failures).toEqual([]);
});

test('failed next asset retains full progress and model until retry succeeds', async ({ page }) => {
  let fail = true;
  await page.route('**/models-desktop/burger-1.glb', route => fail ? route.fulfill({ status: 503, body: 'temporary failure' }) : route.continue());
  await page.goto('/');
  await page.getByRole('button', { name: '查看经典汉堡' }).click();
  await page.getByRole('button', { name: '虚拟试吃' }).click();
  await idle(page, 0); await bites(page, 5, false);
  await expect(page.getByTestId('experience')).toHaveAttribute('data-phase', 'waiting');
  await expect(page.getByTestId('experience')).toHaveAttribute('data-bites', '5');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: '重试加载' })).toBeVisible();
  fail = false; await page.getByRole('button', { name: '重试加载' }).click(); await idle(page, 1);
});

test('direct food interaction and help restore focus without a separate eat button', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: '查看经典汉堡' }).click();
  await page.getByRole('button', { name: '虚拟试吃' }).click();
  await idle(page, 0);
  await expect(page.getByRole('button', { name: '吃一口', exact: true })).toHaveCount(0);
  const food = page.getByRole('button', { name: '经典汉堡', exact: true });
  const bounds = (await food.boundingBox())!;
  await expect(food).toHaveAttribute('aria-disabled', 'false');
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await expect(page.getByTestId('experience')).toHaveAttribute('data-bites', '1');
  await expect(food).toHaveAttribute('aria-disabled', 'false');
  const help = page.getByRole('button', { name: '使用说明' });
  await help.click();
  await expect(page.getByRole('dialog', { name: '怎么吃' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(help).toBeFocused();
  await expect(page.getByTestId('experience')).toHaveAttribute('data-bites', '1');
  await bites(page, 1);
  await expect(page.getByTestId('experience')).toHaveAttribute('data-bites', '2');
});

test('menu table and settings persist, and tasting returns to the dish draft', async ({ page }) => {
  const expectedModels = [
    'burger', 'rosemary-fries', 'pepperoni-pizza', 'crispy-chicken', 'mango-cheesecake', 'lemon-soda',
  ].map(id => `/models-mobile/${id}-0.glb`).sort();
  const visibleOnlyUrls = new Set(menuItems.flatMap(item => item.previewModelUrl ? [item.previewModelUrl] : []));
  const modelRequests: string[] = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path.endsWith('.glb') && !visibleOnlyUrls.has(path)) modelRequests.push(path);
  });
  await page.goto('/');
  const menu = page.locator('.ordering-menu');
  await expect(menu).toBeVisible();
  await expect(page.getByRole('heading', { name: '食刻开饭！', exact: true })).toBeVisible();
  await expect(page.locator('.ordering-food-card').filter({ hasText: '经典汉堡' }).getByTestId('menu-model-preview')).toHaveAttribute('data-ready', 'true');
  await expect.poll(() => [...modelRequests].sort()).toEqual(expectedModels);
  await page.screenshot({ path: 'docs/screenshots/menu-desktop.png' });
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: '查看经典汉堡', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.ordering-food-card').filter({ hasText: '经典汉堡' }).getByTestId('menu-model-preview')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'docs/screenshots/menu-mobile.png', fullPage: true });
  await page.getByRole('button', { name: '使用演示桌号 A01' }).click();
  await expect(page).toHaveURL(/\?table=A01$/);
  await expect(menu.locator('.ordering-table')).toContainText('A01');

  const settingsTrigger = page.locator('.ordering-tools').getByRole('button', { name: '设置' });
  await settingsTrigger.click();
  const settings = page.getByRole('dialog', { name: '玩得顺手' });
  await expect(settings).toBeVisible();
  await settings.getByRole('checkbox', { name: '声音' }).check();
  await settings.locator('select').selectOption('reduced');
  await settings.getByRole('button', { name: '完成' }).click();
  await expect(settings).not.toBeVisible();
  await expect(settingsTrigger).toBeFocused();
  // A full reload creates a new module cache; count requests per document.
  modelRequests.length = 0;
  await page.reload();
  await expect(menu).toBeVisible();
  await expect(menu.locator('.ordering-table')).toContainText('A01');
  await settingsTrigger.click();
  const retained = page.getByRole('dialog', { name: '玩得顺手' });
  await expect(retained.getByRole('checkbox', { name: '声音' })).toBeChecked();
  await expect(retained.locator('select')).toHaveValue('reduced');
  await page.keyboard.press('Escape');
  await expect(retained).not.toBeVisible();
  await expect(settingsTrigger).toBeFocused();
  await expect(menu.locator('.ordering-food-card').filter({ hasText: '经典汉堡' }).getByTestId('menu-model-preview')).toHaveAttribute('data-ready', 'true');
  await expect.poll(() => [...modelRequests].sort()).toEqual(expectedModels);

  await page.getByRole('button', { name: '查看经典汉堡', exact: true }).focus();
  await page.keyboard.press('Enter');
  const detail = page.locator('.ordering-detail');
  await expect(detail.getByRole('heading', { level: 1 })).toHaveText('经典汉堡');
  await expect(detail.getByRole('heading', { level: 1 })).toBeFocused();
  await expect(page.getByRole('button', { name: '虚拟试吃' })).toBeVisible();
  await page.getByRole('radio', { name: '微辣', exact: true }).check();
  await page.getByRole('button', { name: '增加数量' }).click();
  await page.getByRole('textbox', { name: '备注', exact: true }).fill('不要洋葱');
  await detail.getByTestId('menu-model-preview').scrollIntoViewIfNeeded();
  await expect(detail.getByTestId('menu-model-preview')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect.poll(() => [...modelRequests].sort()).toEqual(expectedModels);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'docs/screenshots/detail-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'docs/screenshots/detail-desktop.png' });
  const loaded = page.waitForResponse(response => response.url().includes('/models-desktop/burger-0.glb') && response.ok());
  await page.getByRole('button', { name: '虚拟试吃' }).click();
  await loaded; await idle(page, 0);
  await page.getByRole('button', { name: '返回菜品' }).click();
  await expect(detail).toBeVisible();
  await expect(detail.getByRole('heading', { level: 1 })).toBeFocused();
  await expect(page.getByRole('radio', { name: '微辣', exact: true })).toBeChecked();
  await expect(page.getByRole('status', { name: '数量' })).toHaveText('2');
  await expect(page.getByRole('textbox', { name: '备注', exact: true })).toHaveValue('不要洋葱');
  await detail.getByTestId('menu-model-preview').scrollIntoViewIfNeeded();
  await expect(detail.getByTestId('menu-model-preview')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.getByRole('button', { name: '返回菜单' }).click();
  await expect(menu).toBeVisible();
  await expect(menu.locator('.ordering-table')).toContainText('A01');
  await settingsTrigger.click();
  await expect(settings.getByRole('checkbox', { name: '声音' })).toBeChecked();
  await expect(settings.locator('select')).toHaveValue('reduced');
  await settings.getByRole('button', { name: '完成' }).click();
  await expect(settingsTrigger).toBeFocused();
});

test('mobile layout fits and reduced-motion completes transitions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: '查看经典汉堡' }).click();
  await page.getByRole('button', { name: '虚拟试吃' }).click();
  await idle(page, 0);
  expect(await page.evaluate(() => performance.getEntriesByType('resource').some(entry => entry.name.includes('/models-mobile/burger-0.glb')))).toBe(true);
  expect(await page.evaluate(() => performance.getEntriesByType('resource').some(entry => entry.name.includes('/models-desktop/burger-0.glb')))).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'docs/screenshots/mobile.png' });
  for (let stage = 0; stage < 4; stage++) {
    await idle(page, stage);
    await page.locator('canvas').screenshot({ path: `docs/screenshots/mobile-stage-${stage + 1}.png`, omitBackground: true });
    if (stage < 3) await bites(page, stage % 2 === 0 ? 5 : 6);
  }
});
