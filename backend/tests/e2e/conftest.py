"""
Shared fixtures and helpers for Playwright E2E tests targeting the demo.

Prerequisites:
  - pip install pytest-playwright pytest-bdd
  - playwright install chromium
  - Demo running at https://wb.canadaquebec.ca/ with AUTH_DISABLED=true
"""
import pytest
from playwright.sync_api import sync_playwright, Browser, BrowserContext, Page

BASE_URL = "https://wb.canadaquebec.ca"

# Fixed UUIDs from backend/app/seed.py
USER_SOPHIE = "00000000-0000-0000-0000-000000000001"
USER_JOHN   = "00000000-0000-0000-0000-000000000002"
USER_MARIA  = "00000000-0000-0000-0000-000000000003"
USER_KEVIN  = "00000000-0000-0000-0000-000000000004"
USER_SARAH  = "00000000-0000-0000-0000-000000000005"

USERNAMES = {
    USER_SOPHIE: "Sophie Martin",
    USER_JOHN:   "John Carter",
    USER_MARIA:  "María García",
    USER_KEVIN:  "Kevin Lee",
    USER_SARAH:  "Sarah Wilson",
}

# Time (ms) to wait for Gemma 4 translation to complete
TRANSLATION_WAIT_MS = 15_000
# Time (ms) to wait for agentic reply
AGENTIC_WAIT_MS = 30_000


@pytest.fixture(scope="module")
def browser():
    """Headless Chromium — no UI shown (required by user)."""
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        yield b
        b.close()


@pytest.fixture
def open_context(browser: Browser):
    """Factory: creates isolated BrowserContexts that are closed after the test."""
    created: list[BrowserContext] = []

    def _new(user_id: str | None = None) -> Page:
        ctx = browser.new_context()
        created.append(ctx)
        page = ctx.new_page()

        # Preset dev_user_id in localStorage before loading the app
        if user_id:
            page.add_init_script(f"localStorage.setItem('wb_dev_user_id', '{user_id}')")

        page.goto(BASE_URL, wait_until="domcontentloaded")
        # Wait for sidebar to confirm app is loaded
        page.wait_for_selector("aside", timeout=20_000)
        return page

    yield _new

    for ctx in created:
        try:
            ctx.close()
        except Exception:
            pass


# ─── helpers ─────────────────────────────────────────────────────────────────

def switch_user(page: Page, user_id: str) -> None:
    """
    Switch the current dev user via localStorage + reload.
    The picker auto-reads from localStorage on init, so a reload is enough.
    """
    page.evaluate(f"localStorage.setItem('wb_dev_user_id', '{user_id}')")
    page.reload(wait_until="domcontentloaded")
    page.wait_for_selector("aside", timeout=20_000)


def navigate_to_channel(page: Page, channel_name: str) -> None:
    """Click on a channel by (partial) name in the sidebar and wait for the message area."""
    page.locator(f"text={channel_name}").first.click()
    page.wait_for_selector("textarea, [class*='message'], [class*='input']", timeout=15_000)
    page.wait_for_timeout(1_000)


def send_message(page: Page, text: str) -> None:
    """Type a message in the textarea and submit."""
    textarea = page.locator("textarea").first
    textarea.wait_for(state="visible", timeout=10_000)
    textarea.fill(text)
    textarea.press("Enter")
    page.wait_for_timeout(500)
