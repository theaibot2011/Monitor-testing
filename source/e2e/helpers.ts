import { expect, type Page } from '@playwright/test';

export const h1 = (page: Page) => page.locator('h1').first();

/** Reload and confirm we land on the same screen with no blank page. */
export async function refreshKeeps(page: Page, text: string | RegExp) {
  await page.reload();
  await expect(h1(page)).toContainText(text);
}

/** Home → set-up screens → first check briefing. */
export async function toFirstCheck(page: Page, purpose: RegExp = /buying/, setup: 'A laptop' | 'A desktop computer' = 'A laptop') {
  await page.goto('/');
  await page.getByRole('radio', { name: purpose }).click();
  await page.getByRole('button', { name: 'Start the check' }).click();
  await page.getByRole('radio', { name: new RegExp(setup) }).click();
  await page.getByRole('button', { name: 'I have done these' }).click();
  await page.getByRole('button', { name: 'Ready, next' }).click();
  await page.getByRole('button', { name: /Next: check the screen set-up/ }).click();
  await confirmSetup(page);
}

/** The set-up check measures the refresh rate first (about 1 s); with a fake clock, move time on. */
export async function confirmSetup(page: Page) {
  const yes = page.getByRole('button', { name: 'Yes, this page is on the monitor' });
  for (let i = 0; i < 10 && !(await yes.isVisible()); i++) {
    await page.clock.runFor(1000).catch(() => page.waitForTimeout(500));
  }
  await yes.click();
}

/** Skip the current check, confirming the question. */
export async function skipCheck(page: Page) {
  await page.getByTestId('skip-step').click();
  await page.getByTestId('confirm-skip').click();
}

/** Runs a check from its briefing, looking at each picture long enough, then answers PASSED. */
export async function passCurrentCheck(page: Page) {
  const title = await h1(page).innerText();
  await page.getByTestId('start-step').click();
  if (/Colour cycle/.test(title)) {
    await page.getByTestId('cycle-area').waitFor({ state: 'attached' });
    await page.clock.runFor(37_000);
    await page.getByRole('button', { name: 'Answer the question' }).click();
  } else if (/Slow scan/.test(title)) {
    await page.clock.runFor(11_000);
    await page.mouse.move(200, 200);
    await page.getByRole('button', { name: /Finished/ }).click();
  } else if (/No signal/.test(title)) {
    const extend = page.getByRole('button', { name: 'Done, I chose Extend' });
    if (await extend.count()) await extend.click();
    await page.getByRole('button', { name: 'I am unplugging it now' }).click();
    await page.clock.runFor(31_000);
    await page.getByRole('button', { name: 'I have plugged it back in' }).click();
    await page.getByRole('button', { name: 'Run the set-up check again' }).click();
    await confirmSetup(page);
  } else if (!/Power|Buttons|Cable sockets|Sounds|Case/.test(title)) {
    const label = page.getByTestId('pattern-label');
    await label.waitFor();
    for (;;) {
      await page.clock.runFor(5_200);
      if (!(await label.count())) break;
      const txt = await label.innerText();
      await page.keyboard.press('Space');
      await expect(label.or(page.getByTestId('answer-passed'))).not.toHaveText(txt);
    }
  }
  await expect(page.getByTestId('answer-passed')).toBeEnabled();
  await page.getByTestId('answer-passed').click();
}
