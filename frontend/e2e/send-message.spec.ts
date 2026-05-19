import { test, expect } from '@playwright/test';

/**
 * Focused test: verify message sending works end-to-end.
 * Runs against PLAYWRIGHT_BASE_URL (defaults to localhost:4200).
 */
test('send-message: user can type and send a message that persists', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
    if (msg.text().startsWith('[WS]')) console.log('WS log:', msg.text());
  });

  console.log('Step 1: navigating...');
  await page.goto('/app/chat');
  console.log('Step 2: waiting for channel URL...');
  await page.waitForURL(/\/app\/chat\//, { timeout: 15_000 });
  console.log('Step 3: URL =', page.url());

  const input = page.locator('textarea').first();
  console.log('Step 4: waiting for textarea...');
  await expect(input).toBeVisible({ timeout: 10_000 });
  console.log('Step 5: textarea visible, waiting 2s for WS...');

  await page.waitForTimeout(2_000);
  console.log('Step 6: filling textarea...');

  const msg = `E2E-${Date.now()}`;
  await input.click();
  console.log('Step 7: clicked input');

  await input.fill(msg);
  console.log('Step 8: filled input');

  const val = await input.inputValue();
  console.log('Step 9: textarea value =', val);
  expect(val).toBe(msg);

  console.log('Step 10: pressing Enter...');
  await input.press('Enter');

  console.log('Step 11: waiting 2s...');
  await page.waitForTimeout(2_000);

  console.log('Step 12: checking for message in chat...');
  console.log('Errors so far:', errors);

  const sent = page.locator(`text="${msg}"`);
  await expect(sent).toBeVisible({ timeout: 10_000 });
  console.log('✅ Message sent and visible');

  // Reload — message must persist (stored in DB)
  console.log('Step 13: reloading to verify persistence...');
  await page.reload();
  await page.waitForURL(/\/app\/chat\//, { timeout: 15_000 });
  await page.waitForSelector('textarea', { timeout: 10_000 });
  await expect(page.locator(`text="${msg}"`)).toBeVisible({ timeout: 10_000 });
  console.log('✅ Message persisted after reload');
});
