# Scénario Complet : Connexion et Affichage d'un Thread Multilingue (Mode AUTH_DISABLED)

**Document de référence** : Décrit la séquence complète des actions et la réaction du système lorsqu'un utilisateur est impersonné (mode dev `AUTH_DISABLED=true`), ouvre un fil de discussion, et voit les messages traduits en sa langue.

---

## ⚙️ Configuration Requise

Pour tester ce scénario en LOCAL :

```bash
# .env backend
AUTH_DISABLED=true
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
DATABASE_URL=postgresql+asyncpg://wb_user:wb_password@localhost:5432/withoutborder

# Démarrer
./start.sh
```

**Note** : En mode `AUTH_DISABLED=true` :
- ❌ Pas d'authentification Keycloak
- ✅ Dropdown de sélection d'utilisateur visible (dev users pré-seedés)
- ✅ Chaque requête HTTP inclut header `X-Dev-User-Id`
- ✅ Backend valide le header, impersonne l'utilisateur
- ✅ Parfait pour tester les traductions et WebSocket localement

---

## Sommaire

- [1. Scénario Global](#1-scénario-global)
- [2. Phase 1 : Authentification et Chargement du Profil](#2-phase-1--authentification-et-chargement-du-profil)
- [3. Phase 2 : Chargement du Thread et des Canaux](#3-phase-2--chargement-du-thread-et-des-canaux)
- [4. Phase 3 : Traduction des Messages (Page Load)](#4-phase-3--traduction-des-messages-page-load)
- [5. Phase 4 : Connexion WebSocket (Real-Time)](#5-phase-4--connexion-websocket-real-time)
- [6. Phase 5 : Arrivée d'un Nouveau Message](#6-phase-5--arrivée-dun-nouveau-message)
- [7. Phase 6 : Mise à Jour de l'Affichage (Frontend)](#7-phase-6--mise-à-jour-de-laffichage-frontend)
- [8. Diagrammes de Flux](#8-diagrammes-de-flux)
- [9. Tableau Récapitulatif](#9-tableau-récapitulatif)

---

## 1. Scénario Global (Mode DEV - AUTH_DISABLED=true)

Développeur teste **Marie** (FR) en mode développement (sans Keycloak) à 14:00 UTC.

**Acteurs dans la conversation** (pré-seedés en BD) :
- **Marie** — Français (FR) 🇫🇷 (sélectionnée pour le test)
- **John** — Anglais (EN) 🇬🇧
- **Carlos** — Espagnol (ES) 🇪🇸
- **Wei** — Chinois (ZH) 🇨🇳

**Scénario** :
1. Frontend : Sélectionner Marie dans le dropdown dev
2. Header `X-Dev-User-Id: <marie-uuid>` ajouté automatiquement
3. Backend : Valide le header (pas de JWT)
4. Afficher un canal → GET `/api/v1/channels/{id}/messages?page=1`
5. 50 messages affichés (certains sans traductions en cache)
6. Pendant ce temps, background task traduit les messages non cachés
7. WebSocket se connecte → écoute les nouveaux messages en temps réel
8. Simuler John qui envoie un message en anglais
9. Backend traduit pour tous → Marie voit le message en FR

---

## 2. Phase 1 : Sélection d'Utilisateur Dev (Mode AUTH_DISABLED)

### 2.1 Frontend : Démarrage de l'App

**Lieu** : `frontend/src/app/app.component.ts` et `environment.ts`

```typescript
// environment.authDisabled = true  (configuration locale)
// Pas de redirection vers Keycloak

// L'app affiche un sélecteur d'utilisateur dev:
```

**Écran affiché** :
```
┌─────────────────────────────────────────┐
│  WithoutBorder (Mode Dev)               │
├─────────────────────────────────────────┤
│  Sélectionner un utilisateur:           │
│                                         │
│  ⬤ Marie (FR) 🇫🇷                      │
│  ○ John (EN) 🇬🇧                       │
│  ○ Carlos (ES) 🇪🇸                      │
│  ○ Wei (ZH) 🇨🇳                        │
│                                         │
│  [Continuer vers l'app]                 │
└─────────────────────────────────────────┘
```

### 2.2 Frontend : Impersonnation d'Utilisateur

**Lieu** : `frontend/src/app/core/services/dev-user.service.ts`

```typescript
// Service qui gère la sélection d'utilisateur en mode dev
class DevUserService {
  private _selectedId = signal<string | null>(null);
  readonly selectedId = this._selectedId.asReadonly();
  
  selectUser(userId: string) {
    this._selectedId.set(userId);
    // Redirection vers /app/chat
  }
}

// Marie sélectionnée:
this.devUserSvc.selectUser("00000000-0000-0000-0001-000000000001");
```

### 2.3 Frontend : Intercepteur Ajoute le Header `X-Dev-User-Id`

**Lieu** : `frontend/src/app/core/interceptors/dev-user.interceptor.ts`

Chaque requête HTTP inclut maintenant le header :

```typescript
// dev-user.interceptor.ts ligne 14-22:
if (!environment.authDisabled) return next(req);

const devUserSvc = inject(DevUserService);
const userId = devUserSvc.selectedId();

const cloned = req.clone({
  setHeaders: { 'X-Dev-User-Id': userId },  // ← Header magic!
});
return next(cloned);

// Exemple de requête:
GET /api/v1/users/me
X-Dev-User-Id: 00000000-0000-0000-0001-000000000001
```

### 2.4 Backend : Bypass Authentication avec Header

**Lieu** : `backend/app/core/security/jwt_handler.py` → `_get_bypass_user()` et `get_current_user()`

```python
# Quand AUTH_DISABLED=True dans .env:
async def get_current_user(
    user_id_override: str = Header(None, alias="X-Dev-User-Id")
) -> UserRead:
    """Bypass auth with X-Dev-User-Id header in dev mode."""
    
    if settings.AUTH_DISABLED:
        if user_id_override:
            user = await _get_bypass_user(user_id_override=user_id_override)
            _log.debug(f"[AUTH-BYPASS] Impersonating user {user.username}")
            return user
        else:
            raise HTTPException(
                status_code=400,
                detail="AUTH_DISABLED: X-Dev-User-Id header required"
            )
    
    # ... Keycloak validation (skipped in this mode)
```

### 2.5 Backend : Charger le Profil de Marie

**Lieu** : `backend/app/repositories/repositories.py` → `UserRepository.get_by_id()`

```python
# Backend reçoit le header et extrait user_id
user_id = "00000000-0000-0000-0001-000000000001"

# Query:
SELECT * FROM users WHERE id = user_id;

# Réponse (auto-seed par la fixture de test):
{
  "id": "00000000-0000-0000-0001-000000000001",
  "email": "marie@withoutborder.app",
  "username": "marie",
  "preferred_language": "fr",  # ← Language locale
  "status": "active",
  "agentic_enabled": false,
  "avatar_url": null,
  "created_at": "2024-01-01T00:00:00Z"
}
```

### 2.6 Frontend : GET /api/v1/users/me (avec Header)

```typescript
// auth.service.ts → loadCurrentUser()
const raw = await firstValueFrom(
  this.http.get<Record<string, unknown>>(`${environment.apiUrl}/api/v1/users/me`)
  // Header X-Dev-User-Id: 00000000-0000-0000-0001-000000000001 ajouté par intercepteur
);

const user = mapUser(raw);
this._user.set(user);
```

### 2.7 Frontend : Utilisateur Chargé en Signal

```typescript
// Signal Angular mis à jour:
private _user = signal<User | null>(null);

this._user.set({
  id: "00000000-0000-0000-0001-000000000001",
  username: "marie",
  preferredLanguage: "fr",  // ← Utilisé pour la traduction
  status: "active",
  email: "marie@withoutborder.app",
  ...
});

// Navigation vers /app/chat
```

**✓ État après Phase 1** :
- ✅ Marie sélectionnée (MODE DEV)
- ✅ Header `X-Dev-User-Id` ajouté automatiquement
- ✅ Profil chargé en mémoire (Angular signal)
- ✅ Langue préférée = `fr`
- ⏳ Pas encore de messages affichés

---

## 3. Phase 2 : Chargement du Thread et des Canaux

### 3.1 Frontend : Navigation vers un Canal

Utilisateur clique sur le canal "Projet Q3".

**Lieu** : `frontend/src/app/features/chat/chat.component.ts`

```typescript
// Route change to:
/app/chat/00000000-0000-0000-0002-000000000001  // Channel ID
```

### 3.2 Backend : Récupérer le Canal et Ses Membres

**Lieu** : `backend/app/api/v1/endpoints/channels_router.py` → `get_channel_with_members()`

```python
# GET /api/v1/channels/00000000-0000-0000-0002-000000000001
# (vérifie que Marie est membre du canal)

SELECT 
  c.*,
  array_agg(DISTINCT u.preferred_language) as member_languages
FROM channels c
JOIN channel_members cm ON c.id = cm.channel_id
JOIN users u ON cm.user_id = u.id
WHERE c.id = '...'
GROUP BY c.id;

# Réponse:
{
  "id": "00000000-0000-0000-0002-000000000001",
  "name": "Projet Q3",
  "type": "team",
  "memberCount": 4,
  "members": [
    { "username": "marie", "preferredLanguage": "fr", "status": "active" },
    { "username": "john",  "preferredLanguage": "en", "status": "active" },
    { "username": "carlos", "preferredLanguage": "es", "status": "active" },
    { "username": "wei",   "preferredLanguage": "zh", "status": "active" }
  ],
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### 3.3 Frontend : Afficher la Liste des Canaux et Sélectionner

**Lieu** : `frontend/src/app/features/chat/chat.component.ts`

```typescript
// Signal mises à jour:
private _channels = signal<Channel[]>([...]);
private _currentChannel = signal<Channel | null>(null);
private _currentChannel.set(channelFromAPI);

// Ajoute Marie's vue du canal
```

**✓ État après Phase 2** :
- ✅ Canal "Projet Q3" sélectionné
- ✅ Membres visibles (FR, EN, ES, ZH)
- ⏳ Pas encore de messages affichés

---

## 4. Phase 3 : Traduction des Messages (Page Load)

### 4.1 Frontend : Demander les Messages de la Page 1

**Lieu** : `frontend/src/app/features/chat/chat.component.ts` → `loadMessages()`

```typescript
// GET /api/v1/channels/{channelId}/messages?page=1&page_size=50
const messages = await this.messageService.getMessages(channelId, 1, 50);
```

### 4.2 Backend : Récupérer 50 Messages de la BD

**Lieu** : `backend/app/api/v1/endpoints/messages_router.py` → `get_messages()` (ligne 114-157)

```python
# Requête:
SELECT m.id, m.original_content, m.original_language, 
       m.sender_id, m.created_at, ...
FROM messages m
WHERE m.channel_id = '...'
ORDER BY m.created_at DESC
LIMIT 50 OFFSET 0;

# Résultat: 50 messages (ex. de John, Carlos, Wei, etc.)
```

### 4.3 Backend : Enrichir Chaque Message avec la Traduction en Cache

**Lieu** : `backend/app/api/v1/endpoints/messages_router.py` → `get_messages()` (ligne 140-150)

Pour chaque message, vérifier la cache :

```python
# Pour chaque message m et target_language="fr" (langue de Marie):
SELECT translated_content 
FROM message_translations 
WHERE message_id = m.id AND target_language = 'fr';

# Si hit → inclure dans réponse
# Si miss → ajouter à liste to_translate
```

**Exemple de message avec traduction en cache** :
```json
{
  "id": "msg-001",
  "originalContent": "Hello everyone",
  "originalLanguage": "en",
  "translatedContent": "Bonjour à tous",  // ← En cache
  "senderId": "john-uuid",
  "senderUsername": "john",
  "createdAt": "2024-01-15T14:05:00Z"
}
```

**Exemple de message SANS traduction en cache** :
```json
{
  "id": "msg-042",
  "originalContent": "¿Cómo estás?",
  "originalLanguage": "es",
  "translatedContent": null,  // ← À traduire
  "senderId": "carlos-uuid",
  "senderUsername": "carlos",
  "createdAt": "2024-01-15T14:08:00Z"
}
```

### 4.4 Backend : Recenser les Messages à Traduire

**Lieu** : `backend/app/api/v1/endpoints/messages_router.py` (ligne 141-157)

```python
to_translate = []
for msg in messages:
    if msg.original_language != target_lang:
        cached = await msg_repo.get_cached_translation(msg.id, target_lang)
        if not cached:
            to_translate.append((msg.id, msg.original_content))

# Limite à 10000 (MAX_BG_TRANSLATIONS)
items_to_bg = to_translate[:_MAX_BG_TRANSLATIONS]
```

### 4.5 Backend : Lancer une Tâche de Traduction en Arrière-Plan

**Lieu** : `backend/app/api/v1/endpoints/messages_router.py` (ligne 153-157)

```python
if items_to_bg:
    background_tasks.add_task(
        _cache_translations_batch_bg,
        channel_id=channel_id,
        user_id=current_user.id,
        target_lang="fr",
        items=items_to_bg
    )
```

### 4.6 Backend : Répondre Immédiatement au Frontend (HTTP 200)

**Lieu** : `backend/app/api/v1/endpoints/messages_router.py` (ligne 163)

```json
HTTP 200 OK

{
  "items": [
    {
      "id": "msg-001",
      "originalContent": "Hello everyone",
      "originalLanguage": "en",
      "translatedContent": "Bonjour à tous",
      "senderUsername": "john"
    },
    {
      "id": "msg-042",
      "originalContent": "¿Cómo estás?",
      "originalLanguage": "es",
      "translatedContent": null,  // ← Pas encore de traduction
      "senderUsername": "carlos"
    },
    ...
  ],
  "total": 156,
  "page": 1,
  "page_size": 50,
  "has_more": true
}
```

### 4.7 Frontend : Afficher les Messages Immédiatement

**Lieu** : `frontend/src/app/features/chat/message-list.component.ts`

```typescript
// Mise à jour du signal:
private _messages = signal<Message[]>([]);
this._messages.set(messages);

// Template (chat.component.html):
@for (msg of messages(); track msg.id) {
  <app-message-bubble 
    [message]="msg"
    [translator]="translationService">
  </app-message-bubble>
}

// Component affiche:
// Si message.translatedContent → affiche la traduction
// Si message.translatedContent === null → affiche l'original + spinner
```

**Écran affiché à Marie à t=14:00 UTC** :
```
┌─────────────────────────────────────────┐
│  Projet Q3  (4 membres)                 │
├─────────────────────────────────────────┤
│ [EN] john: Bonjour à tous               │  ← En cache
│ [ES] carlos: ¿Cómo estás? ⟳            │  ← Traduction en cours
│ [ZH] wei: 很高兴认识你 ⟳                │  ← Traduction en cours
│ [EN] john: Quelque chose d'autre        │  ← En cache
│ [ES] carlos: Hola nuevamente ⟳          │  ← Traduction en cours
└─────────────────────────────────────────┘
```

### 4.8 Tâche d'Arrière-Plan : Traduire les Messages

**Lieu** : `backend/app/api/v1/endpoints/messages_router.py` → `_cache_translations_batch_bg()` (ligne 35-140)

Execut **en parallèle** (n'attend pas de répondre à l'utilisateur) :

#### Étape 1 : Re-vérifier la cache (d'autres requêtes ont peut-être déjà traduit)

```python
async with AsyncSessionLocal() as db:
    for msg_id, text in items:
        cached = await msg_repo_bg.get_cached_translation(msg_id, target_lang="fr")
        if not cached:
            pending.append((msg_id, text))
```

#### Étape 2 : Appeler Ollama (Gemma 4) par Batch

**Lieu** : `backend/app/services/translation_service.py` → `translate_batch()`

```python
# Entrée:
texts = [
    "¿Cómo estás?",
    "很高兴认识你",
    "Hola nuevamente"
]

# Prompt:
system = "You are a professional multilingual translator. Translate ALL texts to French. Return ONLY a JSON array of translated strings, in the same order."
user = '["¿Cómo estás?", "很高兴认识你", "Hola nuevamente"]'

# Appel Ollama:
async with _bg_translation_sem:  # Max 5 appels concurrents
    raw = await self.llm.complete(system_prompt=system, user_prompt=user)

# Résultat Ollama:
[
  "Comment ça va?",
  "Heureux de vous rencontrer",
  "Bonjour à nouveau"
]
```

#### Étape 3 : Persistance en Base de Données

```python
# INSERT INTO message_translations:
INSERT INTO message_translations (message_id, target_language, translated_content)
VALUES 
  ('msg-042', 'fr', 'Comment ça va?'),
  ('msg-043', 'fr', 'Heureux de vous rencontrer'),
  ('msg-044', 'fr', 'Bonjour à nouveau')
ON CONFLICT (message_id, target_language) DO NOTHING;
```

#### Étape 4 : Envoyer les Traductions via WebSocket

**Lieu** : `backend/app/core/websocket_manager.py` → `broadcast()`

```python
# Pour chaque message traduit, envoyer à Marie via WS:
for msg_id, translated_text in results:
    ws_event = {
        "type": "message_translated",
        "data": {
            "message_id": msg_id,
            "translated_content": translated_text,
            "target_language": "fr"
        }
    }
    # Broadcast au channel
    await connection_manager.broadcast(channel_id, json.dumps(ws_event))
```

### 4.9 Frontend : WebSocket reçoit les Traductions et met à jour l'UI

**Lieu** : `frontend/src/app/core/services/chat-ws.service.ts` → reçoit un événement `message_translated`

```typescript
// WebSocket event reçu:
{
  "type": "message_translated",
  "data": {
    "message_id": "msg-042",
    "translated_content": "Comment ça va?"
  }
}

// Mise à jour du signal messages:
const msg = this._messages().find(m => m.id === "msg-042");
if (msg) {
    msg.translatedContent = "Comment ça va?";
    this._messages.set([...this._messages()]);  // Signal update
}
```

**Écran affiché à Marie après ~2-3 sec** :
```
┌─────────────────────────────────────────┐
│  Projet Q3  (4 membres)                 │
├─────────────────────────────────────────┤
│ [EN] john: Bonjour à tous               │
│ [ES] carlos: Comment ça va?             │  ← Traduction reçue!
│ [ZH] wei: Heureux de vous rencontrer    │  ← Traduction reçue!
│ [EN] john: Quelque chose d'autre        │
│ [ES] carlos: Bonjour à nouveau          │  ← Traduction reçue!
└─────────────────────────────────────────┘
```

**✓ État après Phase 4** :
- ✅ 50 messages affichés
- ✅ Traductions en cache affichées immédiatement
- ✅ Traductions manquantes traduites en arrière-plan
- ✅ WebSocket met à jour l'UI en temps réel

---

## 5. Phase 4 : Connexion WebSocket (Real-Time)

### 5.1 Frontend : Établir une Connexion WebSocket

**Lieu** : `frontend/src/app/core/services/chat-ws.service.ts` → `connect()`

```typescript
// Après que le canal soit sélectionné:
this.chatWsService.connect(channelId);

// Construction de l'URL WebSocket:
const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const wsBase = `${wsProtocol}://${window.location.host}${environment.apiUrl}`;
const wsUrl = `${wsBase}/api/v1/ws/channels/${channelId}?token=${token}`;

// Connexion:
this.ws = new WebSocket(wsUrl);

this.ws.onopen = () => {
    console.log("WebSocket connected");
    this._connected$.next();
};

this.ws.onmessage = (event) => {
    const wsEvent = JSON.parse(event.data);
    this._events$.next(wsEvent);
};
```

### 5.2 Backend : Accepter la Connexion WebSocket

**Lieu** : `backend/app/api/v1/endpoints/messages_router.py` → `websocket_endpoint()` (ligne 180-210)

```python
@router.websocket("/ws/channels/{channel_id}")
async def websocket_endpoint(
    websocket: WebSocket, 
    channel_id: uuid.UUID, 
    token: str
):
    # 1. Extraire et valider le JWT
    user = await get_current_user(token=token)
    
    # 2. Vérifier que l'utilisateur est membre du canal
    is_member = await channel_repo.is_user_member(channel_id, user.id)
    if not is_member:
        await websocket.close(code=1008, reason="Not a member")
        return
    
    # 3. Ajouter la connexion au gestionnaire
    await connection_manager.connect(websocket, channel_id, user.id)
    
    # 4. Broadcast "presence" event
    await connection_manager.broadcast(channel_id, {
        "type": "presence",
        "data": {
            "user_id": user.id,
            "username": user.username,
            "status": "online"
        }
    })
    
    # 5. Boucle de réception
    try:
        while True:
            data = await websocket.receive_text()
            msg_data = json.loads(data)
            # Traiter le message (voir Phase 6)
    except WebSocketDisconnect:
        await connection_manager.disconnect(websocket, channel_id, user.id)
```

### 5.3 Frontend : Recevoir et Traiter les Événements

**Lieu** : `frontend/src/app/core/services/chat-ws.service.ts`

```typescript
// Souscrire aux événements:
this._events$
  .pipe(
    filter(evt => evt.type === 'presence'),
    map(evt => evt.data as PresenceUser)
  )
  .subscribe(presenceUser => {
    const onlineMap = this._onlineUsers();
    onlineMap.set(presenceUser.userId, presenceUser);
    this._onlineUsers.set(onlineMap);
  });
```

**Affichage des Utilisateurs en Ligne** :
```
┌─────────────────────────────────────────┐
│  Projet Q3  (4 membres)                 │
│  🟢 marie     🟢 john                   │
│  🟢 carlos    🟢 wei                    │
├─────────────────────────────────────────┤
│ Conversation...                         │
└─────────────────────────────────────────┘
```

**✓ État après Phase 5** :
- ✅ WebSocket connecté
- ✅ État de présence reçu (Marie, John, Carlos, Wei en ligne)
- ⏳ Attendre un nouveau message

---

## 6. Phase 5 : Arrivée d'un Nouveau Message

### 6.1 Autre Utilisateur Envoie un Message

**Scénario** : John tape "Let me know what you think" en anglais et l'envoie.

**Lieu** : Frontend de John → `chat.component.ts` → `sendMessage()`

```typescript
const msg = {
    content: "Let me know what you think",
    channelId: "00000000-0000-0000-0002-000000000001"
};

// Envoi via WebSocket:
this.chatWsService.send(msg);
```

### 6.2 WebSocket Backend Reçoit le Message

**Lieu** : `backend/app/api/v1/endpoints/messages_router.py` → `websocket_endpoint()` boucle (ligne 220-280)

```python
data = await websocket.receive_text()
# data = "{"content": "Let me know what you think", ...}"

msg_data = json.loads(data)
```

### 6.3 Backend Détecte la Langue Source

**Lieu** : `backend/app/helpers/language_detector.py` → `detect_language()`

```python
detected_lang = await detect_language("Let me know what you think")
# Résultat: "en" (Anglais)
```

### 6.4 Backend Crée le Message en BD

**Lieu** : `backend/app/api/v1/endpoints/messages_router.py` → `websocket_endpoint()` (ligne 240-250)

```python
new_msg = Message(
    id=uuid.uuid4(),
    channel_id=channel_id,
    sender_id=john_user.id,
    original_content="Let me know what you think",
    original_language="en",
    is_agentic=False
)

await msg_repo.create(new_msg)
await db.commit()

_log.info(f"[WS-NEW-MSG] Created message {new_msg.id} from {john_user.username}")
```

### 6.5 Backend Obtient tous les Membres du Canal

**Lieu** : `backend/app/api/v1/endpoints/messages_router.py` (ligne 253-260)

```python
members = await channel_repo.get_channel_members(channel_id)
# Résultat:
# [
#   {"user_id": "...", "username": "marie", "preferred_language": "fr"},
#   {"user_id": "...", "username": "john",  "preferred_language": "en"},
#   {"user_id": "...", "username": "carlos", "preferred_language": "es"},
#   {"user_id": "...", "username": "wei",   "preferred_language": "zh"}
# ]

member_langs = {m['preferred_language'] for m in members}
# {"fr", "en", "es", "zh"}
```

### 6.6 Backend Broadcast le Message Original à Tous

**Lieu** : `backend/app/api/v1/endpoints/messages_router.py` (ligne 265-275)

```python
# Envoyer à TOUS les clients WebSocket du canal
ws_event = {
    "type": "message",
    "data": {
        "id": str(new_msg.id),
        "channelId": str(channel_id),
        "senderId": str(john_user.id),
        "senderUsername": "john",
        "originalContent": "Let me know what you think",
        "originalLanguage": "en",
        "translatedContent": None,  # Pas de traduction automatique à l'envoi
        "createdAt": new_msg.created_at.isoformat()
    }
}

await connection_manager.broadcast(channel_id, json.dumps(ws_event))
```

### 6.7 Frontend Reçoit le Nouveau Message

**Tous les clients reçoivent** :

```typescript
// Frontend de Marie reçoit via WebSocket:
{
  "type": "message",
  "data": {
    "id": "msg-123",
    "senderUsername": "john",
    "originalContent": "Let me know what you think",
    "originalLanguage": "en",
    "translatedContent": null
  }
}

// Ajouter au début de la liste:
const newMessage: Message = {
    id: "msg-123",
    senderUsername: "john",
    originalContent: "Let me know what you think",
    originalLanguage: "en",
    translatedContent: null,
    ...
};

const msgs = this._messages();
this._messages.set([newMessage, ...msgs]);
```

**Affichage immédiat** :
```
┌─────────────────────────────────────────┐
│ [EN] john: Let me know what you think ⟳ │  ← Reçu, en attente de traduction
│ [ES] carlos: Bonjour à nouveau          │
│ ...                                     │
└─────────────────────────────────────────┘
```

### 6.8 Backend Traduit pour Chaque Membre

**Lieu** : `backend/app/api/v1/endpoints/messages_router.py` (ligne 278-300) → `translate_for_members()`

```python
# Lancer une tâche en arrière-plan (ne bloque pas la réponse WebSocket)
background_tasks.add_task(
    translate_for_members,
    message_id=new_msg.id,
    original_content="Let me know what you think",
    original_language="en",
    channel_id=channel_id,
    member_languages=["fr", "en", "es", "zh"]
)
```

### 6.9 Tâche de Traduction pour Chaque Langue

**Lieu** : `backend/app/services/translation_service.py` → `translate_for_members()` (ligne 145-180)

```python
async def translate_for_members(
    message_id, original_content, original_language, 
    channel_id, member_languages
):
    _log.info(f"[TRANSLATE-FOR-MEMBERS] msg_id={message_id}, langs={member_languages}")
    
    # Pour chaque langue de membre (sauf la langue originale):
    for target_lang in member_languages:
        if target_lang == original_language:
            continue  # Skip John (il a l'original)
        
        # 1. Traduire le texte
        translated = await self.translate(
            original_content,
            target_language=target_lang,
            source_language=original_language
        )
        
        # 2. Sauvegarder en cache
        await msg_repo.create_translation(
            message_id=message_id,
            target_language=target_lang,
            translated_content=translated
        )
        
        # 3. Envoyer via WebSocket
        ws_event = {
            "type": "message_translated",
            "data": {
                "message_id": str(message_id),
                "translated_content": translated,
                "target_language": target_lang
            }
        }
        await connection_manager.broadcast(channel_id, json.dumps(ws_event))
```

**Exécution pour chaque langue** :
- `target_lang="fr"` → "Faites-moi savoir ce que vous en pensez"
- `target_lang="es"` → "Déjame saber lo que piensas"
- `target_lang="zh"` → "告诉我你的想法"

**✓ État après Phase 6** :
- ✅ Nouveau message créé en BD
- ✅ Broadcast initial envoyé (original + null)
- ✅ Traductions lancées en arrière-plan

---

## 7. Phase 6 : Mise à Jour de l'Affichage (Frontend)

### 7.1 Frontend : Recevoir l'Événement WebSocket `message_translated`

**Lieu** : `frontend/src/app/core/services/chat-ws.service.ts`

```typescript
this.ws.onmessage = (event) => {
    const wsEvent = JSON.parse(event.data);
    
    if (wsEvent.type === 'message_translated') {
        const { message_id, translated_content, target_language } = wsEvent.data;
        
        // Trouver le message dans la liste
        const msgs = this._messages();
        const msgIndex = msgs.findIndex(m => m.id === message_id);
        
        if (msgIndex >= 0 && target_language === this.currentUserLanguage) {
            // Mettre à jour le message avec la traduction
            msgs[msgIndex].translatedContent = translated_content;
            msgs[msgIndex].showOriginal = false;  // Reset le toggle
            this._messages.set([...msgs]);  // Signal update
        }
    }
};
```

### 7.2 Frontend : Afficher la Traduction dans le Bubble

**Lieu** : `frontend/src/app/features/chat/components/message-bubble.component.ts`

```html
<!-- Template -->
<div class="message-bubble">
  <!-- Avatar + Sender -->
  <div class="message-header">
    <img [src]="message.senderAvatar" alt="avatar">
    <span class="sender">{{ message.senderUsername }}</span>
    <span class="timestamp">{{ message.createdAt | date:'short' }}</span>
  </div>
  
  <!-- Contenu -->
  <div class="message-content">
    <!-- Afficher la traduction SI disponible, sinon l'original -->
    @if (message.translatedContent && !message.showOriginal) {
      <p class="translated">{{ message.translatedContent }}</p>
      <button (click)="toggleOriginal()" class="show-original">
        Voir original [{{ message.originalLanguage | uppercase }}]
      </button>
    } @else {
      <p class="original">{{ message.originalContent }}</p>
      @if (message.originalLanguage !== currentLanguage) {
        <button (click)="toggleOriginal()" class="show-original">
          [{{ message.originalLanguage | uppercase }}] Voir traduction
        </button>
      }
    }
  </div>
</div>
```

**Rendu HTML pour Marie** :

#### Avant la traduction (t=14:02:00)
```html
<div class="message-bubble">
  <div class="message-header">
    <span class="sender">john</span>
    <span class="badge en">EN</span>
    <span class="timestamp">14:02</span>
  </div>
  <div class="message-content">
    <p class="original">Let me know what you think</p>
    <button>Voir traduction</button>
    <span class="spinner">⟳</span>
  </div>
</div>
```

#### Après la traduction (t=14:02:02)
```html
<div class="message-bubble">
  <div class="message-header">
    <span class="sender">john</span>
    <span class="badge en">EN</span>
    <span class="timestamp">14:02</span>
  </div>
  <div class="message-content">
    <p class="translated">Faites-moi savoir ce que vous en pensez</p>
    <button>Voir original [EN]</button>
  </div>
</div>
```

### 7.3 Frontend : Affichage dans le Canal

**Écran final pour Marie après la traduction** :

```
┌─────────────────────────────────────────────┐
│  Projet Q3  (4 membres)                     │
│  🟢 marie     🟢 john                       │
│  🟢 carlos    🟢 wei                        │
├─────────────────────────────────────────────┤
│  [EN] john (14:02)                          │
│  Faites-moi savoir ce que vous en pensez   │
│  [Voir original]                            │
│                                             │
│  [ES] carlos (14:01)                        │
│  Bonjour à nouveau                          │
│                                             │
│  [ZH] wei (13:59)                           │
│  Heureux de vous rencontrer                 │
└─────────────────────────────────────────────┘

Message Composer:
┌─────────────────────────────────────────────┐
│ [Écrire un message...]                      │
│                                             │
│  [Envoyer]                                  │
└─────────────────────────────────────────────┘
```

**✓ État final** :
- ✅ Marie voit tous les messages en français
- ✅ Badges de langue affichés
- ✅ Boutons "Voir original" disponibles
- ✅ WebSocket maintient la connexion pour les nouveaux messages

---

## 8. Diagrammes de Flux

### 8.1 Sélection Dev et Chargement du Profil (MODE AUTH_DISABLED)

```
Frontend: App charge
         │
         ▼
Affiche sélecteur d'utilisateur dev
         │
         ▼
Dev sélectionne "Marie"
         │
         ▼
DevUserService.selectUser(marie-uuid)
         │
         ▼
Redirecte vers /app/chat
         │
         ▼
Frontend: GET /users/me
         ↓ (Intercepteur ajoute X-Dev-User-Id: marie-uuid)
         ▼
Backend: Valide le header (pas de JWT)
         │
         ▼
Backend: Profil de Marie (preferred_language: "fr")
         │
         ▼
Frontend: Signal user$ mis à jour
```

### 8.2 Chargement du Thread et des Messages

```
Frontend: Sélection du canal
         │
         ▼
GET /channels/{id}/messages?page=1&page_size=50
         │
    ┌────┴────┐
    │          │
    ▼          ▼
[Réponse HTTP] [Tâche BG]
    │          │
    │          ├─ Pour chaque message sans traduction:
    │          │   Appel Ollama (batch)
    │          │   INSERT cache
    │          │   Broadcast via WS
    │          │
    ▼          ▼
Frontend    Frontend
Affiche msg Reçoit message_translated
    │          │
    └────┬─────┘
         │
         ▼
UI met à jour
(spinner → traduction)
```

### 8.3 WebSocket en Temps Réel

```
John envoie "Let me know what you think"
         │
         ▼
WebSocket.send(msg)
         │
         ▼
Backend: Détect langue (en)
         │
         ▼
Create Message en BD
         │
         ▼
Broadcast original à tous
         │
    ┌────┼────┬────┐
    ▼    ▼    ▼    ▼
  Marie John Carlos Wei
    │    │    │    │
    │ (en)  (en)  (en)
    │    │    │    │
    ▼    ▼    ▼    ▼
  Reçoit originalContent (affiche en FR après traduction)
    │    
    ├─ Tâche BG: Traduire "Let me know..." → "Faites-moi savoir..."
    │            INSERT cache
    │            Broadcast message_translated
    │
    ▼
Marie reçoit event "message_translated"
    │
    ▼
Signal messages$ mise à jour
    │
    ▼
Template remplace "Let me know..." par "Faites-moi savoir..."
    │
    ▼
Affichage final en français
```

---

## 9. Tableau Récapitulatif

| Phase | Étape | Lieu | Action | État |
|-------|-------|------|--------|------|
| **1** | 1.1 | Frontend | Sélection dev: Marie | User ID stocké |
| **1** | 1.2 | Frontend | Intercepteur HTTP | X-Dev-User-Id header ajouté |
| **1** | 1.4 | Frontend | GET /users/me (avec header) | Profil chargé (FR) |
| **2** | 2.1 | Frontend | Sélection canal | Canal actif |
| **3** | 3.2 | Backend | SELECT messages | 50 messages EN BD |
| **3** | 3.3 | Backend | Vérif cache | Partiels avec trad |
| **3** | 3.5 | Backend | Lancer BG task | Task en parallèle |
| **3** | 3.6 | Frontend | HTTP 200 | Affichage immédiat |
| **4** | 4.8 | Backend | Appel Ollama | Batch traduit |
| **4** | 4.9 | Frontend | WS event | Messages mis à jour |
| **5** | 5.1 | Frontend | WS connect | Connection ouverte |
| **6** | 6.1 | Frontend | sendMessage() | John envoie EN |
| **6** | 6.4 | Backend | INSERT Message | Message créé |
| **6** | 6.6 | Backend | Broadcast | Événement "message" |
| **6** | 6.7 | Frontend | onmessage | Message affiché (EN) |
| **6** | 6.9 | Backend | Translate batch | Pour FR, ES, ZH |
| **7** | 7.1 | Frontend | message_translated | Marie reçoit FR |
| **7** | 7.2 | Frontend | Render template | "Faites-moi..." visible |

---

## Résumé

**Flux complet de bout en bout (Mode AUTH_DISABLED)** :

1. **Sélectionner Marie** → Header `X-Dev-User-Id` ajouté automatiquement
2. **Backend valide le header** → Profil chargé (langue FR)
3. **Sélectionner un canal** → 50 messages affichés (certains avec trad en cache)
4. **Messages sans cache** → Traduction en arrière-plan lancée via Ollama
5. **WebSocket se connecte** → Reçoit les traductions en temps réel
6. **Simuler message de John** → Broadcast initial (EN original)
7. **Traduction en BG** → Ollama traduit pour FR/ES/ZH
8. **WebSocket push** → Marie reçoit la traduction
9. **UI update** → "Faites-moi savoir ce que vous en pensez" affichée

**Avantages du mode DEV** :
- ✅ Pas de dépendance Keycloak
- ✅ Impersonnation instantanée (juste un dropdown)
- ✅ Chaque requête inclut `X-Dev-User-Id` header automatiquement
- ✅ Parfait pour tester les traductions et WebSocket localement

**Tout cela en ~2-3 secondes pour les translations en background, et immédiatement pour le contenu en cache.**
