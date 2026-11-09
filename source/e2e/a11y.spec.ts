import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { confirmSetup, h1 } from './helpers';

/** Fails on any serious or critical accessibility problem found by axe-core. */
async function scan(page: Page, where: string) {
  await page.waitForTimeout(400); // let the 0.2 s fade-in finish so mid-animation colours are not measured
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${where}: ${v.id} (${v.impact}) ${v.nodes.length}x: ${v.help}`)).toEqual([]);
}

test('no serious accessibility problems on any screen', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await scan(page, 'home');
  await page.getByRole('button', { name: 'About' }).click();
  await scan(page, 'about');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Help' }).click();
  await scan(page, 'help');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Start the check' }).click();
  await scan(page, 'before you start');
  await page.getByRole('button', { name: 'I have done these' }).click();
  await scan(page, 'getting ready');
  await page.getByRole('button', { name: 'Ready, next' }).click();
  await scan(page, 'details');
  await page.getByRole('button', { name: /Next: check the screen set-up/ }).click();
  await scan(page, 'set-up check');
  await confirmSetup(page);
  await scan(page, 'briefing');
  await page.getByTestId('start-step').click();
  await scan(page, 'pattern');
  for (let i = 0; i < 3; i++) await page.keyboard.press('Space');
  await scan(page, 'answer');
  await page.getByTestId('answer-problem').click();
  await scan(page, 'severity');
  await page.getByTestId('severity-minor').click();
  await page.getByRole('button', { name: 'Home' }).click();
  await page.getByRole('button', { name: 'See the report' }).click();
  await expect(h1(page)).toHaveText('Monitor check report');
  await scan(page, 'report');
  await page.goto('/?selftest=1');
  await expect(page.getByTestId('selfcheck-summary')).toBeVisible();
  await scan(page, 'self-check');
});
