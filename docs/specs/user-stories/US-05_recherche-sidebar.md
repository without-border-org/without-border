# US-05 — Barre de recherche dans la sidebar

## Description
En tant qu'utilisateur, je veux pouvoir rechercher un canal ou une conversation directe via une barre de recherche dans la sidebar, afin de naviguer rapidement sans parcourir toute la liste.

## Critères d'acceptation

- [ ] Une barre de recherche est placée sous le logo dans la sidebar gauche, avec une icône loupe à gauche et le placeholder "Rechercher..."
- [ ] Le champ a un style cohérent avec le thème (fond panel, bordure subtile, focus orange/30)
- [ ] La saisie filtre en temps réel les canaux d'équipe ET les conversations directes affichés dans la sidebar (filtrage local, sans appel API supplémentaire)
- [ ] La recherche est insensible à la casse et porte sur le nom du canal/utilisateur
- [ ] Si aucun résultat : les sections "Équipes" et "Binômes" sont vides (pas de message d'erreur requis dans cette version)
- [ ] Effacer le champ restaure la liste complète
