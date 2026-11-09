import { expect, test } from '@playwright/test';
import { confirmSetup, h1, refreshKeeps, skipCheck, toFirstCheck } from './helpers';

test('Home → set-up → first check → report, refresh-safe, PASSED locked until looked at', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => !/\/some\/deep\//.test(String(e)) && errors.push(String(e)));
  // The deliberate deep-link visit below makes the browser log one failed module load before the guard redirects.
  page.on('console', (m) => m.type() === 'error' && !/Failed to load module script|\/some\/deep\//.test(m.text()) && errors.push(m.text()));
  await page.clock.install();

  await page.goto('/');
  await expect(h1(page)).toHaveText('Check a monitor properly');
  await expect(page.getByText(/Quick check/i)).toHaveCount(0);
  await expect(page.getByText(/works offline after the first load/i)).toBeVisible();
  await page.getByRole('radio', { name: /selling/ }).click();
  await page.getByRole('button', { name: 'Start the check' }).click();

  await expect(h1(page)).toHaveText('Before you start');
  await page.getByRole('radio', { name: /A desktop computer/ }).click();
  await expect(page.getByText(/Win\+P/)).toHaveCount(0);
  await page.getByRole('radio', { name: /A laptop/ }).click();
  await expect(page.getByText(/Win\+P/).first()).toBeVisible();
  await refreshKeeps(page, 'Before you start');
  await page.getByRole('button', { name: 'I have done these' }).click();

  await expect(h1(page)).toHaveText('Getting ready');
  await refreshKeeps(page, 'Getting ready');
  await page.getByRole('button', { name: 'Ready, next' }).click();

  await expect(h1(page)).toHaveText('About this monitor');
  await page.getByLabel('Monitor make and model').fill('Test Monitor 27');
  await page.getByLabel(/Advertised refresh rate/).fill('144');
  await expect(page.getByText('Monitor switched on at')).toHaveCount(0);
  await refreshKeeps(page, 'About this monitor');
  await expect(page.getByLabel('Monitor make and model')).toHaveValue('Test Monitor 27');
  await page.getByRole('button', { name: /Next: check the screen set-up/ }).click();

  await expect(h1(page)).toHaveText('Screen set-up check');
  await refreshKeeps(page, 'Screen set-up check');
  await confirmSetup(page);

  await expect(h1(page)).toHaveText('Plain screens');
  await expect(page.getByText('Normal (PASSED)')).toBeVisible();
  await expect(page.getByText('A problem (PROBLEM FOUND)')).toBeVisible();
  await refreshKeeps(page, 'Plain screens');
  await page.getByTestId('start-step').click();

  // Click straight through without looking: PASSED stays locked.
  await expect(page.getByTestId('pattern-label')).toContainText('1 of 3: Black');
  await expect(page.getByRole('button', { name: 'Exit full screen' })).toBeVisible();
  await page.getByTestId('next-area').click();
  await expect(page.getByTestId('pattern-label')).toContainText('2 of 3: White');

  // Refresh mid-test: full screen is lost, so the paused screen keeps our place.
  await page.reload();
  await expect(h1(page)).toHaveText('Testing paused');
  await expect(page.getByText('picture 2 of 3')).toBeVisible();
  await page.getByRole('button', { name: 'Carry on without full screen' }).click();
  await page.keyboard.press('Space');
  await page.keyboard.press('Space');
  await expect(h1(page)).toContainText('Did you see any lines');
  await expect(page.getByTestId('answer-passed')).toBeDisabled();
  await expect(page.getByTestId('pass-locked')).toContainText('Picture 1 (Black)');

  // Look properly, then PASSED unlocks.
  await page.getByRole('button', { name: 'Show me the check' }).click();
  await page.getByTestId('start-step').click();
  for (let i = 1; i <= 3; i++) {
    await expect(page.getByTestId('pattern-label')).toContainText(`${i} of 3`);
    await page.clock.runFor(2500);
    await page.keyboard.press('Space');
  }
  await expect(page.getByTestId('answer-passed')).toBeEnabled();
  await page.getByTestId('answer-passed').click();

  // Second check: report a small problem with a severity choice.
  await expect(h1(page)).toHaveText('Colour cycle');
  await skipCheck(page);
  await expect(h1(page)).toHaveText('Very dark colours');
  await page.getByRole('button', { name: 'Home' }).click();
  await page.getByRole('button', { name: 'See the report' }).click();

  await expect(h1(page)).toHaveText('Monitor check report');
  await expect(page.getByTestId('overall')).toContainText('NOT FINISHED');
  await expect(page.getByTestId('not-checked')).toContainText('Colour cycle');
  await expect(page.getByTestId('tested-range')).toContainText('Tested: ');
  await expect(page.getByText(/advertised 144 Hz/).first()).toBeVisible();
  await expect(page.getByText('Finding the cause')).toHaveCount(0);
  await refreshKeeps(page, 'Monitor check report');

  const json = page.waitForEvent('download');
  await page.getByTestId('save-json').click();
  expect((await json).suggestedFilename()).toMatch(/^monitortest-Test-Monitor-27-.*\.json$/);
  const png = page.waitForEvent('download');
  await page.getByTestId('save-png').click();
  expect((await png).suggestedFilename()).toMatch(/\.png$/);

  await page.getByRole('button', { name: 'Review or redo answers' }).click();
  await refreshKeeps(page, 'Review all answers');
  await page.goto('/some/deep/path');
  await expect(h1(page)).toHaveText('Review all answers');

  // About & privacy, and Help focus handling.
  await page.getByRole('button', { name: 'About' }).click();
  await expect(page.getByText('Nothing you enter is uploaded')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Help' }).click();
  expect(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'))).toBe(true);
  await page.keyboard.press('Escape');

  expect(errors).toEqual([]);
});

test('severity choice and earlier-answer label', async ({ page }) => {
  await toFirstCheck(page);
  const through = async () => {
    await page.getByTestId('start-step').click();
    for (let i = 1; i <= 3; i++) {
      await expect(page.getByTestId('pattern-label')).toContainText(`${i} of 3`);
      await page.keyboard.press('Space');
    }
  };
  await through();
  await page.getByTestId('answer-notsure').click();
  await page.getByRole('button', { name: 'Back to previous step' }).click();
  await through();
  await expect(page.getByText('Earlier answer: NOT SURE.')).toBeVisible();
  await page.getByTestId('answer-problem').click();
  await expect(h1(page)).toHaveText('How serious is it?');
  await page.getByTestId('severity-minor').click();
  await page.getByRole('button', { name: 'Home' }).click();
  await page.getByRole('button', { name: 'See the report' }).click();
  await expect(page.getByRole('cell', { name: 'PROBLEM FOUND (small)' })).toBeVisible();
});

test('self-check passes, with only a note at 125% scaling, on portrait and ultrawide screens', async ({ browser }) => {
  for (const [w, h, dsf] of [[1280, 720, 1], [1229, 691, 1.25], [1080, 1920, 1], [3440, 1440, 1]] as const) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf });
    const page = await ctx.newPage();
    await page.goto('/?selftest=1');
    await expect(page.getByTestId('selfcheck-summary')).toContainText(/All \d+ checks PASSED/);
    if (dsf !== 1) await expect(page.getByText('Scaling note')).toBeVisible();
    await ctx.close();
  }
});

test('phones get a clear warning', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.getByText('You are on a phone or tablet')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await ctx.close();
});

test('results files: old (v1/v2) files open read-only; bad files are rejected; content is text only', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('import-input').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"nope"}') });
  await expect(page.getByRole('alert')).toContainText('not a MonitorTest results file');
  const v1 = {
    schemaVersion: 1, id: 'abc', createdAt: 0, updatedAt: 0, mode: 'quick', screen: 'report', stepIndex: 0, subStep: 0,
    phase: 'briefing', redo: false, displayReturn: false, nosignalStage: 0, unpluggedAt: null, runs: 1, runStartedAt: {},
    details: { operator: '<img src=x onerror=alert(1)>', model: 'Imported Model', serial: '', jobRef: '', monitorOnAt: 0 },
    displayCheck: null, answers: { 'ofv1.A': { status: 'problem', note: 'top edge', photo: '', at: 0 } }, flags: [], combos: [], evidence: '',
  };
  await page.getByTestId('import-input').setInputFiles({ name: 'r.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'monitortest-results', session: v1 })) });
  await expect(page.getByText('You are viewing a saved results file')).toBeVisible();
  await expect(page.getByTestId('overall')).toContainText('SERIOUS PROBLEM FOUND');
  await expect(page.getByText('<img src=x onerror=alert(1)>', { exact: true })).toBeVisible();
  expect(await page.locator('main img').count()).toBe(0);
  await page.reload();
  await expect(page.getByText('Imported Model').first()).toBeVisible();
});
