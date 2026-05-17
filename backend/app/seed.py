"""
Seed script — full demo data matching the functional mockup.

5 users, 2 agents, 4 team channels, 5 DMs (3 human + 2 agent), messages with reactions.
All message content is stored in French (Sophie's native language) for demo
consistency. The original_language field reflects each sender's actual language
so the frontend shows the correct language badge and "traduit" indicator.

Run: cd backend && python -m app.seed
Demo password for all accounts: demo1234 (provisioned in Keycloak realm)
"""
import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from app.core.database import AsyncSessionLocal, create_tables
from app.models.models import (
    User, Channel, ChannelMember,
    Message, MessageReaction, Agent,
)

# ── Fixed UUIDs — must match Keycloak realm users ───────────────────────────
U_SOPHIE = uuid.UUID("00000000-0000-0000-0000-000000000001")
U_JOHN   = uuid.UUID("00000000-0000-0000-0000-000000000002")
U_MARIA  = uuid.UUID("00000000-0000-0000-0000-000000000003")
U_KEVIN  = uuid.UUID("00000000-0000-0000-0000-000000000004")
U_SARAH  = uuid.UUID("00000000-0000-0000-0000-000000000005")

# Channel UUIDs — team channels
C_ANNONCES  = uuid.UUID("00000000-0000-0000-0001-000000000001")
C_DEV       = uuid.UUID("00000000-0000-0000-0001-000000000002")
C_DESIGN    = uuid.UUID("00000000-0000-0000-0001-000000000003")
C_MARKETING = uuid.UUID("00000000-0000-0000-0001-000000000004")

# Channel UUIDs — pair (DM) channels
C_DM_JOHN  = uuid.UUID("00000000-0000-0000-0002-000000000001")
C_DM_MARIA = uuid.UUID("00000000-0000-0000-0002-000000000002")
C_DM_KEVIN = uuid.UUID("00000000-0000-0000-0002-000000000003")

# Agent UUIDs
A_PROJECTBOT = uuid.UUID("00000000-0000-0000-0003-000000000001")
A_TRANSBOT   = uuid.UUID("00000000-0000-0000-0003-000000000002")

# Channel UUIDs — agent DM channels (from Sophie's perspective)
C_DM_PROJECTBOT = uuid.UUID("00000000-0000-0000-0002-000000000004")
C_DM_TRANSBOT   = uuid.UUID("00000000-0000-0000-0002-000000000005")

# ── Agents ───────────────────────────────────────────────────────────────────
DEMO_AGENTS = [
    dict(
        id=A_PROJECTBOT,
        name="ProjectBot",
        description="Suivi de roadmap, jalons et sprints",
        agent_type="project_manager",
        persona=(
            "Tu es ProjectBot, un assistant IA professionnel pour WithoutBorder. "
            "Tu réponds aux @mentions en français avec un ton concis et professionnel. "
            "Tu connais le détail du Sprint 14 (18/23 tickets terminés, jalon Q4 le 15 nov). "
            "Adresse-toi toujours à l'utilisateur par son prénom."
        ),
        is_active=True,
    ),
    dict(
        id=A_TRANSBOT,
        name="TransBot",
        description="Traduction multilingue automatique",
        agent_type="translator",
        persona=(
            "Tu es TransBot, spécialisé en traduction multilingue pour WithoutBorder. "
            "Tu traduis automatiquement les messages selon le profil linguistique du destinataire. "
            "Tu opères en mode veille par défaut et peux être activé manuellement."
        ),
        is_active=True,
    ),
]

# ── Users ────────────────────────────────────────────────────────────────────
DEMO_USERS = [
    dict(
        id=U_SOPHIE, email="demo@withoutborder.app", username="Sophie Martin",
        preferred_language="fr", status="active", agentic_enabled=False,
    ),
    dict(
        id=U_JOHN, email="john@withoutborder.app", username="John Carter",
        preferred_language="en", status="active", agentic_enabled=False,
    ),
    dict(
        id=U_MARIA, email="maria@withoutborder.app", username="María García",
        preferred_language="es", status="agentic", agentic_enabled=True,
        agentic_persona="Assistante IA multilingue spécialisée en développement logiciel",
    ),
    dict(
        id=U_KEVIN, email="kevin@withoutborder.app", username="Kevin Lee",
        preferred_language="ko", status="inactive", agentic_enabled=False,
    ),
    dict(
        id=U_SARAH, email="sarah@withoutborder.app", username="Sarah Wilson",
        preferred_language="en", status="active", agentic_enabled=False,
    ),
]

# ── Channels ─────────────────────────────────────────────────────────────────
CHANNEL_DEFS = [
    dict(id=C_ANNONCES,  name="Annonces Générales",         type="team", description="TechCorp Workspace", created_by=U_JOHN),
    dict(id=C_DEV,       name="Équipe Développement Front",  type="team", description="Projet Apollo",       created_by=U_SOPHIE),
    dict(id=C_DESIGN,    name="Design System",               type="team", description="Charte graphique",    created_by=U_SOPHIE),
    dict(id=C_MARKETING, name="Marketing & Com",             type="team", description="Campagnes 2025",      created_by=U_SARAH),
    # DM channels — name = partner name (from Sophie's perspective for display)
    dict(id=C_DM_JOHN,  name="John Carter",  type="pair", description="", created_by=U_SOPHIE),
    dict(id=C_DM_MARIA, name="María García", type="pair", description="", created_by=U_SOPHIE),
    dict(id=C_DM_KEVIN, name="Kevin Lee",    type="pair", description="", created_by=U_SOPHIE),
    # Agent DM channels
    dict(id=C_DM_PROJECTBOT, name="ProjectBot", type="pair", description="Agent IA", created_by=U_SOPHIE),
    dict(id=C_DM_TRANSBOT,   name="TransBot",   type="pair", description="Agent IA", created_by=U_SOPHIE),
]

# (user_id, role)
CHANNEL_MEMBERS: dict[uuid.UUID, list[tuple[uuid.UUID, str]]] = {
    C_ANNONCES:  [(U_JOHN, "admin"), (U_SOPHIE, "member"), (U_MARIA, "member"), (U_KEVIN, "member"), (U_SARAH, "member")],
    C_DEV:       [(U_SOPHIE, "admin"), (U_JOHN, "member"), (U_MARIA, "member"), (U_KEVIN, "member")],
    C_DESIGN:    [(U_SOPHIE, "admin"), (U_MARIA, "member"), (U_JOHN, "member")],
    C_MARKETING: [(U_SARAH, "admin"), (U_JOHN, "member"), (U_KEVIN, "member"), (U_SOPHIE, "member")],
    C_DM_JOHN:   [(U_SOPHIE, "member"), (U_JOHN, "member")],
    C_DM_MARIA:  [(U_SOPHIE, "member"), (U_MARIA, "member")],
    C_DM_KEVIN:  [(U_SOPHIE, "member"), (U_KEVIN, "member")],
    C_DM_PROJECTBOT: [(U_SOPHIE, "member")],
    C_DM_TRANSBOT:   [(U_SOPHIE, "member")],
}

# ── Messages ─────────────────────────────────────────────────────────────────
def _ts(hour: int, minute: int, offset_days: int = 0) -> datetime:
    """Return today's date at the given time, minus offset_days."""
    now = datetime.now(timezone.utc)
    base = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    return base - timedelta(days=offset_days)


# Each entry: sender UUID, original_language, timestamp args, content, reactions list
# reactions = list of (reactor_uuid, emoji) — deduped on insert
MESSAGES: dict[uuid.UUID, list[dict]] = {
    C_ANNONCES: [
        dict(
            sender=U_JOHN, lang="en", hour=9, minute=12,
            content=(
                "Bonjour à toute l'équipe ! Je tenais à vous souhaiter la bienvenue sur notre nouvel "
                "espace WithoutBorder. Nous avons mis en place cet outil pour fluidifier nos échanges "
                "internationaux et supprimer les barrières linguistiques. N'oubliez pas de renseigner "
                "votre langue native dans les paramètres de votre profil afin d'activer la traduction automatique."
            ),
            reactions=[(U_SOPHIE, "🔥"), (U_SARAH, "🔥"), (U_SOPHIE, "👋"), (U_SARAH, "👋"), (U_MARIA, "👋"), (U_KEVIN, "👋")],
        ),
        dict(
            sender=U_SARAH, lang="en", hour=10, minute=45,
            content=(
                "C'est une excellente nouvelle John ! Pour le lancement de la version Beta prévu lundi "
                "prochain, est-ce que nous avons déjà finalisé le listing des testeurs externes ou "
                "faut-il que je m'en occupe d'ici la fin de journée ? J'ai déjà une liste de 15 contacts "
                "issus de notre programme early-adopters que je peux mobiliser rapidement."
            ),
            reactions=[],
        ),
        dict(
            sender=U_SOPHIE, lang="fr", hour=11, minute=12,
            content=(
                "De mon côté, je suis en pleine phase de polissage des interfaces de paiement. Je devrais "
                "pouvoir soumettre ma Pull Request d'ici ce soir. Tout sera prêt pour la revue de code de "
                "demain matin. J'ai également ajouté les états d'erreur et de succès manquants sur les "
                "formulaires de facturation, ne vous inquiétez pas !"
            ),
            reactions=[(U_JOHN, "❤️"), (U_SARAH, "❤️"), (U_MARIA, "❤️"), (U_KEVIN, "❤️"), (U_JOHN, "✅"), (U_SARAH, "✅"), (U_MARIA, "✅")],
        ),
    ],
    C_DEV: [
        dict(
            sender=U_MARIA, lang="es", hour=14, minute=20,
            content=(
                "Le composant de navigation que j'ai partagé hier sur le repo de staging est désormais "
                "totalement réactif. J'aimerais que vous testiez la fluidité des animations, notamment "
                "sur les navigateurs mobiles d'anciennes générations. Le code est documenté et des stories "
                "Storybook sont disponibles pour chaque variante."
            ),
            reactions=[(U_JOHN, "🚀")],
        ),
        dict(
            sender=U_JOHN, lang="en", hour=14, minute=25,
            content=(
                "Beau boulot María. Je vais libérer un créneau dans mon agenda cet après-midi pour tester "
                "ça en profondeur sur iOS Safari et Chrome Android. Si tout est correct, on pourra "
                "l'intégrer au master dès demain matin et planifier la démo client pour jeudi."
            ),
            reactions=[],
        ),
        dict(
            sender=U_SOPHIE, lang="fr", hour=15, minute=2,
            content=(
                "J'ai identifié une régression dans le module de gestion des tokens d'authentification "
                "sur Safari 16. Le problème semble lié à une incompatibilité avec la nouvelle politique "
                "SameSite des cookies. Je vais ouvrir un ticket Jira avec les étapes de reproduction "
                "et prioriser le correctif pour demain matin avant le standup."
            ),
            reactions=[(U_JOHN, "🔍"), (U_MARIA, "🔍")],
        ),
        dict(
            sender=U_KEVIN, lang="ko", hour=15, minute=48,
            content=(
                "Rapport de tests inter-navigateurs : Chrome 120 ✓, Firefox 121 ✓, Safari 16 → bug tokens "
                "confirmé (Sophie s'en occupe), Edge 120 ✓. Sur mobile, j'ai noté un décalage de 3 px sur "
                "l'alignement vertical des icônes sous Android 12. Rien de bloquant pour le lancement, "
                "mais j'ouvre un ticket P3 pour le corriger la semaine prochaine."
            ),
            reactions=[],
        ),
        dict(
            sender=U_MARIA, lang="es", hour=16, minute=10,
            content=(
                "Merci Kevin pour ce rapport complet. Pour le bug Safari, j'ai une piste : il faudra "
                "migrer vers les headers d'autorisation Bearer plutôt que les cookies pour ce module "
                "spécifique. Je prépare un POC ce soir et je partage le lien au repo demain matin. "
                "Le ticket Android est assigné, on le traite en sprint 14."
            ),
            reactions=[(U_JOHN, "👍"), (U_SOPHIE, "👍"), (U_KEVIN, "👍")],
        ),
    ],
    C_DESIGN: [
        dict(
            sender=U_SOPHIE, lang="fr", hour=10, minute=5,
            content=(
                "J'ai finalisé la première version de notre système de design tokens. Vous trouverez dans "
                "Figma les nouvelles variables pour les couleurs, la typographie et les espacements. Toutes "
                "les couleurs sont déclinées en mode sombre et clair avec des ratios de contraste conformes "
                "aux normes WCAG 2.1 AA. Le lien de review est dans le ticket DS-42."
            ),
            reactions=[(U_JOHN, "🎨"), (U_MARIA, "🎨"), (U_KEVIN, "🎨"), (U_JOHN, "❤️"), (U_MARIA, "❤️")],
        ),
        dict(
            sender=U_MARIA, lang="es", hour=10, minute=32,
            content=(
                "Super boulot Sophie ! J'ai commencé à intégrer les tokens dans la codebase via des variables "
                "CSS custom properties. Pour les animations, je propose d'ajouter deux variables : "
                "--transition-fast à 150 ms et --transition-smooth à 250 ms, pour standardiser les durées à "
                "travers toute l'application. Est-ce que l'équipe valide ces valeurs avant que je les merge ?"
            ),
            reactions=[(U_SOPHIE, "✅"), (U_JOHN, "✅"), (U_KEVIN, "✅"), (U_SARAH, "✅")],
        ),
        dict(
            sender=U_JOHN, lang="en", hour=11, minute=15,
            content=(
                "Je valide la proposition de María, les durées sont cohérentes avec nos benchmarks UX. "
                "Concernant les icônes, j'ai fait une revue avec l'équipe produit et nous recommandons "
                "d'adopter Phosphor Icons comme librairie principale. Elle est plus fournie que Heroicons "
                "et sa licence MIT est compatible avec notre contexte commercial. On peut migrer progressivement."
            ),
            reactions=[(U_SOPHIE, "🔥"), (U_MARIA, "🔥")],
        ),
    ],
    C_MARKETING: [
        dict(
            sender=U_SARAH, lang="en", hour=9, minute=30,
            content=(
                "Bonne nouvelle pour la campagne Q2 : les résultats des tests A/B sur nos landing pages "
                "montrent que la variante avec un témoignage client en haut de page génère 34 % de "
                "conversions supplémentaires. Je recommande de déployer cette version sur l'ensemble de "
                "nos marchés actifs dès lundi prochain. Le rapport complet est dans Notion."
            ),
            reactions=[
                (U_JOHN, "📈"), (U_SOPHIE, "📈"), (U_MARIA, "📈"), (U_KEVIN, "📈"),
                (U_SOPHIE, "🔥"), (U_JOHN, "🔥"), (U_MARIA, "🔥"),
            ],
        ),
        dict(
            sender=U_JOHN, lang="en", hour=9, minute=47,
            content=(
                "Excellente performance Sarah, +34 % c'est au-dessus de nos objectifs initiaux. Pour "
                "capitaliser sur ces chiffres auprès des équipes commerciales, pouvez-vous préparer un "
                "deck synthétique résumant les KPIs du trimestre ? Il nous faut quelque chose de visuel "
                "et percutant pour le board meeting du 15. On peut allouer deux jours dédiés si nécessaire."
            ),
            reactions=[],
        ),
        dict(
            sender=U_KEVIN, lang="ko", hour=10, minute=15,
            content=(
                "Pour information, j'ai finalisé l'intégration du pixel de tracking sur toutes les "
                "nouvelles pages produit lancées ce trimestre. Le flux de données vers notre CRM HubSpot "
                "est maintenant pleinement opérationnel. Vous devriez voir les premières données "
                "consolidées dans le dashboard Analytics d'ici 24 heures. Signalez-moi toute anomalie."
            ),
            reactions=[(U_JOHN, "🙌"), (U_SOPHIE, "🙌")],
        ),
        dict(
            sender=U_SOPHIE, lang="fr", hour=11, minute=0,
            content=(
                "Concernant le calendrier éditorial du mois prochain, j'ai préparé une proposition de "
                "12 publications réparties sur 3 semaines actives. J'ai favorisé du contenu éducatif à "
                "60 % et des cas clients à 40 % pour renforcer notre positionnement expert sur le marché "
                "de la collaboration internationale. Le document est dans la section Ressources Partagées."
            ),
            reactions=[(U_JOHN, "📅")],
        ),
    ],
    C_DM_JOHN: [
        dict(
            sender=U_JOHN, lang="en", hour=14, minute=10,
            content=(
                "Salut Sophie, est-ce que tu as quelques minutes pour discuter des derniers ajustements "
                "du design ? J'ai reçu des retours client assez précis sur la taille des boutons de "
                "validation sur mobile. Certains utilisateurs sur iPhone SE trouvent la zone de tap trop "
                "petite et génèrent des erreurs de clic fréquentes."
            ),
            reactions=[],
        ),
        dict(
            sender=U_SOPHIE, lang="fr", hour=14, minute=15,
            content=(
                "Salut John ! Oui bien sûr, je suis d'accord avec ce retour. Sur les écrans 5 pouces le "
                "padding actuel est insuffisant. Je vais augmenter la zone tactile à 48×48 px minimum "
                "(recommandation Material Design), agrandir la police à 15 px et revoir les marges internes. "
                "Je pousse le patch sur la branche fix/button-touch-targets d'ici une heure."
            ),
            reactions=[(U_JOHN, "🙏")],
        ),
    ],
    C_DM_MARIA: [
        dict(
            sender=U_MARIA, lang="es", hour=8, minute=0, is_agentic=True,
            content=(
                "Bonjour Sophie ! Mode Agentic activé. J'ai analysé vos 14 derniers commits sur la branche "
                "feature/i18n et identifié plusieurs zones d'amélioration dans la documentation de l'API "
                "de traduction. Le nouveau endpoint /detect-language introduit la semaine dernière n'est "
                "pas encore couvert. Je peux rédiger les sections manquantes du README si vous le souhaitez."
            ),
            reactions=[],
        ),
        dict(
            sender=U_SOPHIE, lang="fr", hour=8, minute=5,
            content=(
                "Parfait, c'est exactement ce dont j'avais besoin ! Peux-tu me résumer les changements "
                "structurants sur l'API de traduction depuis le sprint 11 ? Je veux aussi comprendre "
                "pourquoi le endpoint /detect-language retourne désormais un score de confiance alors "
                "qu'avant il renvoyait juste un code langue. C'est un breaking change ?"
            ),
            reactions=[],
        ),
    ],
    C_DM_KEVIN: [
        dict(
            sender=U_KEVIN, lang="ko", hour=16, minute=30, offset_days=1,
            content=(
                "Hey Sophie, j'ai enfin isolé la cause du bug sur les z-index de la modale de profil. "
                "C'était un conflit de stacking context avec le header en position fixed et l'élément "
                "parent qui avait un transform CSS non intentionnel. Le correctif est sur la branche "
                "bugfix/profile-modal, peux-tu valider en recette avant que je fasse la PR ?"
            ),
            reactions=[(U_SOPHIE, "🐛")],
        ),
    ],
    C_DM_PROJECTBOT: [
        dict(
            sender=U_SOPHIE, lang="fr", hour=9, minute=2,
            content="@ProjectBot peux-tu me résumer où en est le sprint en cours ?",
            reactions=[],
        ),
        dict(
            sender=U_SOPHIE, lang="fr", hour=9, minute=3, is_agentic=True,
            content=(
                "Bonjour Sophie ! Sprint 14 : 18 tickets terminés sur 23 (78 %). "
                "Trois sont en revue de code, deux bloqués sur dépendance externe. "
                "Le jalon Q4 reste planifié au 15 novembre. Voulez-vous le détail par épopée ?"
            ),
            reactions=[],
        ),
    ],
    C_DM_TRANSBOT: [
        dict(
            sender=U_SOPHIE, lang="fr", hour=8, minute=30, is_agentic=True,
            content=(
                "Mode veille. Je traduis automatiquement les messages dès qu'un membre "
                "n'a pas la langue de l'expéditeur dans son profil. Activez les déclencheurs "
                "dans la configuration pour me solliciter manuellement."
            ),
            reactions=[],
        ),
    ],
}


# ── Seed function ─────────────────────────────────────────────────────────────
async def seed() -> None:
    print("🌱 Seeding database...")
    await create_tables()

    async with AsyncSessionLocal() as db:
        # Idempotency — skip if already seeded
        result = await db.execute(select(User).where(User.email == "demo@withoutborder.app"))
        if result.scalar_one_or_none():
            print("✅ Already seeded — skipping. Drop tables and re-run to reset.")
            return

        # Users
        users: dict[uuid.UUID, User] = {}
        for u in DEMO_USERS:
            user = User(
                id=u["id"],
                email=u["email"],
                username=u["username"],
                preferred_language=u["preferred_language"],
                status=u["status"],
                agentic_enabled=u.get("agentic_enabled", False),
                agentic_persona=u.get("agentic_persona"),
                is_active=True,
            )
            db.add(user)
            users[u["id"]] = user
        await db.flush()
        print(f"  ✓ {len(users)} users created")

        # Agents
        for a in DEMO_AGENTS:
            agent = Agent(
                id=a["id"],
                name=a["name"],
                description=a.get("description"),
                agent_type=a["agent_type"],
                persona=a.get("persona"),
                is_active=a.get("is_active", True),
            )
            db.add(agent)
        await db.flush()
        print(f"  ✓ {len(DEMO_AGENTS)} agents created")

        # Channels + memberships
        for ch_def in CHANNEL_DEFS:
            ch = Channel(
                id=ch_def["id"],
                name=ch_def["name"],
                description=ch_def.get("description", ""),
                type=ch_def["type"],
                created_by=ch_def["created_by"],
            )
            db.add(ch)
            await db.flush()
            for user_id, role in CHANNEL_MEMBERS[ch_def["id"]]:
                db.add(ChannelMember(channel_id=ch.id, user_id=user_id, role=role))
        await db.flush()
        print(f"  ✓ {len(CHANNEL_DEFS)} channels created")

        # Messages + reactions
        total_msgs = 0
        total_reactions = 0
        for channel_id, msg_list in MESSAGES.items():
            for m in msg_list:
                ts = _ts(m["hour"], m["minute"], m.get("offset_days", 0))
                msg = Message(
                    id=uuid.uuid4(),
                    channel_id=channel_id,
                    sender_id=m["sender"],
                    original_content=m["content"],
                    original_language=m["lang"],
                    is_agentic=m.get("is_agentic", False),
                    created_at=ts,
                    updated_at=ts,
                )
                db.add(msg)
                await db.flush()
                total_msgs += 1

                # Reactions — deduplicate (message_id, user_id, emoji)
                seen: set[tuple[uuid.UUID, str]] = set()
                for reactor_id, emoji in m.get("reactions", []):
                    if (reactor_id, emoji) in seen:
                        continue
                    seen.add((reactor_id, emoji))
                    db.add(MessageReaction(
                        message_id=msg.id,
                        user_id=reactor_id,
                        emoji=emoji,
                    ))
                    total_reactions += 1

        await db.commit()
        print(f"  ✓ {total_msgs} messages created")
        print(f"  ✓ {total_reactions} reactions seeded")

    print("\n✅ Seed complete!")
    print("\n📋 Demo accounts (password: demo1234, login with email):")
    print("┌──────────────────────────────────┬───────────────┬──────┬──────────┐")
    print("│ Email                            │ Username       │ Lang │ Status   │")
    print("├──────────────────────────────────┼───────────────┼──────┼──────────┤")
    for u in DEMO_USERS:
        print(f"│ {u['email']:<32} │ {u['username']:<15} │ {u['preferred_language']:<4} │ {u['status']:<8} │")
    print("└──────────────────────────────────┴───────────────┴──────┴──────────┘")
    print("\n🌐 Frontend: http://localhost:4200  |  📖 API: http://localhost:8000/docs")


if __name__ == "__main__":
    asyncio.run(seed())
