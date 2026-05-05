# 🌍 WithoutBorder
### Multilingual Real-Time Collaboration Platform

[![Angular](https://img.shields.io/badge/Angular-21-DD0031?style=flat-square&logo=angular)](https://angular.io)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![Gemma 4](https://img.shields.io/badge/AI-Gemma%204-6C63FF?style=flat-square)](https://ai.google.dev/gemma)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue?style=flat-square)](LICENSE)

---

## What is WithoutBorder?

WithoutBorder is a real-time collaboration platform that eliminates language barriers. Every user writes in their native language — messages are automatically translated for each recipient by a local Gemma 4 model. No cloud dependency, no data leaving your infrastructure.

---

## Core Features

| Feature | Description |
|---|---|
| 🗣️ **Real-time Translation** | Messages auto-translated per recipient language via Gemma 4 |
| 🤖 **Backup AI Agent** | AI replies on your behalf when you activate Agentic mode |
| 📋 **Summaries** | Generate structured meeting summaries from conversations |
| ✅ **Action Plans** | Extract tasks and assignees automatically |
| 📄 **Reports** | Full meeting reports with participants and decisions |
| 📎 **File Translation** | Translate PDFs and text documents |
| 🔔 **Mentions & Reactions** | @mentions, emoji reactions, pinned messages |
| 🔍 **Search** | Full-text search within channel history |

---

## Quick Start

```bash
git clone https://github.com/without-border-org/without-border
cd without-border
./start.sh
```

**Frontend →** http://localhost:4200  
**API docs →** http://localhost:8000/docs

### Demo accounts (password: `demo1234`)

| Email | Language |
|---|---|
| `demo@withoutborder.app` | 🇫🇷 Français |
| `john@withoutborder.app` | 🇬🇧 English |
| `maria@withoutborder.app` | 🇪🇸 Español |
| `li@withoutborder.app` | 🇨🇳 中文 |

---

## Local Development

### Disable authentication (dev only)

Add to `backend/.env`:
```env
AUTH_DISABLED=true
```

The backend will skip all JWT validation and use the first active user automatically. **Never enable this in production.**

### Environment variables

```env
# backend/.env
DATABASE_URL=postgresql+asyncpg://wb_user:wb_password@localhost:5432/withoutborder
SECRET_KEY=your-secret-key-min-32-chars
LLM_PROVIDER=ollama          # or: vertexai
LLM_MODEL=gemma4:9b
OLLAMA_BASE_URL=http://localhost:11434
AUTH_DISABLED=false           # true for local dev only
AUTO_SEED=true                # creates demo accounts on first start
```

---

## Architecture

```
Angular 21 (Mobile-First, Tailwind, Signals)
         ↕ HTTP + WebSocket
FastAPI (Python 3.12, async)
    ├── Routes → Services → Repositories → PostgreSQL
    └── AI: LLMProvider (Ollama | Vertex AI)
              └── Gemma 4 (translation, agents, summaries)
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for full diagrams.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 21, TailwindCSS, Signals |
| Backend | FastAPI, Python 3.12, SQLAlchemy async |
| Database | PostgreSQL 16 |
| AI Runtime | Ollama (local) or Vertex AI |
| AI Model | Gemma 4 (9B or 27B) |
| Auth | JWT (python-jose + bcrypt) |
| Containers | Docker + Docker Compose |

---

## License

[Apache 2.0](LICENSE)
