import { test, expect } from '@playwright/test';

test('first parser failure retries and gesture cancellation never bites', async ({ page }) => {
  let corrupt = true;
  await page.route('**/burger-0.glb', route => corrupt ? route.fulfill({ status: 200, body: 'invalid GLB' }) : route.continue());
  await page.goto('/?mode=dine-in&guests=2');
  await page.getByRole('button', { name: '查看经典汉堡' }).click();
  await page.getByRole('button', { name: '虚拟试吃' }).click();
  await expect(page.getByRole('button', { name: '重试加载' })).toBeVisible();
  await expect(page.getByTestId('experience')).toHaveAttribute('data-phase', 'loading');
  corrupt = false; await page.getByRole('button', { name: '重试加载' }).click();
  await expect(page.getByTestId('experience')).toHaveAttribute('data-phase', 'idle');
  const food = page.getByRole('button', { name: '经典汉堡' });
  const box = (await food.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  // Blank canvas is not edible; outside release cannot poison the next gesture.
  await page.mouse.move(box.x + 4, box.y + 4); await page.mouse.down();
  await page.mouse.move(0, 0); await page.mouse.up();
  await page.mouse.click(x, y, { button: 'right' });
  await page.mouse.move(x, y); await page.mouse.down();
  await page.waitForTimeout(280); await page.mouse.up();
  // Real multitouch via Chrome DevTools, to exercise capture with valid active IDs.
  const cdp = await page.context().newCDPSession(page);
  const touch = { x, y, id: 1 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch, { x: x + 20, y, id: 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await expect(page.getByTestId('experience')).toHaveAttribute('data-bites', '0');
  await expect(food).toHaveAttribute('aria-disabled', 'false');
  await food.focus(); await page.keyboard.press('Enter');
  await expect(page.getByTestId('experience')).toHaveAttribute('data-bites', '1');
  await expect(food).toHaveAttribute('aria-disabled', 'false');
});

test('renderer fallback retry remains clickable inside food input', async ({ page }) => {
  await page.addInitScript(() => {
    let failOnce = true;
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: any[]) {
      if (failOnce && (type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl')) {
        failOnce = false;
        throw new Error('forced renderer failure');
      }
      return getContext.call(this, type, ...args);
    };
  });
  await page.goto('/?mode=dine-in&guests=2');
  await page.getByRole('button', { name: '查看经典汉堡' }).click();
  await page.getByRole('button', { name: '虚拟试吃' }).click();
  await expect(page.getByRole('button', { name: '重试画面' })).toBeVisible();
  await page.getByRole('button', { name: '重试画面' }).click();
  await expect(page.getByTestId('experience')).toHaveAttribute('data-phase', 'idle');
  await expect(page.getByTestId('experience')).toHaveAttribute('data-hit-ready', 'true');
  const food = page.getByRole('button', { name: '经典汉堡' });
  await expect(food).toHaveAttribute('aria-disabled', 'false');
  await food.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('experience')).toHaveAttribute('data-bites', '1');
  await expect(food).toHaveAttribute('aria-disabled', 'false');
  const box = (await food.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 20, { steps: 4 });
  await page.mouse.up();
  await expect(page.getByTestId('experience')).toHaveAttribute('data-bites', '1');
});

test('WebGL context loss provides a recovery action', async ({ page }) => {
  await page.goto('/?mode=dine-in&guests=2');
  await page.getByRole('button', { name: '查看经典汉堡' }).click();
  await page.getByRole('button', { name: '虚拟试吃' }).click();
  await expect(page.getByTestId('experience')).toHaveAttribute('data-phase', 'idle');
  await page.locator('canvas').evaluate(canvas => canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
  await expect(page.getByRole('button', { name: '重试画面' })).toBeVisible();
  await page.getByRole('button', { name: '重试画面' }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: '重试画面' })).toHaveCount(0);
});
