# US-19 — Affichage des traductions automatiques par message

## Description
En tant qu'utilisateur, je veux lire les messages dans ma langue native grâce à la traduction automatique, et savoir quand un message a été traduit, afin de collaborer avec des collègues qui parlent d'autres langues.

## Critères d'acceptation

- [ ] Chaque message affiche un badge de langue originale (ex. `GB`, `ES`, `FR`, `KR`) dans la ligne de métadonnées
- [ ] Si la langue originale du message (`original_language`) est différente de la langue préférée de l'utilisateur courant (`preferred_language`), le contenu affiché est `translated_content` (retourné par le backend)
- [ ] Dans ce cas, un label "traduit" avec l'icône `文` est affiché en orange dans la ligne de métadonnées (à droite du badge langue)
- [ ] Si aucune traduction n'est disponible (`translated_content` null ou absent), le message original est affiché tel quel, sans label "traduit"
- [ ] La langue préférée de l'utilisateur courant est récupérée via `GET /api/v1/users/me` (`preferred_language`)
- [ ] Le mapping `preferred_language` → code badge (ex. `fr` → `FR`, `en` → `GB`, `es` → `ES`, `ko` → `KR`, `zh` → `CN`) est géré côté frontend dans un objet de correspondance
- [ ] La traduction est générée côté backend (via Gemma 4 / Ollama ou Vertex AI) et mise en cache dans la table `MessageTranslation` ; le frontend ne déclenche pas de traduction à la volée
