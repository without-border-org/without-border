# US-18 — Envoi et réception de messages en temps réel (WebSocket)

## Description
En tant qu'utilisateur, je veux que les messages s'échangent en temps réel via WebSocket, afin de voir immédiatement les nouveaux messages sans recharger la page.

## Critères d'acceptance

- [ ] À la sélection d'un canal, `ChatWsService` ouvre une connexion WebSocket sur `ws://.../ws/channels/{id}?token={jwt}`
- [ ] À la fermeture/changement de canal, la connexion WebSocket précédente est proprement fermée
- [ ] Un message envoyé via le compositeur est transmis au WebSocket ; en cas d'échec de connexion, un repli sur `POST /api/v1/channels/{id}/messages` est effectué
- [ ] Les messages reçus via WebSocket (de soi ou d'un autre membre) sont ajoutés en bas de la liste en temps réel
- [ ] La liste auto-scrolle vers le bas à la réception d'un nouveau message (si l'utilisateur était déjà en bas)
- [ ] Le type d'événement WebSocket `WsEvent` comprend au moins le type `new_message` avec les données du message ; d'autres types (typing, presence) peuvent être ignorés dans cette version
- [ ] En cas de déconnexion WebSocket, une tentative de reconnexion automatique est effectuée (max 3 tentatives avec backoff)
