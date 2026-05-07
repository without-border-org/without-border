# US-12 — Compositeur de messages

## Description
En tant qu'utilisateur, je veux pouvoir saisir et envoyer un message dans le canal actif via un compositeur en bas de la zone centrale, afin de participer aux échanges.

## Critères d'acceptation

- [ ] Le compositeur est un bloc arrondi (`rounded-2xl`) collé en bas de la zone centrale, séparé par une bordure supérieure
- [ ] Il contient un `textarea` (3 lignes, `resize-none`, fond transparent, 14px) avec le placeholder "Envoyer un message..."
- [ ] Appuyer sur `Enter` (sans `Shift`) envoie le message ; `Shift+Enter` insère un saut de ligne
- [ ] Le bouton d'envoi (icône avion en papier) est en bas à droite du compositeur : désactivé/grisé (`opacity: 0.22`) quand le champ est vide, actif/orange quand du texte est présent
- [ ] Cliquer le bouton d'envoi ou appuyer `Enter` envoie le message via le WebSocket (`chat-ws.service`) ; si le WebSocket n'est pas connecté, repli sur `POST /api/v1/channels/{id}/messages`
- [ ] Après l'envoi, le textarea est vidé et le focus est remis dessus
- [ ] Le compositeur est désactivé visuellement si l'utilisateur n'est pas membre du canal actif (cas limite)
- [ ] Le message envoyé apparaît immédiatement dans la liste (optimistic update) avec les métadonnées de l'utilisateur courant
