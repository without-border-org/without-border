# Cahier des Charges — WithoutBorder MVP
## Plateforme de Collaboration Multilingue avec IA

**Version :** 2.0  
**Date :** Mai 2026  

---



### 1.2 Comment WithoutBorder s'inscrit dans ces domaines

**→ Éducation (domaine principal)**
- Des millions d'élèves et enseignants ne peuvent pas collaborer à cause des barrières linguistiques
- Des ONG éducatives internationales (UNESCO, Save the Children) coordonnent leurs équipes en multi-langues
- Des universités avec des étudiants étrangers perdent en efficacité pédagogique
- WithoutBorder permet à des apprenants de discuter, partager des ressources et travailler en groupe **dans leur langue natale** tout en étant compris par tous

**→ Santé**
- Des équipes médicales internationales (MSF, OMS) collaborent sous pression avec des barrières linguistiques
- Des chercheurs de différents pays doivent partager et analyser des résultats rapidement
- Le Backup Agentic permet à un médecin absent (urgence terrain) de rester "présent" dans les discussions

**→ Résilience Climatique**
- Des équipes environnementales multi-pays (GIEC, projets de reforestation) coordonnent leurs actions
- Des communautés locales (Afrique, Asie, Amérique latine) peuvent rejoindre des projets globaux sans barrière linguistique

### 1.3 Argument clé pour les juges
> "WithoutBorder est l'infrastructure de collaboration pour les projets à impact global. Là où les outils comme Slack ou Teams échouent — dans les pays en développement, les organisations sans budget, les équipes multilinguees — WithoutBorder fonctionne. Gemma 4 tourne en local, sans cloud coûteux, dans n'importe quel contexte."

---

## 1. Vision Produit

WithoutBorder est une plateforme de messagerie collaborative où :
- Chaque utilisateur écrit dans sa **langue maternelle**
- Les messages sont **automatiquement traduits** en temps réel pour chaque membre (Gemma 4)
- Un **agent IA (Backup Agentic)** répond au nom d'un utilisateur absent
- Des **livrables structurés** sont générés automatiquement (résumés, plans d'action, rapports)
- Les **documents partagés** sont traduits à la volée
- Tout peut tourner **hors ligne / on-premises** grâce à Gemma 4 open-weights

---

## 2. Périmètre MVP

### 2.1 Fonctionnalités

| # | Fonctionnalité | Priorité | Détail |
|---|---|---|---|
| F01 | Auth JWT (register/login/refresh/logout) | MUST | Email + password, tokens JWT |
| F02 | Profil utilisateur | MUST | Langue préférée, photo, statut, persona IA |
| F03 | Gestion équipes (channels) | MUST | Créer, rejoindre, lister, rechercher |
| F04 | Gestion binômes (DM) | MUST | Messages directs entre 2 utilisateurs |
| F05 | Chat temps réel (WebSocket) | MUST | Envoi/réception instantané |
| F06 | Traduction automatique (Gemma 4) | MUST | Message traduit dans la langue de chaque destinataire |
| F07 | Détection automatique de langue | MUST | langdetect + fallback |
| F08 | Bascule original/traduit | MUST | L'utilisateur peut voir le texte original |
| F09 | Statuts : Actif / Agentic / Inactif | MUST | Visible par tous les membres |
| F10 | Backup Agentic — réponse IA autonome | MUST | Agent Gemma 4 répond à la place de l'utilisateur |
| F11 | Persona IA personnalisable | MUST | Chaque user configure son agent (ton, domaine...) |
| F12 | Génération de résumé de conversation | MUST | Points clés + décisions + actions |
| F13 | Génération de plan d'action | MUST | Tâches extraites, assignées, avec deadline |
| F14 | Partage de fichiers (PDF, images) | SHOULD | Upload + stockage local |
| F15 | Traduction de fichiers texte/PDF | SHOULD | Gemma 4 traduit le contenu du fichier |
| F16 | Réactions aux messages (emojis) | SHOULD | 👍 ❤️ etc. |
| F17 | Mentions @username | SHOULD | Notification ciblée |
| F18 | Messages épinglés | COULD | Pinning dans un channel |
| F19 | Recherche full-text dans l'historique | COULD | PostgreSQL full-text search |
| F20 | Notifications (in-app) | COULD | Badge non-lus |

### 2.2 Non-périmètre MVP
- App mobile native (Angular PWA = mobile-first web)
- Intégrations tierces (Slack, Jira, Google Drive...)
- Appels audio/vidéo
- Paiement / abonnements

---

## 3. Architecture Technique

### 3.1 Stack

| Couche | Technologie | Version |
|---|---|---|
| Frontend | Angular | **21** (latest 2026) |
| Styling | TailwindCSS | 4+ |
| State Management | Angular Signals + NgRx Signals | Angular 21 natif |
| Backend | Python / FastAPI | 3.12+ |
| WebSocket | FastAPI WebSocket natif | — |
| Base de données | PostgreSQL | 16+ |
| Cache traductions | PostgreSQL (table dédiée) | — |
| ORM | SQLAlchemy (async) | 2+ |
| IA / LLM | **Gemma 4** via Ollama ou Vertex AI | Gemma 4 |
| Auth | JWT (python-jose) + bcrypt | — |
| Containerisation | Docker + Docker Compose | — |
| Upload fichiers | FastAPI + stockage local `/uploads` | — |

> **Suppression de Redis** : Le cache des traductions est géré en BDD (table `message_translations`). La session WebSocket est gérée en mémoire via le `ConnectionManager`.

### 3.2 Pourquoi Angular 21
- **Signals natifs stables** : réactivité fine-grained sans Zone.js
- **Zoneless change detection** : performances accrues
- **Signal-based Forms** : gestion des formulaires moderne
- **Hydration améliorée** : SSR optionnel
- **Selectorless components** (preview) : moins de boilerplate

### 3.3 Principes d'architecture

**SOLID appliqué partout :**
- **S** — Single Responsibility : 1 classe = 1 responsabilité
- **O** — Open/Closed : extension via interfaces (ex: `LLMProvider`)
- **L** — Liskov : `OllamaProvider` et `VertexAIProvider` sont interchangeables
- **I** — Interface Segregation : interfaces spécifiques (pas de "god interface")
- **D** — Dependency Inversion : tout passe par injection (Angular DI / FastAPI Depends)

**Règles de code :**
- ❌ Aucun fichier ne dépasse **500 lignes** — refactoring obligatoire sinon
- ✅ Séparation stricte : `routes / services / models / repositories / helpers`
- ✅ Angular 21 : composants standalone, signals, inject() au lieu de constructor DI
- ✅ FastAPI : async/await partout, Pydantic v2
- ✅ Nommage explicite en anglais, docstrings sur toutes les fonctions publiques

---

## 4. Structure des Dossiers

```
withoutborder/
├── docs/
│   ├── CAHIER_DES_CHARGES_MVP.md
│   ├── API.md                    ← Swagger auto-généré + description
│   ├── ARCHITECTURE.md
│
├── frontend/                     ← Angular 21
│   └── src/
│       ├── app/
│       │   ├── core/
│       │   │   ├── models/       ← Interfaces TypeScript (User, Message, Channel...)
│       │   │   ├── services/     ← AuthService, UserService, ChannelService...
│       │   │   ├── repositories/ ← Abstraction API calls (HttpClient wrappé)
│       │   │   ├── helpers/      ← Fonctions pures (date, format, language...)
│       │   │   ├── guards/       ← AuthGuard, RoleGuard
│       │   │   ├── interceptors/ ← JwtInterceptor, ErrorInterceptor
│       │   │   └── pipes/        ← DatePipe custom, LanguagePipe
│       │   │
│       │   ├── features/
│       │   │   ├── auth/         ← Login, Register
│       │   │   ├── chat/         ← Chat principal (WebSocket)
│       │   │   ├── teams/        ← Gestion des équipes/channels
│       │   │   ├── profile/      ← Profil + config agent IA
│       │   │   └── ai/           ← Résumé, plan d'action
│       │   │
│       │   └── shared/
│       │       ├── components/   ← UI réutilisables
│       │       ├── pipes/
│       │       └── directives/
│       │
│       ├── environments/
│       └── styles/               ← Design system SCSS
│
└── backend/                      ← Python 3.12 / FastAPI
    └── app/
        ├── api/v1/endpoints/     ← Routes HTTP
        ├── core/
        │   ├── config/           ← Settings (env vars)
        │   ├── security/         ← JWT, bcrypt
        │   ├── middleware/        ← CORS, logging
        │   └── websocket_manager.py
        ├── models/               ← SQLAlchemy ORM
        ├── schemas/              ← Pydantic v2 DTOs
        ├── repositories/         ← Accès BDD
        ├── services/             ← Logique métier
        ├── helpers/              ← LLMProvider, language_detector
        ├── agents/               ← Agents Gemma 4
        └── tests/                ← pytest async
```

---

## 5. Modèles de Données

### User
```sql
users (
  id UUID PK,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  hashed_password VARCHAR(255) NOT NULL,
  preferred_language VARCHAR(10) DEFAULT 'fr',
  status ENUM('active','agentic','inactive') DEFAULT 'active',
  agentic_enabled BOOLEAN DEFAULT false,
  agentic_persona TEXT,              -- Instructions pour l'agent IA
  avatar_url VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

### Channel
```sql
channels (
  id UUID PK,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type ENUM('team','pair') NOT NULL,
  created_by UUID FK→users,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ
)
```

### ChannelMember
```sql
channel_members (
  id UUID PK,
  channel_id UUID FK→channels,
  user_id UUID FK→users,
  role ENUM('admin','member') DEFAULT 'member',
  joined_at TIMESTAMPTZ,
  UNIQUE(channel_id, user_id)
)
```

### Message
```sql
messages (
  id UUID PK,
  channel_id UUID FK→channels INDEX,
  sender_id UUID FK→users,
  original_content TEXT NOT NULL,
  original_language VARCHAR(10) NOT NULL,
  is_agentic BOOLEAN DEFAULT false,
  parent_id UUID FK→messages NULL,   -- Thread/reply
  is_pinned BOOLEAN DEFAULT false,
  file_url VARCHAR(500) NULL,
  file_name VARCHAR(255) NULL,
  file_type VARCHAR(50) NULL,
  created_at TIMESTAMPTZ INDEX,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ NULL        -- Soft delete
)
```

### MessageTranslation (cache BDD — remplace Redis)
```sql
message_translations (
  id UUID PK,
  message_id UUID FK→messages INDEX,
  target_language VARCHAR(10) NOT NULL,
  translated_content TEXT NOT NULL,
  created_at TIMESTAMPTZ,
  UNIQUE(message_id, target_language)
)
```

### MessageReaction
```sql
message_reactions (
  id UUID PK,
  message_id UUID FK→messages,
  user_id UUID FK→users,
  emoji VARCHAR(10) NOT NULL,
  created_at TIMESTAMPTZ,
  UNIQUE(message_id, user_id, emoji)
)
```

### Notification
```sql
notifications (
  id UUID PK,
  user_id UUID FK→users INDEX,
  type ENUM('mention','reply','agentic_reply','summary_ready'),
  channel_id UUID NULL,
  message_id UUID NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ
)
```

---

## 6. Flux Principaux

### F06 — Traduction temps réel
```
1. User A (fr) envoie "Bonjour tout le monde" → WS Backend
2. Backend : détecte langue = 'fr', sauvegarde message
3. Récupère membres du channel : [en, zh, es, fr]
4. Pour chaque langue ≠ fr :
   - Vérifie cache BDD (message_translations) → si trouvé, utilise
   - Sinon : appel Gemma 4 → traduit → sauvegarde en BDD
5. Broadcast WebSocket à chaque client avec sa traduction
6. Client : affiche message traduit, toggle "voir original" disponible
```

### F10 — Backup Agentic
```
1. User B active mode "Agentic" → status = 'agentic' (visible de tous)
2. Message envoyé dans un channel où B est membre
3. Backend : B n'est pas connecté en WS ET agentic_enabled = true
4. Agent récupère les 20 derniers messages (contexte)
5. Prompt Gemma 4 : "Tu es l'assistant de {B}, réponds comme il le ferait"
6. Réponse générée → sauvegardée avec is_agentic=true
7. Affiché : "[IA] B : {réponse}" avec badge violet
8. Notification envoyée à B : "Votre agent a répondu à votre place"
```

### F12 — Génération de résumé
```
1. User clique "✨ Générer résumé" dans le header du channel
2. Backend récupère les 50 derniers messages (contenu original)
3. Prompt Gemma 4 : structure résumé en 3 sections
4. Résumé retourné dans la langue de l'utilisateur demandeur
5. Affiché dans une modale avec option "copier" / "sauvegarder"
```

---

## 7. API Endpoints

### Auth
```
POST   /api/v1/auth/register          ← Inscription
POST   /api/v1/auth/login             ← Connexion → tokens
POST   /api/v1/auth/refresh           ← Renouveler access token
POST   /api/v1/auth/logout            ← Invalide refresh token
```

### Users
```
GET    /api/v1/users/me               ← Profil courant
PUT    /api/v1/users/me               ← Modifier profil
PUT    /api/v1/users/me/status        ← Changer statut (active/agentic/inactive)
PUT    /api/v1/users/me/avatar        ← Upload avatar
GET    /api/v1/users/search?q=        ← Chercher utilisateurs
GET    /api/v1/users/me/notifications ← Liste notifications
PUT    /api/v1/users/me/notifications/read-all ← Marquer tout lu
```

### Channels
```
GET    /api/v1/channels               ← Mes channels
POST   /api/v1/channels               ← Créer channel
GET    /api/v1/channels/{id}          ← Détail channel
PUT    /api/v1/channels/{id}          ← Modifier channel (admin)
DELETE /api/v1/channels/{id}          ← Archiver channel
GET    /api/v1/channels/{id}/members  ← Liste membres
POST   /api/v1/channels/{id}/members  ← Ajouter membre
DELETE /api/v1/channels/{id}/members/{uid} ← Retirer membre
```

### Messages
```
GET    /api/v1/channels/{id}/messages ← Historique (paginated)
POST   /api/v1/channels/{id}/messages ← Envoyer message (REST fallback)
PUT    /api/v1/messages/{id}          ← Modifier message
DELETE /api/v1/messages/{id}          ← Supprimer (soft delete)
POST   /api/v1/messages/{id}/pin      ← Épingler
POST   /api/v1/messages/{id}/reactions ← Ajouter réaction
GET    /api/v1/channels/{id}/pinned   ← Messages épinglés
POST   /api/v1/channels/{id}/search   ← Recherche full-text

WS     /ws/channels/{id}?token=...    ← WebSocket temps réel
```

### Files
```
POST   /api/v1/files/upload           ← Upload fichier
GET    /api/v1/files/{id}             ← Télécharger fichier
POST   /api/v1/files/{id}/translate   ← Traduire contenu fichier
```

### AI
```
POST   /api/v1/channels/{id}/summary      ← Générer résumé
POST   /api/v1/channels/{id}/action-plan  ← Extraire plan d'action
POST   /api/v1/channels/{id}/report       ← Générer rapport complet
GET    /api/v1/ai/health                  ← Vérifier disponibilité Gemma 4
```

---

## 8. Design UI/UX

### 8.1 Principes
- **Mobile First** — breakpoints : 375 / 640 / 768 / 1024 / 1280 / 1440px
- **Glassmorphism moderne** — surfaces semi-transparentes avec backdrop-blur
- **Dark mode natif** — palette sombre par défaut, light mode optionnel
- **Micro-animations** — transitions fluides (150-300ms)
- **Accessible** — WCAG 2.1 AA, focus visible, aria-labels

### 8.2 Composants clés
- `StatusBadge` : Active (vert pulse) / Agentic (violet pulse) / Inactive (gris)
- `MessageBubble` : Bulle avec toggle original/traduit, réactions, menu contextuel
- `AgenticBadge` : Badge "[IA]" sur les messages générés par l'agent
- `TranslationToggle` : Bouton discret pour voir le texte original
- `AIGeneratePanel` : Panel latéral pour résumé/plan d'action
- `LanguageFlag` : Drapeau + code langue affiché sur le profil
- `OnlineIndicator` : Point coloré sur l'avatar selon le statut
- `FileMessage` : Prévisualisation inline des fichiers partagés

---

## 9. Intégration Gemma 4

### 9.1 Interface abstraite LLMProvider
```python
class LLMProvider(ABC):
    async def complete(system: str, user: str) -> str
    async def stream(system: str, user: str) -> AsyncIterator[str]
    async def is_available() -> bool
```
→ Implémentations : `OllamaProvider`, `VertexAIProvider`, `HuggingFaceProvider`

### 9.2 Prompts

**Traduction**
```
System: Professional translator. Translate to {lang}. Return ONLY the translation.
User: {text}
```

**Backup Agentic**
```
System: You are {name}'s AI assistant. Persona: {persona}. Language: {lang}.
        Reply as {name} would in a professional context. Be concise.
User: [Context: last 20 messages]
      New message to answer: {message}
```

**Résumé**
```
System: Expert meeting summarizer. Respond in {lang}.
User: [conversation]
      Generate:
      ## Points clés
      ## Décisions prises
      ## Prochaines étapes
```

**Plan d'action**
```
System: Project manager. Extract action items. Respond in {lang}.
User: [conversation]
      Format: - @assignee: tâche [deadline si mentionnée]
```

---

## 10. Plan de Développement MVP

### Sprint 1 — Fondations (Jours 1-3)
- [ ] Init Angular 21 + TailwindCSS 4
- [ ] Init FastAPI + PostgreSQL + Docker Compose
- [ ] Auth complet (register/login/JWT refresh)
- [ ] Modèles BDD + migrations Alembic
- [ ] Design system (couleurs, typographie, composants de base)

### Sprint 2 — Chat Core (Jours 4-6)
- [ ] WebSocket backend (manager multi-channel)
- [ ] Layout principal (sidebar + zone chat)
- [ ] Envoi/réception de messages temps réel
- [ ] Gestion channels (équipes + DM)
- [ ] Composant MessageBubble

### Sprint 3 — IA Gemma 4 (Jours 7-9)
- [ ] LLMProvider + Ollama integration
- [ ] Service de traduction + cache BDD
- [ ] Affichage traductions + toggle original
- [ ] Mode Backup Agentic + statuts

### Sprint 4 — Features avancées (Jours 10-12)
- [ ] Résumé + plan d'action (UI + API)
- [ ] Réactions, mentions @, messages épinglés
- [ ] Upload fichiers + traduction PDF
- [ ] Recherche full-text

- [ ] Polish UI mobile
- [ ] Tests unitaires clés
- [ ] Demo seeding (données de démo réalistes)
- [ ] Déploiement Hugging Face Spaces ou Render

---


| Livrable | Statut |
|---|---|
| Repo GitHub public (Apache 2.0) | À faire |
| Demo fonctionnelle accessible en ligne | À faire |
| README avec instructions `docker compose up` | ✅ Inclus |
| Technical write-up (usage Gemma 4) | À rédiger |
| Vidéo démo 2-3 min | À enregistrer |
| Données de démo réalistes | À seeder |

---

*Document vivant — mis à jour à chaque sprint.*
