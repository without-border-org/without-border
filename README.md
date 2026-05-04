# 🌍 WithoutBorder
### AI-Powered Multilingual Collaboration — Gemma 4 Good Hackathon

[![Gemma 4](https://img.shields.io/badge/Powered%20by-Gemma%204-6C63FF?style=for-the-badge)](https://ai.google.dev/gemma)
[![Angular](https://img.shields.io/badge/Angular-21-DD0031?style=for-the-badge&logo=angular)](https://angular.io)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue?style=for-the-badge)](LICENSE)

---

## 🎯 Problem

Language barriers exclude billions of people from global collaboration. Teams in education, healthcare NGOs, and climate research lose efficiency because their tools don't support real multilingual workflows. Slack, Teams, and similar tools treat translation as an afterthought.

**WithoutBorder makes language invisible.**

---

## 💡 Solution

A real-time collaboration platform where every user writes in their native language and receives messages translated by **Gemma 4** — instantly, privately, and locally.

### Key Features

| Feature | Description |
|---|---|
| 🗣️ **Real-time Translation** | Every message auto-translated for each recipient's language |
| 🤖 **Backup AI Agent** | Gemma 4 replies on your behalf when you're away (Agentic mode) |
| 📋 **Smart Summaries** | Auto-generate meeting summaries in your language |
| ✅ **Action Plan Extraction** | Extract tasks and assignees from conversations |
| 📄 **Full Reports** | Generate complete meeting reports |
| 📎 **File Translation** | Translate PDF and text documents via Gemma 4 |
| 🔔 **Mentions & Reactions** | @mentions, emoji reactions, message pinning |
| 🔍 **Full-text Search** | Search within channel history |

---

## 🤖 How Gemma 4 is Used

```
User writes in French → Gemma 4 translates to EN, ZH, ES → Each member reads in their language
                                    ↓
               If member is "Agentic" + away → Gemma 4 replies as them
                                    ↓
              On demand → Summary / Action Plan / Full Report
```

### Gemma 4 Services

```python
class LLMProvider(ABC):
    async def complete(system: str, user: str) -> str  # ← All AI features use this

# Swap providers with one env variable:
# LLM_PROVIDER=ollama   → Local Gemma 4 via Ollama (default)
# LLM_PROVIDER=vertexai → Google Vertex AI Model Garden
```

### Why Gemma 4
- **Open weights** — runs fully on-premises, zero data sent to cloud
- **Multilingual** — 140+ languages, ideal for global teams
- **Low requirements** — gemma4:9b runs on consumer GPUs

---

## 🚀 Quick Start

```bash
git clone https://github.com/without-border-org/without-border
cd without-border

# 1. Pull Gemma 4
docker compose up ollama -d
sleep 10
docker exec wb_ollama ollama pull gemma4:9b

# 2. Start everything
docker compose up

# Frontend → http://localhost:4200
# API docs  → http://localhost:8000/docs
```

No Redis. No extra services. Just PostgreSQL + Ollama + your app.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Angular 21 (Mobile-First, Tailwind, Signals)           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │  Auth    │  │  Chat    │  │ Teams    │  │Profile │ │
│  └──────────┘  └────┬─────┘  └──────────┘  └────────┘ │
└───────────────────  │  ──────────────────────────────────┘
                      │ WebSocket + HTTP
┌─────────────────────▼───────────────────────────────────┐
│  FastAPI (Python 3.12, async)                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │  Auth    │  │ Messages │  │ Channels │  │  AI    │ │
│  └──────────┘  └──────────┘  └──────────┘  └───┬────┘ │
│  Repositories │ Services │ Agents                │      │
└───────────────────────────────────────────────  │  ─────┘
          │                                        │
┌─────────▼────────┐              ┌───────────────▼──────┐
│   PostgreSQL 16  │              │  Gemma 4 (Ollama)    │
│  (+ Translation  │              │  or Vertex AI        │
│     cache table) │              └─────────────────────┘
└──────────────────┘
```

**No Redis** — translations cached in PostgreSQL `message_translations` table.

---

## 📁 Project Structure

```
withoutborder/
├── backend/app/
│   ├── api/v1/endpoints/   # auth, users, channels, messages, AI, files
│   ├── models/             # SQLAlchemy ORM (User, Channel, Message, Notification...)
│   ├── schemas/            # Pydantic v2 DTOs
│   ├── repositories/       # DB access layer (SOLID: SRP)
│   ├── services/           # TranslationService (with BDD cache)
│   ├── agents/             # AgentService (summary, action plan, backup reply)
│   └── helpers/            # LLMProvider (Ollama/VertexAI), LanguageDetector
│
└── frontend/src/app/
    ├── core/               # models, services, guards, interceptors
    ├── features/
    │   ├── auth/           # Login + Register
    │   ├── chat/           # Layout, Conversation, MessageBubble, AI Panel
    │   └── profile/        # Profile + Agentic agent config
    └── shared/             # Reusable components
```

---

## 🎨 Design

- **Dark glassmorphism** — `backdrop-blur` surfaces over deep dark backgrounds
- **Primary palette** — `#6C63FF` (indigo/violet) + `#FF6584` (pink accent)
- **Mobile-First** — fully responsive from 375px → 1440px+
- **Micro-animations** — fade-in-up, scale-in, pulse for live elements
- **Status indicators** — Active (green pulse), Agentic (violet pulse), Inactive (gray)

---

## 🌍 Hackathon Alignment

| Domain | How WithoutBorder helps |
|---|---|
| **Education** | Students/teachers worldwide collaborate in their language. NGOs like UNESCO coordinate multilingual teams. |
| **Health** | MSF/WHO field teams communicate across language barriers in real time. Doctors can activate "Agentic" mode during emergencies. |
| **Climate** | International environmental teams (GIEC, reforestation projects) coordinate across 140+ languages. |

**Core innovation:** Gemma 4 runs locally — it can work in low-connectivity environments, with sovereign data requirements, and without costly API subscriptions.

---

## 🧪 Running Tests

```bash
# Backend
cd backend && pytest tests/ -v

# Frontend
cd frontend && npm test
```

---

## 📄 License

[Apache 2.0](LICENSE) — Same as Gemma 4.
