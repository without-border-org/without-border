# Cache de Traductions — Réactivation

## Problème

Le cache était désactivé dans un commit précédent. Tous les messages étaient traduits à chaque fois (pas d'optimisation).

## Solution

Réactivation complète du cache avec deux points de vérification :

### 1. GET /messages — Lecture du cache

```python
# Ligne 164-167 de messages_router.py
cached = await msg_repo.get_cached_translation(msg.id, current_user.preferred_language)
if cached:
    translated = cached  # Utilise la traduction en cache
    _log.debug(f"[GET-MESSAGES-CACHE-HIT] message_id={msg.id}")
else:
    to_translate.append((msg.id, msg.original_content))  # Ajoute à traduire
```

**Résultat** : Les messages traduits retournent immédiatement sans attendre Ollama.

### 2. Background Task — Vérification et persistance

```python
# Ligne 55-69 : Recheck cache (déduplication)
for msg_id, text in items:
    cached = await msg_repo_bg.get_cached_translation(msg_id, target_lang)
    if not cached:
        pending.append((msg_id, text))
# Si tout est en cache, skip la traduction

# Ligne 95-106 : Enregistrement en cache après Ollama
for msg_id, translated_content in zip(pending, translations):
    await msg_repo_persist.save_translation(msg_id, target_lang, translated_content)
```

**Résultat** : 
- Les traductions d'Ollama sont stockées en cache
- Les requêtes concurrentes bénéficient du cache
- Pas de retranslation inutile

## Flux complet

```
Requête 1 (User A, français):
├─ GET /messages
├─ Message "Hola" pas en cache
├─ Ajoute à to_translate[]
├─ Background: Ollama traduit
└─ ENREGISTRE en cache (msg1, "fr", "Bonjour")

Requête 2 (User A, français) :
├─ GET /messages
├─ Cherche en cache → TROUVE! "Bonjour"
├─ Retourne immédiatement
└─ Pas d'appel Ollama (gain: ~0.5-2s)

Requête 3 (User B, français, même channel):
├─ GET /messages
├─ Cherche en cache → TROUVE! "Bonjour" (bénéfice du cache de User A)
├─ Retourne immédiatement
└─ Pas d'appel Ollama
```

## Table de cache

```sql
message_translations (
  id UUID PRIMARY KEY,
  message_id UUID FK,
  target_lang VARCHAR(5),  -- "fr", "es", "en", etc.
  translated_content TEXT,
  created_at TIMESTAMP,
  
  UNIQUE(message_id, target_lang)
)
```

**Constraints** :
- Une seule traduction par message+language
- Les traductions de User A, User B, User C sont identiques (déduplicatas)
- Tous les users bénéficient du cache

## Améliorations

✓ Cache lecture : `get_cached_translation()` in GET /messages
✓ Cache écriture : `save_translation()` in background task
✓ Deduplication : Recheck cache dans background task
✓ Pas de colonne `requested_user` (global cache, pas per-user)

## Performance

| Scénario | Sans cache | Avec cache |
|----------|-----------|-----------|
| 1ère requête, 50 msgs | ~2s (Ollama) | ~2s (Ollama) + WS |
| 2e requête, même user | ~2s (Ollama) | <100ms (cache hit) |
| Autre user, même msgs | ~2s (Ollama) | <100ms (cache hit) |

**Economie** : ~90% moins d'appels Ollama après le premier chargement.
