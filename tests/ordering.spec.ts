import { test, expect } from '@playwright/test';

test('dine-in records the selected guest count through checkout and restored receipt', async ({ page }) => {
  await page.goto('/?table=a01');
  const dineIn = page.getByRole('button', { name: /堂食/ });
  await dineIn.click();
  const dialog = page.getByRole('dialog', { name: '几位用餐？' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(dineIn).toBeFocused();
  await dineIn.click();
  await dialog.getByRole('button', { name: '3 人', exact: true }).click();
  await dialog.getByRole('button', { name: '进入菜单' }).click();
  await expect(page.getByRole('button', { name: /当前堂食 · 3 位/ })).toBeVisible();
  await expect(page.getByText('A01 桌', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: '查看经典汉堡' }).click();
  await expect(page.getByRole('button', { name: '虚拟试吃' })).toBeVisible();
  await page.getByRole('radio', { name: /双份芝士/ }).check();
  await page.getByRole('button', { name: '增加数量' }).click();
  await page.getByLabel('备注').fill('不要洋葱');
  await page.getByRole('button', { name: /加入点单/ }).click();
  await page.reload();
  await page.getByRole('button', { name: /查看购物车/ }).click();
  await expect(page.getByText('不要洋葱')).toBeVisible();
  await expect(page.locator('.order-total')).toContainText('¥70.00');
  await page.getByRole('button', { name: '确认点单' }).click();
  await expect(page.getByRole('heading', { name: '确认订单' })).toBeVisible();
  await expect(page.getByText('堂食 · 3 位', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '提交演示订单' }).click();
  await expect(page.getByRole('heading', { name: '演示订单已生成' })).toBeVisible();
  await expect(page.getByText(/DEMO-/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '演示订单已生成' })).toBeVisible();
  await expect(page.getByText('堂食 · 3 位', { exact: true })).toBeVisible();
});

test('takeaway goes straight to the menu and can order without a table', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: /打包/ }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: /当前打包自取/ })).toBeVisible();
  await page.getByRole('button', { name: '查看经典汉堡' }).click();
  await page.getByRole('button', { name: /加入点单/ }).click();
  await page.getByRole('button', { name: /查看购物车/ }).click();
  await page.getByRole('button', { name: '确认点单' }).click();
  await expect(page.getByText('打包自取', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '提交演示订单' }).click();
  await expect(page.getByRole('heading', { name: '演示订单已生成' })).toBeVisible();
  await expect(page.getByText('打包自取', { exact: true })).toBeVisible();
});

test('menu works without a table and an empty cart invites browsing', async ({ page }) => {
  await page.goto('/?mode=dine-in&guests=2');
  await expect(page.getByText(/扫描桌码/).first()).toBeVisible();
  await page.getByRole('button', { name: /查看购物车/ }).click();
  await expect(page.getByText('还没有选菜')).toBeVisible();
  await page.getByRole('button', { name: '继续选菜' }).click();
  await page.getByRole('button', { name: '查看经典汉堡' }).click();
  await page.getByRole('button', { name: /加入点单/ }).click();
  await page.getByRole('button', { name: /查看购物车/ }).click();
  await page.getByRole('button', { name: '确认点单' }).click();
  await expect(page.getByRole('button', { name: '提交演示订单' })).toBeDisabled();
  await page.getByRole('button', { name: '使用演示桌号 A01' }).click();
  await expect(page.getByRole('button', { name: '提交演示订单' })).toBeEnabled();
});

test('category filters and sold-out details stay browseable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?table=B02&mode=dine-in&guests=2');
  await page.getByRole('button', { name: '饮品', exact: true }).click();
  await expect(page.getByRole('button', { name: '查看鲜柠气泡饮' })).toBeVisible();
  await expect(page.getByRole('button', { name: '查看经典汉堡' })).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 260));
  const menuScroll = await page.evaluate(() => window.scrollY);
  await page.getByRole('button', { name: '查看鲜柠气泡饮' }).click();
  await expect(page.getByRole('button', { name: '虚拟试吃', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /加入点单/ })).toBeEnabled();
  await page.getByRole('button', { name: /返回菜单/ }).click();
  await expect(page.getByRole('button', { name: '饮品', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(menuScroll);
  await page.getByRole('button', { name: '小食', exact: true }).click();
  await page.getByRole('button', { name: '查看黑松露帕玛森薯条' }).click();
  await expect(page.getByRole('button', { name: /暂时售罄/ })).toBeDisabled();
});

test('storage failure never clears the cart or claims a submitted order', async ({ page }) => {
  await page.goto('/?table=A01&mode=dine-in&guests=2');
  await page.getByRole('button', { name: '查看经典汉堡' }).click();
  await page.getByRole('button', { name: /加入点单/ }).click();
  await page.getByRole('button', { name: /查看购物车/ }).click();
  await page.getByRole('button', { name: '确认点单' }).click();
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'QuotaExceededError'); }; });
  await page.getByRole('button', { name: '提交演示订单' }).click();
  await expect(page.getByRole('alert')).toContainText('订单未保存');
  await expect(page.getByRole('heading', { name: '演示订单已生成' })).toHaveCount(0);
  await page.getByRole('button', { name: '返回购物车' }).click();
  await expect(page.getByRole('heading', { name: '经典汉堡' })).toBeVisible();
});
