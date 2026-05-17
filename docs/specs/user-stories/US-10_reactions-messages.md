# US-10 — Réactions aux messages (emoji pills)

## Description
En tant qu'utilisateur, je veux voir les réactions emoji sous les messages et pouvoir interagir avec elles, afin d'exprimer une réponse rapide sans écrire un message.

## Critères d'acceptance

- [ ] Les réactions sont affichées sous le contenu du message sous forme de "pills" : emoji + compteur, fond `rgba(255,255,255,.05)`, bordure subtile, `border-radius: 99px`, police 10px gras
- [ ] En mode clair, les pills ont un fond `rgba(0,0,0,.02)` et bordure `rgba(0,0,0,.05)`
- [ ] Au survol d'une pill : scale 1.05, fond `brand-orange/10`, bordure `brand-orange/30`
- [ ] Cliquer sur une réaction existante envoie `POST /api/v1/messages/{id}/reactions` avec l'emoji ; si l'utilisateur a déjà réagi avec cet emoji, la réaction est retirée (toggle)
- [ ] Le compteur se met à jour immédiatement (optimistic update)
- [ ] Les réactions sont issues du champ `reactions` retourné par le endpoint de messages
- [ ] Les pills sont disposées en flex-wrap horizontal sous le message (`flex gap-1.5 mt-2 flex-wrap`)
