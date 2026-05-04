# Architecture — WithoutBorder

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   Angular 21 Frontend                       │
│  Mobile-First · Tailwind CSS · Signals · Standalone         │
│                                                             │
│  ┌──────────┐ ┌──────────────┐ ┌──────────┐ ┌───────────┐  │
│  │   Auth   │ │     Chat     │ │  Teams   │ │  Profile  │  │
│  │ Login    │ │ Conversation │ │ Channels │ │  Agentic  │  │
│  │ Register │ │ MessageBubble│ │ Members  │ │  Settings │  │
│  └──────────┘ └──────────────┘ └──────────┘ └───────────┘  │
│                                                             │
│  Core: services · guards · interceptors · signals           │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTP + WebSocket
              ┌─────────▼──────────────┐
              │   FastAPI Backend      │
              │   Python 3.12 async    │
              │                        │
              │  /api/v1/auth          │
              │  /api/v1/users         │
              │  /api/v1/channels      │
              │  /api/v1/messages      │
              │  /api/v1/ai            │
              │  /api/v1/files         │
              │  /ws/channels/{id}     │
              │                        │
              │  Layers:               │
              │  Routes → Services     │
              │       → Repositories  │
              │       → Models        │
              └──────┬────────┬────────┘
                     │        │
          ┌──────────▼──┐  ┌──▼────────────────────┐
          │ PostgreSQL  │  │  Gemma 4               │
          │             │  │                        │
          │ users       │  │  OllamaProvider        │
          │ channels    │  │  → http://ollama:11434 │
          │ messages    │  │                        │
          │ msg_transl. │  │  VertexAIProvider      │
          │ reactions   │  │  → Vertex AI API       │
          │ notifs      │  │                        │
          └─────────────┘  │  LLMProvider (ABC)     │
                           │  ↑ Swap with 1 env var │
                           └────────────────────────┘
```

## Data Flow — Message Translation

```
User A (fr) types "Bonjour tout le monde"
         │
         ▼
WS Backend receives message
         │
         ├─ 1. Detect source language: "fr"
         ├─ 2. Save to DB: messages table
         ├─ 3. Get channel members: [en, zh, es, fr]
         │
         ├─ 4. For each target language ≠ source:
         │       ├─ Check: message_translations (cache)
         │       │         ↓ HIT → use cached
         │       │         ↓ MISS → call Gemma 4
         │       └─ Save to: message_translations
         │
         └─ 5. Broadcast to each WS client:
               User B (en) ← "Hello everyone"
               User C (zh) ← "大家好"
               User D (es) ← "Hola a todos"
               User A (fr) ← "Bonjour tout le monde" (original)
```

## Data Flow — Backup Agentic

```
User B is "Agentic" (away)
User A sends "@john can you review the PR?"
         │
         ▼
Backend checks: is John agentic AND not connected WS?
         │ YES
         ▼
AgentService.generate_backup_reply(
    username="john",
    language="en",
    persona="I'm a senior developer. Review PRs thoroughly.",
    context=[last 20 messages],
    incoming="@john can you review the PR?"
)
         │
         ▼ Gemma 4 response
"Sure, I'll take a look at the PR and leave comments by EOD."
         │
         ▼
Save message: is_agentic=true
Broadcast with [AI Agent] badge
Notify john: "Your agent replied on your behalf"
```

## Database Schema

```sql
users (id, email, username, hashed_password, preferred_language,
       status, agentic_enabled, agentic_persona, avatar_url)

channels (id, name, description, type[team|pair], created_by, is_archived)

channel_members (channel_id, user_id, role[admin|member])
  UNIQUE(channel_id, user_id)

messages (id, channel_id, sender_id, original_content, original_language,
          is_agentic, is_pinned, parent_id, file_url, deleted_at)

message_translations (message_id, target_language, translated_content)
  UNIQUE(message_id, target_language)   ← Translation cache

message_reactions (message_id, user_id, emoji)
  UNIQUE(message_id, user_id, emoji)

notifications (user_id, type, channel_id, message_id, content, is_read)
```

## SOLID Principles Applied

| Principle | How |
|---|---|
| **Single Responsibility** | `UserRepository` only touches users table. `TranslationService` only does translation. `AgentService` only does AI. |
| **Open/Closed** | `LLMProvider` ABC — add new providers without touching existing code |
| **Liskov** | `OllamaProvider` and `VertexAIProvider` are fully interchangeable |
| **Interface Segregation** | Separate repos per aggregate (User, Channel, Message, Notification) |
| **Dependency Inversion** | All services receive `LLMProvider` via constructor — testable, swappable |

## File Size Rules

All files enforced under 500 lines:
- `repositories.py` — 180 lines (could be split per model if grows)
- `models.py` — 145 lines
- `schemas.py` — 155 lines
- `messages_router.py` — 190 lines (includes WebSocket handler)
- Frontend components — all under 300 lines each
