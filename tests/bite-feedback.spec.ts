import { test, expect } from '@playwright/test';

test('bite has visible crumbs and recoil, settles, and respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/?mode=dine-in&guests=2');
  await page.getByRole('button', { name: '查看经典汉堡' }).click();
  await page.getByRole('button', { name: '虚拟试吃' }).click();
  const food = page.getByRole('button', { name: '经典汉堡' });
  const canvas = page.locator('canvas');
  await expect(food).toHaveAttribute('data-hit-ready', 'true');
  await expect(page.getByTestId('experience')).toHaveAttribute('data-phase', 'idle');
  await canvas.evaluate(element => {
    element.setAttribute('data-peak-crumbs', '0');
    element.setAttribute('data-peak-recoil', '0');
    new MutationObserver(() => {
      for (const key of ['crumbs', 'recoil']) {
        const value = Number(element.getAttribute(`data-${key}`));
        if (value > Number(element.getAttribute(`data-peak-${key}`))) element.setAttribute(`data-peak-${key}`, String(value));
      }
    }).observe(element, { attributes: true, attributeFilter: ['data-crumbs', 'data-recoil'] });
  });
  await food.focus();
  await food.evaluate(element => {
    for (let i = 0; i < 2; i++) element.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
  });
  await expect(canvas).toHaveAttribute('data-bite-pulse', '1');
  await expect(page.getByTestId('experience')).toHaveAttribute('data-bites', '1');
  await expect(food).toHaveAttribute('aria-disabled', 'false');
  await expect.poll(async () => Number(await canvas.getAttribute('data-peak-crumbs'))).toBeGreaterThanOrEqual(3);
  await expect.poll(async () => Number(await canvas.getAttribute('data-peak-recoil'))).toBeGreaterThan(0.001);
  await page.screenshot({ path: 'docs/screenshots/bite-feedback.png' });
  await expect(canvas).toHaveAttribute('data-crumbs', '0');
  await expect(canvas).toHaveAttribute('data-recoil', '0');
  await page.getByRole('button', { name: '设置' }).click();
  const sheet = page.getByRole('dialog', { name: '玩得顺手' });
  await sheet.locator('select').selectOption('reduced');
  await sheet.getByRole('checkbox', { name: '声音' }).uncheck();
  await sheet.getByRole('button', { name: '完成' }).click();
  await food.focus();
  await page.keyboard.press('Space');
  await expect(canvas).toHaveAttribute('data-bite-pulse', '2');
  await expect(canvas).toHaveAttribute('data-crumbs', '0');
  await expect(canvas).toHaveAttribute('data-recoil', '0');
});
