# US-14 — Panel participants (sidebar droite)

## Description
En tant qu'utilisateur, je veux ouvrir un panneau latéral droit listant les participants du canal actif avec leur statut, afin de savoir qui est présent sans quitter la conversation.

## Critères d'acceptation

- [ ] La sidebar droite est masquée par défaut (`transform: translateX(100%)`, `width: 0`, `opacity: 0`)
- [ ] Cliquer sur le groupe d'avatars dans le header du canal bascule (toggle) l'état visible/masqué de la sidebar
- [ ] Quand elle est visible, la sidebar fait 340px de large, glisse depuis la droite avec une transition CSS (`transition: all 0.25s cubic-bezier(.4,0,.2,1)`)
- [ ] Elle a un header de 64px avec le titre "Participants" et le nombre entre parenthèses (ex. `(5)`), et un bouton ✕ pour fermer
- [ ] Chaque participant est affiché en liste avec : avatar rond (initiales, couleur utilisateur), indicateur de statut (point en bas à droite de l'avatar : vert/online, orange/agentic, gris/offline), nom complet, rôle, et badge `AGENTIC` si statut agentic
- [ ] Les données de participants viennent de `GET /api/v1/channels/{id}/members` enrichies par le statut de chaque utilisateur
- [ ] La liste est scrollable si elle dépasse la hauteur disponible (scrollbar custom)
- [ ] Fermer la sidebar droite via ✕ ou en recliquant le groupe d'avatars la replie avec la même animation
