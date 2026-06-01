# Topologie du Système de Traduction — Without Border

## Vue d'ensemble

La traduction se fait **à l'affichage** (pas au stockage). Quand l'utilisateur affiche un fil de discussion, les messages manquants sont traduits en arrière-plan et cachés en base de données.

---

## 1. Flux - Utilisateur charge la page

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Frontend (Angular)                                                      │
│  GET /app/chat/00000000-0000-0000-0001-000000000002                     │
└────────────────────┬────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Backend (FastAPI)                                                       │
│  GET /channels/{channel_id}/messages?page=1&page_size=50               │
└────────────────────┬────────────────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
   ┌─────────────┐          ┌──────────────────┐
   │  Database   │          │  For each msg:   │
   │  PostgreSQL │          │  - Sender info   │
   │             │          │  - Get CACHED    │
   │ messages    │          │    translation   │
   │ (50 msgs)   │          │  - Reactions     │
   └─────────────┘          └──────────────────┘
                                    │
                                    ▼
                            ┌──────────────────┐
                            │ Collect messages │
                            │ WITHOUT cached   │
                            │ translation into │
                            │ to_translate[]   │
                            └────────┬─────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
         Has cached translations?              No cached?
                    │                                 │
                    ▼                                 ▼
           ┌──────────────────┐         ┌──────────────────────────┐
           │  Return message  │         │ Launch BACKGROUND TASK   │
           │  with            │         │ (_cache_translations...) │
           │  translated_cont.│         └──────────────────────────┘
           └──────────────────┘                      │
                                                     ▼
                                        ┌──────────────────────────┐
                                        │ Limit to first 50 items  │
                                        │ (MAX_BG_TRANSLATIONS)    │
                                        │                          │
                                        │ ⚠️ THIS IS THE BUG!      │
                                        │ Items 51+ are IGNORED    │
                                        └──────────────────────────┘
```

---

## 2. Flux - Réponse HTTP immédiate

```
┌───────────────────────────────────────────────────┐
│ HTTP 200 OK - PaginatedMessages                   │
├───────────────────────────────────────────────────┤
│ {                                                 │
│   "items": [                                      │
│     {                                             │
│       "id": "msg-1",                              │
│       "original_content": "Hola",                 │
│       "original_language": "es",                  │
│       "translated_content": "Bonjour"  ← Si en   │
│     },                                       cache│
│     {                                             │
│       "id": "msg-2",                              │
│       "original_content": "Hello",                │
│       "original_language": "en",                  │
│       "translated_content": null  ← Pas en cache │
│     },                                            │
│     ...                                           │
│   ],                                              │
│   "total": 54,                                    │
│   "page": 1,                                      │
│   "page_size": 50,                                │
│   "has_more": true                                │
│ }                                                 │
└───────────────────────────────────────────────────┘
```

---

## 3. Flux - Tâche de traduction en arrière-plan

```
┌──────────────────────────────────────────────────────────┐
│ BACKGROUND TASK: _cache_translations_batch_bg            │
│ (asyncio.create_task dans FastAPI)                       │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
      ┌──────────────────────────────┐
      │ 1. Re-check cache            │
      │    Skip items already cached │
      │    since requête lancée      │
      └────────────┬─────────────────┘
                   │
                   ▼
      ┌──────────────────────────────┐
      │ 2. Call Ollama (batched)     │
      │    One call for all msgs     │
      │    input: [text1, text2...n] │
      │    output: [trans1, trans2..] │
      │                              │
      │    ⚠️ Semaphore: max 5       │
      │    concurrent calls          │
      └────────────┬─────────────────┘
                   │
                   ▼
      ┌──────────────────────────────┐
      │ 3. Persist to DB             │
      │    INSERT INTO               │
      │    message_translations      │
      │    (message_id, target_lang, │
      │     translated_content)      │
      └────────────┬─────────────────┘
                   │
                   ▼
      ┌──────────────────────────────┐
      │ 4. Push via WebSocket        │
      │    For each msg:             │
      │    {                         │
      │      "type": "message_trans" │
      │      "message_id": "...",    │
      │      "translated_content"    │
      │    }                         │
      └──────────────────────────────┘
```

---

## 4. Flux - WebSocket (temps réel)

Quand un message est envoyé :

```
┌────────────────┐
│ User sends msg │
└────────┬───────┘
         │
         ▼
    ┌─────────────────────────────┐
    │ 1. Save to DB               │
    │    messages.create()        │
    │    commit immediately       │
    └────────────┬────────────────┘
                 │
                 ▼
    ┌─────────────────────────────┐
    │ 2. Broadcast to ALL members │
    │    with original_content    │
    │    translated_content = nil │
    │    (Each user will request  │
    │     their own translation)  │
    └────────────┬────────────────┘
                 │
                 ▼
    ┌─────────────────────────────┐
    │ 3. Background: Translate    │
    │    for EACH member language │
    │    via translate_for_members│
    │    (different from GET list)│
    └────────────┬────────────────┘
                 │
                 ▼
    ┌─────────────────────────────┐
    │ 4. Push translated to each  │
    │    user via WS if different │
    │    from original            │
    └─────────────────────────────┘
```

---

## 5. Les deux services de traduction

### A) `get_messages` (GET)

**Code** : `messages_router.py` ligne 114-157

- **Quand** : Utilisateur scroll/pagine les messages existants
- **Limite** : `_MAX_BG_TRANSLATIONS = 50` (ligne 28, 152)
- **Problème** : Si page 1 retourne 50 messages et que 55+ manquent de traduction, seul les 50 premiers sont traduits. Items 51+ sont **complètement ignorés**.

```python
# Ligne 152 — LE BUG EST ICI
items=to_translate[:_MAX_BG_TRANSLATIONS]  # Coupe à 50 !
```

### B) `translate_for_members` (WebSocket)

**Code** : `messages_router.py` ligne 345-369 et `translation_service.translate_for_members()`

- **Quand** : Nouveau message posté via WebSocket
- **Pas de limite** : Traduit pour TOUS les membres simultanément
- **Pas de bug** : Gère tous les messages

---

## 6. Schéma de cache

```
┌────────────────────────────────────────┐
│ message_translations (table)           │
├────────────────────────────────────────┤
│ id           | UUID (PK)               │
│ message_id   | UUID (FK messages)      │
│ target_lang  | VARCHAR (e.g. "fr")     │
│ trans_cont.  | TEXT (traduction)       │
│ created_at   | TIMESTAMP               │
│                                        │
│ UNIQUE (message_id, target_lang)       │
│ Index: message_id, created_at          │
└────────────────────────────────────────┘

Example:
┌──────────────────────────────────────────┐
│ msg-1 | en | es  | "Hola"    │ 04:01 UTC│
│ msg-1 | en | fr  | "Bonjour" │ 04:01 UTC│
│ msg-1 | en | ko  | "안녕"     │ 04:01 UTC│
│ msg-2 | fr | en  | "Hello"   │ 04:02 UTC│
│ msg-2 | fr | es  | "Hola"    │ 04:02 UTC│
│ msg-3 | -- | --  | (aucune)  │    --    │ ← BUG
└──────────────────────────────────────────┘
```

---

## 7. Diagnostic — Ton problème

**Observation** : 23 messages n'ont aucune traduction.

**Hypothèse** : Quand une page charge, elle fetch 50 messages (page 1). S'il y a plus de 50 messages non traduits, seul les 50 premiers sont envoyés à Ollama. Les messages 51+ **ne sont jamais traduits**.

**Timeline** :
- ~04:01 UTC : 31 messages traduits (batch 1)
- ~04:03 UTC : Autres messages créés, 23 n'ont jamais de batch background
- Raison : Ils arrivent APRÈS le `[:_MAX_BG_TRANSLATIONS]` slice

---

## 8. Solution proposée

**Option 1** : Augmenter `_MAX_BG_TRANSLATIONS` (moins sûr pour la mémoire)
```python
_MAX_BG_TRANSLATIONS = 200  # Au lieu de 50
```

**Option 2** : Boucler sur tous les batches (plus correct)
```python
# Au lieu de:
items=to_translate[:_MAX_BG_TRANSLATIONS]

# Faire:
for batch in [to_translate[i:i+_MAX_BG_TRANSLATIONS] 
              for i in range(0, len(to_translate), _MAX_BG_TRANSLATIONS)]:
    background_tasks.add_task(_cache_translations_batch_bg, ..., items=batch)
```

**Option 3** : Traduire au clic (frontend) plutôt qu'au chargement

---

## 9. Commandes SQL pour investiguer

```sql
-- Messages sans traduction
SELECT COUNT(*) 
FROM messages m
WHERE NOT EXISTS (
  SELECT 1 FROM message_translations mt WHERE mt.message_id = m.id
);

-- Traductions par message
SELECT m.id, COUNT(DISTINCT mt.target_language) as lang_count
FROM messages m
LEFT JOIN message_translations mt ON m.id = mt.message_id
GROUP BY m.id
ORDER BY lang_count, m.created_at DESC;

-- Timestamp de la coupure
SELECT 
  'Traduits' as status, MAX(created_at) as latest
FROM messages m
WHERE EXISTS (SELECT 1 FROM message_translations WHERE message_id = m.id)
UNION ALL
SELECT 
  'Non traduits', MAX(created_at)
FROM messages m
WHERE NOT EXISTS (SELECT 1 FROM message_translations WHERE message_id = m.id);
```

---

## Résumé

| Aspect | Détail |
|--------|--------|
| **Lieu de traduction** | À l'affichage (GET / WebSocket), pas stockage |
| **Cache** | `message_translations` table en PostgreSQL |
| **Batch size** | 50 messages max par appel Ollama (GET) |
| **Bug** | Items 51+ ignorés si `to_translate.length > 50` |
| **Symptôme** | 23 messages sans traduction (après timestamp 04:03 UTC) |
| **Impact** | Utilisateurs voient la langue originale au lieu de traduction |
| **Fix** | Boucler sur les batches ou augmenter la limite |

