import { expect, test } from '@playwright/test';
import { confirmSetup, h1, passCurrentCheck, skipCheck, toFirstCheck } from './helpers';
import { readFileSync } from 'node:fs';

test.setTimeout(240_000);

test('buying: every check looked at and passed → ALL CHECKS PASSED, under a strict CSP, then offline', async ({ page, context }) => {
  // Apply the real security headers that Netlify will send.
  const csp = /Content-Security-Policy: (.*)/.exec(readFileSync('dist/_headers', 'utf8'))![1];
  await page.route('**/*', async (route) => {
    const res = await route.fetch();
    const headers = { ...res.headers() };
    if (route.request().resourceType() === 'document') headers['content-security-policy'] = csp;
    await route.fulfill({ response: res, headers });
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => (m.type() === 'error' || /Content Security Policy/i.test(m.text())) && errors.push(m.text()));
  await page.clock.install();
  await toFirstCheck(page, /buying/);
  for (let n = 0; n < 40; n++) {
    if ((await h1(page).innerText()) === 'Monitor check report') break;
    await passCurrentCheck(page);
  }
  await expect(h1(page)).toHaveText('Monitor check report');
  await expect(page.getByTestId('overall')).toContainText('ALL CHECKS PASSED');
  await expect(page.getByTestId('not-checked')).toHaveCount(0);
  await expect(page.getByRole('cell', { name: /^\d+ s$/ }).first()).toBeVisible();

  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('button', { name: 'Print or save as PDF' })).toBeHidden();
  await page.emulateMedia({ media: 'screen' });
  expect(errors).toEqual([]);
  await page.unrouteAll({ behavior: 'ignoreErrors' });

  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(h1(page)).toHaveText('Monitor check report');
  await context.setOffline(false);
});

test('repair: no-signal flow, flagged line, warm-up, combinations and hints', async ({ page }) => {
  await page.clock.install();
  await toFirstCheck(page, /repaired/);
  await expect(page.getByText(/monitor has been on for \d+ min/i)).toBeVisible();
  await passCurrentCheck(page); // Plain screens
  // Colour cycle: click anywhere to flag a line, confirm it stayed put, answer serious.
  await page.getByTestId('start-step').click();
  await page.clock.runFor(1000);
  await page.getByTestId('cycle-area').click({ position: { x: 300, y: 200 } });
  await expect(page.getByText(/Line noted/)).toHaveCount(0); // a click never flags by accident
  await page.keyboard.press('l');
  await page.clock.runFor(6000);
  await expect(page.getByText('Did it stay in the same place when the colour changed?')).toBeVisible();
  await page.getByRole('button', { name: 'Yes, same place' }).click();
  await page.keyboard.press('Enter');
  await expect(page.getByText(/You flagged 1 line during the colour cycle/)).toBeVisible();
  await page.getByTestId('answer-problem').click();
  await page.getByTestId('severity-serious').click();
  await passCurrentCheck(page); // Very dark colours
  await expect(h1(page)).toContainText('No signal');
  await page.getByTestId('start-step').click();
  await page.getByRole('button', { name: 'Done, I chose Extend' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'I am unplugging it now' }).click();
  await page.getByRole('button', { name: /Skip the wait/ }).click();
  await page.getByRole('button', { name: 'Run the set-up check again' }).click();
  await expect(page.getByText('Welcome back.')).toBeVisible();
  await confirmSetup(page);
  await expect(page.getByTestId('answer-passed')).toBeDisabled();
  await page.getByTestId('answer-notsure').click();
  await page.getByRole('button', { name: 'Home' }).click();
  await page.getByRole('button', { name: 'See the report' }).click();
  await expect(page.getByTestId('overall')).toContainText('SERIOUS PROBLEM FOUND');
  await expect(page.getByText(/Stayed in the same place when the colour changed: Yes/)).toBeVisible();
  await page.getByPlaceholder('e.g. left USB-C').fill('USB-C left');
  await page.getByPlaceholder('165').fill('165');
  await page.getByRole('combobox').nth(1).selectOption('yes');
  await page.getByRole('button', { name: 'Add row' }).click();
  await page.getByRole('combobox').nth(0).selectOption('HDMI');
  await page.getByPlaceholder('e.g. left USB-C').fill('USB-C left');
  await page.getByPlaceholder('165').fill('165');
  await page.getByRole('combobox').nth(1).selectOption('no');
  await page.getByRole('button', { name: 'Add row' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Lines only showed with the DisplayPort cable' })).toBeVisible();
});

test('colour cycle survives frame timestamps that lag behind performance.now()', async ({ page }) => {
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => raf(() => cb(performance.now() - 8));
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await toFirstCheck(page);
  await skipCheck(page);
  await page.getByTestId('start-step').click();
  await page.getByTestId('cycle-area').waitFor({ state: 'attached' });
  await page.waitForTimeout(5000);
  await expect(page.getByText('Sorry, something went wrong')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('works when served from a sub-folder (GitHub Pages style)', async ({ page }) => {
  await page.route('http://localhost:4173/Monitor-testing/v3/**', async (route) => {
    const url = new URL(route.request().url());
    const rel = url.pathname.replace('/Monitor-testing/v3/', '') || 'index.html';
    const res = await route.fetch({ url: `http://localhost:4173/${rel}` });
    await route.fulfill({ response: res });
  });
  await page.goto('/Monitor-testing/v3/');
  await expect(h1(page)).toHaveText('Check a monitor properly');
  await page.getByRole('button', { name: 'Start the check' }).click();
  await expect(h1(page)).toHaveText('Before you start');
});
