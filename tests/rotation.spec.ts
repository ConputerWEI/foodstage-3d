import { test, expect } from '@playwright/test';

test('food remains interactive after vertical and horizontal flips', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '翻开菜单' }).click();
  await page.getByRole('button', { name: '开始品尝' }).click();
  const food = page.getByRole('button', { name: '经典汉堡' });
  await expect(food).toHaveAttribute('data-hit-ready', 'true');
  await expect(food).toHaveAttribute('aria-disabled', 'false');
  const box = (await food.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  // Pointer capture allows a >180-degree drag even outside the original food silhouette.
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 360, y + 370, { steps: 30 });
  await expect.poll(() => page.locator('canvas').evaluate(canvas => Number(canvas.dataset.rotationX))).toBeGreaterThan(Math.PI);
  await expect.poll(() => page.locator('canvas').evaluate(canvas => Number(canvas.dataset.rotationY))).toBeGreaterThan(Math.PI);
  await page.mouse.up();
  await expect(page.getByTestId('experience')).toHaveAttribute('data-bites', '0');
  await page.screenshot({ path: 'docs/screenshots/food-flipped.png' });
  await food.focus();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('experience')).toHaveAttribute('data-bites', '1');
  await expect(food).toHaveAttribute('aria-disabled', 'false');
});
