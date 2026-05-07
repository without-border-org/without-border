# US-16 — Chargement des canaux depuis l'API backend

## Description
En tant qu'utilisateur, je veux que la liste des canaux et conversations directes soit chargée dynamiquement depuis le backend, afin de voir uniquement mes espaces réels.

## Critères d'acceptation

- [ ] Au chargement du layout chat, le service `ChannelService` appelle `GET /api/v1/channels` avec le token Bearer de l'utilisateur courant
- [ ] La réponse est séparée en deux listes : `teams` (type `team`) et `dms` (type `pair`), chacune alimentant la section correspondante de la sidebar
- [ ] Si l'appel échoue (401/403/500), un état d'erreur discret est affiché (ex. texte gris "Impossible de charger les canaux") sans bloquer l'interface
- [ ] Un indicateur de chargement (skeleton ou spinner) est affiché pendant la requête dans les sections sidebar
- [ ] Les membres du canal sont chargés via `GET /api/v1/channels/{id}/members` au moment de la sélection d'un canal (lazy load, pas en amont)
- [ ] Le badge de comptage de messages dans la sidebar (US-03) est calculé côté frontend à partir du nombre de messages retournés par `GET /channels/{id}/messages` pour le canal actif (pas en temps réel pour tous les canaux dans cette version)
