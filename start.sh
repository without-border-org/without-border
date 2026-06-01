#!/bin/bash
# ============================================================
# WithoutBorder — Quick Start
# ============================================================
set -e
GREEN='\033[0;32m' BLUE='\033[0;34m' YELLOW='\033[1;33m' NC='\033[0m'

echo -e "${BLUE}"
echo "  ██╗    ██╗██╗████████╗██╗  ██╗ ██████╗ ██╗   ██╗████████╗"
echo "  ██║    ██║██║╚══██╔══╝██║  ██║██╔═══██╗██║   ██║╚══██╔══╝"
echo "  ██║ █╗ ██║██║   ██║   ███████║██║   ██║██║   ██║   ██║   "
echo "  ██║███╗██║██║   ██║   ██╔══██║██║   ██║██║   ██║   ██║   "
echo "  ╚███╔███╔╝██║   ██║   ██║  ██║╚██████╔╝╚██████╔╝   ██║   "
echo "   ╚══╝╚══╝ ╚═╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝  ╚═════╝    ╚═╝   "
echo "  ██████╗  ██████╗ ██████╗ ██████╗ ███████╗██████╗           "
echo "  ██╔══██╗██╔═══██╗██╔══██╗██╔══██╗██╔════╝██╔══██╗          "
echo "  ██████╔╝██║   ██║██████╔╝██║  ██║█████╗  ██████╔╝          "
echo "  ██╔══██╗██║   ██║██╔══██╗██║  ██║██╔══╝  ██╔══██╗          "
echo "  ██████╔╝╚██████╔╝██║  ██║██████╔╝███████╗██║  ██║          "
echo "  ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═════╝ ╚══════╝╚═╝  ╚═╝          "
echo -e "${NC}"
echo -e "${BLUE}  Multilingual AI Collaboration — Powered by Gemma 4${NC}"
echo ""

# Check docker
if ! command -v docker &> /dev/null; then
  echo "❌ Docker not found. Install Docker first: https://docs.docker.com/get-docker/"
  exit 1
fi

echo -e "${YELLOW}Step 1/3${NC} — Starting services (PostgreSQL + Ollama + Backend + Frontend)..."
# Profil local-llm : lance un Ollama conteneurisé (CPU) pour le dev local.
# En demo/dev sur OCI, Ollama vient du Studio Lightning via le tunnel SSH (WB-11).
# On pointe le backend vers le conteneur ollama (et non l'hôte) pour ce mode local.
export OLLAMA_BASE_URL="http://ollama:11434"
docker compose --profile local-llm up -d --build

echo ""
echo -e "${YELLOW}Step 2/3${NC} — Pulling Gemma model (this may take a few minutes)..."
echo "  Model: gemma4:e4b"
sleep 5
docker exec wb_ollama ollama pull gemma4:e4b || echo "  ⚠️  Ollama GPU not available — trying CPU mode..."

echo ""
echo -e "${YELLOW}Step 3/3${NC} — Waiting for services to be ready..."
sleep 8

echo ""
echo -e "${GREEN}✅ WithoutBorder is running!${NC}"
echo ""
echo "  🌐 Frontend  →  http://localhost:4200"
echo "  📖 API docs  →  http://localhost:8000/docs"
echo "  🔧 Health    →  http://localhost:8000/health"
echo ""
echo -e "${BLUE}Demo accounts (password: demo1234):${NC}"
echo "  demo@withoutborder.app  (Sophie  — Français  🇫🇷)"
echo "  john@withoutborder.app  (John    — English   🇬🇧)"
echo "  maria@withoutborder.app (Maria   — Español   🇪🇸)"
echo "  li@withoutborder.app    (Li Ming — 中文       🇨🇳)"
echo ""
echo -e "${BLUE}First time? Provision Keycloak users:${NC}"
echo "  python scripts/provision_keycloak.py"
echo ""
echo -e "${YELLOW}To stop:${NC} docker compose down"
