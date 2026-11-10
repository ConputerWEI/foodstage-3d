import { test, expect } from '@playwright/test';

const items = [
  { id: 'crispy-chicken', name: '黄金炸鸡腿' },
  { id: 'mango-cheesecake', name: '芒果芝士蛋糕' },
];
for (const width of [390, 1440]) {
  for (const food of items) {
    test(`${food.id} four stages and replay at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      const variant = width < 768 ? 'mobile' : 'desktop';
      const response = page.waitForResponse(r => r.url().includes(`/models-${variant}/${food.id}-0.glb`) && r.ok());
      await page.goto('/');
      await page.getByRole('button', { name: `查看${food.name}`, exact: true }).click();
      await page.getByRole('button', { name: '虚拟试吃' }).click();
      await response;
      const experience = page.getByTestId('experience');
      const area = page.getByRole('button', { name: food.name, exact: true });
      const canvas = page.locator('canvas');
      for (let stage = 0; stage < 4; stage++) {
        await expect(experience).toHaveAttribute('data-stage', String(stage));
        await expect(experience).toHaveAttribute('data-phase', 'idle');
        await expect(area).toHaveAttribute('data-hit-ready', 'true');
        await expect(canvas).toHaveAttribute('data-stage-blend', '1');
        await page.screenshot({ path: `artifacts/showcase-browser/${food.id}-${width}-stage-${stage}.png` });
        for (let bite = 0; bite < 3; bite++) {
          await expect(area).toHaveAttribute('aria-disabled', 'false');
          await area.focus();
          await page.keyboard.press('Space');
          if (food.id === 'lemon-soda') {
            await expect(canvas).toHaveAttribute('data-crumbs', '0');
            await expect(canvas).toHaveAttribute('data-recoil', '0');
          }
          if (bite < 2) await expect(area).toHaveAttribute('aria-disabled', 'false');
        }
      }
      await expect(page.getByRole('button', { name: '再吃一次' })).toBeEnabled();
      await page.getByRole('button', { name: '再吃一次' }).click();
      await expect(experience).toHaveAttribute('data-stage', '0');
      await expect(experience).toHaveAttribute('data-phase', 'idle');
      await expect(area).toHaveAttribute('data-hit-ready', 'true');
      expect(errors).toEqual([]);
    });
  }
}
