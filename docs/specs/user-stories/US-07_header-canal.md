# US-07 — Header de canal (zone principale)

## Description
En tant qu'utilisateur, je veux voir dans le header de la zone principale les informations du canal actif et les avatars des participants, afin d'avoir le contexte du canal sans ouvrir la sidebar droite.

## Critères d'acceptation

- [ ] Le header est positionné en fixe sur 64px en haut de la zone centrale (glass effect : `backdrop-filter: blur(12px)`)
- [ ] À gauche : une icône de canal (icône groupe SVG pour un canal d'équipe, initiales de l'interlocuteur pour un DM) dans un fond `orange/10`, suivie du nom du canal (gras, 14px) et d'un sous-titre (10px, gris) — le sous-titre est le nom du workspace pour les équipes, le rôle pour les DMs
- [ ] À droite : un groupe d'avatars empilés (`-space-x-2.5`) affichant jusqu'à 3 participants avec leurs initiales et couleurs, puis un badge `+N` gris pour le reste
- [ ] Cliquer sur le groupe d'avatars ouvre/ferme la sidebar droite des participants (voir US-14)
- [ ] Les données d'avatars dans le header sont issues des membres du canal (`GET /api/v1/channels/{id}/members`)
- [ ] Le header se met à jour automatiquement lors du changement de canal actif
