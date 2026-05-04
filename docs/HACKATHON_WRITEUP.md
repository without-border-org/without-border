# WithoutBorder — Technical Write-Up
## Kaggle × Google DeepMind — Gemma 4 Good Hackathon

---

## 1. Problem Statement

Language barriers are one of the most persistent obstacles to global collaboration. In education, health, and climate sectors:

- **Education:** 250M+ learners worldwide lack access to content in their language. International NGOs coordinate teams across 30+ countries without shared languages.
- **Health:** Médecins Sans Frontières operates in 70+ countries. Communication errors due to language barriers cause medical incidents.
- **Climate:** IPCC working groups involve thousands of researchers from 195 countries. Key findings get lost in translation.

Existing tools (Slack, Teams, Discord) treat translation as a premium bolt-on, not a core feature. They require cloud dependencies, have high costs, and don't respect data sovereignty.

---

## 2. Our Solution

**WithoutBorder** is a real-time multilingual collaboration platform where Gemma 4 is the core infrastructure — not an add-on.

Every message is **automatically translated** for each recipient in their preferred language. Users interact entirely in their native language. The language barrier simply disappears.

---

## 3. How We Use Gemma 4

### 3.1 Architecture

```python
class LLMProvider(ABC):
    async def complete(system: str, user: str) -> str

# Implementations:
class OllamaProvider(LLMProvider):    # Local Gemma 4 — default
class VertexAIProvider(LLMProvider):  # Google Vertex AI — production
```

The `LLMProvider` abstraction means the entire platform runs on **any Gemma 4 deployment** — local via Ollama, cloud via Vertex AI, or any future provider. Switching is a single env variable change.

### 3.2 Real-Time Translation Service

```python
class TranslationService:
    async def translate_for_members(
        db, message_id, text, source_language, target_languages
    ) -> dict[str, str]:
        # 1. Check PostgreSQL cache (message_translations table)
        # 2. If miss → call Gemma 4
        # 3. Store result in cache
        # 4. Return translations per language
```

**Key design:** No Redis. Translations are cached in a dedicated PostgreSQL table with a `UNIQUE(message_id, target_language)` constraint. This simplifies deployment while maintaining performance — repeated messages (greetings, common phrases) are never translated twice.

**Prompt engineering:**
```
System: You are a professional multilingual translator.
        Translate the text to {target_language}.
        Return ONLY the translated text. No explanation.
User: {original_message}
```

This minimal prompt consistently produces clean output across Gemma 4's 140+ supported languages.

### 3.3 Backup AI Agent (Most Innovative Feature)

When a user activates **Agentic mode**, Gemma 4 replies on their behalf using their conversation history and a custom persona:

```python
async def generate_backup_reply(
    username, preferred_language, agentic_persona,
    context_messages, incoming_message
) -> str:
    system = f"""You are an AI assistant acting on behalf of {username}.
    Always respond in {language}. Persona: {persona}
    Be professional and concise. Respond as {username} would."""

    context = format_last_20_messages(context_messages)
    return await llm.complete(system, f"{context}\n\nNew: {incoming}")
```

This is shown transparently in the UI with a `[AI Agent]` badge. Users see exactly when they're talking to a human vs. the AI.

### 3.4 Content Generation (Summary, Action Plan, Report)

Three structured prompts extract value from conversations:

**Summary:**
```
Generate structured summary:
## Key Points
## Decisions Made  
## Next Steps
```

**Action Plan:**
```
Extract: - [ ] @assignee: task [deadline]
```

**Full Report:**
```
Meeting report: Date, Participants, Discussion, Decisions, Action Items table
```

All outputs are generated in the requesting user's preferred language.

### 3.5 File Translation

PDF and text files are translated end-to-end:
```python
# Extract text from PDF
content = "\n".join(page.extract_text() for page in PdfReader(file))
# Translate with Gemma 4
translated = await agent_svc.translate_file_content(content, target_language)
```

---

## 4. Technical Stack

| Component | Technology | Why |
|---|---|---|
| AI Model | **Gemma 4** (9B or 27B) | Open weights, multilingual, runs locally |
| AI Runtime | Ollama or Vertex AI | Flexible deployment |
| Backend | FastAPI + Python 3.12 | Async WebSocket support |
| Database | PostgreSQL 16 | Translation cache, full-text search |
| Frontend | Angular 21 | Signals, standalone components |
| Realtime | WebSocket (native FastAPI) | No extra broker needed |
| Auth | JWT (python-jose) | Stateless, scalable |

**No Redis, no Kafka, no complex infra.** The entire platform runs with `docker compose up`.

---

## 5. Why This Matters

### Data Sovereignty
Gemma 4 runs on-premises. Sensitive health records, student data, and climate research never leave your infrastructure. This is critical for:
- Medical teams in countries with strict health data laws (HIPAA, GDPR)
- Educational institutions handling minors' data
- Government climate agencies

### Accessibility
- Runs on a single GPU (gemma4:9b on 8GB VRAM)
- Works offline after initial model pull
- Mobile-first Angular frontend for low-end devices

### Real Impact
A single deployment of WithoutBorder enables:
- A WHO team in Geneva to coordinate with field workers in DRC, Bangladesh, and Peru — all in their languages
- A climate research group spanning EU, India, and Brazil to share findings without translation friction
- A rural school NGO to manage multilingual volunteer teams globally

---

## 6. Challenges & Solutions

| Challenge | Solution |
|---|---|
| Translation latency | PostgreSQL cache — same translation never computed twice |
| Agentic response quality | Last 20 messages as context + customizable persona |
| Multi-language detection | `langdetect` library + Gemma fallback |
| WebSocket auth | JWT passed as query param on WS connect |
| No Redis dependency | Translation cache in BDD, WS state in memory |

---

## 7. Future Work

- Voice message translation (Whisper → Gemma 4 → TTS)
- Real-time collaborative document editing with translation
- Mobile app (Capacitor wrapping the Angular PWA)
- Fine-tuning Gemma 4 on domain-specific terminology (medical, legal, technical)
- Integration with existing tools (Mattermost, open-source LMS)

---

## 8. Conclusion

WithoutBorder demonstrates that **Gemma 4 can be the infrastructure layer for global collaboration** — not just a chatbot. By embedding AI translation, agentic responses, and content generation directly into the communication layer, we eliminate language as a barrier to global impact in education, health, and climate action.

The platform is fully open-source (Apache 2.0), runs locally, and can be deployed by any organization in minutes.

**Try it:** `git clone https://github.com/without-border-org/without-border && ./start.sh`
