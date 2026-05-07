# US-11 — Messages Agentic (style et badge)

## Description
En tant qu'utilisateur, je veux que les messages générés par l'IA (Agentic) soient visuellement distincts des messages humains, afin de savoir immédiatement qu'il s'agit d'une réponse automatisée.

## Critères d'acceptation

- [ ] Un message Agentic (`is_agentic = true`) affiche un badge `AGENTIC` orange (`bg-brand-orange/20 text-brand-orange`, 8px, gras, uppercase) dans la ligne de métadonnées, à la suite des autres badges
- [ ] Le contenu d'un message Agentic a un fond plein orange (`bg-brand-orange text-white`) avec une ombre `shadow-lg shadow-orange-500/20` au lieu du style panel standard
- [ ] Dans la sidebar gauche (section Binômes), un interlocuteur en mode agentic affiche un badge `AGENTIC` orange à la place de son rôle, et son point de statut est orange
- [ ] Dans la sidebar droite (participants), les utilisateurs en mode agentic affichent un badge `AGENTIC` orange à droite de leur nom
- [ ] La distinction visuelle est appliquée aussi bien en mode dark qu'en mode light
- [ ] Le champ `is_agentic` du modèle `Message` (backend) est la source de vérité pour ce flag
