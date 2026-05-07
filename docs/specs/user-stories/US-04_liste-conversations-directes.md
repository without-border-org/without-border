# US-04 — Liste des conversations directes (Binômes / DMs)

## Description
En tant qu'utilisateur, je veux voir la liste de mes conversations directes dans la sidebar, avec le statut et le rôle de chaque interlocuteur, afin de contacter rapidement un collègue.

## Critères d'acceptation

- [ ] La section "Binômes" affiche un label `BINÔMES` en capitales, 10px, gris
- [ ] Chaque DM affiche : un avatar initialisé (2 lettres, couleur unique par utilisateur), un indicateur de statut (point coloré en bas à droite de l'avatar), le nom complet, et le rôle de l'utilisateur OU un badge "AGENTIC" orange si le statut est `agentic`
- [ ] Statuts et couleurs : `online` → point vert, `agentic` → point orange, `offline` → point gris
- [ ] Le DM actif applique le même style que le canal actif (fond orange/10, texte orange, bordure gauche)
- [ ] La liste est chargée depuis `GET /api/v1/channels` (filtrée sur `type = 'pair'`)
- [ ] Un clic sur un DM le rend actif et charge la conversation dans la zone centrale
- [ ] L'avatar utilise les initiales et une couleur cohérente avec l'identité de l'utilisateur (dérivée du backend ou de la seed)
