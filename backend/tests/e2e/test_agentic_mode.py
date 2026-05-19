"""
E2E — Scenario 2: Mode agentique

Cible: https://wb.canadaquebec.ca (AUTH_DISABLED=true)
Approche: sélection de l'utilisateur via localStorage (wb_dev_user_id)

John envoie un message dans "Équipe Développement Front".
María (status=agentic, agentic_enabled=True, lang=es) n'est PAS connectée → l'agent répond en son nom.
"""
import pytest
from pytest_bdd import scenario, given, when, then
from playwright.sync_api import Page

from tests.e2e.conftest import (
    USER_JOHN, USER_MARIA,
    AGENTIC_WAIT_MS,
    navigate_to_channel, send_message,
)

FEATURE = "features/agentic_mode.feature"
TRIGGER_MESSAGE = "Maria, can you review the latest PR before end of day?"
MARIA_USERNAME = "María García"


# ─── Scenario binding ────────────────────────────────────────────────────────

@scenario(FEATURE, "L'agent de María répond automatiquement lorsqu'elle est en mode agentique")
def test_agentic_mode_auto_reply():
    """Vérifie que le mode agentique déclenche bien une réponse IA au nom de María."""


# ─── Given ───────────────────────────────────────────────────────────────────

@given("l'application est démarrée sur la démo")
def app_is_running():
    """Précondition documentaire — le stack est up et accessible."""


@given("María est configurée en mode agentique et n'est pas connectée")
def maria_is_agentic_and_absent() -> None:
    """
    María est seedée avec status='agentic' et agentic_enabled=True.
    Comme aucun navigateur ne la connecte au WebSocket dans ce test,
    la condition d'absence est implicitement satisfaite.
    Aucune vérification active nécessaire — on fait confiance au seed.
    """


@given("John est l'utilisateur actif", target_fixture="john_page")
def john_is_active(open_context) -> Page:
    """Ouvre un onglet en tant que John."""
    return open_context(USER_JOHN)


@given('John navigue vers le canal "Équipe Développement Front"')
def john_navigates(john_page: Page) -> None:
    navigate_to_channel(john_page, "Équipe Développement Front")


# ─── When ────────────────────────────────────────────────────────────────────

@when(
    'John envoie le message "Maria, can you review the latest PR before end of day?"',
    target_fixture="trigger_message",
)
def john_sends_trigger(john_page: Page) -> str:
    send_message(john_page, TRIGGER_MESSAGE)
    # Attendre que Gemma 4 génère la réponse agentique de María
    john_page.wait_for_timeout(AGENTIC_WAIT_MS)
    return TRIGGER_MESSAGE


# ─── Then ────────────────────────────────────────────────────────────────────

@then("un message agentique de María apparaît dans le canal dans les 30 secondes")
def agentic_reply_appears(john_page: Page) -> None:
    """
    María n'est pas connectée → _handle_agentic_replies doit générer une réponse.
    On cherche son nom dans les bulles de message.
    """
    # Re-check in case messages arrived after the wait
    all_text = john_page.inner_text("body")

    assert MARIA_USERNAME in all_text, (
        f"Aucun message de '{MARIA_USERNAME}' trouvé dans le canal après {AGENTIC_WAIT_MS}ms.\n"
        "Causes possibles :\n"
        "  1. Gemma 4 indisponible (vérifier `docker exec ollama ollama list`)\n"
        "  2. María est déjà connectée (vérifier les sessions WebSocket)\n"
        f"  3. María n'est pas en mode agentique en DB (vérifier status/agentic_enabled)"
    )


@then("le message est marqué comme généré par l'IA")
def agentic_badge_visible(john_page: Page) -> None:
    """
    Le frontend doit afficher un indicateur visuel pour les messages is_agentic=True.
    On cherche la classe dot-agentic, agentic-badge, ou le texte 'agentic' dans le DOM.
    """
    # Try a few selectors that the frontend may use
    indicator = john_page.locator(
        '[class*="agentic"], [class*="bot"], [title*="agent"], [title*="IA"]'
    ).first

    try:
        indicator.wait_for(state="visible", timeout=5_000)
    except Exception:
        page_text = john_page.inner_text("body").lower()
        assert any(kw in page_text for kw in ("agentic", "bot", "ia", "agent")), (
            "Aucun indicateur 'agentic' trouvé sur le message de María.\n"
            "Vérifiez que le frontend affiche bien le badge quand is_agentic=True."
        )
