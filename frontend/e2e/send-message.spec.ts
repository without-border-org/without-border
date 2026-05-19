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

  // Go directly to the chat app (Angular SPA lives under /app/)
  await page.goto('/app/chat');
  await page.waitForURL(/\/app\/chat\//, { timeout: 15_000 });
  console.log('URL after load:', page.url());

  // Wait for message input to be visible
  const input = page.locator('textarea').first();
  await expect(input).toBeVisible({ timeout: 10_000 });

  // Wait for WS to be open — Angular logs "[WS] Connected to ..." in the console
  await page.waitForFunction(
    () => (window as any).__wsChatReady === true,
    { timeout: 8_000 }
  ).catch(() => console.log('WS ready flag not set — proceeding anyway (message will be queued)'));

  const msg = `E2E-${Date.now()}`;

  // fill() triggers Angular's ngModel via the `input` event
  await input.fill(msg);

  // Verify Angular picked up the value before sending
  const val = await input.inputValue();
  console.log('Textarea value before send:', val);
  expect(val).toBe(msg);

  // Click the send button (more reliable than Enter for Angular in headless mode)
  const sendBtn = page.locator('button[title="Envoyer (Entrée)"]');
  await expect(sendBtn).toBeVisible({ timeout: 5_000 });
  await sendBtn.click();

  await page.waitForTimeout(1_000);
  console.log('Console errors so far:', errors);

  // Message must appear in the conversation within 8 s
  const sent = page.locator(`text="${msg}"`);
  await expect(sent).toBeVisible({ timeout: 8_000 });
  console.log('✅ Message sent and visible:', msg);

  // Reload page — message must persist (stored in DB)
  await page.reload();
  await page.waitForURL(/\/app\/chat\//, { timeout: 15_000 });
  await page.waitForSelector('textarea', { timeout: 10_000 });

  const persisted = page.locator(`text="${msg}"`);
  await expect(persisted).toBeVisible({ timeout: 10_000 });
  console.log('✅ Message persisted after reload');
});
