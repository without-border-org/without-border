"""
Seed script — creates demo users, channels, and messages for testing.

With Keycloak integration, users are authenticated externally. This seed creates
the local database mirror of users that already exist in Keycloak.

Run with:
    cd backend && python -m app.seed

Demo accounts (must exist in Keycloak — run scripts/provision_keycloak.py first):
  demo@withoutborder.app   (Sophie  — fr)
  john@withoutborder.app   (John    — en)
  maria@withoutborder.app  (Maria   — es)
  li@withoutborder.app     (Li Ming — zh)

⚠  UUIDs MUST match those used when provisioning Keycloak users.
   See: scripts/provision_keycloak.py
"""
import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from app.core.database import AsyncSessionLocal, create_tables
from app.models.models import User, Channel, ChannelMember, Message, MessageTranslation

# UUIDs must match those set by scripts/provision_keycloak.py
# These are fixed so that Keycloak sub == local user.id
DEMO_USERS = [
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000001"),
        "email": "demo@withoutborder.app",
        "username": "sophie",
        "preferred_language": "fr",
        "agentic_enabled": False,
        "status": "active",
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000002"),
        "email": "john@withoutborder.app",
        "username": "john",
        "preferred_language": "en",
        "agentic_enabled": False,
        "status": "active",
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000003"),
        "email": "maria@withoutborder.app",
        "username": "maria",
        "preferred_language": "es",
        "agentic_enabled": False,
        "status": "active",
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000004"),
        "email": "li@withoutborder.app",
        "username": "li",
        "preferred_language": "zh",
        "agentic_enabled": False,
        "status": "active",
    },
]

DEMO_MESSAGES = [
    ("sophie", "Bonjour à tous ! Bienvenue sur notre espace de collaboration 🎉"),
    ("john",   "Great to have everyone here. Let's build something amazing!"),
    ("maria",  "¡Hola a todos! La función de traducción automática es increíble."),
    ("li",     "大家好！很高兴在这里和大家一起协作。"),
    ("sophie", "La plateforme multilingue fonctionne parfaitement 🌍"),
]


async def seed():
    print("🌱 Seeding database...")
    await create_tables()

    async with AsyncSessionLocal() as db:
        # Check if already seeded
        from sqlalchemy import select
        result = await db.execute(select(User).where(User.email == "demo@withoutborder.app"))
        if result.scalar_one_or_none():
            print("✅ Already seeded — skipping.")
            print("\n📋 Demo accounts (authenticated via Keycloak):")
            for u in DEMO_USERS:
                print(f"  Email: {u['email']}  Username: {u['username']}  Language: {u['preferred_language']}")
            return

        # Create users (mirror from Keycloak)
        users: dict[str, User] = {}
        for u_data in DEMO_USERS:
            user = User(
                id=u_data["id"],
                email=u_data["email"],
                username=u_data["username"],
                preferred_language=u_data["preferred_language"],
                agentic_enabled=u_data.get("agentic_enabled", False),
                agentic_persona=u_data.get("agentic_persona"),
                status=u_data.get("status", "active"),
                is_active=True,
            )
            db.add(user)
            users[u_data["username"]] = user
        await db.flush()
        print(f"  ✓ Created {len(users)} users (mirrored from Keycloak)")

        # Create general team channel
        general = Channel(
            id=uuid.uuid4(),
            name="General",
            description="General announcements for the whole team",
            type="team",
            created_by=users["sophie"].id,
        )
        db.add(general)
        await db.flush()

        # Add all members
        for username, user in users.items():
            role = "admin" if username == "john" else "member"
            db.add(ChannelMember(channel_id=general.id, user_id=user.id, role=role))

        # Create development team channel
        dev_ch = Channel(
            id=uuid.uuid4(),
            name="Development",
            description="Development team channel",
            type="team",
            created_by=users["sophie"].id,
        )
        db.add(dev_ch)
        await db.flush()
        for u in [users["sophie"], users["john"], users["maria"]]:
            db.add(ChannelMember(channel_id=dev_ch.id, user_id=u.id, role="member"))

        # Seed demo messages in general channel
        base_time = datetime.now(timezone.utc) - timedelta(hours=2)
        for i, (username, content) in enumerate(DEMO_MESSAGES):
            sender = users[username]
            msg = Message(
                id=uuid.uuid4(),
                channel_id=general.id,
                sender_id=sender.id,
                original_content=content,
                original_language=sender.preferred_language,
                is_agentic=False,
                created_at=base_time + timedelta(minutes=i * 3),
                updated_at=base_time + timedelta(minutes=i * 3),
            )
            db.add(msg)

        await db.commit()
        print("  ✓ Created 2 channels (general, development)")
        print("  ✓ Seeded 5 demo messages")

    print("\n✅ Seed complete!")
    print("\n📋 Demo accounts (authenticate via Keycloak at https://auth.manga-pics.com):")
    print("┌──────────────────────────────────┬──────────┬──────┬──────────┐")
    print("│ Email                            │ Username │ Lang │ Status   │")
    print("├──────────────────────────────────┼──────────┼──────┼──────────┤")
    for u in DEMO_USERS:
        print(f"│ {u['email']:<32} │ {u['username']:<8} │ {u['preferred_language']:<4} │ {u['status']:<8} │")
    print("└──────────────────────────────────┴──────────┴──────┴──────────┘")
    print("\n🔑 Passwords managed by Keycloak (run scripts/provision_keycloak.py to provision)")
    print("🌐 Frontend: http://localhost:4200")
    print("📖 API docs: http://localhost:8000/docs")


if __name__ == "__main__":
    asyncio.run(seed())

