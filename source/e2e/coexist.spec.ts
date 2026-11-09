import { expect, test } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { h1 } from './helpers';

// Your GitHub Pages layout: /Monitor-testing/v2/ and /Monitor-testing/v3/ on the same address.
// Uses the real v2 files from the repository if they are next to this project.
const V2_DIR = process.env.V2_DIR || '../theaibot2011/monitor-testing/v2';

test('opening v2 on the same address never deletes v3 progress', async ({ page }) => {
  test.skip(!existsSync(V2_DIR), 'v2 files not available');
  await page.route('http://localhost:4173/Monitor-testing/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/Monitor-testing/', '');
    const [ver, ...rest] = path.split('/');
    const rel = rest.join('/') || 'index.html';
    if (ver === 'v2') {
      const file = join(V2_DIR, rel);
      const type = rel.endsWith('.js') ? 'text/javascript' : rel.endsWith('.css') ? 'text/css' : 'text/html';
      return route.fulfill({ body: readFileSync(existsSync(file) ? file : join(V2_DIR, 'index.html')), contentType: type });
    }
    const res = await route.fetch({ url: `http://localhost:4173/${rel}` });
    return route.fulfill({ response: res });
  });
  await page.goto('/Monitor-testing/v3/');
  await page.getByRole('button', { name: 'Start the check' }).click();
  await page.getByRole('button', { name: 'I have done these' }).click();
  await page.getByRole('button', { name: 'Ready, next' }).click();
  await page.getByLabel('Monitor make and model').fill('Keep Me 27');
  await page.goto('/Monitor-testing/v2/');
  await expect(h1(page)).toHaveText('MonitorTest');
  await page.goto('/Monitor-testing/v3/');
  await expect(h1(page)).toHaveText('About this monitor');
  await expect(page.getByLabel('Monitor make and model')).toHaveValue('Keep Me 27');
});
