import { test, expect } from '@playwright/test';
for (const width of [390, 1440]) {
  test(`new food menu previews rotate at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    for (const name of ['黄金炸鸡腿', '芒果芝士蛋糕']) {
      const card = page.locator('.ordering-food-card').filter({ has: page.getByRole('heading', { name, exact: true }) });
      const preview = card.getByTestId('menu-model-preview');
      await preview.scrollIntoViewIfNeeded();
      await expect(preview).toHaveAttribute('data-ready', 'true');
      const initial = await preview.getAttribute('data-rotation');
      const bounds = (await preview.boundingBox())!;
      await page.mouse.move(bounds.x + bounds.width * .35, bounds.y + bounds.height * .5);
      await page.mouse.down();
      await page.mouse.move(bounds.x + bounds.width * .70, bounds.y + bounds.height * .5, { steps: 10 });
      await page.mouse.up();
      await expect(preview).not.toHaveAttribute('data-rotation', initial!);
      await expect(page.getByRole('heading', { name: '食刻开饭！', exact: true })).toBeVisible();
      await page.screenshot({ path: `artifacts/showcase-browser/menu-${name}-${width}.png` });
    }
    expect(errors).toEqual([]);
  });
}
