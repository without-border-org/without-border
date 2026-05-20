# WithoutBorder

**Real-time multilingual collaboration, powered by a local AI model — your data never leaves your infrastructure.**

[![Angular](https://img.shields.io/badge/Angular-21-DD0031?style=flat-square&logo=angular)](https://angular.io)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![Gemma 4](https://img.shields.io/badge/AI-Gemma%204-6C63FF?style=flat-square)](https://ai.google.dev/gemma)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

---

## Table of Contents

- [Why WithoutBorder](#why-withoutborder)
- [Live Demo](#live-demo)
- [Features](#features)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Configuration](#configuration)
- [Self-Hosting](#self-hosting)
- [Contributing](#contributing)
- [License](#license)

---

## Why WithoutBorder

**The Language Tax.** Teams operating across language boundaries spend 20–40% of their communication time bridging comprehension gaps — rephrasing, summarizing, waiting for translations. That overhead compounds silently into missed decisions and slower execution.

**The AI Adoption Gap.** Most translation tools route your conversations through third-party cloud APIs. Enterprise teams cannot accept that: contracts, roadmaps, and personnel decisions are not data you send to an external service.

**The Sovereignty Wall.** Regulated industries, government bodies, and privacy-conscious organizations are effectively locked out of AI-assisted collaboration. Existing tools force a binary choice: use AI and lose control of your data, or retain control and work without AI.

WithoutBorder removes that wall. Every translation and every AI interaction runs on a Gemma 4 model you host yourself. No external API calls, no data residency risk, no vendor dependency.

---

## Live Demo

- **Landing page:** https://wb.canadaquebec.ca/
- **Application:** https://wb.canadaquebec.ca/app

### Demo accounts

All demo accounts share password `demo1234`. Each account is configured for a different native language to demonstrate real-time cross-language translation.

| Account | Language |
|---|---|
| `demo@withoutborder.app` | French (FR) |
| `john@withoutborder.app` | English (EN) |
| `maria@withoutborder.app` | Spanish (ES) |
| `li@withoutborder.app` | Chinese (ZH) |

> Screenshot placeholder — `docs/assets/screenshot-channels.png`

---

## Features

| Feature | Description |
|---|---|
| Real-time Translation | Each message is translated per recipient in their native language via a local Gemma 4 model |
| Backup AI Agent | When Agentic mode is active (AGENTIC badge), the AI responds on your behalf while you are unavailable |
| Meeting Summaries | Generate structured summaries, action plans, and full reports from any conversation history |
| File Translation | Translate PDFs and text documents inline |
| Channels and Pairs | Group channels and 1:1 private conversations |
| Mentions and Reactions | @mentions, emoji reactions, and pinned messages |
| Full-text Search | Search across channel and conversation history |
| Local-first | All AI inference runs on Ollama locally — zero data sent outside your network |

---

## Quick Start

**Prerequisites:** Docker and Docker Compose installed. [Ollama](https://ollama.com) running locally with the model specified in `LLM_MODEL` pulled.

```bash
git clone https://github.com/without-border-org/without-border
cd without-border
./start.sh
```

| Service | URL |
|---|---|
| Frontend | http://localhost:4200 |
| API (with docs) | http://localhost:8000/docs |

The `start.sh` script builds both containers, runs database migrations, and seeds demo accounts automatically on first launch (`AUTO_SEED=true`).

---

## Architecture

```
+---------------------------------------------------+
|  Browser                                          |
|  Angular 21  (Signals, TailwindCSS, WebSocket)    |
+-------------------------+-------------------------+
                          | HTTP / WebSocket
+-------------------------v-------------------------+
|  FastAPI  (Python 3.12, async)                    |
|                                                   |
|  Routes -> Services -> Repositories               |
|                   |                               |
|            PostgreSQL 16                          |
|                                                   |
|  AI Layer: LLMProvider                            |
|    |- Ollama  (local, default)                    |
|    +- Vertex AI  (optional, cloud)                |
|         |                                         |
|      Gemma (configurable via LLM_MODEL)           |
|      translation / agent / summaries              |
+---------------------------------------------------+
```

| Layer | Technology |
|---|---|
| Frontend | Angular 21, TailwindCSS, Signals |
| Backend | FastAPI, Python 3.12, SQLAlchemy (async) |
| Database | PostgreSQL 16 |
| AI Runtime | Ollama (local) or Vertex AI |
| AI Model | Gemma (configurable via `LLM_MODEL` in `.env`) |
| Auth | JWT — python-jose + bcrypt |
| Containers | Docker, Docker Compose |

---

## Configuration

Create `backend/.env` before the first run. All variables below are required unless marked optional.

```env
# Database
DATABASE_URL=postgresql+asyncpg://wb_user:wb_password@localhost:5432/withoutborder

# Auth
SECRET_KEY=your-secret-key-min-32-chars
AUTH_DISABLED=false          # Set to true for local dev only — never in production

# AI
LLM_PROVIDER=ollama          # ollama | vertexai
LLM_MODEL=                   # Set to the model configured in your Ollama instance (see .env.example)
OLLAMA_BASE_URL=http://localhost:11434

# Seed (optional)
AUTO_SEED=true               # Creates demo accounts on first start
```

---

## Self-Hosting

### 1. Pull the AI model

```bash
# Pull the model defined in LLM_MODEL in your .env file
ollama pull $(grep LLM_MODEL .env | cut -d= -f2)
```

See `.env.example` for the recommended model for your hardware.

### 2. Configure environment

Copy the example file and fill in your values:

```bash
cp backend/.env.example backend/.env
# Edit SECRET_KEY, DATABASE_URL, and OLLAMA_BASE_URL as needed
```

### 3. Start the stack

```bash
docker compose up -d --build
```

### 4. Verify

```bash
curl -s http://localhost:8000/health
# Expected: {"status": "ok"}
```

### Production notes

- Set `AUTH_DISABLED=false` and use a strong random `SECRET_KEY` (minimum 32 characters).
- Run Ollama on the same host or a dedicated GPU node reachable at `OLLAMA_BASE_URL`.
- PostgreSQL data is persisted in a named Docker volume. Back it up with `pg_dump` on a schedule.
- For TLS termination, place a reverse proxy (Nginx, Traefik) in front of the frontend container.

---

## Contributing

Contributions are welcome. Please open an issue before submitting a pull request for non-trivial changes.

```bash
# 1. Fork and clone
git clone https://github.com/your-fork/without-border

# 2. Create a feature branch
git checkout -b feat/your-feature

# 3. Run the stack in dev mode
AUTH_DISABLED=true ./start.sh

# 4. Commit and open a pull request against main
```

Code style is enforced by Ruff (Python) and ESLint (TypeScript). Both run as pre-commit checks.

---

## License

[MIT](LICENSE)
