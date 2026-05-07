# US-03 — Liste des canaux d'équipe (Équipes)

## Description
En tant qu'utilisateur, je veux voir la liste de mes canaux d'équipe dans la sidebar gauche avec un indicateur du nombre de messages, afin de naviguer rapidement vers le bon canal.

## Critères d'acceptance

- [ ] La section "Équipes" affiche un label `ÉQUIPES` en capitales, 10px, gris, dans la sidebar gauche
- [ ] Chaque canal d'équipe est listé avec : un numéro de position (ex. `#1`, opacité 40%), le nom du canal (tronqué si long), et un badge orange arrondi affichant le nombre de messages si > 0
- [ ] Le canal actif est mis en évidence : fond orange à 10%, texte orange, bordure gauche 3px orange, border-radius 0 8px 8px 0
- [ ] Un clic sur un canal le rend actif et charge ses messages dans la zone centrale
- [ ] La liste est chargée depuis `GET /api/v1/channels` (filtrée sur `type = 'team'`) et reflète uniquement les canaux dont l'utilisateur est membre
- [ ] La liste est scrollable si elle dépasse la hauteur disponible (scrollbar custom 5px)
- [ ] Un canal archivé n'apparaît pas dans la liste
