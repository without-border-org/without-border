# US-08 — Affichage de la liste de messages

## Description
En tant qu'utilisateur, je veux voir les messages du canal actif dans une zone scrollable entre le header et le compositeur, afin de lire les échanges de l'équipe.

## Critères d'acceptation

- [ ] La zone de messages occupe tout l'espace vertical entre le header (64px) et le compositeur, avec un padding de `pt-24 pb-4 px-6`
- [ ] Les messages sont affichés en ordre chronologique croissant (le plus ancien en haut)
- [ ] Chaque message est espacé des autres (`space-y-6`)
- [ ] La zone est scrollable verticalement avec la scrollbar custom (5px discrète)
- [ ] Au chargement d'un canal, le scroll est positionné automatiquement en bas (dernier message visible)
- [ ] Lors de l'envoi ou la réception d'un nouveau message, le scroll se remet en bas automatiquement
- [ ] Les messages sont chargés depuis `GET /api/v1/channels/{id}/messages?page=1&page_size=50`
- [ ] Si le canal n'a pas encore de messages, la zone est vide (pas de message d'état requis dans cette version)
