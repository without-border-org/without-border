# US-17 — Chargement et pagination des messages

## Description
En tant qu'utilisateur, je veux que les messages d'un canal se chargent depuis l'API avec pagination, afin de ne pas alourdir l'interface sur des canaux avec beaucoup d'historique.

## Critères d'acceptation

- [ ] Lors de la sélection d'un canal, `GET /api/v1/channels/{id}/messages?page=1&page_size=50` est appelé et les 50 derniers messages sont affichés
- [ ] La réponse utilise le schéma `PaginatedMessages` du backend : `items`, `total`, `page`, `page_size`, `pages`
- [ ] Si `pages > 1`, un mécanisme de chargement des messages plus anciens est disponible : soit un bouton "Charger plus" en haut de la liste, soit un scroll infini vers le haut (appel page suivante quand scroll atteint le top)
- [ ] Les messages nouvellement chargés (anciens) sont insérés en haut de la liste sans perturber la position de scroll actuelle
- [ ] Chaque message retourné inclut son `translated_content` dans la langue de l'utilisateur courant (le backend retourne déjà la traduction si disponible)
- [ ] Un indicateur de chargement (spinner) est affiché pendant le fetch initial du canal
- [ ] Si le canal change, la liste est vidée et rechargée depuis la page 1
