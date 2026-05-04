"""
Seed script — creates demo users, channels, and messages for testing.

Run with:
    cd backend && python -m app.seed

Demo accounts created:
  Email: demo@withoutborder.app    Password: demo1234
  Email: john@withoutborder.app    Password: demo1234
  Email: maria@withoutborder.app   Password: demo1234
  Email: li@withoutborder.app      Password: demo1234
"""
import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from app.core.database import AsyncSessionLocal, create_tables
from app.core.security.password_handler import hash_password
from app.models.models import User, Channel, ChannelMember, Message, MessageTranslation

DEMO_PASSWORD = hash_password("demo1234")

DEMO_USERS = [
    {
        "email": "demo@withoutborder.app",
        "username": "sophie",
        "preferred_language": "fr",
        "agentic_enabled": True,
        "agentic_persona": "Je suis développeuse frontend. Je réponds de façon concise et professionnelle.",
        "status": "active",
    },
    {
        "email": "john@withoutborder.app",
        "username": "john",
        "preferred_language": "en",
        "agentic_enabled": False,
        "status": "active",
    },
    {
        "email": "maria@withoutborder.app",
        "username": "maria",
        "preferred_language": "es",
        "agentic_enabled": True,
        "agentic_persona": "Soy diseñadora UX. Respondo de forma amigable y creativa.",
        "status": "agentic",
    },
    {
        "email": "li@withoutborder.app",
        "username": "li_ming",
        "preferred_language": "zh",
        "agentic_enabled": False,
        "status": "inactive",
    },
]

DEMO_MESSAGES = [
    ("sophie", "Bonjour à tous ! Bienvenue dans notre nouvel espace de collaboration 🎉"),
    ("john", "Hello everyone! Really excited to be here. The auto-translation is amazing!"),
    ("maria", "¡Hola a todos! Esto es increíble, puedo leer todo en español 🌍"),
    ("li_ming", "大家好！这个翻译功能太棒了！"),
    ("sophie", "Exactement ! Gemma 4 traduit tout automatiquement. Plus besoin de changer de langue."),
    ("john", "I just enabled Agentic mode — my AI will reply when I'm away. Check out the violet dot!"),
    ("maria", "Perfecto. ¿Podemos organizar una reunión esta semana para revisar el diseño?"),
    ("sophie", "Oui bien sûr ! Je suis disponible jeudi et vendredi matin."),
    ("john", "Thursday works for me too. Let's say 10am UTC?"),
    ("li_ming", "我周四有空，10点UTC可以。"),
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
            print("\n📋 Demo accounts:")
            for u in DEMO_USERS:
                print(f"  Email: {u['email']}  Password: demo1234  Language: {u['preferred_language']}")
            return

        # Create users
        users: dict[str, User] = {}
        for u_data in DEMO_USERS:
            user = User(
                id=uuid.uuid4(),
                email=u_data["email"],
                username=u_data["username"],
                hashed_password=DEMO_PASSWORD,
                preferred_language=u_data["preferred_language"],
                agentic_enabled=u_data.get("agentic_enabled", False),
                agentic_persona=u_data.get("agentic_persona"),
                status=u_data.get("status", "active"),
                is_active=True,
            )
            db.add(user)
            users[u_data["username"]] = user
        await db.flush()
        print(f"  ✓ Created {len(users)} users")

        # Create general team channel
        general = Channel(
            id=uuid.uuid4(),
            name="Annonces Générales",
            description="General announcements for the whole team",
            type="team",
            created_by=users["sophie"].id,
        )
        db.add(general)
        await db.flush()

        # Add all members
        for username, user in users.items():
            role = "admin" if username == "sophie" else "member"
            db.add(ChannelMember(channel_id=general.id, user_id=user.id, role=role))

        # Create frontend team channel
        frontend_ch = Channel(
            id=uuid.uuid4(),
            name="Équipe Développement Front",
            description="Frontend development team",
            type="team",
            created_by=users["sophie"].id,
        )
        db.add(frontend_ch)
        await db.flush()
        for u in [users["sophie"], users["john"]]:
            db.add(ChannelMember(channel_id=frontend_ch.id, user_id=u.id, role="member"))

        # Create DM channel
        dm_ch = Channel(
            id=uuid.uuid4(),
            name="Sophie & John",
            description=None,
            type="pair",
            created_by=users["sophie"].id,
        )
        db.add(dm_ch)
        await db.flush()
        for u in [users["sophie"], users["john"]]:
            db.add(ChannelMember(channel_id=dm_ch.id, user_id=u.id, role="member"))

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
        print("  ✓ Created 3 channels (general, frontend, DM)")
        print("  ✓ Seeded 10 demo messages")

    print("\n✅ Seed complete!")
    print("\n📋 Demo accounts (all use password: demo1234):")
    print("┌─────────────────────────────────────┬──────────┬────────────┬──────────┐")
    print("│ Email                               │ Username │ Language   │ Status   │")
    print("├─────────────────────────────────────┼──────────┼────────────┼──────────┤")
    for u in DEMO_USERS:
        print(f"│ {u['email']:<35} │ {u['username']:<8} │ {u['preferred_language']:<10} │ {u['status']:<8} │")
    print("└─────────────────────────────────────┴──────────┴────────────┴──────────┘")
    print("\n🔑 All passwords: demo1234")
    print("🌐 Frontend: http://localhost:4200")
    print("📖 API docs: http://localhost:8000/docs")


if __name__ == "__main__":
    asyncio.run(seed())
