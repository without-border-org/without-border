# US-01 — Layout principal 3 colonnes

## Description
En tant qu'utilisateur authentifié, je veux accéder à une interface structurée en 3 colonnes (sidebar gauche, zone de chat centrale, sidebar droite optionnelle) afin de naviguer efficacement dans l'application.

## Critères d'acceptation

- [ ] La sidebar gauche (largeur fixe 256px) est toujours visible, contient le logo/nom "WithoutBorder", la recherche, la navigation et la carte profil
- [ ] La zone centrale occupe tout l'espace restant et contient un header fixe (64px), une zone de messages scrollable et le compositeur en bas
- [ ] La sidebar droite (340px) est masquée par défaut ; elle se superpose à droite sans réduire la zone centrale
- [ ] Le layout couvre toute la hauteur de la fenêtre (`h-screen`, `overflow-hidden`)
- [ ] Sur chaque section, les scrollbars custom (5px, style discret) sont appliquées sur les zones de contenu dépassant la hauteur
- [ ] La route `/chat/:channelId` charge ce layout ; la route protégée par `authGuard` redirige vers Keycloak si non authentifié
- [ ] Le layout est le composant shell de la feature chat (remplace le design Angular actuel)
