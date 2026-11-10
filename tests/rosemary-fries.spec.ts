import { test, expect } from '@playwright/test';

for (const width of [390, 1440]) {
  test(`fresh Lux3D fries load all four stages at ${width}px`, async ({ page }) => {
    const failures: string[] = [];
    const loaded = new Set<string>();
    page.on('pageerror', error => failures.push(error.message));
    page.on('response', response => {
      if (response.ok() && /rosemary-fries-[0-3]\.glb/.test(response.url())) loaded.add(new URL(response.url()).pathname);
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/?table=A01');
    await page.getByRole('button', { name: '查看迷迭香薯条' }).click();
    await page.getByRole('button', { name: '虚拟试吃' }).click();
    const experience = page.getByTestId('experience');
    const input = page.getByRole('button', { name: '迷迭香薯条', exact: true });
    await expect(experience).toHaveAttribute('data-food', 'rosemary-fries');
    for (let stage = 0; stage < 4; stage++) {
      await expect(experience).toHaveAttribute('data-stage', String(stage));
      await expect(experience).toHaveAttribute('data-phase', 'idle');
      await expect(input).toHaveAttribute('data-hit-ready', 'true');
      await expect(page.locator('canvas')).toHaveAttribute('data-stage-blend', '1');
      await page.screenshot({ path: `artifacts/fries-only-20261106/screenshots/${width}-stage-${stage}.png` });
      if (stage === 3) break;
      for (let bite = 0; bite < [5, 6, 5][stage]!; bite++) {
        await expect(input).toHaveAttribute('aria-disabled', 'false');
        await input.focus();
        await page.keyboard.press('Space');
      }
    }
    const variant = width >= 768 ? 'models-desktop' : 'models-mobile';
    for (let stage = 0; stage < 4; stage++) expect(loaded.has(`/${variant}/rosemary-fries-${stage}.glb`)).toBe(true);
    expect(failures).toEqual([]);
  });
}
