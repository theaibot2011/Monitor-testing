import { expect, test } from '@playwright/test';
import { confirmSetup, h1, refreshKeeps } from './helpers';

// Runs in Chromium, Firefox and WebKit (Safari's engine).
test('core journey works in this browser engine', async ({ page, browserName }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.clock.install();
  await page.goto('/');
  await expect(h1(page)).toHaveText('Check a monitor properly');

  // Arrow keys move through the purpose choices.
  await page.getByRole('radio', { name: /buying/ }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: /selling/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('radio', { name: /selling/ })).toBeFocused();

  await page.getByRole('button', { name: 'Start the check' }).click();
  await page.getByRole('button', { name: 'I have done these' }).click();
  await page.getByRole('button', { name: 'Ready, next' }).click();
  await page.getByLabel('Monitor make and model').fill(`${browserName} monitor`);
  await page.getByRole('button', { name: /Next: check the screen set-up/ }).click();
  await confirmSetup(page);
  await expect(page.getByTestId('progress-text')).toContainText('minutes left');

  // Plain screens: pictures are drawn, PASSED unlocks only after looking.
  await page.getByTestId('start-step').click();
  const label = page.getByTestId('pattern-label');
  for (let i = 1; i <= 3; i++) {
    await expect(label).toContainText(`${i} of 3`);
    if (i === 1) {
      // Pixel check in this engine: the black picture really is black.
      const px = await page.evaluate(() => {
        const c = document.querySelector('canvas')!;
        const d = c.getContext('2d')!.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data;
        return [d[0], d[1], d[2], c.width, Math.round(c.getBoundingClientRect().width * devicePixelRatio)];
      });
      expect(px.slice(0, 3)).toEqual([0, 0, 0]);
      expect(Math.abs(px[3] - px[4])).toBeLessThanOrEqual(1);
      // Hidden controls are not reachable by Tab until shown.
      await page.clock.runFor(3000);
      await expect(page.getByTestId('stage-bar')).toHaveAttribute('inert', '');
      await page.keyboard.press('Tab');
      await expect(page.getByTestId('stage-bar')).not.toHaveAttribute('inert', '');
    }
    await page.clock.runFor(2500);
    await page.keyboard.press('Space');
  }
  await expect(page.getByTestId('answer-passed')).toBeEnabled();
  await page.getByTestId('answer-passed').click();

  // Colour cycle: a click does not flag; L does.
  await expect(h1(page)).toHaveText('Colour cycle');
  await page.getByTestId('start-step').click();
  await page.getByTestId('cycle-area').waitFor({ state: 'attached' });
  await page.clock.runFor(3000);
  await page.getByTestId('cycle-area').click({ position: { x: 300, y: 200 } });
  await expect(page.getByText(/Line noted/)).toHaveCount(0);
  await page.keyboard.press('l');
  await expect(page.getByText(/Line noted/).first()).toBeVisible();
  await page.clock.runFor(6000);
  await page.getByRole('button', { name: 'Not sure' }).click();
  await page.keyboard.press('Enter');
  await page.getByTestId('answer-notsure').click();

  await refreshKeeps(page, 'Very dark colours');
  await page.getByRole('button', { name: 'Home' }).click();
  await page.getByRole('button', { name: 'See the report' }).click();
  await expect(page.getByTestId('overall')).toContainText('NOT FINISHED');
  await expect(page.getByTestId('overall-reasons')).toContainText('more not finished');
  const png = page.waitForEvent('download');
  await page.getByTestId('save-png').click();
  expect((await png).suggestedFilename()).toMatch(/\.png$/);
  const json = page.waitForEvent('download');
  await page.getByTestId('save-json').click();
  expect((await json).suggestedFilename()).toMatch(/\.json$/);
  expect(errors).toEqual([]);
});

test('self-check passes in this browser engine', async ({ page }) => {
  await page.goto('/?selftest=1');
  await expect(page.getByTestId('selfcheck-summary')).toContainText(/All \d+ checks PASSED/);
});
