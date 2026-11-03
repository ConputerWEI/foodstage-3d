import { test, expect } from '@playwright/test';

test('real milestone assets decode, three transitions and one victory play per meal', async ({ page }) => {
  await page.addInitScript(() => {
    const starts: { duration: number; rate: number; delay: number }[] = [];
    Object.assign(window, { milestoneStarts: starts });
    const original = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const source = original.call(this);
      const start = source.start.bind(source);
      source.start = (when = 0, offset = 0, duration?: number) => {
        starts.push({ duration: source.buffer?.duration ?? 0, rate: source.playbackRate.value, delay: when - this.currentTime });
        start(when, offset, duration);
      };
      return source;
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: '设置' }).click();
  await page.getByRole('checkbox', { name: '声音' }).check();
  await page.getByRole('button', { name: '完成', exact: true }).click();
  await page.getByRole('button', { name: '查看经典汉堡' }).click();
  await page.getByRole('button', { name: '虚拟试吃' }).click();
  const area = page.getByRole('button', { name: '经典汉堡' });
  for (let stage = 0; stage < 4; stage++) {
    await expect(page.getByTestId('experience')).toHaveAttribute('data-stage', String(stage));
    for (let i = 0; i < (stage % 2 === 0 ? 5 : 6); i++) {
      await expect(area).toHaveAttribute('aria-disabled', 'false');
      await area.focus();
      await page.keyboard.press('Space');
    }
  }
  await expect(page.getByRole('button', { name: '再吃一次' })).toBeVisible();
  const records = () => page.evaluate(() => (window as unknown as { milestoneStarts: { duration: number; rate: number; delay: number }[] }).milestoneStarts);
  await expect.poll(async () => (await records()).filter(item => item.duration > 1.15 && item.duration < 1.20).length).toBe(1);
  const played = await records();
  const transitions = played.filter(item => item.duration > .29 && item.duration < .30);
  expect(transitions).toHaveLength(3);
  expect(transitions.map(item => item.rate)).toEqual([...transitions.map(item => item.rate)].sort((a,b) => a-b));
  expect(played.find(item => item.duration > 1.15 && item.duration < 1.20)!.delay).toBeLessThanOrEqual(.035);
  await page.getByRole('button', { name: '再吃一次' }).click();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
});
