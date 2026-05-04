"""Agentic service — Backup AI agent, summary, action plan, report generation."""
from app.helpers.llm_provider import LLMProvider, get_llm_provider
from app.core.config.settings import settings

AGENT_SYSTEM = """You are an AI assistant acting on behalf of {username}.
Always respond in {language}.
Persona: {persona}
Be professional, concise, and helpful. Respond naturally as {username} would."""

SUMMARY_SYSTEM = """You are an expert meeting summarizer.
Respond in {language}. Use markdown formatting.
Analyze the conversation and provide a structured summary."""

SUMMARY_USER = """Conversation to summarize:
{conversation}

Provide a summary with exactly these sections:
## 📌 Key Points
- (bullet points of main topics discussed)

## ✅ Decisions Made
- (decisions reached, or "None" if none)

## 🎯 Next Steps
- (action items or follow-ups)"""

ACTION_PLAN_SYSTEM = """You are a project manager. Extract concrete action items.
Respond in {language}. Use markdown formatting."""

ACTION_PLAN_USER = """Conversation:
{conversation}

Extract all action items in this format:
## 📋 Action Plan
- [ ] @assignee: task description [deadline if mentioned]

If no clear assignee, use @team."""

REPORT_SYSTEM = """You are a professional meeting reporter.
Respond in {language}. Create a comprehensive report."""

REPORT_USER = """Conversation:
{conversation}

Generate a full meeting report with:
## 📄 Meeting Report
**Date:** {date}
**Participants:** {participants}

## Discussion Summary
(detailed paragraph)

## Key Decisions
(numbered list)

## Action Items
(table format: | Who | What | When |)

## Next Meeting
(recommended follow-up if applicable)"""


class AgentService:
    """Handles Gemma 4 agentic operations."""

    def __init__(self, llm: LLMProvider = None):
        self.llm = llm or get_llm_provider()

    async def generate_backup_reply(
        self, username: str, preferred_language: str,
        agentic_persona: str | None, context_messages: list[dict], incoming: str
    ) -> str:
        """Generates a reply on behalf of a user in agentic mode."""
        context = self._format_context(context_messages)
        system = AGENT_SYSTEM.format(
            username=username,
            language=preferred_language,
            persona=agentic_persona or "Professional and collaborative colleague.",
        )
        user_prompt = f"Conversation context:\n{context}\n\nNew message to respond to:\n{incoming}"
        return await self.llm.complete(system_prompt=system, user_prompt=user_prompt)

    async def generate_summary(self, messages: list[dict], target_language: str) -> str:
        """Generates a structured summary of a conversation."""
        conversation = self._format_context(messages)
        system = SUMMARY_SYSTEM.format(language=target_language)
        user = SUMMARY_USER.format(conversation=conversation)
        return await self.llm.complete(system_prompt=system, user_prompt=user)

    async def generate_action_plan(self, messages: list[dict], target_language: str) -> str:
        """Extracts action items from a conversation."""
        conversation = self._format_context(messages)
        system = ACTION_PLAN_SYSTEM.format(language=target_language)
        user = ACTION_PLAN_USER.format(conversation=conversation)
        return await self.llm.complete(system_prompt=system, user_prompt=user)

    async def generate_report(
        self, messages: list[dict], target_language: str,
        date: str, participants: list[str]
    ) -> str:
        """Generates a complete meeting report."""
        conversation = self._format_context(messages)
        system = REPORT_SYSTEM.format(language=target_language)
        user = REPORT_USER.format(
            conversation=conversation, date=date,
            participants=", ".join(participants)
        )
        return await self.llm.complete(system_prompt=system, user_prompt=user)

    async def translate_file_content(self, content: str, target_language: str) -> str:
        """Translates a document's textual content."""
        system = "You are a professional document translator. Translate the entire text to {lang}. Preserve formatting.".format(lang=target_language)
        return await self.llm.complete(system_prompt=system, user_prompt=content)

    def _format_context(self, messages: list[dict]) -> str:
        lines = []
        for m in messages[-settings.MAX_CONTEXT_MESSAGES:]:
            prefix = "[AI] " if m.get("is_agentic") else ""
            lines.append(f"{prefix}{m.get('sender_username', 'Unknown')}: {m.get('original_content', '')}")
        return "\n".join(lines)
