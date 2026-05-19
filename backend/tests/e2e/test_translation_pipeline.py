"""
E2E — Scenario 1: Pipeline de traduction Gemma 4

Cible: https://wb.canadaquebec.ca (AUTH_DISABLED=true)
Approche: sélection de l'utilisateur via localStorage (wb_dev_user_id)

John (lang=en) envoie un message en anglais dans "Annonces Générales".
Sophie (lang=fr) doit voir ce message traduit en français par Gemma 4.
"""
import pytest
from pytest_bdd import scenario, given, when, then
from playwright.sync_api import Page

from tests.e2e.conftest import (
    USER_JOHN, USER_SOPHIE,
    TRANSLATION_WAIT_MS,
    navigate_to_channel, send_message,
)

FEATURE = "features/translation_pipeline.feature"
ORIGINAL_MESSAGE = "The sprint review is scheduled for Friday at 3pm"


# ─── Scenario binding ────────────────────────────────────────────────────────

@scenario(FEATURE, "Un message en anglais est traduit en français pour Sophie")
def test_translation_en_to_fr():
    """Vérifie que le pipeline de traduction Gemma 4 fonctionne de bout en bout."""


# ─── Shared state ────────────────────────────────────────────────────────────

@pytest.fixture
def john_page_store():
    return {"page": None}


@pytest.fixture
def sophie_page_store():
    return {"page": None}


@pytest.fixture
def original_message_store():
    return {"value": None}


# ─── Given ───────────────────────────────────────────────────────────────────

@given("l'application est démarrée sur la démo")
def app_is_running():
    """Précondition documentaire — le stack est up et accessible."""


@given("John est l'utilisateur actif dans le contexte A", target_fixture="john_page")
def john_is_active(open_context) -> Page:
    """Ouvre un onglet en tant que John (UUID seedé) via localStorage."""
    return open_context(USER_JOHN)


@given('John navigue vers le canal "Annonces Générales" dans le contexte A')
def john_navigates(john_page: Page) -> None:
    navigate_to_channel(john_page, "Annonces Générales")


# ─── When ────────────────────────────────────────────────────────────────────

@when(
    'John envoie le message "The sprint review is scheduled for Friday at 3pm"',
    target_fixture="original_message",
)
def john_sends_message(john_page: Page) -> str:
    send_message(john_page, ORIGINAL_MESSAGE)
    # Laisser Gemma 4 produire la traduction pour tous les membres
    john_page.wait_for_timeout(TRANSLATION_WAIT_MS)
    return ORIGINAL_MESSAGE


@given("Sophie est l'utilisateur actif dans le contexte B", target_fixture="sophie_page")
def sophie_is_active(open_context) -> Page:
    """Ouvre un second onglet (contexte isolé) en tant que Sophie."""
    return open_context(USER_SOPHIE)


@given('Sophie navigue vers le canal "Annonces Générales" dans le contexte B')
def sophie_navigates(sophie_page: Page) -> None:
    navigate_to_channel(sophie_page, "Annonces Générales")
    sophie_page.wait_for_timeout(3_000)


# ─── Then ─────────────────────────────────────────────────────────────────────

@then("Sophie voit le dernier message dans le canal")
def sophie_sees_messages(sophie_page: Page) -> None:
    messages = sophie_page.locator('[class*="message"], [class*="bubble"], [class*="msg"]')
    messages.last.wait_for(state="visible", timeout=10_000)
    count = messages.count()
    assert count > 0, "Aucun message visible dans le canal pour Sophie"


@then("le message affiché à Sophie est différent du texte original anglais")
def message_is_translated(sophie_page: Page, original_message: str) -> None:
    """
    Sophie (lang=fr) doit voir le message traduit. Le texte anglais original ne doit
    pas apparaître directement. Si Gemma 4 est indisponible, le backend retourne le
    texte original en fallback — le test échoue alors intentionnellement.
    """
    messages = sophie_page.locator('[class*="message"], [class*="bubble"], [class*="msg"]')
    # Collect all visible text
    all_text = sophie_page.inner_text("body")

    assert original_message not in all_text, (
        f"Le message n'a PAS été traduit — Sophie voit encore l'anglais original.\n"
        f"Message original : '{original_message}'\n"
        f"Vérifier qu'Ollama tourne et que gemma4:9b est disponible sur le serveur demo."
    )
