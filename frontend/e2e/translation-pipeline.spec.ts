import { test, expect, Page, APIRequestContext } from '@playwright/test';

type DevUser = {
  id: string;
  username: string;
  preferred_language: string;
};

type Channel = {
  id: string;
  name: string;
  type: 'team' | 'pair';
};

const APP_BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4200';
const APP_BASE_PATH = new URL(APP_BASE_URL).pathname.replace(/\/$/, '') === '/'
  ? ''
  : new URL(APP_BASE_URL).pathname.replace(/\/$/, '');
const API_BASE_URL = process.env.PLAYWRIGHT_API_BASE_URL
  ?? (APP_BASE_URL.includes('localhost:4200')
    ? 'http://localhost:8000/api/v1'
    : new URL('/app/api/v1', APP_BASE_URL).toString());
const TRANSLATION_TIMEOUT = 30_000;
const LANGUAGE_BADGES: Record<string, string> = {
  en: 'GB',
  fr: 'FR',
  es: 'ES',
  de: 'DE',
  ko: 'KR',
  pt: 'BR',
};

function appPath(path: string): string {
  return `${APP_BASE_PATH}${path}`;
}

function languageBadge(language: string): string {
  return LANGUAGE_BADGES[language] ?? language.toUpperCase();
}

async function getDevUsers(request: APIRequestContext): Promise<DevUser[]> {
  const response = await request.get(`${API_BASE_URL}/users/dev/list`, {
    headers: { 'X-Dev-User-Id': '00000000-0000-0000-0000-000000000001' },
  });

  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function getChannels(request: APIRequestContext, userId: string): Promise<Channel[]> {
  const response = await request.get(`${API_BASE_URL}/channels`, {
    headers: { 'X-Dev-User-Id': userId },
  });

  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function resolveScenario(request: APIRequestContext): Promise<{ sender: DevUser; receiver: DevUser; channel: Channel }> {
  const users = await getDevUsers(request);
  const sender = users.find(user => user.preferred_language === 'en');
  const receiver = users.find(user => user.preferred_language === 'fr' && user.id !== sender?.id);

  expect(sender, 'Expected an English-speaking seeded user').toBeTruthy();
  expect(receiver, 'Expected a French-speaking seeded user').toBeTruthy();

  const [senderChannels, receiverChannels] = await Promise.all([
    getChannels(request, sender!.id),
    getChannels(request, receiver!.id),
  ]);

  const receiverChannelIds = new Set(receiverChannels.map(channel => channel.id));
  const channel = senderChannels.find(channel => channel.type === 'pair' && receiverChannelIds.has(channel.id))
    ?? senderChannels.find(channel => channel.type === 'team' && receiverChannelIds.has(channel.id));

  expect(channel, 'Expected a shared pair or team channel for the selected users').toBeTruthy();

  return {
    sender: sender!,
    receiver: receiver!,
    channel: channel!,
  };
}

async function waitForChatReady(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.locator('textarea[placeholder="Envoyer un message..."]').waitFor({
    state: 'visible',
    timeout: 20_000,
  });
  await page.locator('wb-dev-user-picker').waitFor({ state: 'visible', timeout: 20_000 });
}

async function openChatAs(page: Page, userId: string, channelId: string): Promise<void> {
  await page.addInitScript(value => window.localStorage.setItem('wb_dev_user_id', value), userId);
  await page.goto(appPath(`/chat/${channelId}`));
  await waitForChatReady(page);
}

async function sendMessage(page: Page, message: string): Promise<void> {
  const composer = page.locator('textarea[placeholder="Envoyer un message..."]');
  await composer.fill(message);
  await composer.press('Enter');
  await expect(page.getByText(message, { exact: true })).toBeVisible({ timeout: 10_000 });
}

async function switchUser(page: Page, username: string): Promise<void> {
  const picker = page.locator('wb-dev-user-picker');
  await picker.locator('button').click();
  await picker.locator('li', { hasText: username }).click();
  await expect(picker.locator('button')).toContainText(username, { timeout: 10_000 });
  await expect(page).toHaveURL(/\/chat(?:\/[^/?#]+)?/, { timeout: 15_000 });
  await page.locator('textarea[placeholder="Envoyer un message..."]').waitFor({
    state: 'visible',
    timeout: 20_000,
  });
}

function latestBubble(page: Page) {
  return page.locator('wb-message-bubble').last();
}

async function latestDisplayedText(page: Page): Promise<string> {
  return (await latestBubble(page).locator('p').first().textContent())?.trim() ?? '';
}

test.describe('Translation pipeline in AUTH_DISABLED mode', () => {
  test('persists translations across refresh and user switches', async ({ page, request }) => {
    const { sender, receiver, channel } = await resolveScenario(request);
    const senderMessage = `Roadmap update ${Date.now()} - please review the delivery checklist.`;
    const receiverMessage = `Bonjour ${Date.now()} - la version française est prête pour validation.`;

    await openChatAs(page, sender.id, channel.id);
    await sendMessage(page, senderMessage);
    await expect(latestBubble(page)).toContainText(sender.username);

    await switchUser(page, receiver.username);
    await page.goto(appPath(`/chat/${channel.id}`));
    await waitForChatReady(page);

    await expect(latestBubble(page)).toContainText(languageBadge(sender.preferred_language));
    await expect(latestBubble(page)).toContainText('文 traduit', { timeout: TRANSLATION_TIMEOUT });
    await expect.poll(async () => latestDisplayedText(page), { timeout: TRANSLATION_TIMEOUT }).not.toBe(senderMessage);
    const translatedForReceiver = await latestDisplayedText(page);
    expect(translatedForReceiver).toBeTruthy();
    expect(translatedForReceiver).not.toBe(senderMessage);

    await page.reload();
    await waitForChatReady(page);
    await expect(latestBubble(page)).toContainText('文 traduit');
    await expect.poll(async () => latestDisplayedText(page), { timeout: 10_000 }).toBe(translatedForReceiver);

    await sendMessage(page, receiverMessage);
    await expect(latestBubble(page)).toContainText(receiver.username);

    await switchUser(page, sender.username);
    await page.goto(appPath(`/chat/${channel.id}`));
    await waitForChatReady(page);

    await expect(latestBubble(page)).toContainText(languageBadge(receiver.preferred_language));
    await expect(latestBubble(page)).toContainText('文 traduit', { timeout: TRANSLATION_TIMEOUT });
    await expect.poll(async () => latestDisplayedText(page), { timeout: TRANSLATION_TIMEOUT }).not.toBe(receiverMessage);
  });
});
