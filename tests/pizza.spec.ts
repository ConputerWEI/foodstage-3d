import { test, expect } from '@playwright/test';

for (const width of [390, 1440]) {
  test(`pizza loads and advances through four stages at ${width}px`, async ({ page }) => {
    const failures: string[] = [];
    const loaded = new Set<string>();
    page.on('pageerror', error => failures.push(error.message));
    page.on('response', response => {
      if (response.ok() && /pepperoni-pizza-[0-3]\.glb/.test(response.url())) loaded.add(new URL(response.url()).pathname);
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/?table=A01');
    await page.getByRole('button', { name: '查看意式双重芝士披萨' }).click();
    await expect(page.locator('.ordering-detail-art img')).toHaveAttribute('src', '/foods/pizza-six-0-cutout.png');
    await page.getByRole('button', { name: '虚拟试吃', exact: true }).click();
    const experience = page.getByTestId('experience');
    const input = page.getByRole('button', { name: '意式双重芝士披萨', exact: true });
    await expect(experience).toHaveAttribute('data-food', 'pepperoni-pizza');
    for (let stage = 0; stage < 4; stage++) {
      await expect(experience).toHaveAttribute('data-stage', String(stage));
      await expect(experience).toHaveAttribute('data-phase', 'idle');
      await expect(input).toHaveAttribute('data-hit-ready', 'true');
      await expect(page.locator('canvas')).toHaveAttribute('data-stage-blend', '1');
      await page.screenshot({ path: `artifacts/pizza-20261106/${width}-stage-${stage}.png` });
      for (let bite = 0; bite < 3; bite++) {
        await expect(input).toHaveAttribute('aria-disabled', 'false');
        await input.focus();
        await page.keyboard.press('Space');
      }
    }
    await expect(experience).toHaveAttribute('data-phase', 'finished');
    await expect(page.getByText('吃光了', { exact: true })).toBeVisible();
    const variant = width >= 768 ? 'models-desktop' : 'models-mobile';
    for (let stage = 0; stage < 4; stage++) expect(loaded.has(`/${variant}/pepperoni-pizza-${stage}.glb`)).toBe(true);
    expect(failures).toEqual([]);
  });
}
